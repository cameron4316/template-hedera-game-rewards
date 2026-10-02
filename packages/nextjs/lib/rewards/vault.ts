/** The RewardVault functions the app and scripts call, as human-readable ABI (checked against the compiled ABI in tests). */
export const REWARD_VAULT_ABI = [
  "function rewardToken() view returns (address)",
  "function games(bytes32 gameId) view returns (address signer, bool active, uint64 maxPerClaim, uint64 dailyCap, uint64 day, uint64 mintedToday)",
  "function claim((bytes32 gameId, address player, uint256 amount, bytes32 nonce, uint64 expiry) c, bytes signature)",
  "event Claimed(bytes32 indexed gameId, address indexed player, uint256 amount, bytes32 nonce)",
] as const;
