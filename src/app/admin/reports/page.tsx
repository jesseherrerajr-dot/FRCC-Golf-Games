import { requireSuperAdmin } from "@/lib/auth";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { formatInitialLastName, formatFullName } from "@/lib/format";
import { getTodayPacific } from "@/lib/timezone";
import { ReportsClient } from "./reports-client";

export default async function AdminReportsPage() {
  const { supabase } = await requireSuperAdmin();

  const today = getTodayPacific();

  // ============================================================
  // 1. Golfer Engagement (RSVP-based stats per golfer)
  // ============================================================

  // Get all active events
  const { data: allEvents } = await supabase
    .from("events")
    .select("id, name")
    .eq("is_active", true);

  const eventNameMap: Record<string, string> = {};
  for (const ev of allEvents || []) {
    eventNameMap[ev.id] = ev.name;
  }

  // Get recent past schedules (last 12 weeks) across all active events
  const { data: recentSchedules } = await supabase
    .from("event_schedules")
    .select("id, game_date, event_id, status")
    .eq("status", "scheduled")
    .lte("game_date", today)
    .order("game_date", { ascending: false })
    .limit(300);

  // Group schedules by event, take last 12 per event
  const schedulesByEvent: Record<string, { id: string; game_date: string }[]> = {};
  for (const sched of recentSchedules || []) {
    if (!schedulesByEvent[sched.event_id]) {
      schedulesByEvent[sched.event_id] = [];
    }
    if (schedulesByEvent[sched.event_id].length < 12) {
      schedulesByEvent[sched.event_id].push({ id: sched.id, game_date: sched.game_date });
    }
  }

  // Build per-golfer engagement stats
  type GolferEngagement = {
    id: string;
    name: string;
    email: string;
    eventName: string;
    eventId: string;
    totalInvites: number;        // How many weeks they were on the distribution list
    totalResponses: number;      // How many times they responded (any status except no_response)
    totalIn: number;             // How many times they said "In"
    totalOut: number;            // How many times they said "Out"
    totalNotSure: number;
    totalNoResponse: number;
    responseRate: number;        // % of invites they responded to
    participationRate: number;   // % of invites they said "In"
    consecutiveNoReplies: number;
    lastResponseDate: string | null;
  };

  const engagementData: GolferEngagement[] = [];

  for (const [eventId, schedules] of Object.entries(schedulesByEvent)) {
    if (schedules.length === 0) continue;

    const scheduleIds = schedules.map((s) => s.id);

    // Get all RSVPs for these schedules
    const { data: rsvps } = await supabase
      .from("rsvps")
      .select("profile_id, schedule_id, status, responded_at")
      .in("schedule_id", scheduleIds);

    // Get subscribed golfers for this event
    const { data: subscriptions } = await supabase
      .from("event_subscriptions")
      .select("profile_id, profiles(id, first_name, last_name, email, status)")
      .eq("event_id", eventId);

    const activeSubscribers = (subscriptions || []).filter(
      (sub: any) => sub.profiles?.status === "active"
    );

    for (const sub of activeSubscribers) {
      const profile = sub.profiles as any;
      if (!profile) continue;

      let totalIn = 0;
      let totalOut = 0;
      let totalNotSure = 0;
      let totalNoResponse = 0;
      let consecutiveNoReplies = 0;
      let lastResponseDate: string | null = null;
      let foundFirstResponse = false;

      // Walk through schedules from most recent to oldest
      for (const sched of schedules) {
        const rsvp = (rsvps || []).find(
          (r) => r.profile_id === profile.id && r.schedule_id === sched.id
        );

        const status = rsvp?.status || "no_response";

        if (status === "in" || status === "waitlisted") totalIn++;
        else if (status === "out") totalOut++;
        else if (status === "not_sure") totalNotSure++;
        else totalNoResponse++;

        // Track consecutive no-replies from most recent
        if (!foundFirstResponse) {
          if (status === "no_response") {
            consecutiveNoReplies++;
          } else {
            foundFirstResponse = true;
            lastResponseDate = sched.game_date;
          }
        }
      }

      const totalInvites = schedules.length;
      const totalResponses = totalIn + totalOut + totalNotSure;

      engagementData.push({
        id: profile.id,
        name: formatFullName(profile.first_name, profile.last_name),
        email: profile.email,
        eventName: eventNameMap[eventId] || "Unknown Event",
        eventId,
        totalInvites,
        totalResponses,
        totalIn,
        totalOut,
        totalNotSure,
        totalNoResponse,
        responseRate: totalInvites > 0 ? Math.round((totalResponses / totalInvites) * 100) : 0,
        participationRate: totalInvites > 0 ? Math.round((totalIn / totalInvites) * 100) : 0,
        consecutiveNoReplies,
        lastResponseDate,
      });
    }
  }

  // Sort by response rate ascending (worst engagement first)
  engagementData.sort((a, b) => a.responseRate - b.responseRate || b.consecutiveNoReplies - a.consecutiveNoReplies);

  // Calculate aggregate stats
  const totalGolfers = engagementData.length;
  const avgResponseRate = totalGolfers > 0
    ? Math.round(engagementData.reduce((sum, g) => sum + g.responseRate, 0) / totalGolfers)
    : 0;
  const avgParticipationRate = totalGolfers > 0
    ? Math.round(engagementData.reduce((sum, g) => sum + g.participationRate, 0) / totalGolfers)
    : 0;
  const ghostCount = engagementData.filter((g) => g.consecutiveNoReplies >= 3).length;

  // ============================================================
  // 2. Activity Log (logins & page views)
  // ============================================================
  // Fetch login counts per golfer (last 12 weeks = 84 days)
  const twelveWeeksAgoMs = new Date(Date.now() - 84 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentLogins } = await supabase
    .from("activity_log")
    .select("profile_id, created_at")
    .eq("activity_type", "login")
    .gte("created_at", twelveWeeksAgoMs);

  const { data: recentPageViews } = await supabase
    .from("activity_log")
    .select("profile_id, page_path, created_at")
    .eq("activity_type", "page_view")
    .gte("created_at", twelveWeeksAgoMs);

  // Aggregate logins per golfer
  const loginsByGolfer: Record<string, number> = {};
  for (const login of recentLogins || []) {
    loginsByGolfer[login.profile_id] = (loginsByGolfer[login.profile_id] || 0) + 1;
  }

  // Aggregate page views by path
  const viewsByPath: Record<string, number> = {};
  const viewsByGolfer: Record<string, number> = {};
  for (const pv of recentPageViews || []) {
    // Normalize paths: strip UUIDs and tokens for grouping
    const normalizedPath = (pv.page_path || "")
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "/[id]")
      .replace(/\/rsvp\/[^/]+/g, "/rsvp/[token]");
    viewsByPath[normalizedPath] = (viewsByPath[normalizedPath] || 0) + 1;
    viewsByGolfer[pv.profile_id] = (viewsByGolfer[pv.profile_id] || 0) + 1;
  }

  // Get profile names for top users
  const allProfileIds = [...new Set([
    ...Object.keys(loginsByGolfer),
    ...Object.keys(viewsByGolfer),
  ])];

  let activityProfileMap: Record<string, string> = {};
  if (allProfileIds.length > 0) {
    const { data: activityProfiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", allProfileIds.slice(0, 50)); // Cap to avoid huge queries

    for (const p of activityProfiles || []) {
      activityProfileMap[p.id] = formatFullName(p.first_name, p.last_name);
    }
  }

  // Top pages (sorted by views)
  const topPages = Object.entries(viewsByPath)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top users by logins
  const topLoginUsers = Object.entries(loginsByGolfer)
    .map(([profileId, count]) => ({
      profileId,
      name: activityProfileMap[profileId] || "Unknown",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top users by page views
  const topActiveUsers = Object.entries(viewsByGolfer)
    .map(([profileId, count]) => ({
      profileId,
      name: activityProfileMap[profileId] || "Unknown",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const activityData = {
    totalLogins: (recentLogins || []).length,
    totalPageViews: (recentPageViews || []).length,
    uniqueLoggedIn: Object.keys(loginsByGolfer).length,
    uniqueActiveUsers: Object.keys(viewsByGolfer).length,
    topPages,
    topLoginUsers,
    topActiveUsers,
  };

  // ============================================================
  // 3. Response Timing — how quickly golfers respond after invite
  // ============================================================
  const { data: recentInviteLogs } = await supabase
    .from("email_log")
    .select("schedule_id, sent_at, event_id")
    .eq("email_type", "invite")
    .gte("sent_at", new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("sent_at", { ascending: false });

  type TimingBucket = {
    label: string;
    count: number;
    percentage: number;
  };

  type ResponseTimingData = {
    totalResponses: number;
    totalInvitesSent: number;
    buckets: TimingBucket[];
    averageHours: number | null;
    medianHours: number | null;
  };

  let responseTimingData: ResponseTimingData = {
    totalResponses: 0,
    totalInvitesSent: 0,
    buckets: [],
    averageHours: null,
    medianHours: null,
  };

  if (recentInviteLogs && recentInviteLogs.length > 0) {
    const inviteScheduleIds = [...new Set(recentInviteLogs.map((l) => l.schedule_id))];

    const { data: respondedRsvps } = await supabase
      .from("rsvps")
      .select("schedule_id, responded_at, status")
      .in("schedule_id", inviteScheduleIds)
      .not("responded_at", "is", null)
      .neq("status", "no_response");

    const inviteSentMap: Record<string, string> = {};
    for (const log of recentInviteLogs) {
      if (!inviteSentMap[log.schedule_id]) {
        inviteSentMap[log.schedule_id] = log.sent_at;
      }
    }

    const responseTimes: number[] = [];
    for (const rsvp of respondedRsvps || []) {
      const inviteSentAt = inviteSentMap[rsvp.schedule_id];
      if (!inviteSentAt || !rsvp.responded_at) continue;

      const sentTime = new Date(inviteSentAt).getTime();
      const respondedTime = new Date(rsvp.responded_at).getTime();
      const hoursToRespond = (respondedTime - sentTime) / (1000 * 60 * 60);

      if (hoursToRespond > 0) {
        responseTimes.push(hoursToRespond);
      }
    }

    const bucketDefs = [
      { label: "Within 1 hour", max: 1 },
      { label: "1–4 hours", max: 4 },
      { label: "4–24 hours", max: 24 },
      { label: "1–2 days", max: 48 },
      { label: "2–4 days", max: 96 },
      { label: "4+ days", max: Infinity },
    ];

    const bucketCounts = bucketDefs.map(() => 0);
    for (const hours of responseTimes) {
      for (let i = 0; i < bucketDefs.length; i++) {
        if (hours <= bucketDefs[i].max || i === bucketDefs.length - 1) {
          bucketCounts[i]++;
          break;
        }
      }
    }

    const total = responseTimes.length;

    let averageHours: number | null = null;
    let medianHours: number | null = null;
    if (total > 0) {
      averageHours = responseTimes.reduce((a, b) => a + b, 0) / total;
      const sorted = [...responseTimes].sort((a, b) => a - b);
      medianHours =
        sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];
    }

    responseTimingData = {
      totalResponses: total,
      totalInvitesSent: inviteScheduleIds.length,
      buckets: bucketDefs.map((def, i) => ({
        label: def.label,
        count: bucketCounts[i],
        percentage: total > 0 ? Math.round((bucketCounts[i] / total) * 100) : 0,
      })),
      averageHours,
      medianHours,
    };
  }

  // ============================================================
  // 4. Profile Completeness
  // ============================================================
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, phone, ghin_number, handicap_index")
    .eq("status", "active")
    .eq("is_guest", false)
    .order("last_name")
    .order("first_name");

  const missingGhin = (allProfiles || []).filter(
    (p) => !p.ghin_number || p.ghin_number.trim() === ""
  );
  const missingPhone = (allProfiles || []).filter(
    (p) => !p.phone || p.phone.trim() === ""
  );
  const incompleteGolfers = (allProfiles || []).filter(
    (p) =>
      (!p.ghin_number || p.ghin_number.trim() === "") ||
      (!p.phone || p.phone.trim() === "")
  );

  const profileCompletenessData = {
    totalActive: (allProfiles || []).length,
    missingGhinCount: missingGhin.length,
    missingPhoneCount: missingPhone.length,
    incompleteCount: incompleteGolfers.length,
    golfers: incompleteGolfers.map((p) => ({
      id: p.id,
      name: formatFullName(p.first_name, p.last_name),
      displayName: formatInitialLastName(p.first_name, p.last_name),
      email: p.email,
      missingGhin: !p.ghin_number || p.ghin_number.trim() === "",
      missingPhone: !p.phone || p.phone.trim() === "",
      hasHandicap: p.handicap_index !== null,
    })),
  };

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Breadcrumbs
          items={[
            { label: "Admin", href: "/admin" },
            { label: "Reports" },
          ]}
        />

        <h1 className="text-2xl font-serif uppercase tracking-wide font-bold text-navy-900">
          Reports
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Platform health and operational insights across all events.
        </p>

        <ReportsClient
          engagement={{
            golfers: engagementData,
            totalGolfers,
            avgResponseRate,
            avgParticipationRate,
            ghostCount,
            events: (allEvents || []).map((e) => ({ id: e.id, name: e.name })),
          }}
          activity={activityData}
          responseTiming={responseTimingData}
          profileCompleteness={profileCompletenessData}
        />
      </div>
    </main>
  );
}
