import * as chains from "viem/chains";

export type ScaffoldConfig = {
  targetNetworks: readonly [chains.Chain, ...chains.Chain[]];
  pollingInterval: number;
  rpcOverrides?: Record<number, string>;
  enableBurnerWallet: boolean;
  walletConnectProjectId: string;
};

// The app accepts exactly one network, chosen by HEDERA_NETWORK in the root .env (exposed by next.config.ts).
// Wallets on any other chain see "Wrong network" with a switch button.
const targetNetworks = [
  process.env.NEXT_PUBLIC_HEDERA_NETWORK === "mainnet" ? chains.hedera : chains.hederaTestnet,
] as const satisfies readonly [chains.Chain, ...chains.Chain[]];

const scaffoldConfig = {
  targetNetworks,

  pollingInterval: 10000,

  // Off: a burner auto-connects an unfunded address that has no Hedera account.
  enableBurnerWallet: false,

  rpcOverrides: {
    [chains.hedera.id]: process.env.NEXT_PUBLIC_HEDERA_MAINNET_RPC_URL || "https://mainnet.hashio.io/api",
    [chains.hederaTestnet.id]: process.env.NEXT_PUBLIC_HEDERA_TESTNET_RPC_URL || "https://testnet.hashio.io/api",
  },

  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64",
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;
