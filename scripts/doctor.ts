import { spawnSync } from "child_process";
import * as fs from "fs";
import { privateKeyToAccount } from "viem/accounts";
import { NETWORKS } from "../packages/nextjs/lib/rewards/constants";
import { toRawEcdsaKey } from "../packages/nextjs/lib/rewards/ids";
import { mirrorGet, mirrorUrl } from "../packages/nextjs/lib/rewards/mirror";
import { ENV_PATH, loadEnv } from "./lib/env";
import { selectNetwork } from "./lib/hedera";

const MIN_NODE = [20, 18, 3];
const RECOMMENDED_HBAR = 100;
let failures = 0;

const ok = (message: string) => console.log(`✔ ${message}`);
const warn = (message: string, fix: string) => console.log(`⚠ ${message}\n    → ${fix}`);
const bad = (message: string, fix: string) => {
  failures++;
  console.log(`✖ ${message}\n    → ${fix}`);
};

/** Compressed secp256k1 public key, the form the mirror node reports for ECDSA account keys. */
function compressedPublicKey(privateKey: string) {
  const uncompressed = privateKeyToAccount(toRawEcdsaKey(privateKey)).publicKey.slice(4);
  const x = uncompressed.slice(0, 64);
  const yIsOdd = parseInt(uncompressed.slice(-1), 16) % 2 === 1;
  return `${yIsOdd ? "03" : "02"}${x}`;
}

async function main() {
  const node = process.versions.node.split(".").map(Number);
  const nodeOk = node[0] !== MIN_NODE[0] ? node[0] > MIN_NODE[0] : node[1] > MIN_NODE[1] || (node[1] === MIN_NODE[1] && node[2] >= MIN_NODE[2]);
  if (nodeOk) ok(`Node ${process.versions.node}`);
  else bad(`Node ${process.versions.node} is too old`, `Install Node ${MIN_NODE.join(".")} or later from https://nodejs.org`);

  if (process.env.npm_config_user_agent?.startsWith("yarn")) ok("Running under Yarn");
  else warn("Not running under Yarn", "Run `corepack enable`, then use `yarn doctor`");

  const git = (key: string) => spawnSync("git", ["config", key], { encoding: "utf8" }).stdout?.trim();
  if (git("user.name") && git("user.email")) ok("Git user.name and user.email are set");
  else bad("Git user.name or user.email is not set", 'Run `git config --global user.name "Your Name"` and `git config --global user.email you@example.com`');

  if (!fs.existsSync(ENV_PATH)) {
    warn("No .env file yet", "Run `yarn setup` to create it, then add your operator ID and key");
    return;
  }
  loadEnv();
  const network = selectNetwork();
  ok(`Network: ${network}`);

  const { rpcUrl, chainId } = NETWORKS[network];
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    const { result } = (await res.json()) as { result: string };
    if (Number(result) === chainId) ok(`JSON-RPC relay ${rpcUrl} (chain ${chainId})`);
    else bad(`JSON-RPC relay returned chain ${Number(result)}, expected ${chainId}`, "Check HEDERA_NETWORK in the root .env");
  } catch {
    bad(`JSON-RPC relay ${rpcUrl} is unreachable`, "Check your internet connection or proxy, then retry");
  }

  try {
    await mirrorGet(network, "/network/nodes?limit=1");
    ok(`Mirror node ${mirrorUrl(network)}`);
  } catch {
    bad(`Mirror node ${mirrorUrl(network)} is unreachable`, "Check HEDERA_MIRROR_URL in the root .env and your connection");
  }

  const { HEDERA_OPERATOR_ID: operatorId, HEDERA_OPERATOR_KEY: operatorKey } = process.env;
  if (!operatorId || !operatorKey) {
    bad("HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY is empty", "Create a testnet ECDSA account at https://portal.hedera.com and paste its ID and hex key into .env");
    return;
  }
  try {
    const account = await mirrorGet<{ balance: { balance: number }; key: { _type: string; key: string } }>(
      network,
      `/accounts/${operatorId}`,
    );
    if (account.key._type !== "ECDSA_SECP256K1") {
      bad(`Operator ${operatorId} uses a ${account.key._type} key`, "Create an ECDSA account at https://portal.hedera.com; the EVM tooling needs ECDSA");
    } else if (account.key.key !== compressedPublicKey(operatorKey)) {
      bad(`HEDERA_OPERATOR_KEY does not belong to ${operatorId}`, "Copy the private key for this exact account from https://portal.hedera.com");
    } else {
      ok(`Operator ${operatorId} key matches`);
    }
    const hbar = account.balance.balance / 1e8;
    if (hbar >= RECOMMENDED_HBAR) ok(`Operator balance ${hbar.toFixed(2)} HBAR`);
    else warn(`Operator balance ${hbar.toFixed(2)} HBAR (deploy needs about 60)`, "Top up at https://portal.hedera.com/faucet");
  } catch {
    bad(`Operator ${operatorId} was not found on ${network}`, "Check HEDERA_OPERATOR_ID and HEDERA_NETWORK in the root .env");
  }
}

main().then(() => {
  console.log(failures === 0 ? "\nAll checks passed. Next: yarn setup" : `\n${failures} check(s) failed. Fix them and re-run yarn doctor.`);
  process.exit(failures === 0 ? 0 : 1);
});
