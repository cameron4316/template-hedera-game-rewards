import { loadEnv } from "../../../scripts/lib/env";
loadEnv();
import { Wallet } from "ethers";
import password from "@inquirer/password";
import { spawn } from "child_process";
import { config } from "hardhat";

/**
 * Resolves the deployer key from the root .env and runs `hardhat deploy` with it.
 * DEPLOYER_PRIVATE_KEY_ENCRYPTED (from `yarn hardhat:account:import`) wins and prompts for its password;
 * otherwise HEDERA_OPERATOR_KEY is used, so the portal account that runs `yarn setup` also deploys.
 */
async function resolveDeployerKey() {
  const encryptedKey = process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED;
  if (encryptedKey) {
    const pass = await password({ message: "Enter password to decrypt private key:" });
    try {
      return (await Wallet.fromEncryptedJson(encryptedKey, pass)).privateKey;
    } catch {
      throw new Error("Failed to decrypt DEPLOYER_PRIVATE_KEY_ENCRYPTED. Wrong password? Re-run and try again.");
    }
  }
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;
  if (operatorKey) return `0x${operatorKey.replace(/^0x/, "").slice(-64)}`;
  throw new Error(
    "No deployer key. Set HEDERA_OPERATOR_KEY in the root .env, or run `yarn hardhat:account:import` to add an encrypted key.",
  );
}

async function main() {
  const networkIndex = process.argv.indexOf("--network");
  const networkName = networkIndex !== -1 ? process.argv[networkIndex + 1] : config.defaultNetwork;
  if (networkName !== "localhost" && networkName !== "hardhat") {
    process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY = await resolveDeployerKey();
  }

  const hardhat = spawn("hardhat", ["deploy", ...process.argv.slice(2)], {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  hardhat.on("exit", code => process.exit(code ?? 1));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
