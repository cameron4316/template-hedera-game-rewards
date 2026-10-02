import { TOKEN_UNIT } from "../constants";
import type { GameDefinition } from "./types";

export const ROUND_MS = 30_000;
const MAX_HITS = 150;
const MAX_REWARDED_HITS = 100;

/** Tap-the-target demo: one reward token per hit, at most 100 per round. */
export const demoGame: GameDefinition = {
  id: "demo",
  maxPerClaim: BigInt(MAX_REWARDED_HITS) * TOKEN_UNIT,
  dailyCap: 10_000n * TOKEN_UNIT,
  validate(result) {
    const { hits, durationMs } = (result ?? {}) as { hits?: unknown; durationMs?: unknown };
    if (typeof hits !== "number" || !Number.isInteger(hits) || hits < 1 || hits > MAX_HITS) {
      return { ok: false, reason: `hits must be an integer from 1 to ${MAX_HITS}` };
    }
    if (typeof durationMs !== "number" || durationMs < ROUND_MS - 1_000 || durationMs > ROUND_MS + 5_000) {
      return { ok: false, reason: `durationMs must be within a ${ROUND_MS / 1000}-second round` };
    }
    return { ok: true, score: hits, amount: BigInt(Math.min(hits, MAX_REWARDED_HITS)) * TOKEN_UNIT };
  },
};
