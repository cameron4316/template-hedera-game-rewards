# packages/hardhat

The Solidity side of the Hedera Game Rewards template. For setup, the full flow and troubleshooting, see the [root README](../../README.md).

## What's here

| Path | Purpose |
| --- | --- |
| `contracts/RewardVault.sol` | Treasury and supply key of the HTS reward token. Mints for EIP-712 claims signed by a game's attestor, within per-claim and daily caps. |
| `contracts/interfaces/IHederaTokenService.sol` | Minimal interface for the HTS system contract at `0x167`. |
| `contracts/test/MockHederaTokenService.sol` | HTS test double that the tests copy to `0x167`. |
| `deploy/00_deploy_reward_vault.ts` | Deploys the vault, creates the token, registers games and seeds the SaucerSwap V1 pool. Each step checks on-chain state, so a re-run resumes. |
| `test/RewardVault.test.ts` | Offline tests on the in-process Hardhat network. |
| `scripts/` | Deployer key handling, `deployedContracts.ts` generation and Sourcify verification. |

Configuration comes from the repo-root `.env`. Contracts compile with Solidity 0.8.28 for the `cancun` EVM.

## Commands

Run these from the repo root. `yarn deploy`, `yarn verify` and `yarn test` wrap them with the right network and checks.

| Command | What it does |
| --- | --- |
| `yarn hardhat:compile` | Compiles the contracts and generates TypeChain types |
| `yarn hardhat:test` | Runs the contract tests (no network needed) |
| `yarn hardhat:deploy --network hederaTestnet` | Deploys with the deployer key from the root `.env`. Prefer `yarn deploy`, which also writes `NEXT_PUBLIC_REWARD_TOKEN_ID` |
| `yarn hardhat:verify RewardVault testnet` | Verifies a deployment on Sourcify. Prefer `yarn verify` |
| `yarn hardhat:account:import` | Stores an encrypted deployer key in the root `.env` (optional; otherwise `HEDERA_OPERATOR_KEY` deploys) |
| `yarn hardhat:account:generate`, `yarn hardhat:account`, `yarn hardhat:account:reveal-pk` | Create, show or reveal the encrypted deployer key |
| `yarn hardhat:lint`, `yarn hardhat:check-types`, `yarn hardhat:format` | Static checks and formatting |

There is no local chain. Hedera's HTS and exchange-rate system contracts don't exist on a plain Hardhat node, so tests use the mock and real behaviour is proven on testnet with `yarn demo`.
