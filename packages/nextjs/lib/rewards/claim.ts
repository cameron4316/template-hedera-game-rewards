export type Hex = `0x${string}`;

/** Mirrors `RewardVault.Claim`. */
export type Claim = {
  gameId: Hex;
  player: Hex;
  amount: bigint;
  nonce: Hex;
  expiry: bigint;
};

/** JSON-safe form of a claim, as returned by POST /api/rewards/attest. */
export type SerializedClaim = Omit<Claim, "amount" | "expiry"> & { amount: string; expiry: string };

export const CLAIM_TYPES = {
  Claim: [
    { name: "gameId", type: "bytes32" },
    { name: "player", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "bytes32" },
    { name: "expiry", type: "uint64" },
  ],
} as const;

export const claimDomain = (chainId: number, verifyingContract: Hex) => ({
  name: "RewardVault",
  version: "1",
  chainId,
  verifyingContract,
});

export const serializeClaim = (claim: Claim): SerializedClaim => ({
  ...claim,
  amount: claim.amount.toString(),
  expiry: claim.expiry.toString(),
});

export const parseClaim = (claim: SerializedClaim): Claim => ({
  ...claim,
  amount: BigInt(claim.amount),
  expiry: BigInt(claim.expiry),
});
