import { requireSuperAdmin } from "@/lib/auth";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { formatInitialLastName, formatFullName } from "@/lib/format";
import { getTodayPacific } from "@/lib/timezone";
import { ReportsClient } from "./reports-client";

export default async function AdminReportsPage() {
  const { supabase } = await requireSuperAdmin();

  const today = getTodayPacific();

  // ============================================================
  // 1. Profile Completeness
  // ============================================================
  // Fetch all active, non-guest profiles missing GHIN or phone
  const { data: incompleteProfiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, phone, ghin_number, handicap_index")
    .eq("status", "active")
    .eq("is_guest", false)
    .order("last_name")
    .order("first_name");

  const missingGhin = (incompleteProfiles || []).filter(
    (p) => !p.ghin_number || p.ghin_number.trim() === ""
  );
  const missingPhone = (incompleteProfiles || []).filter(
    (p) => !p.phone || p.phone.trim() === ""
  );
  // Golfers missing either
  const incompleteGolfers = (incompleteProfiles || []).filter(
    (p) =>
      (!p.ghin_number || p.ghin_number.trim() === "") ||
      (!p.phone || p.phone.trim() === "")
  );

  const profileCompletenessData = {
    totalActive: (incompleteProfiles || []).length,
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

  // ============================================================
  // 2. Ghost Report — golfers with 3+ consecutive no-responses
  // ============================================================
  // Get recent schedules (last 8 weeks) across all active events
  const { data: recentSchedules } = await supabase
    .from("event_schedules")
    .select("id, game_date, event_id, status")
    .eq("status", "scheduled")
    .lte("game_date", today)
    .order("game_date", { ascending: false })
    .limit(200);

  // Group schedules by event, take last N per event
  const schedulesByEvent: Record<string, { id: string; game_date: string }[]> = {};
  for (const sched of recentSchedules || []) {
    if (!schedulesByEvent[sched.event_id]) {
      schedulesByEvent[sched.event_id] = [];
    }
    if (schedulesByEvent[sched.event_id].length < 8) {
      schedulesByEvent[sched.event_id].push({ id: sched.id, game_date: sched.game_date });
    }
  }

  // Get all active events for labeling
  const { data: allEvents } = await supabase
    .from("events")
    .select("id, name")
    .eq("is_active", true);

  const eventNameMap: Record<string, string> = {};
  for (const ev of allEvents || []) {
    eventNameMap[ev.id] = ev.name;
  }

  // For each event, get RSVPs for recent schedules and find ghosts
  type GhostGolfer = {
    id: string;
    name: string;
    displayName: string;
    email: string;
    eventName: string;
    eventId: string;
    consecutiveNoReplies: number;
    lastResponseDate: string | null;
  };

  const ghosts: GhostGolfer[] = [];

  for (const [eventId, schedules] of Object.entries(schedulesByEvent)) {
    if (schedules.length < 3) continue; // Need at least 3 weeks of data

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

    // For each subscriber, check consecutive no-responses from most recent
    for (const sub of activeSubscribers) {
      const profile = sub.profiles as any;
      if (!profile) continue;

      let consecutiveNoReplies = 0;
      let lastResponseDate: string | null = null;

      // Walk through schedules from most recent to oldest
      for (const sched of schedules) {
        const rsvp = (rsvps || []).find(
          (r) => r.profile_id === profile.id && r.schedule_id === sched.id
        );

        if (!rsvp || rsvp.status === "no_response") {
          consecutiveNoReplies++;
        } else {
          if (!lastResponseDate) {
            lastResponseDate = sched.game_date;
          }
          break; // Stop at first response found
        }
      }

      if (consecutiveNoReplies >= 3) {
        ghosts.push({
          id: profile.id,
          name: formatFullName(profile.first_name, profile.last_name),
          displayName: formatInitialLastName(profile.first_name, profile.last_name),
          email: profile.email,
          eventName: eventNameMap[eventId] || "Unknown Event",
          eventId,
          consecutiveNoReplies,
          lastResponseDate,
        });
      }
    }
  }

  // Sort ghosts by consecutive no-replies descending
  ghosts.sort((a, b) => b.consecutiveNoReplies - a.consecutiveNoReplies);

  // ============================================================
  // 3. Response Timing — how quickly golfers respond after invite
  // ============================================================
  // Get invite emails sent in the last 8 weeks
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
    // Get RSVPs for those schedules that have a responded_at timestamp
    const inviteScheduleIds = [...new Set(recentInviteLogs.map((l) => l.schedule_id))];

    const { data: respondedRsvps } = await supabase
      .from("rsvps")
      .select("schedule_id, responded_at, status")
      .in("schedule_id", inviteScheduleIds)
      .not("responded_at", "is", null)
      .neq("status", "no_response");

    // Build invite sent time map (schedule_id → sent_at)
    const inviteSentMap: Record<string, string> = {};
    for (const log of recentInviteLogs) {
      if (!inviteSentMap[log.schedule_id]) {
        inviteSentMap[log.schedule_id] = log.sent_at;
      }
    }

    // Calculate response times in hours
    const responseTimes: number[] = [];
    for (const rsvp of respondedRsvps || []) {
      const inviteSentAt = inviteSentMap[rsvp.schedule_id];
      if (!inviteSentAt || !rsvp.responded_at) continue;

      const sentTime = new Date(inviteSentAt).getTime();
      const respondedTime = new Date(rsvp.responded_at).getTime();
      const hoursToRespond = (respondedTime - sentTime) / (1000 * 60 * 60);

      // Only count positive times (responded after invite)
      if (hoursToRespond > 0) {
        responseTimes.push(hoursToRespond);
      }
    }

    // Bucket the response times
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
      let prevMax = 0;
      for (let i = 0; i < bucketDefs.length; i++) {
        if (hours <= bucketDefs[i].max || i === bucketDefs.length - 1) {
          bucketCounts[i]++;
          break;
        }
        prevMax = bucketDefs[i].max;
      }
    }

    const total = responseTimes.length;

    // Calculate average and median
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
          profileCompleteness={profileCompletenessData}
          ghosts={ghosts}
          responseTiming={responseTimingData}
        />
      </div>
    </main>
  );
}
