import * as fs from "fs";
import * as path from "path";
import { Abi, createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hedera, hederaTestnet } from "viem/chains";
import { resolveNetwork } from "../../packages/nextjs/lib/rewards/config";
import { NETWORKS, NetworkName } from "../../packages/nextjs/lib/rewards/constants";
import type { Hex } from "../../packages/nextjs/lib/rewards/claim";
import { toRawEcdsaKey } from "../../packages/nextjs/lib/rewards/ids";
import { ROOT } from "./env";

export const HARDHAT_NETWORK: Record<NetworkName, string> = { testnet: "hederaTestnet", mainnet: "hederaMainnet" };

const FIXES: Record<string, string> = {
  HEDERA_OPERATOR_ID: "Create a testnet ECDSA account at https://portal.hedera.com and paste its account ID",
  HEDERA_OPERATOR_KEY: "Paste the account's ECDSA private key (hex) from https://portal.hedera.com",
  ATTESTOR_PRIVATE_KEY: "Run `yarn setup`",
  NEXT_PUBLIC_SCORE_TOPIC_ID: "Run `yarn setup`",
  NEXT_PUBLIC_REWARD_TOKEN_ID: "Run `yarn deploy`",
};

export function fail(message: string): never {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

/** Exits naming each missing root .env variable and the command or step that sets it. */
export function requireEnv(...keys: string[]) {
  const missing = keys.filter(key => !process.env[key]);
  if (missing.length === 0) return;
  fail(`Missing in the root .env:\n${missing.map(key => `  - ${key}: ${FIXES[key]}`).join("\n")}`);
}

/** Reads HEDERA_NETWORK. Mainnet spends real HBAR, so it also requires the --confirm-mainnet flag. */
export function selectNetwork(): NetworkName {
  const network = resolveNetwork(process.env);
  if (!network) fail("HEDERA_NETWORK must be testnet or mainnet. Fix it in the root .env.");
  if (network === "mainnet") {
    if (!process.argv.includes("--confirm-mainnet")) {
      fail(
        "HEDERA_NETWORK=mainnet spends real HBAR. Set HEDERA_NETWORK=testnet, or re-run with --confirm-mainnet after legal review (docs/compliance.md).",
      );
    }
    console.warn("⚠ Running against Hedera MAINNET with real HBAR.");
  }
  return network;
}

/** The RewardVault deployment written by `yarn deploy` (hardhat-deploy). */
export function readVaultDeployment(network: NetworkName): { address: Hex; abi: Abi } {
  const file = path.join(ROOT, "packages/hardhat/deployments", HARDHAT_NETWORK[network], "RewardVault.json");
  if (!fs.existsSync(file)) fail(`No RewardVault deployment found for ${network}. Run \`yarn deploy\` first.`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** viem clients for the operator account over the Hashio JSON-RPC relay. */
export function operatorClients(network: NetworkName) {
  const chain = network === "mainnet" ? hedera : hederaTestnet;
  const transport = http(NETWORKS[network].rpcUrl);
  const account = privateKeyToAccount(toRawEcdsaKey(process.env.HEDERA_OPERATOR_KEY!));
  return {
    account,
    publicClient: createPublicClient({ chain, transport }),
    walletClient: createWalletClient({ chain, transport, account }),
  };
}
