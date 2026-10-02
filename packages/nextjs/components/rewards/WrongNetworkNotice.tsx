"use client";

import { useSwitchChain } from "wagmi";
import { useRewards } from "~~/hooks/useRewards";

/** Shown while the connected wallet is on another chain; every rewards write stays disabled until it switches. */
export const WrongNetworkNotice = () => {
  const { wrongNetwork, config, chainId } = useRewards();
  const { switchChain, isPending, error } = useSwitchChain();
  if (!wrongNetwork || !config || !chainId) return null;

  return (
    <div role="alert" className="alert alert-warning flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <span className="text-sm">
        Wrong network. Your wallet must be on Hedera {config.network} (chain {chainId}) to associate, claim or cash out.
      </span>
      <button
        type="button"
        className="btn btn-sm btn-neutral shrink-0"
        onClick={() => switchChain({ chainId })}
        disabled={isPending}
      >
        Switch to Hedera {config.network}
      </button>
      {error && <span className="text-xs break-words">{error.message.split("\n")[0]}</span>}
    </div>
  );
};
