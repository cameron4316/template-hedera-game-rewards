import { spawnSync } from "child_process";
import { loadEnv } from "./lib/env";
import { fail, readVaultDeployment, selectNetwork } from "./lib/hedera";

/** Verifies the deployed RewardVault on Sourcify, which HashScan uses to show source and decode events. */
function main() {
  loadEnv();
  const network = selectNetwork();
  const { address } = readVaultDeployment(network);
  const run = (args: string[]) =>
    spawnSync("yarn", ["workspace", "@sh/hardhat", ...args], { stdio: "inherit", shell: process.platform === "win32" })
      .status;

  if (run(["compile"]) !== 0) fail("Compilation failed. Fix the Solidity errors above, then re-run `yarn verify`.");
  if (run(["verify:contract", "RewardVault", network, address]) !== 0) {
    fail(
      "Verification failed. If you changed RewardVault.sol after deploying, run `yarn deploy` again, then `yarn verify`.",
    );
  }
  console.log("\nVerified. HashScan now shows RewardVault's source and decodes its Claimed events.");
}

main();
