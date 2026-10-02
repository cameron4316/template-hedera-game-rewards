import { AttestError, MIN_CLAIM_INTERVAL_MS, attest, gameIdHash } from "./attest";
import { CLAIM_TYPES, claimDomain } from "./claim";
import { RewardsConfig, readRewardsConfig } from "./config";
import { CLAIM_TTL_SECONDS, NETWORKS, TOKEN_UNIT } from "./constants";
import { ROUND_MS, demoGame } from "./games/demo";
import type { ScoreMessage } from "./hcs";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recoverTypedDataAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const attestorKey = generatePrivateKey();
const config: RewardsConfig = {
  network: "testnet",
  operator: { network: "testnet", accountId: "0.0.1001", privateKey: generatePrivateKey() },
  attestorKey,
  topicId: "0.0.2002",
  tokenId: "0.0.3003",
  vault: "0x00000000000000000000000000000000000a0a0a",
};
const round = { hits: 42, durationMs: ROUND_MS };
let nextPlayer = 1;
const freshPlayer = () => `0x${(nextPlayer++).toString(16).padStart(40, "0")}`;

function context(now = Date.now()) {
  const published: ScoreMessage[] = [];
  const publishScore = async (message: ScoreMessage) => {
    published.push(message);
    return {
      topicId: config.topicId,
      sequenceNumber: published.length,
      transactionId: "0.0.1001@1700000000.000000001",
    };
  };
  return { published, ctx: { config, publishScore, now } };
}

describe("demoGame.validate", () => {
  it("rewards one token per hit", () => {
    assert.deepEqual(demoGame.validate(round), { ok: true, score: 42, amount: 42n * TOKEN_UNIT });
  });

  it("caps the reward at the per-claim maximum", () => {
    const result = demoGame.validate({ hits: 140, durationMs: ROUND_MS });
    assert.equal(result.ok && result.amount, demoGame.maxPerClaim);
  });

  it("rejects impossible or malformed rounds", () => {
    for (const result of [
      { hits: 0, durationMs: ROUND_MS },
      { hits: 151, durationMs: ROUND_MS },
      { hits: 4.5, durationMs: ROUND_MS },
      { hits: 10, durationMs: 5_000 },
      null,
      "42",
    ]) {
      assert.equal(demoGame.validate(result).ok, false, JSON.stringify(result));
    }
  });
});

describe("attest", () => {
  it("signs a claim the attestor key recovers and logs the score to HCS", async () => {
    const now = 1_700_000_000_000;
    const player = freshPlayer();
    const { published, ctx } = context(now);
    const { claim, signature, hcs } = await attest({ gameId: "demo", player, result: round }, ctx);

    assert.equal(claim.gameId, gameIdHash("demo"));
    assert.equal(claim.amount, 42n * TOKEN_UNIT);
    assert.equal(claim.expiry, BigInt(now / 1000 + CLAIM_TTL_SECONDS));
    const signer = await recoverTypedDataAddress({
      domain: claimDomain(NETWORKS.testnet.chainId, config.vault),
      types: CLAIM_TYPES,
      primaryType: "Claim",
      message: claim,
      signature,
    });
    assert.equal(signer, privateKeyToAccount(attestorKey).address);
    assert.deepEqual(published, [
      { v: 1, gameId: "demo", player: claim.player, score: 42, amount: claim.amount.toString(), nonce: claim.nonce },
    ]);
    assert.equal(hcs.sequenceNumber, 1);
  });

  it("uses a fresh nonce for every claim", async () => {
    const a = await attest({ gameId: "demo", player: freshPlayer(), result: round }, context().ctx);
    const b = await attest({ gameId: "demo", player: freshPlayer(), result: round }, context().ctx);
    assert.notEqual(a.claim.nonce, b.claim.nonce);
  });

  it("rejects bad requests with the matching HTTP status", async () => {
    const cases: [object, number][] = [
      [{ gameId: "nope", player: freshPlayer(), result: round }, 400],
      [{ gameId: "demo", player: "not-an-address", result: round }, 400],
      [{ gameId: "demo", player: freshPlayer(), result: { hits: 0 } }, 422],
    ];
    for (const [request, status] of cases) {
      await assert.rejects(attest(request, context().ctx), (error: AttestError) => error.status === status);
    }
  });

  it("rate-limits each player", async () => {
    const player = freshPlayer();
    const now = Date.now();
    await attest({ gameId: "demo", player, result: round }, context(now).ctx);
    await assert.rejects(
      attest({ gameId: "demo", player, result: round }, context(now + 1_000).ctx),
      (error: AttestError) => error.status === 429,
    );
    await attest({ gameId: "demo", player, result: round }, context(now + MIN_CLAIM_INTERVAL_MS).ctx);
  });
});

describe("readRewardsConfig", () => {
  it("names every missing variable and the missing deployment", () => {
    const result = readRewardsConfig({}, undefined);
    assert.equal(result.ok, false);
    assert.deepEqual(!result.ok && result.missing, [
      "HEDERA_OPERATOR_ID",
      "HEDERA_OPERATOR_KEY",
      "ATTESTOR_PRIVATE_KEY",
      "NEXT_PUBLIC_SCORE_TOPIC_ID",
      "NEXT_PUBLIC_REWARD_TOKEN_ID",
      "RewardVault deployment (run yarn deploy)",
    ]);
  });

  it("rejects an unknown network", () => {
    const result = readRewardsConfig({ HEDERA_NETWORK: "previewnet" }, config.vault);
    assert.ok(!result.ok && result.missing.includes("HEDERA_NETWORK (testnet or mainnet)"));
  });
});
