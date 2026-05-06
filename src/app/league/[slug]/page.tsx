import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  getLeagueConfigBySlug,
  getLeagueTabs,
  getLeagueScores,
  getSubscribedGolfers,
  computeSeasonWeeks,
  buildLeaderboard,
} from "@/lib/league";
import { LeagueTabs } from "./league-tabs";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function LeagueInfoPage({ params }: PageProps) {
  const { slug } = await params;

  // Require authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch league config + event
  const result = await getLeagueConfigBySlug(slug);
  if (!result) {
    redirect("/home");
  }

  const { config, event } = result;

  // Fetch tabs, scores, and golfers in parallel
  const [tabs, scores, golfers] = await Promise.all([
    getLeagueTabs(event.id),
    getLeagueScores(event.id, config.season_start, config.season_end),
    getSubscribedGolfers(event.id),
  ]);

  // Compute season weeks for leaderboard header
  const seasonWeeks =
    config.season_start && config.total_m
      ? computeSeasonWeeks(config.season_start, config.total_m)
      : [];

  // Build leaderboard data
  const leaderboard = buildLeaderboard(
    golfers,
    scores,
    config.best_n,
    config.min_rounds_to_qualify
  );

  // Serialize leaderboard for client component (Set → Array)
  const serializedLeaderboard = leaderboard.map((entry) => ({
    ...entry,
    countingWeeks: Array.from(entry.countingWeeks),
  }));

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/home" },
            { label: event.name },
            { label: "League Info" },
          ]}
        />

        <h1 className="text-2xl font-serif uppercase tracking-wide font-bold text-navy-900">
          {event.name}
        </h1>
        {config.season_name && (
          <p className="text-sm text-gray-500 mt-1">{config.season_name}</p>
        )}

        <div className="mt-6">
          <LeagueTabs
            tabs={tabs}
            leaderboard={serializedLeaderboard}
            seasonWeeks={seasonWeeks}
            bestN={config.best_n}
            totalM={config.total_m}
            minRoundsToQualify={config.min_rounds_to_qualify}
          />
        </div>
      </div>
    </main>
  );
}
