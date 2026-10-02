"use client";

import { useQuery } from "@tanstack/react-query";
import { BaseError, ContractFunctionRevertedError, parseAbi } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { useTransactor } from "~~/hooks/scaffold-hbar";
import { HealthResponse, requestClaim } from "~~/lib/rewards/api";
import { parseClaim } from "~~/lib/rewards/claim";
import { GAS, NETWORKS } from "~~/lib/rewards/constants";
import { entityIdToAddress } from "~~/lib/rewards/ids";
import { tokenHolding } from "~~/lib/rewards/mirror";
import { HTS_TOKEN_ABI } from "~~/lib/rewards/saucerswap";
import { REWARD_VAULT_ABI, describeVaultError } from "~~/lib/rewards/vault";

export const vaultAbi = parseAbi(REWARD_VAULT_ABI);
export const tokenAbi = parseAbi(HTS_TOKEN_ABI);

/** The mirror node indexes a transaction a few seconds after consensus. */
const MIRROR_LAG_MS = 6_000;

/** Live config from GET /api/rewards/health; `config` is set only when everything is deployed and registered. */
export function useRewardsHealth() {
  const query = useQuery({
    queryKey: ["rewards-health"],
    queryFn: async () => (await (await fetch("/api/rewards/health")).json()) as HealthResponse,
    staleTime: 30_000,
  });
  const config = query.data?.configured ? query.data : undefined;
  return { ...query, config, chainId: config ? NETWORKS[config.network].chainId : undefined };
}

function vaultRevertMessage(error: unknown) {
  if (!(error instanceof BaseError)) return undefined;
  const revert = error.walk(e => e instanceof ContractFunctionRevertedError);
  if (!(revert instanceof ContractFunctionRevertedError) || !revert.data?.errorName) return undefined;
  return describeVaultError(revert.data.errorName, revert.data.args ?? []);
}

/** Wraps the attest API, the association check and the claim() write for the connected wallet. */
export function useRewards() {
  const { address, chainId: walletChainId } = useAccount();
  const { config, chainId } = useRewardsHealth();
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();
  const transact = useTransactor();
  const token = config ? entityIdToAddress(config.tokenId) : undefined;
  /** True when a wallet is connected to any chain other than the configured one; every write is blocked. */
  const wrongNetwork = Boolean(address && chainId && walletChainId !== chainId);
  const networkName = config ? `Hedera ${config.network}` : "Hedera";

  const holding = useQuery({
    queryKey: ["reward-holding", config?.tokenId, address],
    queryFn: () => tokenHolding(config!.network, address!, config!.tokenId),
    enabled: Boolean(config && address),
    refetchInterval: 15_000,
    retry: false,
  });
  const refreshHolding = () => {
    holding.refetch();
    setTimeout(() => holding.refetch(), MIRROR_LAG_MS);
  };

  const associate = async () => {
    if (wrongNetwork) throw new Error(`Switch your wallet to ${networkName} first.`);
    await transact(() =>
      writeContractAsync({
        address: token!,
        abi: tokenAbi,
        functionName: "associate",
        gas: BigInt(GAS.htsApproveOrAssociate),
        chainId,
      }),
    );
    refreshHolding();
  };

  /** Attests a finished round, then sends claim() from the connected wallet. Throws a player-facing message. */
  const claimRound = async (gameId: string, result: unknown) => {
    if (!config || !address || !publicClient) throw new Error("Connect a wallet first.");
    // Checked before attesting, so a wrong-network attempt never logs a score to HCS.
    if (wrongNetwork) throw new Error(`Switch your wallet to ${networkName} first.`);
    const { relationship } = (await holding.refetch({ throwOnError: true })).data!;
    if (relationship === "none") throw new Error(describeVaultError("HtsCallFailed", ["transferToken", 184]));

    const attested = await requestClaim("", { gameId, player: address, result });
    const args = [parseClaim(attested.claim), attested.signature] as const;
    try {
      await publicClient.simulateContract({
        account: address,
        address: config.vault,
        abi: vaultAbi,
        functionName: "claim",
        args,
      });
    } catch (error) {
      const message = vaultRevertMessage(error);
      if (message) throw new Error(message);
    }
    const hash = await transact(() =>
      writeContractAsync({
        address: config.vault,
        abi: vaultAbi,
        functionName: "claim",
        args,
        gas: BigInt(GAS.claim + (relationship === "auto" ? GAS.autoAssociation : 0)),
        chainId,
      }),
    );
    refreshHolding();
    return { hash, amount: args[0].amount, hcs: attested.hcs };
  };

  return { address, config, chainId, wrongNetwork, token, holding, refreshHolding, associate, claimRound };
}
