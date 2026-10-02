import { spawnSync } from "child_process";
import { NETWORKS } from "../packages/nextjs/lib/rewards/constants";
import { longZeroAddressToEntityId } from "../packages/nextjs/lib/rewards/ids";
import { loadEnv, upsertEnv } from "./lib/env";
import { HARDHAT_NETWORK, fail, operatorClients, readVaultDeployment, requireEnv, selectNetwork } from "./lib/hedera";

async function main() {
  loadEnv();
  const network = selectNetwork();
  requireEnv("HEDERA_OPERATOR_ID", "HEDERA_OPERATOR_KEY", "ATTESTOR_PRIVATE_KEY", "NEXT_PUBLIC_SCORE_TOPIC_ID");

  const { status } = spawnSync("yarn", ["workspace", "@sh/hardhat", "deploy", "--network", HARDHAT_NETWORK[network]], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (status !== 0) fail("Deploy failed (see above). Fix the cause and re-run `yarn deploy`; it resumes from the last completed step.");

  const { address, abi } = readVaultDeployment(network);
  const token = (await operatorClients(network).publicClient.readContract({
    address,
    abi,
    functionName: "rewardToken",
  })) as string;
  const tokenId = longZeroAddressToEntityId(token);
  upsertEnv({ NEXT_PUBLIC_REWARD_TOKEN_ID: tokenId });

  const hashscan = NETWORKS[network].hashscan;
  console.log(`\n✔ RewardVault: ${hashscan}/contract/${address}`);
  console.log(`✔ Reward token ${tokenId} written to NEXT_PUBLIC_REWARD_TOKEN_ID`);
  console.log("\nDeploy complete. Next: yarn demo (headless end-to-end run), then yarn dev");
}

main().catch(error => fail(`Deploy failed: ${error instanceof Error ? error.message : error}`));
