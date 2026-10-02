/** The RewardVault functions and errors the app and scripts use, as human-readable ABI (checked against the compiled ABI in tests). */
export const REWARD_VAULT_ABI = [
  "function rewardToken() view returns (address)",
  "function games(bytes32 gameId) view returns (address signer, bool active, uint64 maxPerClaim, uint64 dailyCap, uint64 day, uint64 mintedToday)",
  "function claim((bytes32 gameId, address player, uint256 amount, bytes32 nonce, uint64 expiry) c, bytes signature)",
  "event Claimed(bytes32 indexed gameId, address indexed player, uint256 amount, bytes32 nonce)",
  "error HtsCallFailed(string operation, int64 responseCode)",
  "error UnknownGame(bytes32 gameId)",
  "error GameInactive(bytes32 gameId)",
  "error ClaimExpired(uint64 expiry)",
  "error NonceAlreadyUsed(bytes32 nonce)",
  "error AmountOutOfRange(uint256 amount, uint64 maxPerClaim)",
  "error DailyCapExceeded(uint64 remaining)",
  "error InvalidSignature()",
] as const;

const TOKEN_NOT_ASSOCIATED_TO_ACCOUNT = 184;

/** Player-facing text for a RewardVault custom error, or undefined for anything else. */
export function describeVaultError(name: string, args: readonly unknown[] = []): string | undefined {
  switch (name) {
    case "HtsCallFailed":
      return Number(args[1]) === TOKEN_NOT_ASSOCIATED_TO_ACCOUNT
        ? "Your account is not associated with the reward token. Use Associate on the Rewards page, then claim again."
        : `The Hedera Token Service rejected ${String(args[0])} with response code ${String(args[1])}.`;
    case "ClaimExpired":
      return "This claim expired after 10 minutes. Play another round.";
    case "NonceAlreadyUsed":
      return "This claim was already redeemed.";
    case "InvalidSignature":
      return "The vault does not recognise the attestor's signature. Run yarn deploy to register the current attestor.";
    case "DailyCapExceeded":
      return "Today's reward cap for this game is used up. Try again tomorrow (UTC).";
    case "GameInactive":
      return "This game is paused by the vault owner.";
    case "UnknownGame":
      return "This game is not registered on the vault. Run yarn deploy.";
    case "AmountOutOfRange":
      return "The claim amount is above the game's per-claim maximum.";
  }
}
