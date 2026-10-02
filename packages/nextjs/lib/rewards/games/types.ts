export type Validation = { ok: true; score: number; amount: bigint } | { ok: false; reason: string };

/**
 * A game the attestor can sign claims for. `validate` is the only place the game's rules live;
 * `maxPerClaim` and `dailyCap` (smallest token units) are enforced again on-chain by RewardVault.
 * On-chain, the game is keyed by keccak256 of the UTF-8 `id`.
 */
export type GameDefinition = {
  id: string;
  maxPerClaim: bigint;
  dailyCap: bigint;
  validate: (result: unknown) => Validation;
};
