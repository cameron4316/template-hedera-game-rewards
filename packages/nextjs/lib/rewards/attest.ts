import { CLAIM_TYPES, Claim, Hex, claimDomain } from "./claim";
import type { RewardsConfig } from "./config";
import { CLAIM_TTL_SECONDS, NETWORKS } from "./constants";
import { GAMES, findGame } from "./games";
import type { HcsReceipt, ScoreMessage } from "./hcs";
import { getAddress, isAddress, keccak256, stringToBytes, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export class AttestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type AttestRequest = { gameId?: unknown; player?: unknown; result?: unknown };

export type AttestContext = {
  config: RewardsConfig;
  publishScore: (message: ScoreMessage) => Promise<HcsReceipt>;
  now?: number;
};

/** On-chain game key: keccak256 of the UTF-8 game ID. */
export const gameIdHash = (id: string) => keccak256(stringToBytes(id));

/** Demo-grade, per-process rate limit. Use a shared store (Redis, KV) when running more than one instance. */
export const MIN_CLAIM_INTERVAL_MS = 10_000;
const lastClaimAt = new Map<string, number>();

/** Turns a finished round into a signed claim and logs the score to HCS. */
export async function attest(request: AttestRequest, { config, publishScore, now = Date.now() }: AttestContext) {
  const game = typeof request.gameId === "string" ? findGame(request.gameId) : undefined;
  if (!game) {
    throw new AttestError(400, `Unknown gameId. Known games: ${GAMES.map(g => g.id).join(", ")}.`);
  }
  if (typeof request.player !== "string" || !isAddress(request.player)) {
    throw new AttestError(400, "player must be the 0x EVM address of the wallet that receives the reward.");
  }
  // Cast: the Next.js app registers abitype addresses as plain strings.
  const player = getAddress(request.player) as Hex;

  const validation = game.validate(request.result);
  if (!validation.ok) throw new AttestError(422, `Result rejected: ${validation.reason}.`);

  const last = lastClaimAt.get(player);
  if (last !== undefined && now - last < MIN_CLAIM_INTERVAL_MS) {
    const wait = Math.ceil((MIN_CLAIM_INTERVAL_MS - (now - last)) / 1000);
    throw new AttestError(429, `Too many claims for this player. Try again in ${wait}s.`);
  }
  lastClaimAt.set(player, now);

  const claim: Claim = {
    gameId: gameIdHash(game.id),
    player,
    amount: validation.amount,
    nonce: toHex(crypto.getRandomValues(new Uint8Array(32))),
    expiry: BigInt(Math.floor(now / 1000) + CLAIM_TTL_SECONDS),
  };
  const signature = await privateKeyToAccount(config.attestorKey).signTypedData({
    domain: claimDomain(NETWORKS[config.network].chainId, config.vault),
    types: CLAIM_TYPES,
    primaryType: "Claim",
    message: claim,
  });
  const hcs = await publishScore({
    v: 1,
    gameId: game.id,
    player,
    score: validation.score,
    amount: claim.amount.toString(),
    nonce: claim.nonce,
  });
  return { claim, signature, hcs };
}
