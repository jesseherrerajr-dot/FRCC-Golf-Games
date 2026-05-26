import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  getPenaltyBoxEventBySlug,
  getActivePenalties,
  getPenaltyHistory,
  formatTimeServed,
  getEventAdmin,
  getEligibleWitnesses,
  expireOverdueWitnesses,
} from "@/lib/penalty-box";
import { formatFullName, formatInitialLastName } from "@/lib/format";
import { formatDateTime } from "@/lib/format";
import { PenaltyBoxClient } from "./penalty-box-client";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PenaltyBoxPage({ params }: PageProps) {
  const { slug } = await params;

  // Require authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch event with penalty box enabled check
  const eventResult = await getPenaltyBoxEventBySlug(slug);
  if (!eventResult) {
    redirect("/home");
  }

  const { id: eventId, name: eventName, penalty_box_name: penaltyBoxName } = eventResult;

  // Expire overdue witnesses on page load
  const [activePenalties] = await Promise.all([
    getActivePenalties(eventId),
  ]);

  // Expire witnesses for each active penalty
  for (const penalty of activePenalties) {
    await expireOverdueWitnesses(penalty.id);
  }

  // Re-fetch after expiry
  const [currentPenalties, history, eventAdmin] = await Promise.all([
    getActivePenalties(eventId),
    getPenaltyHistory(eventId),
    getEventAdmin(eventId),
  ]);

  const adminName = eventAdmin
    ? formatFullName(eventAdmin.first_name, eventAdmin.last_name)
    : "The Admin";

  // Check if current user has an active penalty
  const userPenalty = currentPenalties.find((p) => p.profile_id === user.id);

  // Get eligible witnesses if user needs to select them
  let eligibleWitnesses: Array<{ id: string; first_name: string; last_name: string }> = [];
  if (userPenalty && userPenalty.status === "awaiting_witnesses") {
    // Check if they still need to select witnesses
    const pendingWitnesses = userPenalty.witnesses.filter(
      (w) => w.status === "pending"
    ).length;
    const completedYes = userPenalty.witnesses.filter(
      (w) => w.status === "completed" && w.vote === "yes"
    ).length;
    const needsMore = completedYes < userPenalty.witnesses_required;

    if (needsMore && pendingWitnesses === 0) {
      eligibleWitnesses = await getEligibleWitnesses(
        eventId,
        userPenalty.id,
        user.id
      );
    }
  }

  // Serialize for client component
  const serializedPenalties = currentPenalties.map((p) => ({
    ...p,
    timeServed: formatTimeServed(p.created_at),
    yesVotes: p.witnesses.filter((w) => w.status === "completed" && w.vote === "yes").length,
    noVotes: p.witnesses.filter((w) => w.status === "completed" && w.vote === "no").length,
    pendingWitnesses: p.witnesses.filter((w) => w.status === "pending").length,
  }));

  const serializedHistory = history.map((p) => ({
    ...p,
    timeServed: formatTimeServed(p.created_at, p.released_at),
    yesVotes: p.witnesses.filter((w) => w.status === "completed" && w.vote === "yes").length,
    noVotes: p.witnesses.filter((w) => w.status === "completed" && w.vote === "no").length,
  }));

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/home" },
            { label: eventName },
            { label: penaltyBoxName },
          ]}
        />

        <h1 className="text-2xl font-serif uppercase tracking-wide font-bold text-navy-900 mt-4 mb-2">
          🔒 {penaltyBoxName}
        </h1>
        <p className="text-sm text-gray-500 mb-8">{eventName}</p>

        <PenaltyBoxClient
          slug={slug}
          eventId={eventId}
          eventName={eventName}
          adminName={adminName}
          currentUserId={user.id}
          activePenalties={serializedPenalties}
          penaltyHistory={serializedHistory}
          userPenalty={userPenalty ? {
            ...userPenalty,
            timeServed: formatTimeServed(userPenalty.created_at),
            yesVotes: userPenalty.witnesses.filter((w) => w.status === "completed" && w.vote === "yes").length,
            noVotes: userPenalty.witnesses.filter((w) => w.status === "completed" && w.vote === "no").length,
          } : null}
          eligibleWitnesses={eligibleWitnesses}
        />
      </div>
    </main>
  );
}
