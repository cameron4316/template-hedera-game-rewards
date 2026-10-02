import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { NETWORKS } from "../packages/nextjs/lib/rewards/constants";
import { createScoreTopic } from "../packages/nextjs/lib/rewards/hcs";
import { toRawEcdsaKey } from "../packages/nextjs/lib/rewards/ids";
import { ensureEnvFile, loadEnv, upsertEnv } from "./lib/env";
import { requireEnv, selectNetwork } from "./lib/hedera";

async function main() {
  if (ensureEnvFile()) console.log("✔ Created .env from .env.example");
  loadEnv();
  const network = selectNetwork();
  requireEnv("HEDERA_OPERATOR_ID", "HEDERA_OPERATOR_KEY");

  if (!process.env.ATTESTOR_PRIVATE_KEY) {
    upsertEnv({ ATTESTOR_PRIVATE_KEY: generatePrivateKey() });
    console.log("✔ Generated ATTESTOR_PRIVATE_KEY");
  }
  const attestor = privateKeyToAccount(toRawEcdsaKey(process.env.ATTESTOR_PRIVATE_KEY!)).address;
  console.log(`  Attestor address (registered on-chain by yarn deploy): ${attestor}`);

  if (!process.env.NEXT_PUBLIC_SCORE_TOPIC_ID) {
    const topicId = await createScoreTopic({
      network,
      accountId: process.env.HEDERA_OPERATOR_ID!,
      privateKey: process.env.HEDERA_OPERATOR_KEY!,
    });
    upsertEnv({ NEXT_PUBLIC_SCORE_TOPIC_ID: topicId });
    console.log(`✔ Created HCS score topic ${topicId}`);
  }
  console.log(`  Score topic: ${NETWORKS[network].hashscan}/topic/${process.env.NEXT_PUBLIC_SCORE_TOPIC_ID}`);
  console.log("\nSetup complete. Next: yarn deploy");
}

main().catch(error => {
  console.error(`\n✖ Setup failed: ${error instanceof Error ? error.message : error}`);
  console.error("  Check HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY (ECDSA) in the root .env, then run `yarn doctor`.");
  process.exit(1);
});
