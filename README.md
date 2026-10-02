# Hedera Game Rewards

A game-agnostic rewards module for Hedera, built on Scaffold-HBAR. A player finishes a round, a server attestor signs a claim, the player redeems it for HTS reward tokens from a vault contract, the score is logged to the Hedera Consensus Service (HCS), and SaucerSwap lets the player cash rewards out to HBAR. A tiny tap-the-target game is the first consumer; you swap in your own game by writing one `validate()` function.

```
 Game round ──POST /api/rewards/attest──▶ Attestor (Next.js API route)
                                            │ 1. validate(result) → amount
                                            │ 2. sign EIP-712 Claim
                                            │ 3. log score to HCS topic
                                            ▼
 Player wallet ◀──── { claim, signature } ──┘
      │
      │ claim(claim, signature)
      ▼
 RewardVault (Solidity) ── HTS system contract 0x167 ──▶ mint + transfer reward token
      │
      ▼
 SaucerSwap V1 router ──▶ swap reward token → HBAR
```

Testnet is the default. Mainnet needs `HEDERA_NETWORK=mainnet` plus a `--confirm-mainnet` flag on every script.

## Prerequisites

- [Node.js](https://nodejs.org/) 20.18.3 or later
- [Git](https://git-scm.com/) with `user.name` and `user.email` set
- Yarn through Corepack: `corepack enable` (see [Troubleshooting](#troubleshooting) if that fails on Windows)
- A funded **ECDSA** testnet account from the [Hedera Portal](https://portal.hedera.com). Fund it with **100 testnet HBAR** (the flow below costs about 51; see [Costs](#costs)). The faucet gives up to 1,000 a day.

## Quickstart

```bash
npm create scaffold-hbar@latest my-rewards -- --template cameron4316/template-hedera-game-rewards
cd my-rewards
```

The `--` before `--template` is required with `npm create`. Then run these in order; each prints the next command.

**1. `yarn doctor`**: checks Node, Yarn, Git, the JSON-RPC relay, the mirror node, and that your operator key matches your account.

```
✔ Node 24.19.0
✔ Running under Yarn
✔ Git user.name and user.email are set
⚠ No .env file yet
    → Run `yarn setup` to create it, then add your operator ID and key
```

**2. `yarn setup`**: creates `.env` from `.env.example` on first run. Paste `HEDERA_OPERATOR_ID` and `HEDERA_OPERATOR_KEY` (hex) from the portal into `.env` and run it again. It generates the attestor key and creates the HCS score topic.

```
✔ Generated ATTESTOR_PRIVATE_KEY
  Attestor address (registered on-chain by yarn deploy): 0xC1B4…296c
✔ Created HCS score topic 0.0.10829554
Setup complete. Next: yarn deploy
```

**3. `yarn deploy`**: deploys `RewardVault`, creates the reward token, registers the demo game, mints the liquidity allowance and creates the SaucerSwap pool. It takes about two minutes and about 50 HBAR. Every step checks on-chain state first, so if anything fails, re-running resumes where it stopped.

```
deploying "RewardVault" ...: deployed at 0x42aD…fD46 with 1819655 gas
  ✔ Reward token created (gas 193669): https://hashscan.io/testnet/transaction/0x8ad1…
  ✔ Game "demo" registered (gas 71699): …
  ✔ Liquidity minted (gas 769739): …
  ✔ Router approved (gas 726816): …
  ✔ SaucerSwap pool created (fee 19.34080103 HBAR) (gas 6788388): …
✔ Reward token 0.0.10829563 written to NEXT_PUBLIC_REWARD_TOKEN_ID
```

**4. `yarn verify`**: verifies `RewardVault` on Sourcify, which HashScan uses to show the contract source and decode its `Claimed` events. It needs no API key.

```
✅ exact_match — verified on Sourcify
   HashScan: https://hashscan.io/testnet/contract/0x42aDec3dde288e7298A14eB403d9d49CC510fD46
```

**5. `yarn demo`**: a headless end-to-end run: a scripted round, attestation, HCS log, claim and swap. It prints a HashScan link for each step.

```
2/4 Attested 42 ARCADE
  ✔ Score logged to HCS topic 0.0.10829554 #1: https://hashscan.io/testnet/transaction/1790966174.532199667
3/4 Claiming from RewardVault
  ✔ Claimed (gas 103405): https://hashscan.io/testnet/transaction/0x7827…
4/4 Cashing out 42 ARCADE on SaucerSwap V1
  ✔ Swapped for ~0.04250588 HBAR (gas 907708): https://hashscan.io/testnet/transaction/0x5557…
```

**6. `yarn dev`**: starts the app on http://localhost:3000. `GET /api/rewards/health` reports whether everything is configured, including whether the vault's registered signer for each game matches `ATTESTOR_PRIVATE_KEY`.

In dev mode, Next.js compiles each route the first time you open it, so a page's first visit can take several seconds (about 7 seconds per page measured here); later clicks take about 30 ms. A production build (`yarn next:build`, then `yarn next:start`) has no such delay: clicks between pages measured 6–14 ms.

## Costs

Measured on testnet with the defaults in `lib/rewards/constants.ts`:

| Step | HBAR | Where it goes |
| --- | --- | --- |
| `yarn setup` | 0.29 | HCS topic creation |
| `yarn deploy` | 49.56 | Vault deploy 1.49, HTS token creation 11.68, game registration 0.06, liquidity mint 0.63, router approval 0.60, SaucerSwap pool 35.10 (19.34 creation fee + about 10.1 HBAR of liquidity you can withdraw) |
| `yarn demo` | 1.38 | Claim 0.08, router approval 0.60, swap 0.70, HCS message 0.002 |

Plan on **100 testnet HBAR** so a retried deploy or a few extra demo runs never stall.

A player pays for their own wallet transactions. Associate and claim were measured with a fresh player account, and cash-out with `yarn demo`:

| Player action | HBAR |
| --- | --- |
| Associate ARCADE (once per account) | about 0.89 |
| Claim a reward | about 0.088 |
| Cash-out: approve the router, then swap | about 0.60 + 0.70 |

MetaMask shows a much larger "max fee" before you confirm (13.35 HBAR on a claim). That is the gas limit times the maximum gas price, not the charge. Hedera charges the gas actually used, with a floor of 80% of the limit, at the network gas price. The limits here are kept close to measured usage, so the real charge is the figure in the table.

Gas notes behind those numbers:

- **A new SaucerSwap V1 pool uses about 6.8M gas.** SaucerSwap documents 3.2M, which is too low: the call reverts with `Safe multiple associations failed!` because the HTS system contract runs out of gas while associating the new pair. `GAS.saucerSwapNewPool` is 9M.
- **The first time an account receives the reward token costs about 700k extra gas** when it is associated automatically. `yarn deploy` and `yarn demo` check the mirror node and add `GAS.autoAssociation` only when needed. Later receipts cost about 100k.

## Environment variables

Everything reads the root `.env`: scripts, Hardhat and the Next.js server. Only `.env.example` is committed. Nothing secret has a `NEXT_PUBLIC_` prefix.

| Variable | Set by | Used by | Default |
| --- | --- | --- | --- |
| `HEDERA_NETWORK` | You | Everything | `testnet` |
| `HEDERA_OPERATOR_ID` | You, from the portal | Scripts, attestor HCS writes | none |
| `HEDERA_OPERATOR_KEY` | You, ECDSA hex | Scripts, deploy, attestor HCS writes | none |
| `DEPLOYER_PRIVATE_KEY_ENCRYPTED` | `yarn hardhat:account:import` (optional) | `yarn deploy`, instead of the operator key | none |
| `ATTESTOR_PRIVATE_KEY` | `yarn setup` | Attest API route only | none |
| `NEXT_PUBLIC_SCORE_TOPIC_ID` | `yarn setup` | Attestor | none |
| `NEXT_PUBLIC_REWARD_TOKEN_ID` | `yarn deploy` | Attestor, demo | none |
| `SAUCERSWAP_V1_ROUTER_ID` | Preset | Deploy, demo | `0.0.19264` (testnet) |
| `HEDERA_MIRROR_URL` | Preset | Everything that reads | testnet mirror node |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | You, optional | Wallet connection | a shared Scaffold-HBAR project ID |
| `NEXT_PUBLIC_HEDERA_TESTNET_RPC_URL`, `NEXT_PUBLIC_HEDERA_MAINNET_RPC_URL` | You, optional | Browser reads and writes | Hashio |

The vault address comes from `packages/nextjs/contracts/deployedContracts.ts`. It ships empty, and `yarn deploy` fills it with your deployment.

## The app

### Try it in a browser

Test with a **fresh player account**, not the operator account. The operator already holds liquidity tokens and pays for every attestation, so it hides association and balance problems a real player would hit.

1. Create a second ECDSA account at [portal.hedera.com](https://portal.hedera.com) and fund it with about 5 testnet HBAR from the faucet.
2. In MetaMask, add Hedera Testnet (**Settings → Networks → Add a network manually**):

   | Field | Value |
   | --- | --- |
   | Network name | Hedera Testnet |
   | RPC URL | https://testnet.hashio.io/api |
   | Chain ID | 296 |
   | Currency symbol | HBAR |
   | Block explorer URL | https://hashscan.io/testnet |

3. Import the player account's private key into MetaMask, select Hedera Testnet, then open http://localhost:3000 and connect.

The app accepts only the network `HEDERA_NETWORK` selects (testnet by default). On any other chain, the header and the Play and Rewards pages show **Wrong network** with a switch button. Associate, Claim, Approve and Cash out stay disabled, and the attest API is never called, so no score is logged to HCS. There is no burner wallet: Scaffold-HBAR's burner would auto-connect an unfunded address that has no Hedera account.


Every page loads and returns 200 with no `.env` and no deployment, showing what to run instead. Pages read the network, vault, token, topic and router from `GET /api/rewards/health` at runtime, so after `yarn setup` or `yarn deploy` you only need to restart `yarn dev`. The layout works down to 360px phone width.

| Route | What it does | Before setup and deploy |
| --- | --- | --- |
| `/` | Overview, live config status from `/api/rewards/health`, and a leaderboard of best scores read from the HCS topic through the mirror node | Lists the missing variables and the commands to run |
| `/play` | The 30-second tap-the-target game (`components/rewards/TapGame.tsx`). When a round ends, **Claim reward** calls the attest API, then sends `claim()` from the connected wallet. It links the claim transaction and the HCS message | Playable; claiming is disabled and the page explains why |
| `/rewards` | ARCADE balance and association status (from the mirror node), an **Associate** button, and cash-out: SaucerSwap `getAmountsOut` quote, `approve` if needed, then `swapExactTokensForETH` along `[ARCADE, WHBAR token 0.0.15058]` with 5% slippage protection | Explains what `yarn deploy` creates |
| `/debug` | Scaffold-HBAR's contract debugger | Works once `deployedContracts.ts` is filled |

Wallet transactions use explicit gas limits from `GAS` in `lib/rewards/constants.ts`, measured on testnet: claim 300k (plus 900k on a first auto-associated receipt), associate and approve 1M, swap 1.2M. Before sending `claim()`, the app simulates it, so vault errors such as "not associated" or "claim expired" appear as plain sentences instead of a failed transaction. `hooks/useRewards.ts` wraps the attest call, the association check and the claim, so other game pages can reuse it.

## How it works

1. The game posts `{ gameId, player, result }` to `POST /api/rewards/attest`.
2. The attestor looks up the game in `packages/nextjs/lib/rewards/games`. That game's `validate(result)` returns the reward amount or a reason to reject.
3. A per-player rate limit runs. It is in memory, so it is demo-grade.
4. The attestor signs an EIP-712 `Claim { gameId, player, amount, nonce, expiry }` with `ATTESTOR_PRIVATE_KEY`, using a random nonce and a 10-minute expiry.
5. It logs `{ gameId, player, score, amount, nonce }` to the HCS topic. The topic's submit key is the operator key, so only the attestor can write.

   Before signing, the attestor checks that the vault's registered signer for the game matches `ATTESTOR_PRIVATE_KEY`. On a mismatch it returns 409 telling you to run `yarn deploy`, instead of handing out a claim that would revert.
6. The player (or anyone relaying for them) sends `claim(claim, signature)` to `RewardVault`. The vault checks the signer, nonce, expiry, per-claim maximum and daily cap, then mints through the HTS system contract, transfers to `claim.player` and emits `Claimed(gameId, player, amount, nonce)`.

   Each claim's nonce appears in both the HCS score message and the `Claimed` event. You can match any on-chain payout to the attested round that produced it, and spot attestations that were never claimed.
7. The player swaps the reward token for HBAR on SaucerSwap V1.

Response shapes:

```bash
curl -X POST http://localhost:3000/api/rewards/attest \
  -H "content-type: application/json" \
  -d '{"gameId":"demo","player":"0xYourEvmAddress","result":{"hits":42,"durationMs":30000}}'
# 200 { "claim": { "gameId", "player", "amount", "nonce", "expiry" }, "signature", "hcs": { "topicId", "sequenceNumber", "transactionId" } }
# 400 unknown game or bad address · 422 result rejected · 429 rate limited · 409 vault signer mismatch (run yarn deploy) · 503 not configured (lists missing variables)
```

## Add rewards to your own game

1. Write a `GameDefinition` next to `packages/nextjs/lib/rewards/games/demo.ts`. It needs an `id`, `maxPerClaim` and `dailyCap` (in the token's smallest unit, 8 decimals), and `validate(result)`. `validate` is the only place your game's rules live.
2. Add it to `GAMES` in `packages/nextjs/lib/rewards/games/index.ts`.
3. Run `yarn deploy`. It registers every game in `GAMES` on the vault (keyed by `keccak256(id)`) with the attestor as signer, and updates caps that changed.
4. From your game, POST the result to `/api/rewards/attest`, then send `claim()` from the player's wallet. In this Next.js app, replace `TapGame` and call `useRewards().claimRound(gameId, result)`. Any engine works: Unity, Godot and native games make the same HTTP call shown above, with `requestClaim()` in `lib/rewards/api.ts` as the reference client.

The vault caps limit the damage from a cheated client or a leaked attestor key. They do not make client-reported results trustworthy, so keep anything valuable server-authoritative.

## Hedera gotchas

- **Response codes, not reverts.** HTS calls return an `int64` code. `RewardVault` reverts with `HtsCallFailed(operation, code)` for anything other than 22 (SUCCESS). For example, 184 means the player is not associated with the token.
- **Token association.** A player must be associated with the reward token, or have a free auto-association slot. Accounts with unlimited auto-association (`-1`, the portal default for ECDSA accounts) are associated on first receipt. That costs about 700k extra gas, so scripts add `GAS.autoAssociation` when the mirror node shows the account is not yet associated.
- **Gas is charged on the limit.** Hedera charges at least 80% of the gas limit. The limits in `lib/rewards/constants.ts` are measured on testnet, not padded.
- **8 vs 18 decimals.** Inside contracts, `msg.value` is in tinybars (8 decimals). The JSON-RPC relay and wallets use 18. `TINYBAR_TO_WEIBAR` converts.
- **SaucerSwap has two WHBAR addresses.** `router.whbar()` returns the WHBAR token (`0.0.15058` on testnet), which is used in pairs and swap paths. `router.WHBAR()` returns the wrapper contract (`0.0.15057`).
- **New pools need about 6.8M gas, not the documented 3.2M.** Creating a pool creates an HTS LP token and makes two associations. The pool creation fee is $2, priced in tinycents through the exchange-rate system contract (about 19 HBAR).
- **The HTS creation fee is paid in `msg.value`.** `yarn deploy` attaches 20 HBAR to `initRewardToken`. About 11.7 is used and the vault refunds the rest.
- **Balances come from the mirror node.** Every balance and association check (`yarn doctor`, `tokenHolding()` in `lib/rewards/mirror.ts`, the Rewards page) reads the mirror node REST API, never the SDK's `AccountBalanceQuery`. Hedera has been throttling that consensus-node query since release v0.74 and schedules its removal on mainnet with release v0.77. If you need an HBAR balance through the SDK, use `MirrorNodeAccountBalanceQuery` (`@hiero-ledger/sdk` v2.87.0 or later). It returns HBAR only, so token balances still come from the mirror node's `/accounts/{id}/tokens` endpoint.
- **No HTS locally.** Local Hardhat has no code at `0x167`, so the tests copy a mock there. Real behaviour is proven on testnet by `yarn demo`.

## Scripts

| Command | What it does | Needs first |
| --- | --- | --- |
| `yarn doctor` | Checks Node, Yarn, Git, RPC, mirror node, operator key and balance | Nothing |
| `yarn setup` | Creates `.env`, generates the attestor key, creates the HCS score topic | Operator ID and key in `.env` |
| `yarn deploy` | Deploys the vault, creates the token, registers games, seeds the SaucerSwap pool | `yarn setup`, about 50 HBAR |
| `yarn verify` | Verifies RewardVault on Sourcify so HashScan shows its source and decodes events | `yarn deploy` |
| `yarn demo` | Headless round → attest → HCS → claim → swap, with HashScan links | `yarn deploy` |
| `yarn dev` | Next.js on port 3000 | Nothing |
| `yarn test` | Contract tests (HTS mocked) and rewards unit tests, offline | Nothing |
| `yarn lint`, `yarn check-types`, `yarn next:build` | Static checks and production build | Nothing |
| `yarn next:start` | Serves the production build on port 3000 | `yarn next:build` |

## Testing

`yarn test` runs offline:

- `packages/hardhat/test/RewardVault.test.ts`: valid claims, replayed nonces, expired claims, wrong signers, tampered claims, per-claim and daily caps, paused and unknown games, HTS error codes, and liquidity and admin rules. Claims are signed with the same `CLAIM_TYPES` the attestor uses, so any mismatch between the TypeScript types and the contract fails here.
- `packages/nextjs/lib/rewards/rewards.test.ts`: the demo `validate()`, signature recovery, HCS payloads, HTTP status codes, rate limiting and config errors.

`yarn demo` is the integration test for HTS, HCS and SaucerSwap together. Testnet transaction links from building this template, including a fresh player claim with its matching HCS message, are in [docs/evidence.md](docs/evidence.md).

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| PowerShell: `running scripts is disabled on this system` when running `npx`, `npm` or `yarn` | Windows execution policy blocks the `.ps1` shims | Use `npx.cmd` / `npm.cmd` / `yarn.cmd`, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once |
| `corepack enable` fails with `EPERM` on Windows | Node is installed in `C:\Program Files` | Run `corepack enable --install-directory "$(npm config get prefix)" yarn`, or use an admin terminal |
| `HEDERA_OPERATOR_KEY does not belong to 0.0.x` from `yarn doctor` | Key copied from a different account | Copy the hex private key for that exact account from the portal |
| `Operator … uses a ED25519 key` | The account was created with an Ed25519 key | Create an ECDSA account; the EVM tooling needs ECDSA |
| `yarn deploy` stops partway with `transaction execution reverted` or `could not coalesce error` | A relay hiccup or an underfunded step | Re-run `yarn deploy`; it resumes from the last completed step |
| A claim reverts with `HtsCallFailed("transferToken", 184)` | The player is not associated and has no free auto-association slots | Associate the account with the token (HashPack, or `associate()` on the token address), then claim again |
| `HtsCallFailed(…)` or a revert whose trace shows `INSUFFICIENT_GAS` | Gas limit too low for an HTS call; first-time auto-association costs about 700k | Raise the matching value in `GAS` (`lib/rewards/constants.ts`) |
| `/api/rewards/attest` returns 503 | The server cannot see a variable or the deployment | Check `GET /api/rewards/health`, which lists exactly what is missing |
| `/rewards` says `… has no Hedera testnet account yet` | The connected wallet has never received HBAR, so no Hedera account exists for it | Connect a funded testnet wallet, or send HBAR to that address from the portal faucet |
| **Wrong network** in the header, and Claim or Cash out disabled | The wallet is on another chain, such as Hedera Mainnet (295) | Click **Switch to Hedera testnet**, or add Hedera Testnet to MetaMask as shown in [Try it in a browser](#try-it-in-a-browser) |
| The first click on a page takes several seconds in `yarn dev` | Next.js dev mode compiles each route on first visit | Expected in dev; a production build (`yarn next:build`, then `yarn next:start`) navigates in milliseconds |
| HashScan shows raw hex for `Claimed` events | The vault is not verified | Run `yarn verify` |
| `/api/rewards/attest` returns 409 `registered to signer …` | `ATTESTOR_PRIVATE_KEY` changed, or `.env` points at a different vault | Run `yarn deploy`; it re-registers every game to the current attestor |

## Compliance

This is general information, not legal advice. The defaults keep the template on the safe side:

- Free to play, with no paid entry.
- Rewards come only from `validate(result)`, never from chance.
- Testnet by default.
- Hard on-chain caps per claim and per day.
- Neutral wording: "rewards", never "earn money".

Before any mainnet launch, get legal review covering gambling and sweepstakes law, securities rules for a tradeable token, money transmission and KYC/AML, tax reporting, age limits and app-store rules.

## Licence and credits

MIT. See [LICENCE](LICENCE). Built on [Scaffold-HBAR](https://docs.hedera.com/solutions/tools/scaffold-hbar/index) (hedera-dev), which is built on [Scaffold-ETH 2](https://scaffoldeth.io) (BuidlGuidl). Uses [OpenZeppelin Contracts](https://www.openzeppelin.com/contracts), the [Hiero JavaScript SDK](https://github.com/hiero-ledger/hiero-sdk-js) and [SaucerSwap](https://www.saucerswap.finance).
