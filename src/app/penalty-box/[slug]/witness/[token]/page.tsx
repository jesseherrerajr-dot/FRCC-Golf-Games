import { notFound } from "next/navigation";
import { getWitnessByToken, getRandomClownTaunt, getGatekeeperImageUrl } from "@/lib/penalty-box";
import { formatFullName } from "@/lib/format";
import { WitnessFlowClient } from "./witness-flow-client";

interface PageProps {
  params: Promise<{ slug: string; token: string }>;
}

export default async function WitnessPage({ params }: PageProps) {
  const { slug, token } = await params;

  // Fetch witness data by token (no auth required — tokenized access)
  const result = await getWitnessByToken(token);

  if (!result) {
    notFound();
  }

  const { witness, penalty, event, eventAdmin } = result;

  // If already voted or expired, show appropriate message
  if (witness.status === "completed") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-8">
        <div className="max-w-md text-center space-y-4">
          <div className="text-5xl">🏛️</div>
          <h1 className="text-2xl font-bold text-gray-900">
            Vote Already Cast
          </h1>
          <p className="text-gray-600">
            You&apos;ve already submitted your testimony for{" "}
            {formatFullName(penalty.profile.first_name, penalty.profile.last_name)}&apos;s
            Penalty Box case. Your vote: <strong>{witness.vote === "yes" ? "Release" : "Keep Locked"}</strong>.
          </p>
        </div>
      </main>
    );
  }

  if (witness.status === "expired") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-8">
        <div className="max-w-md text-center space-y-4">
          <div className="text-5xl">⏰</div>
          <h1 className="text-2xl font-bold text-gray-900">
            Request Expired
          </h1>
          <p className="text-gray-600">
            This character witness request has expired. The golfer will need to select a new witness.
          </p>
        </div>
      </main>
    );
  }

  // Check if the penalty has already been resolved
  if (penalty.status === "released") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-8">
        <div className="max-w-md text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900">
            Already Released!
          </h1>
          <p className="text-gray-600">
            {formatFullName(penalty.profile.first_name, penalty.profile.last_name)} has already been released from the Penalty Box.
            Your testimony is no longer needed.
          </p>
        </div>
      </main>
    );
  }

  const adminName = formatFullName(eventAdmin.first_name, eventAdmin.last_name);
  const clownTaunt = getRandomClownTaunt(adminName);
  const adminImageUrl = getGatekeeperImageUrl(eventAdmin.id);
  const golferName = formatFullName(
    penalty.profile.first_name,
    penalty.profile.last_name
  );

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8">
      <WitnessFlowClient
        slug={slug}
        witnessId={witness.id}
        golferName={golferName}
        charge={penalty.charge}
        adminName={adminName}
        clownTaunt={clownTaunt}
        eventName={event.name}
        adminImageUrl={adminImageUrl}
      />
    </main>
  );
}
