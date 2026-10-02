"use client";

import { useState } from "react";
import { BaseError, formatUnits, parseAbi, parseUnits } from "viem";
import { useReadContract, useWriteContract } from "wagmi";
import { useTransactor } from "~~/hooks/scaffold-hbar";
import { tokenAbi, useRewards } from "~~/hooks/useRewards";
import { CASH_OUT_SLIPPAGE_PERCENT, GAS, REWARD_TOKEN } from "~~/lib/rewards/constants";
import { entityIdToAddress } from "~~/lib/rewards/ids";
import { SAUCERSWAP_V1_ROUTER_ABI } from "~~/lib/rewards/saucerswap";

const routerAbi = parseAbi(SAUCERSWAP_V1_ROUTER_ABI);

const parseAmount = (input: string) => {
  try {
    return input ? parseUnits(input, REWARD_TOKEN.decimals) : 0n;
  } catch {
    return 0n;
  }
};

/** Swaps reward tokens for HBAR on SaucerSwap V1: quote, approve the router if needed, swapExactTokensForETH. */
export const CashOut = () => {
  const { address, config, chainId, wrongNetwork, token, holding, refreshHolding } = useRewards();
  const { writeContractAsync } = useWriteContract();
  const transact = useTransactor();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const router = config ? entityIdToAddress(config.routerId) : undefined;
  const balance = holding.data?.balance ?? 0n;
  const amountIn = parseAmount(input);

  // whbar() is the WHBAR token used in swap paths (0.0.15058 on testnet), not the WHBAR() wrapper contract.
  const { data: whbar } = useReadContract({
    address: router,
    abi: routerAbi,
    functionName: "whbar",
    chainId,
    query: { enabled: Boolean(router) },
  });
  const path = token && whbar ? ([token, whbar] as const) : undefined;
  const { data: amounts, isFetching: quoting } = useReadContract({
    address: router,
    abi: routerAbi,
    functionName: "getAmountsOut",
    args: path ? [amountIn, path] : undefined,
    chainId,
    query: { enabled: Boolean(path) && amountIn > 0n },
  });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: token,
    abi: tokenAbi,
    functionName: "allowance",
    args: address && router ? [address, router] : undefined,
    chainId,
    query: { enabled: Boolean(address && router && token) },
  });
  const quote = amountIn > 0n ? amounts?.[1] : undefined;
  const tooMuch = amountIn > balance;

  const cashOut = async () => {
    if (wrongNetwork || !address || !router || !token || !path || quote === undefined) return;
    setBusy(true);
    setError(undefined);
    try {
      if ((allowance ?? 0n) < amountIn) {
        await transact(() =>
          writeContractAsync({
            address: token,
            abi: tokenAbi,
            functionName: "approve",
            args: [router, amountIn],
            gas: BigInt(GAS.htsApproveOrAssociate),
            chainId,
          }),
        );
        await refetchAllowance();
      }
      await transact(() =>
        writeContractAsync({
          address: router,
          abi: routerAbi,
          functionName: "swapExactTokensForETH",
          args: [
            amountIn,
            (quote * (100n - CASH_OUT_SLIPPAGE_PERCENT)) / 100n,
            path,
            address,
            BigInt(Math.floor(Date.now() / 1000) + 600),
          ],
          gas: BigInt(GAS.saucerSwapSwap),
          chainId,
        }),
      );
      setInput("");
      refreshHolding();
    } catch (e) {
      setError(e instanceof BaseError ? e.shortMessage : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span>Amount of {REWARD_TOKEN.symbol} to cash out</span>
        <div className="join w-full">
          <input
            className="input input-bordered join-item w-full min-w-0"
            inputMode="decimal"
            placeholder="0"
            value={input}
            onChange={e => setInput(e.target.value.replace(",", "."))}
          />
          <button
            type="button"
            className="btn join-item"
            onClick={() => setInput(formatUnits(balance, REWARD_TOKEN.decimals))}
            disabled={balance === 0n}
          >
            Max
          </button>
        </div>
      </label>
      <p className="m-0 text-sm text-base-content/70">
        {tooMuch
          ? `You only have ${formatUnits(balance, REWARD_TOKEN.decimals)} ${REWARD_TOKEN.symbol}.`
          : quote !== undefined
            ? `You receive about ${formatUnits(quote, 8)} HBAR (at most ${CASH_OUT_SLIPPAGE_PERCENT}% less after slippage).`
            : quoting
              ? "Getting a SaucerSwap quote…"
              : "Enter an amount to get a SaucerSwap quote."}
      </p>
      <button
        type="button"
        className="btn btn-primary"
        onClick={cashOut}
        disabled={busy || wrongNetwork || tooMuch || quote === undefined || quote === 0n}
      >
        {busy ? <span className="loading loading-spinner loading-sm" /> : null}
        {(allowance ?? 0n) < amountIn ? "Approve and cash out" : "Cash out"}
      </button>
      {error && <p className="m-0 text-sm text-error break-words">{error}</p>}
    </div>
  );
};
