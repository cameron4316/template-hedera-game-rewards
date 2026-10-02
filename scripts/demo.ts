import { formatUnits, parseAbi } from "viem";
import { attest } from "../packages/nextjs/lib/rewards/attest";
import { readRewardsConfig } from "../packages/nextjs/lib/rewards/config";
import { GAS, NETWORKS, REWARD_TOKEN } from "../packages/nextjs/lib/rewards/constants";
import { ROUND_MS, demoGame } from "../packages/nextjs/lib/rewards/games/demo";
import { publishScore } from "../packages/nextjs/lib/rewards/hcs";
import { registrationProblems } from "../packages/nextjs/lib/rewards/registration";
import { entityIdToAddress, toMirrorTransactionId } from "../packages/nextjs/lib/rewards/ids";
import { mirrorGet, tokenRelationship } from "../packages/nextjs/lib/rewards/mirror";
import { HTS_TOKEN_ABI, SAUCERSWAP_V1_ROUTER_ABI } from "../packages/nextjs/lib/rewards/saucerswap";
import { loadEnv } from "./lib/env";
import { fail, operatorClients, readVaultDeployment, requireEnv, selectNetwork } from "./lib/hedera";

const SCRIPTED_ROUND = { hits: 42, durationMs: ROUND_MS };
const SLIPPAGE_PERCENT = 5n;

async function main() {
  loadEnv();
  const network = selectNetwork();
  requireEnv(
    "HEDERA_OPERATOR_ID",
    "HEDERA_OPERATOR_KEY",
    "ATTESTOR_PRIVATE_KEY",
    "NEXT_PUBLIC_SCORE_TOPIC_ID",
    "NEXT_PUBLIC_REWARD_TOKEN_ID",
  );
  const { address: vault, abi: vaultAbi } = readVaultDeployment(network);
  const result = readRewardsConfig(process.env, vault);
  if (!result.ok) fail(`Rewards are not configured. Missing: ${result.missing.join(", ")}`);
  const { config } = result;
  const [problem] = await registrationProblems(config, [demoGame]);
  if (problem) fail(problem);

  const { account, publicClient, walletClient } = operatorClients(network);
  const hashscan = NETWORKS[network].hashscan;
  const token = entityIdToAddress(config.tokenId);
  const routerAbi = parseAbi(SAUCERSWAP_V1_ROUTER_ABI);
  const tokenAbi = parseAbi(HTS_TOKEN_ABI);
  const send = async (label: string, hash: `0x${string}`) => {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") fail(`${label} reverted: ${hashscan}/transaction/${hash}`);
    console.log(`  ✔ ${label} (gas ${receipt.gasUsed}): ${hashscan}/transaction/${hash}`);
    return `${hashscan}/transaction/${hash}`;
  };

  console.log(`1/4 Scripted round: ${SCRIPTED_ROUND.hits} hits in ${ROUND_MS / 1000}s by ${account.address}`);
  const { claim, signature, hcs } = await attest(
    { gameId: demoGame.id, player: account.address, result: SCRIPTED_ROUND },
    { config, publishScore: message => publishScore(config.operator, config.topicId, message) },
  );
  const { transactions } = await mirrorGet<{ transactions: { consensus_timestamp: string }[] }>(
    network,
    `/transactions/${toMirrorTransactionId(hcs.transactionId)}`,
    { waitMs: 30_000 },
  );
  const hcsLink = `${hashscan}/transaction/${transactions[0].consensus_timestamp}`;
  console.log(`2/4 Attested ${formatUnits(claim.amount, REWARD_TOKEN.decimals)} ${REWARD_TOKEN.symbol}`);
  console.log(`  ✔ Score logged to HCS topic ${hcs.topicId} #${hcs.sequenceNumber}: ${hcsLink}`);

  console.log("3/4 Claiming from RewardVault");
  const relationship = await tokenRelationship(network, account.address, config.tokenId);
  if (relationship === "none") {
    await send(
      "Associated with reward token",
      await walletClient.writeContract({
        address: token,
        abi: tokenAbi,
        functionName: "associate",
        gas: BigInt(GAS.htsApproveOrAssociate),
      }),
    );
  }
  const claimLink = await send(
    "Claimed",
    await walletClient.writeContract({
      address: vault,
      abi: vaultAbi,
      functionName: "claim",
      args: [claim, signature],
      gas: BigInt(GAS.claim + (relationship === "auto" ? GAS.autoAssociation : 0)),
    }),
  );

  console.log(`4/4 Cashing out ${formatUnits(claim.amount, REWARD_TOKEN.decimals)} ${REWARD_TOKEN.symbol} on SaucerSwap V1`);
  const router = entityIdToAddress(process.env.SAUCERSWAP_V1_ROUTER_ID || NETWORKS[network].saucerSwapV1RouterId);
  const whbar = await publicClient.readContract({ address: router, abi: routerAbi, functionName: "whbar" });
  const path = [token, whbar] as const;
  const [, quoted] = await publicClient.readContract({
    address: router,
    abi: routerAbi,
    functionName: "getAmountsOut",
    args: [claim.amount, path],
  });
  const allowance = await publicClient.readContract({
    address: token,
    abi: tokenAbi,
    functionName: "allowance",
    args: [account.address, router],
  });
  if (allowance < claim.amount) {
    await send(
      "Router approved",
      await walletClient.writeContract({
        address: token,
        abi: tokenAbi,
        functionName: "approve",
        args: [router, claim.amount],
        gas: BigInt(GAS.htsApproveOrAssociate),
      }),
    );
  }
  const swapLink = await send(
    `Swapped for ~${formatUnits(quoted, 8)} HBAR`,
    await walletClient.writeContract({
      address: router,
      abi: routerAbi,
      functionName: "swapExactTokensForETH",
      args: [claim.amount, (quoted * (100n - SLIPPAGE_PERCENT)) / 100n, path, account.address, BigInt(Math.floor(Date.now() / 1000) + 600)],
      gas: BigInt(GAS.saucerSwapSwap),
    }),
  );

  console.log("\nDemo complete:");
  console.log(`  Claim: ${claimLink}`);
  console.log(`  HCS:   ${hcsLink}`);
  console.log(`  Swap:  ${swapLink}`);
}

main().catch(error => fail(`Demo failed: ${error instanceof Error ? error.message : error}`));
