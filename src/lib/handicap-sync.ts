/**
 * GHIN Handicap Sync Service
 *
 * Fetches current Handicap Index values from the GHIN API for golfers
 * with a GHIN number on file. Uses the unofficial GHIN mobile app API
 * (same endpoints wrapped by @spicygolf/ghin) directly — no external
 * dependency, so we can patch endpoints if USGA changes them.
 *
 * Authentication: Requires a GHIN Digital Profile (email + password)
 * stored as GHIN_EMAIL and GHIN_PASSWORD environment variables.
 *
 * Rate limiting: 2-second delay between requests to avoid triggering
 * GHIN rate limits. Batch cap of 20 golfers per invocation to stay
 * within Vercel's 60-second function timeout.
 *
 * Graceful degradation: If env vars are missing, auth fails, or the
 * API is down, the sync silently skips or logs errors without
 * affecting any other app functionality.
 */

import { createAdminClient } from "@/lib/supabase/server";

// ============================================================
// Configuration
// ============================================================

const GHIN_API_BASE = "https://api2.ghin.com/api/v1";
const GHIN_LOGIN_URL = `${GHIN_API_BASE}/golfer_login.json`;

/** Max golfers to process per cron invocation (Vercel 60s timeout) */
const BATCH_SIZE = 20;

/** Delay between API requests in milliseconds */
const THROTTLE_MS = 2000;

/** Handicap is considered fresh if updated within this many hours */
const FRESHNESS_HOURS = 24;

/** Number of consecutive failures before alerting admin */
const CONSECUTIVE_FAILURE_THRESHOLD = 3;

// ============================================================
// GHIN API Client
// ============================================================

interface GhinAuthResponse {
  golfer_user: {
    golfer_user_token: string;
    ghin_number: number;
  };
}

interface GhinGolferResponse {
  golfers: Array<{
    ghin_number: string;
    handicap_index: string | number | null;
    first_name: string;
    last_name: string;
    status: string;
  }>;
}

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Authenticate with the GHIN API using Digital Profile credentials.
 * Returns a bearer token. Caches the token for reuse within the same
 * function invocation.
 */
async function authenticateGhin(): Promise<string> {
  const email = process.env.GHIN_EMAIL;
  const password = process.env.GHIN_PASSWORD;

  if (!email || !password) {
    throw new Error("GHIN_EMAIL and GHIN_PASSWORD environment variables are required");
  }

  // Return cached token if still valid (with 5-minute buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  const response = await fetch(GHIN_LOGIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      token: "recaptcha-disabled",
      user: {
        email_or_ghin: email,
        password,
        remember_me: true,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GHIN auth failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as GhinAuthResponse;
  const token = data?.golfer_user?.golfer_user_token;

  if (!token) {
    throw new Error("GHIN auth response missing token");
  }

  cachedToken = token;
  // Tokens typically last ~24 hours; cache for 1 hour to be safe
  tokenExpiresAt = Date.now() + 60 * 60 * 1000;

  return token;
}

/**
 * Fetch the current handicap index for a single GHIN number.
 * Returns null if the golfer is not found or has no handicap.
 */
async function fetchHandicapIndex(
  ghinNumber: string,
  token: string
): Promise<number | null> {
  const url = `${GHIN_API_BASE}/golfers/search.json?per_page=1&page=1&golfer_id=${encodeURIComponent(ghinNumber)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GHIN lookup failed for ${ghinNumber} (${response.status}): ${text}`);
  }

  const data = (await response.json()) as GhinGolferResponse;

  if (!data.golfers || data.golfers.length === 0) {
    console.log(`GHIN lookup: No golfer found for GHIN# ${ghinNumber}`);
    return null;
  }

  const golfer = data.golfers[0];
  const handicapIndex = golfer.handicap_index;

  if (handicapIndex === null || handicapIndex === undefined || handicapIndex === "NH") {
    console.log(`GHIN lookup: No handicap on file for GHIN# ${ghinNumber}`);
    return null;
  }

  const parsed = typeof handicapIndex === "string"
    ? parseFloat(handicapIndex)
    : handicapIndex;

  if (isNaN(parsed)) {
    console.log(`GHIN lookup: Invalid handicap value "${handicapIndex}" for GHIN# ${ghinNumber}`);
    return null;
  }

  return parsed;
}

/** Throttle helper */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// Sync Orchestration
// ============================================================

interface SyncResult {
  success: boolean;
  totalGolfers: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  errorMessage?: string;
}

/**
 * Run a handicap sync for all golfers subscribed to the given event.
 *
 * - Skips golfers without GHIN numbers.
 * - Skips golfers whose handicap was updated within FRESHNESS_HOURS.
 * - Processes up to BATCH_SIZE golfers per invocation.
 * - Updates profiles.handicap_index and profiles.handicap_updated_at on success.
 * - Logs the run to handicap_sync_log for health monitoring.
 */
export async function runHandicapSync(eventId: string): Promise<SyncResult> {
  const supabase = createAdminClient();

  // Create a sync log entry
  const { data: logEntry, error: logError } = await supabase
    .from("handicap_sync_log")
    .insert({
      event_id: eventId,
      status: "running",
    })
    .select("id")
    .single();

  if (logError) {
    console.error("Failed to create handicap sync log entry:", logError);
  }

  const logId = logEntry?.id;

  try {
    // Authenticate with GHIN
    let token: string;
    try {
      token = await authenticateGhin();
    } catch (authError) {
      const errorMsg = authError instanceof Error ? authError.message : "Unknown auth error";
      console.error("GHIN authentication failed:", errorMsg);

      // Update log entry
      if (logId) {
        await supabase
          .from("handicap_sync_log")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: errorMsg,
          })
          .eq("id", logId);
      }

      return {
        success: false,
        totalGolfers: 0,
        successCount: 0,
        failureCount: 0,
        skippedCount: 0,
        errorMessage: errorMsg,
      };
    }

    // Get all active golfers subscribed to this event with GHIN numbers
    const { data: golfers, error: golfersError } = await supabase
      .from("event_subscriptions")
      .select(`
        profile:profiles!inner(
          id,
          first_name,
          last_name,
          ghin_number,
          handicap_index,
          handicap_updated_at
        )
      `)
      .eq("event_id", eventId)
      .eq("is_active", true)
      .not("profile.ghin_number", "is", null)
      .neq("profile.ghin_number", "");

    if (golfersError) throw golfersError;

    if (!golfers || golfers.length === 0) {
      console.log("No golfers with GHIN numbers found for sync");

      if (logId) {
        await supabase
          .from("handicap_sync_log")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            total_golfers: 0,
          })
          .eq("id", logId);
      }

      return {
        success: true,
        totalGolfers: 0,
        successCount: 0,
        failureCount: 0,
        skippedCount: 0,
      };
    }

    // Filter and sort: skip recently updated, prioritize stalest first
    const freshnessThreshold = new Date(
      Date.now() - FRESHNESS_HOURS * 60 * 60 * 1000
    ).toISOString();

    type GolferProfile = {
      id: string;
      first_name: string;
      last_name: string;
      ghin_number: string;
      handicap_index: number | null;
      handicap_updated_at: string | null;
    };

    const allProfiles: GolferProfile[] = golfers
      .map((g) => g.profile as unknown as GolferProfile)
      .filter((p): p is GolferProfile => !!p && !!p.ghin_number);

    const needsUpdate = allProfiles.filter(
      (p) => !p.handicap_updated_at || p.handicap_updated_at < freshnessThreshold
    );

    const skippedCount = allProfiles.length - needsUpdate.length;

    // Sort: never-synced first, then oldest first
    needsUpdate.sort((a, b) => {
      if (!a.handicap_updated_at && b.handicap_updated_at) return -1;
      if (a.handicap_updated_at && !b.handicap_updated_at) return 1;
      if (!a.handicap_updated_at && !b.handicap_updated_at) return 0;
      return a.handicap_updated_at!.localeCompare(b.handicap_updated_at!);
    });

    // Apply batch limit
    const batch = needsUpdate.slice(0, BATCH_SIZE);
    const totalGolfers = allProfiles.length;

    console.log(
      `Handicap sync: ${totalGolfers} total, ${skippedCount} fresh, ${needsUpdate.length} need update, processing ${batch.length}`
    );

    let successCount = 0;
    let failureCount = 0;

    for (const profile of batch) {
      try {
        const handicapIndex = await fetchHandicapIndex(profile.ghin_number, token);

        if (handicapIndex !== null) {
          const now = new Date().toISOString();
          const { error: updateError } = await supabase
            .from("profiles")
            .update({
              handicap_index: handicapIndex,
              handicap_updated_at: now,
            })
            .eq("id", profile.id);

          if (updateError) {
            console.error(
              `Failed to update handicap for ${profile.first_name} ${profile.last_name}:`,
              updateError
            );
            failureCount++;
          } else {
            // Record history for trend tracking
            await supabase
              .from("handicap_history")
              .insert({
                profile_id: profile.id,
                handicap_index: handicapIndex,
                source: "ghin_sync",
                recorded_at: now,
              });

            console.log(
              `Updated handicap for ${profile.first_name} ${profile.last_name}: ${handicapIndex}`
            );
            successCount++;
          }
        } else {
          // No handicap found — still mark as "attempted" so we don't retry immediately
          await supabase
            .from("profiles")
            .update({
              handicap_updated_at: new Date().toISOString(),
            })
            .eq("id", profile.id);
          successCount++; // Count as success (we got a valid API response)
        }
      } catch (err) {
        console.error(
          `GHIN lookup error for ${profile.first_name} ${profile.last_name} (GHIN# ${profile.ghin_number}):`,
          err
        );
        failureCount++;
      }

      // Throttle between requests
      if (batch.indexOf(profile) < batch.length - 1) {
        await delay(THROTTLE_MS);
      }
    }

    // Update log entry
    const status = failureCount > 0 && successCount === 0 ? "failed" : "completed";

    if (logId) {
      await supabase
        .from("handicap_sync_log")
        .update({
          status,
          completed_at: new Date().toISOString(),
          total_golfers: totalGolfers,
          success_count: successCount,
          failure_count: failureCount,
          skipped_count: skippedCount,
          error_message:
            failureCount > 0
              ? `${failureCount} of ${batch.length} lookups failed`
              : null,
        })
        .eq("id", logId);
    }

    console.log(
      `Handicap sync complete: ${successCount} updated, ${failureCount} failed, ${skippedCount} skipped`
    );

    return {
      success: status === "completed",
      totalGolfers,
      successCount,
      failureCount,
      skippedCount,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("Handicap sync error:", errorMsg);

    if (logId) {
      await supabase
        .from("handicap_sync_log")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: errorMsg,
        })
        .eq("id", logId);
    }

    return {
      success: false,
      totalGolfers: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      errorMessage: errorMsg,
    };
  }
}

// ============================================================
// Health Check Helpers
// ============================================================

/**
 * Check if GHIN credentials are configured.
 * Returns true if both GHIN_EMAIL and GHIN_PASSWORD are set.
 */
export function isGhinConfigured(): boolean {
  return !!(process.env.GHIN_EMAIL && process.env.GHIN_PASSWORD);
}

/**
 * Check if a handicap sync is needed for an event.
 * Returns true if:
 *   1. handicap_sync_enabled is true for the event
 *   2. GHIN credentials are configured
 *   3. No successful sync has run for this event within FRESHNESS_HOURS
 */
export async function needsHandicapSync(eventId: string): Promise<boolean> {
  if (!isGhinConfigured()) return false;

  const supabase = createAdminClient();

  // Check if sync is enabled for this event
  const { data: event } = await supabase
    .from("events")
    .select("handicap_sync_enabled")
    .eq("id", eventId)
    .single();

  if (!event?.handicap_sync_enabled) return false;

  // Check if a successful sync has run recently
  const freshnessThreshold = new Date(
    Date.now() - FRESHNESS_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data: recentSync } = await supabase
    .from("handicap_sync_log")
    .select("id")
    .eq("event_id", eventId)
    .eq("status", "completed")
    .gte("completed_at", freshnessThreshold)
    .limit(1)
    .maybeSingle();

  return !recentSync;
}

/**
 * Check the count of consecutive recent failures for an event.
 * Used to determine if an admin alert should be sent.
 */
export async function getConsecutiveFailureCount(eventId: string): Promise<number> {
  const supabase = createAdminClient();

  // Get the last N sync log entries for this event
  const { data: recentLogs } = await supabase
    .from("handicap_sync_log")
    .select("status")
    .eq("event_id", eventId)
    .order("started_at", { ascending: false })
    .limit(CONSECUTIVE_FAILURE_THRESHOLD);

  if (!recentLogs || recentLogs.length === 0) return 0;

  let consecutiveFailures = 0;
  for (const log of recentLogs) {
    if (log.status === "failed") {
      consecutiveFailures++;
    } else {
      break;
    }
  }

  return consecutiveFailures;
}

/**
 * Get the most recent sync log entry for an event.
 * Used for admin UI status display.
 */
export async function getLatestSyncStatus(eventId: string): Promise<{
  status: "healthy" | "partial" | "failed" | "never";
  lastSyncAt: string | null;
  successCount: number;
  totalGolfers: number;
  failureCount: number;
  errorMessage: string | null;
} | null> {
  const supabase = createAdminClient();

  const { data: latestLog } = await supabase
    .from("handicap_sync_log")
    .select("*")
    .eq("event_id", eventId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestLog) {
    return {
      status: "never",
      lastSyncAt: null,
      successCount: 0,
      totalGolfers: 0,
      failureCount: 0,
      errorMessage: null,
    };
  }

  let status: "healthy" | "partial" | "failed";
  if (latestLog.status === "failed") {
    status = "failed";
  } else if (latestLog.failure_count > 0) {
    status = "partial";
  } else {
    status = "healthy";
  }

  return {
    status,
    lastSyncAt: latestLog.completed_at || latestLog.started_at,
    successCount: latestLog.success_count,
    totalGolfers: latestLog.total_golfers,
    failureCount: latestLog.failure_count,
    errorMessage: latestLog.error_message,
  };
}
