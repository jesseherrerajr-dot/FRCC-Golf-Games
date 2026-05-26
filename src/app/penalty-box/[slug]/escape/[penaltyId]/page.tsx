import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getPenaltyById,
  getEventAdmin,
  getRandomClownTaunt,
  getGatekeeperImageUrl,
} from "@/lib/penalty-box";
import { formatFullName } from "@/lib/format";
import { EscapeGameClient } from "./escape-game-client";

interface PageProps {
  params: Promise<{ slug: string; penaltyId: string }>;
}

export default async function EscapeGamePage({ params }: PageProps) {
  const { slug, penaltyId } = await params;

  // Require authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch penalty
  const penalty = await getPenaltyById(penaltyId);
  if (!penalty) {
    redirect(`/penalty-box/${slug}`);
  }

  // Only the penalized golfer can play the escape game
  if (penalty.profile_id !== user.id) {
    redirect(`/penalty-box/${slug}`);
  }

  // Can only play if status is "incarcerated"
  if (penalty.status !== "incarcerated") {
    redirect(`/penalty-box/${slug}`);
  }

  // Get event admin for the clown
  const eventAdmin = await getEventAdmin(penalty.event_id);
  const adminName = eventAdmin
    ? formatFullName(eventAdmin.first_name, eventAdmin.last_name)
    : "The Admin";

  const clownTaunt = getRandomClownTaunt(adminName);
  const adminImageUrl = getGatekeeperImageUrl(eventAdmin?.id);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8">
      <EscapeGameClient
        slug={slug}
        penaltyId={penaltyId}
        charge={penalty.charge}
        adminName={adminName}
        clownTaunt={clownTaunt}
        witnessesRequired={penalty.witnesses_required}
        adminImageUrl={adminImageUrl}
      />
    </main>
  );
}
