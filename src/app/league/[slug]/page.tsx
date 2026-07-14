import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  getLeagueConfigBySlug,
  getLeagueTabs,
  getLeagueScores,
  getLeagueMoneyScores,
  getSeasonMoneyScores,
  getSubscribedGolfers,
  computeSeasonWeeks,
  buildLeaderboard,
  buildMoneyLeaderboard,
  getRemainingWeeksInfo,
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

  // Fetch tabs, scores, money scores, and golfers in parallel
  const [tabs, scores, moneyScores, seasonMoneyScores, golfers] = await Promise.all([
    getLeagueTabs(event.id),
    getLeagueScores(event.id, config.season_start, config.season_end),
    getLeagueMoneyScores(event.id, config.season_start, config.season_end),
    getSeasonMoneyScores(event.id),
    getSubscribedGolfers(event.id),
  ]);

  // Compute season weeks for leaderboard header
  const seasonWeeks =
    config.season_start && config.total_m
      ? computeSeasonWeeks(config.season_start, config.total_m)
      : [];

  // Determine how many scheduled season weeks remain unplayed, so we can
  // tell golfers below the minimum whether they can still qualify.
  const { remainingWeeks, nextUnplayedWeek } = getRemainingWeeksInfo(
    seasonWeeks,
    scores
  );

  // Build leaderboard data
  const leaderboard = buildLeaderboard(
    golfers,
    scores,
    config.best_n,
    config.min_rounds_to_qualify,
    remainingWeeks
  );

  // Build money leaderboard data
  const moneyLeaderboard = buildMoneyLeaderboard(
    golfers,
    moneyScores,
    scores,
    seasonMoneyScores
  );

  // Serialize leaderboard for client component (Set → Array)
  const serializedLeaderboard = leaderboard.map((entry) => ({
    ...entry,
    countingWeeks: Array.from(entry.countingWeeks),
  }));

  return (
    <main className="min-h-screen px-4 py-8">
      {/* max-w-5xl (not 4xl) so the full 10-week + Season/Avg/Total grid fits
          without clipping the rightmost Total column on desktop. */}
      <div className="mx-auto max-w-5xl">
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
            moneyLeaderboard={moneyLeaderboard}
            seasonWeeks={seasonWeeks}
            bestN={config.best_n}
            totalM={config.total_m}
            minRoundsToQualify={config.min_rounds_to_qualify}
            nextUnplayedWeek={nextUnplayedWeek}
          />
        </div>
      </div>
    </main>
  );
}
