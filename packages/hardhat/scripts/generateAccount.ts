import { ethers } from "ethers";
import password from "@inquirer/password";
import { loadEnv, upsertEnv } from "../../../scripts/lib/env";

const getValidatedPassword = async () => {
  while (true) {
    const pass = await password({ message: "Enter a password to encrypt your private key:" });
    const confirmation = await password({ message: "Confirm password:" });

    if (pass === confirmation) {
      return pass;
    }
    console.log("❌ Passwords don't match. Please try again.");
  }
};

const setNewEnvConfig = async () => {
  console.log("👛 Generating new Wallet\n");
  const randomWallet = ethers.Wallet.createRandom();

  const pass = await getValidatedPassword();
  const encryptedJson = await randomWallet.encrypt(pass);

  upsertEnv({ DEPLOYER_PRIVATE_KEY_ENCRYPTED: encryptedJson });
  console.log("\n📄 Encrypted Private Key saved to the root .env file");
  console.log("🪄 Generated wallet address:", randomWallet.address, "\n");
  console.log("⚠️ Make sure to remember your password! You'll need it to decrypt the private key.");
};

async function main() {
  loadEnv();
  if (process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED) {
    console.log("⚠️ You already have a deployer account. Check DEPLOYER_PRIVATE_KEY_ENCRYPTED in the root .env file");
    return;
  }
  await setNewEnvConfig();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
