"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { BaseError, formatUnits } from "viem";
import { CashOut } from "~~/components/rewards/CashOut";
import { SetupHint } from "~~/components/rewards/ConfigStatus";
import { WrongNetworkNotice } from "~~/components/rewards/WrongNetworkNotice";
import { useRewards, useRewardsHealth } from "~~/hooks/useRewards";
import { NETWORKS, REWARD_TOKEN } from "~~/lib/rewards/constants";

const ASSOCIATION_TEXT = {
  associated: "Your account is associated with the reward token.",
  auto: "Your account associates automatically on its first claim (about 700k extra gas). You can also associate now.",
  none: "Your account must be associated with the reward token before it can receive rewards.",
} as const;

const Rewards: NextPage = () => {
  const health = useRewardsHealth();
  const { address, config, wrongNetwork, holding, associate } = useRewards();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const onAssociate = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await associate();
    } catch (e) {
      setError(e instanceof BaseError ? e.shortMessage : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto px-4 pt-8 pb-28 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold m-0">Rewards</h1>
        <p className="m-0 mt-1 text-base-content/70">
          Your {REWARD_TOKEN.symbol} balance, token association and cash-out to HBAR on SaucerSwap.
        </p>
      </div>

      <WrongNetworkNotice />

      {!config ? (
        <div className="card bg-base-100 shadow-md">
          <div className="card-body p-5 gap-3">
            <h2 className="card-title m-0">Not deployed yet</h2>
            <p className="m-0 text-sm text-base-content/70">
              <code>yarn deploy</code> creates the RewardVault contract, the {REWARD_TOKEN.symbol} HTS token it mints,
              and a {REWARD_TOKEN.symbol}/HBAR pool on SaucerSwap V1 so players can cash out.
            </p>
            {health.data && !health.data.configured && <SetupHint problems={health.data.problems} />}
          </div>
        </div>
      ) : !address ? (
        <p className="m-0">Connect a wallet on Hedera testnet to see your rewards.</p>
      ) : holding.error ? (
        <p className="m-0 text-error break-words">{holding.error.message}</p>
      ) : (
        <>
          <div className="card bg-base-100 shadow-md">
            <div className="card-body p-5 gap-3">
              <h2 className="card-title m-0">Balance</h2>
              <p className="m-0 text-3xl font-bold tabular-nums break-all">
                {holding.data ? formatUnits(holding.data.balance, REWARD_TOKEN.decimals) : "…"} {REWARD_TOKEN.symbol}
              </p>
              {holding.data && (
                <>
                  <p className="m-0 text-sm text-base-content/70">
                    Account{" "}
                    <a
                      className="link font-mono"
                      href={`${NETWORKS[config.network].hashscan}/account/${holding.data.accountId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {holding.data.accountId}
                    </a>
                    . {ASSOCIATION_TEXT[holding.data.relationship]}
                  </p>
                  {holding.data.relationship !== "associated" && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={onAssociate}
                      disabled={busy || wrongNetwork}
                    >
                      {busy && <span className="loading loading-spinner loading-sm" />}
                      Associate {REWARD_TOKEN.symbol}
                    </button>
                  )}
                </>
              )}
              {error && <p className="m-0 text-sm text-error break-words">{error}</p>}
            </div>
          </div>

          <div className="card bg-base-100 shadow-md">
            <div className="card-body p-5 gap-3">
              <h2 className="card-title m-0">Cash out</h2>
              <CashOut />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Rewards;
