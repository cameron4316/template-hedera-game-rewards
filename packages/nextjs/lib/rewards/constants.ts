export const REWARD_TOKEN = { name: "Arcade Reward", symbol: "ARCADE", decimals: 8 } as const;
export const TOKEN_UNIT = 10n ** BigInt(REWARD_TOKEN.decimals);

/** HBAR has 8 decimals on Hedera; the JSON-RPC relay and wallets use 18. */
export const TINYBAR_TO_WEIBAR = 10n ** 10n;

export const NETWORKS = {
  testnet: {
    chainId: 296,
    rpcUrl: "https://testnet.hashio.io/api",
    mirrorUrl: "https://testnet.mirrornode.hedera.com",
    hashscan: "https://hashscan.io/testnet",
    saucerSwapV1RouterId: "0.0.19264",
  },
  mainnet: {
    chainId: 295,
    rpcUrl: "https://mainnet.hashio.io/api",
    mirrorUrl: "https://mainnet.mirrornode.hedera.com",
    hashscan: "https://hashscan.io/mainnet",
    saucerSwapV1RouterId: "0.0.3045981",
  },
} as const;
export type NetworkName = keyof typeof NETWORKS;

/** Measured on testnet; Hedera charges at least 80% of the gas limit, so these are kept close to real usage. */
export const GAS = {
  initRewardToken: 400_000,
  claim: 300_000,
  mintForLiquidity: 300_000,
  /** Added when an HTS transfer auto-associates the recipient; the association is charged as about 700k gas. */
  autoAssociation: 900_000,
  htsApproveOrAssociate: 1_000_000,
  saucerSwapNewPool: 9_000_000,
  saucerSwapSwap: 1_200_000,
} as const;

/** HBAR attached to initRewardToken for the HTS creation fee (about $1); the vault refunds what is unused. */
export const TOKEN_CREATION_HBAR = 20n;

/** Initial SaucerSwap V1 pool seeded by `yarn deploy`: 1 ARCADE = 0.001 HBAR. The tokens are the vault's liquidity cap. */
export const POOL_SEED = { tokens: 10_000n * TOKEN_UNIT, tinybars: 10n * 10n ** 8n };

export const CLAIM_TTL_SECONDS = 600;
