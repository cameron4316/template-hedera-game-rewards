"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { BaseError, formatUnits } from "viem";
import { SetupHint } from "~~/components/rewards/ConfigStatus";
import { TapGame, TapResult } from "~~/components/rewards/TapGame";
import { useRewards, useRewardsHealth } from "~~/hooks/useRewards";
import { NETWORKS, REWARD_TOKEN } from "~~/lib/rewards/constants";
import { demoGame } from "~~/lib/rewards/games/demo";

type Claimed = Awaited<ReturnType<ReturnType<typeof useRewards>["claimRound"]>>;

const Play: NextPage = () => {
  const health = useRewardsHealth();
  const { address, config, holding, claimRound } = useRewards();
  const [result, setResult] = useState<TapResult>();
  const [claimed, setClaimed] = useState<Claimed>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const onFinish = useCallback((round: TapResult) => {
    setResult(round);
    setClaimed(undefined);
    setError(undefined);
  }, []);

  const validation = result ? demoGame.validate(result) : undefined;
  const blocker = health.isLoading
    ? "Checking configuration…"
    : !config
      ? "Rewards are not configured yet, so rounds cannot be claimed."
      : !address
        ? "Connect a wallet on Hedera testnet to claim."
        : holding.error
          ? holding.error.message
          : holding.data?.relationship === "none"
            ? "Associate your account with the reward token on the Rewards page before claiming."
            : validation && !validation.ok
              ? `This round cannot be rewarded: ${validation.reason}.`
              : undefined;

  const claim = async () => {
    if (!result) return;
    setBusy(true);
    setError(undefined);
    try {
      setClaimed(await claimRound(demoGame.id, result));
    } catch (e) {
      setError(e instanceof BaseError ? e.shortMessage : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const hashscan = config ? NETWORKS[config.network].hashscan : undefined;
  return (
    <div className="w-full max-w-lg mx-auto px-4 pt-8 pb-28 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold m-0">Play</h1>
        <p className="m-0 mt-1 text-base-content/70">
          One {REWARD_TOKEN.symbol} per hit, up to {formatUnits(demoGame.maxPerClaim, REWARD_TOKEN.decimals)} per round.
          Playing is free.
        </p>
      </div>

      <TapGame onFinish={onFinish} />

      {result && validation && (
        <div className="card bg-base-100 shadow-md">
          <div className="card-body p-5 gap-3">
            <h2 className="card-title m-0">
              {validation.ok
                ? `${formatUnits(validation.amount, REWARD_TOKEN.decimals)} ${REWARD_TOKEN.symbol} earned`
                : "No reward this round"}
            </h2>
            {claimed && hashscan && config ? (
              <div className="flex flex-col gap-1 text-sm">
                <p className="m-0 font-semibold text-success">
                  Claimed {formatUnits(claimed.amount, REWARD_TOKEN.decimals)} {REWARD_TOKEN.symbol}.
                </p>
                {claimed.hash && (
                  <a className="link" href={`${hashscan}/transaction/${claimed.hash}`} target="_blank" rel="noreferrer">
                    Claim transaction on HashScan
                  </a>
                )}
                <a className="link" href={`${hashscan}/topic/${claimed.hcs.topicId}`} target="_blank" rel="noreferrer">
                  Score logged to HCS topic {claimed.hcs.topicId} (message #{claimed.hcs.sequenceNumber})
                </a>
                <Link className="link" href="/rewards">
                  See your balance or cash out
                </Link>
              </div>
            ) : (
              <>
                <button type="button" className="btn btn-primary" onClick={claim} disabled={busy || Boolean(blocker)}>
                  {busy && <span className="loading loading-spinner loading-sm" />}
                  Claim reward
                </button>
                {blocker && <p className="m-0 text-sm text-base-content/70 break-words">{blocker}</p>}
                {!config && health.data && !health.data.configured && <SetupHint problems={health.data.problems} />}
                {error && <p className="m-0 text-sm text-error break-words">{error}</p>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Play;
