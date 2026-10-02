"use client";

import { useQuery } from "@tanstack/react-query";
import { useRewardsHealth } from "~~/hooks/useRewards";
import { NETWORKS } from "~~/lib/rewards/constants";
import { demoGame } from "~~/lib/rewards/games/demo";
import { fetchLeaderboard } from "~~/lib/rewards/leaderboard";

const shorten = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/** Best demo-game scores from the HCS score topic, read through the mirror node. */
export const Leaderboard = () => {
  const { config } = useRewardsHealth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["leaderboard", config?.network, config?.topicId],
    queryFn: () => fetchLeaderboard(config!.network, config!.topicId, demoGame.id),
    enabled: Boolean(config),
    refetchInterval: 15_000,
  });

  if (!config) {
    return (
      <p className="m-0 text-sm text-base-content/70">
        Scores are read from the HCS topic in <code>NEXT_PUBLIC_SCORE_TOPIC_ID</code>. Run <code>yarn setup</code> and{" "}
        <code>yarn deploy</code> to create it.
      </p>
    );
  }
  if (isLoading) return <div className="h-32 rounded-xl bg-base-200 animate-pulse" aria-label="Loading leaderboard" />;
  if (isError) return <p className="m-0 text-error">Could not read the score topic from the mirror node. Retrying…</p>;
  if (!data || data.length === 0) {
    return (
      <p className="m-0 text-sm text-base-content/70">No scores yet. Finish a round on the Play page to be first.</p>
    );
  }

  const hashscan = NETWORKS[config.network].hashscan;
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm w-full">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th className="text-right">Best</th>
            <th className="text-right">Rounds</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry, i) => (
            <tr key={entry.player}>
              <td>{i + 1}</td>
              <td>
                <a
                  href={`${hashscan}/account/${entry.player}`}
                  target="_blank"
                  rel="noreferrer"
                  className="link font-mono"
                >
                  {shorten(entry.player)}
                </a>
              </td>
              <td className="text-right font-semibold tabular-nums">{entry.bestScore}</td>
              <td className="text-right tabular-nums">{entry.rounds}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
