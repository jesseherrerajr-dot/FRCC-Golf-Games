import webpush from "web-push";

// Configure VAPID keys once on module load
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:jesseherrerajr@gmail.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Send push notifications to a set of users. Non-throwing — returns
 * counts for logging. Automatically cleans up expired/invalid subscriptions.
 *
 * Accepts any Supabase client (browser, server, or admin) — we use `any`
 * to avoid complex generic threading from the various Supabase client types.
 */
export async function sendPushToUsers(
  supabase: any,
  profileIds: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log("Push: VAPID keys not configured, skipping push notifications");
    return { sent: 0, failed: 0 };
  }

  if (profileIds.length === 0) {
    return { sent: 0, failed: 0 };
  }

  // Fetch all push subscriptions for these users
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, profile_id, endpoint, p256dh_key, auth_key")
    .in("profile_id", profileIds);

  if (error) {
    console.error("Push: Failed to fetch subscriptions:", error.message);
    return { sent: 0, failed: 0 };
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];

  const jsonPayload = JSON.stringify(payload);

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh_key,
            auth: sub.auth_key,
          },
        },
        jsonPayload
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      // 404 or 410 = subscription expired/unsubscribed — clean up
      if (statusCode === 404 || statusCode === 410) {
        expiredIds.push(sub.id);
      }
      failed++;
      console.error(
        `Push: Failed to send to ${sub.endpoint.slice(0, 60)}... (${statusCode || "unknown"})`
      );
    }
  }

  // Clean up expired subscriptions
  if (expiredIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("push_subscriptions")
      .delete()
      .in("id", expiredIds);

    if (deleteError) {
      console.error("Push: Failed to clean expired subs:", deleteError.message);
    } else {
      console.log(`Push: Cleaned ${expiredIds.length} expired subscription(s)`);
    }
  }

  console.log(
    `Push: ${sent} sent, ${failed} failed out of ${subscriptions.length} subscription(s)`
  );

  return { sent, failed };
}
