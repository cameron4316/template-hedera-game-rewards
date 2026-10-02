"use client";

import { useRewardsHealth } from "~~/hooks/useRewards";
import { NETWORKS } from "~~/lib/rewards/constants";

const SETUP_STEPS = [
  ["yarn doctor", "checks Node, Yarn, Git, the network and your operator account"],
  ["yarn setup", "creates .env, the attestor key and the HCS score topic"],
  ["yarn deploy", "deploys the vault, creates the reward token and seeds the SaucerSwap pool"],
  ["yarn dev", "restart the app so it reads the new .env"],
] as const;

/** Explains why rewards are unavailable and which commands fix it. */
export const SetupHint = ({ problems }: { problems?: string[] }) => (
  <div className="flex flex-col gap-3">
    {problems && problems.length > 0 && (
      <ul className="list-disc pl-5 m-0 text-sm text-warning-content/90 break-words">
        {problems.map(problem => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
    )}
    <ol className="flex flex-col gap-2 m-0 p-0 list-none">
      {SETUP_STEPS.map(([command, purpose], i) => (
        <li key={command} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 text-sm">
          <code className="bg-base-200 rounded px-2 py-1 w-fit">
            {i + 1}. {command}
          </code>
          <span className="text-base-content/70">{purpose}</span>
        </li>
      ))}
    </ol>
  </div>
);

const Row = ({ label, value, href }: { label: string; value: string; href: string }) => (
  <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 text-sm">
    <span className="text-base-content/60">{label}</span>
    <a href={href} target="_blank" rel="noreferrer" className="link font-mono break-all">
      {value}
    </a>
  </div>
);

/** Live configuration from GET /api/rewards/health. */
export const ConfigStatus = () => {
  const { data, isLoading, isError, config } = useRewardsHealth();

  if (isLoading)
    return <div className="h-24 rounded-xl bg-base-200 animate-pulse" aria-label="Checking configuration" />;
  if (isError || !data) {
    return <p className="text-error m-0">Could not reach /api/rewards/health. Is `yarn dev` running?</p>;
  }
  if (!config) {
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 font-semibold">Rewards are not configured yet. Run these from the project root:</p>
        <SetupHint problems={data.configured ? [] : data.problems} />
      </div>
    );
  }

  const hashscan = NETWORKS[config.network].hashscan;
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 font-semibold text-success">Configured on Hedera {config.network}</p>
      <Row label="Reward vault" value={config.vault} href={`${hashscan}/contract/${config.vault}`} />
      <Row label="Reward token (ARCADE)" value={config.tokenId} href={`${hashscan}/token/${config.tokenId}`} />
      <Row label="HCS score topic" value={config.topicId} href={`${hashscan}/topic/${config.topicId}`} />
      <Row label="SaucerSwap V1 router" value={config.routerId} href={`${hashscan}/contract/${config.routerId}`} />
    </div>
  );
};
