# Testnet evidence

All transactions are on Hedera testnet, checked against the mirror node. The deployment is the reference deployment from building this template; your own `yarn deploy` creates a separate vault, token and topic.

The reference vault was deployed and verified from RewardVault.sol as of commit `7a44003`. A later fix changed only what `DailyCapExceeded` reports when an owner lowers a game's daily cap below that day's mints (now 0 instead of an arithmetic panic). Claims, caps and minting behave the same, but the bytecode differs, so a fresh `yarn deploy` and `yarn verify` are needed to match the current source.

## Reference deployment

| Item | ID | Link |
| --- | --- | --- |
| RewardVault (verified on Sourcify, exact match) | `0x42aDec3dde288e7298A14eB403d9d49CC510fD46` | [contract](https://hashscan.io/testnet/contract/0x42aDec3dde288e7298A14eB403d9d49CC510fD46) |
| ARCADE reward token (HTS, vault is treasury and supply key) | `0.0.10829563` | [token](https://hashscan.io/testnet/token/0.0.10829563) |
| HCS score topic (submit key = operator) | `0.0.10829554` | [topic](https://hashscan.io/testnet/topic/0.0.10829554) |
| ARCADE/WHBAR pool on SaucerSwap V1 | router `0.0.19264` | [pool creation](https://hashscan.io/testnet/transaction/0x80e69af715d521180015c2b99bb0736d4abeafa9c592e687cc73877f4aa3fb7e) |

`yarn deploy` transactions:

| Step | Gas used | Link |
| --- | --- | --- |
| Deploy RewardVault | 1,819,655 | [tx](https://hashscan.io/testnet/transaction/0x215ce27221bef4ade3fc193eabd775b9b651cc1d76a0364226130d04f18bb24f) |
| Create ARCADE through the HTS system contract (`initRewardToken`) | 193,669 | [tx](https://hashscan.io/testnet/transaction/0x8ad1a8834e408a1c22f783c2a332c623b0c1adf9317eec2f012878c049eb462e) |
| Register the `demo` game | 71,699 | [tx](https://hashscan.io/testnet/transaction/0x1467accb0d723c4ebde5d2a072ad91274a5fbef0a394429a3e8cc57e954e4866) |
| Mint 10,000 ARCADE for liquidity (auto-associates the deployer) | 769,739 | [tx](https://hashscan.io/testnet/transaction/0x0b52a4b6baa3d8148077d29ea1311b5d97d2969dcf4259a0660605aead2e7e11) |
| Approve the SaucerSwap router | 726,816 | [tx](https://hashscan.io/testnet/transaction/0xe30a34b70f843d545f3138440a02e305c312cbe5b8ceb9335e1b7944ad67ce21) |
| Create the ARCADE/HBAR pool (`addLiquidityETHNewPool`) | 6,788,388 | [tx](https://hashscan.io/testnet/transaction/0x80e69af715d521180015c2b99bb0736d4abeafa9c592e687cc73877f4aa3fb7e) |

## Fresh player claim from the browser

A separate testnet player account (`0x99Eb8d449858b8e22259Bd6c0B97FF016Bbb39A9`, not the operator) played a round on `/play` and claimed from MetaMask.

| What | Detail | Link |
| --- | --- | --- |
| Claim | Transaction `0.0.7314364@1790977476.447530604`, consensus `1790977482.538342203`, 103,140 gas, 0.0877 HBAR fee. RewardVault minted 50 ARCADE and transferred it to the player: the token's `Transfer` and the vault's `Claimed(gameId, player, 5000000000, nonce)` | [claim tx](https://hashscan.io/testnet/transaction/0xfff3fdc16f4d757ac53f1d7118c3f1a99b53186a527e3317ef66283f2f4682be) |
| HCS score | Message #3 on topic `0.0.10829554`, consensus `1790977471.464165567`: `{"v":1,"gameId":"demo","player":"0x99Eb…39A9","score":50,"amount":"5000000000","nonce":"0x45c06ea9…dc323b"}` | [HCS message](https://hashscan.io/testnet/transaction/1790977471.464165567) |

The same nonce, `0x45c06ea9a7c82d62edca67a5e6cfbce1601ac7b39c29025fea1a602fbcdc323b`, appears in the HCS message and in the `Claimed` event. That links the on-chain payout to the attested round.

## `yarn demo` (headless, operator account)

| Step | Link |
| --- | --- |
| HCS score message #1 | [tx](https://hashscan.io/testnet/transaction/1790966174.532199667) |
| Claim of 42 ARCADE | [tx](https://hashscan.io/testnet/transaction/0x782792367bef5c4aff833de39d82c9e0b0002fbca7c37b401b8c94f4dbac34da) |
| Swap 42 ARCADE for about 0.0425 HBAR on SaucerSwap V1 | [tx](https://hashscan.io/testnet/transaction/0x5557cafe3d03b9367378eac7261a2f2bd59a9d2c292636b38765b0267844b1f6) |
