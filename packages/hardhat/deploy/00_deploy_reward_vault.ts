import { Contract, ContractTransactionResponse, Wallet, ZeroAddress, id } from "ethers";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  GAS,
  NETWORKS,
  NetworkName,
  POOL_SEED,
  REWARD_TOKEN,
  TINYBAR_TO_WEIBAR,
  TOKEN_CREATION_HBAR,
} from "../../nextjs/lib/rewards/constants";
import { GAMES } from "../../nextjs/lib/rewards/games";
import { entityIdToAddress, longZeroAddressToEntityId, toRawEcdsaKey } from "../../nextjs/lib/rewards/ids";
import { MirrorAccount, mirrorGet, tokenHolding } from "../../nextjs/lib/rewards/mirror";
import {
  EXCHANGE_RATE_ABI,
  EXCHANGE_RATE_ADDRESS,
  HTS_TOKEN_ABI,
  SAUCERSWAP_V1_FACTORY_ABI,
  SAUCERSWAP_V1_ROUTER_ABI,
} from "../../nextjs/lib/rewards/saucerswap";

const HEDERA_NETWORKS: Record<string, NetworkName> = { hederaTestnet: "testnet", hederaMainnet: "mainnet" };

/**
 * Deploys RewardVault, creates the HTS reward token, registers every game in lib/rewards/games and seeds the
 * SaucerSwap V1 pool. Each step checks on-chain state first, so re-running resumes where a failed run stopped.
 */
const deployRewardVault: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const network = HEDERA_NETWORKS[hre.network.name];
  if (!network) {
    throw new Error("RewardVault needs Hedera's HTS system contract. Deploy with `yarn deploy` (Hedera testnet).");
  }
  const attestorKey = process.env.ATTESTOR_PRIVATE_KEY;
  if (!attestorKey) throw new Error("ATTESTOR_PRIVATE_KEY is not set. Run `yarn setup` first.");
  const attestor = new Wallet(toRawEcdsaKey(attestorKey)).address;

  const { deployer } = await hre.getNamedAccounts();
  const signer = await hre.ethers.getSigner(deployer);
  const hashscan = NETWORKS[network].hashscan;
  const send = async (label: string, tx: Promise<ContractTransactionResponse>) => {
    const receipt = await (await tx).wait();
    console.log(`  ✔ ${label} (gas ${receipt!.gasUsed}): ${hashscan}/transaction/${receipt!.hash}`);
  };

  const { address } = await hre.deployments.deploy("RewardVault", {
    from: deployer,
    args: [POOL_SEED.tokens],
    log: true,
  });
  const vault = await hre.ethers.getContractAt("RewardVault", address, signer);

  if ((await vault.rewardToken()) === ZeroAddress) {
    await send(
      "Reward token created",
      vault.initRewardToken(REWARD_TOKEN.name, REWARD_TOKEN.symbol, REWARD_TOKEN.decimals, {
        value: TOKEN_CREATION_HBAR * 10n ** 18n,
        gasLimit: GAS.initRewardToken,
      }),
    );
  }
  const token = await vault.rewardToken();
  const tokenId = longZeroAddressToEntityId(token);
  console.log(`  Reward token ${REWARD_TOKEN.symbol}: ${hashscan}/token/${tokenId}`);

  for (const game of GAMES) {
    const gameId = id(game.id);
    const current = await vault.games(gameId);
    if (current.signer !== attestor || current.maxPerClaim !== game.maxPerClaim || current.dailyCap !== game.dailyCap) {
      await send(`Game "${game.id}" registered`, vault.registerGame(gameId, attestor, game.maxPerClaim, game.dailyCap));
    }
  }

  const routerAddress = entityIdToAddress(
    process.env.SAUCERSWAP_V1_ROUTER_ID || NETWORKS[network].saucerSwapV1RouterId,
  );
  const router = new Contract(routerAddress, SAUCERSWAP_V1_ROUTER_ABI, signer);
  const factory = new Contract(await router.factory(), SAUCERSWAP_V1_FACTORY_ABI, signer);
  const whbar: string = await router.whbar();
  if ((await factory.getPair(token, whbar)) !== ZeroAddress) {
    console.log("  SaucerSwap pool already exists");
    return;
  }

  const tokenContract = new Contract(token, HTS_TOKEN_ABI, signer);
  if (!(await vault.liquidityMinted())) {
    const { relationship } = await tokenHolding(network, deployer, tokenId);
    if (relationship === "none") {
      await send(
        "Deployer associated with reward token",
        tokenContract.associate({ gasLimit: GAS.htsApproveOrAssociate }),
      );
    }
    const gasLimit = GAS.mintForLiquidity + (relationship === "auto" ? GAS.autoAssociation : 0);
    await send("Liquidity minted", vault.mintForLiquidity(POOL_SEED.tokens, { gasLimit }));
  }
  if ((await tokenContract.allowance(deployer, routerAddress)) < POOL_SEED.tokens) {
    await send(
      "Router approved",
      tokenContract.approve(routerAddress, POOL_SEED.tokens, { gasLimit: GAS.htsApproveOrAssociate }),
    );
  }

  const account = await mirrorGet<MirrorAccount>(network, `/accounts/${deployer}`);
  if (account.max_automatic_token_associations === 0) {
    throw new Error(
      `Deployer ${account.account} has no automatic association slots, so it cannot receive the LP token. ` +
        "Set its max automatic token associations to -1 (unlimited) in your wallet or with an AccountUpdateTransaction, then re-run `yarn deploy`.",
    );
  }
  const exchangeRate = new Contract(EXCHANGE_RATE_ADDRESS, EXCHANGE_RATE_ABI, signer);
  const feeTinybars: bigint = await exchangeRate.tinycentsToTinybars.staticCall(await factory.pairCreateFee());
  // The fee is re-priced at execution; the 1% buffer covers rate drift and any excess becomes pool liquidity.
  const value = (feeTinybars + feeTinybars / 100n + POOL_SEED.tinybars) * TINYBAR_TO_WEIBAR;
  await send(
    `SaucerSwap pool created (fee ${Number(feeTinybars) / 1e8} HBAR)`,
    router.addLiquidityETHNewPool(
      token,
      POOL_SEED.tokens,
      POOL_SEED.tokens,
      0,
      deployer,
      Math.floor(Date.now() / 1000) + 600,
      {
        value,
        gasLimit: GAS.saucerSwapNewPool,
      },
    ),
  );
};

deployRewardVault.tags = ["RewardVault"];
export default deployRewardVault;
