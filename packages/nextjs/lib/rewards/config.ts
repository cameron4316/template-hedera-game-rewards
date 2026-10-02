import type { Hex } from "./claim";
import { NETWORKS, NetworkName } from "./constants";
import type { Operator } from "./hcs";
import { toRawEcdsaKey } from "./ids";

export type RewardsConfig = {
  network: NetworkName;
  operator: Operator;
  attestorKey: Hex;
  topicId: string;
  tokenId: string;
  vault: Hex;
};

const REQUIRED = [
  "HEDERA_OPERATOR_ID",
  "HEDERA_OPERATOR_KEY",
  "ATTESTOR_PRIVATE_KEY",
  "NEXT_PUBLIC_SCORE_TOPIC_ID",
  "NEXT_PUBLIC_REWARD_TOKEN_ID",
] as const;

export const resolveNetwork = (env: Record<string, string | undefined>) => {
  const network = env.HEDERA_NETWORK || "testnet";
  return network in NETWORKS ? (network as NetworkName) : undefined;
};

/**
 * Reads the attestor's configuration. `missing` names each unset variable, plus `yarn deploy` when the vault
 * address is unknown, so callers can tell the developer exactly what to run.
 */
export function readRewardsConfig(
  env: Record<string, string | undefined>,
  vault: Hex | undefined,
): { ok: true; config: RewardsConfig } | { ok: false; missing: string[] } {
  const network = resolveNetwork(env);
  const missing: string[] = REQUIRED.filter(key => !env[key]);
  if (!network) missing.push("HEDERA_NETWORK (testnet or mainnet)");
  if (!vault) missing.push("RewardVault deployment (run yarn deploy)");
  if (missing.length > 0 || !network || !vault) return { ok: false, missing };

  return {
    ok: true,
    config: {
      network,
      operator: { network, accountId: env.HEDERA_OPERATOR_ID!, privateKey: env.HEDERA_OPERATOR_KEY! },
      attestorKey: toRawEcdsaKey(env.ATTESTOR_PRIVATE_KEY!),
      topicId: env.NEXT_PUBLIC_SCORE_TOPIC_ID!,
      tokenId: env.NEXT_PUBLIC_REWARD_TOKEN_ID!,
      vault,
    },
  };
}
