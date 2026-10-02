import { expect } from "chai";
import { ethers, network } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { MockHederaTokenService, RewardVault } from "../typechain-types";
import { CLAIM_TYPES, Claim, claimDomain, Hex } from "../../nextjs/lib/rewards/claim";
import { REWARD_TOKEN } from "../../nextjs/lib/rewards/constants";
import { demoGame } from "../../nextjs/lib/rewards/games/demo";
import { REWARD_VAULT_ABI } from "../../nextjs/lib/rewards/vault";

const HTS_ADDRESS = "0x0000000000000000000000000000000000000167";
const DEMO_ID = ethers.id(demoGame.id) as Hex;
const SMALL_ID = ethers.id("small-caps") as Hex;
const LIQUIDITY_CAP = 50_000n;
const TOKEN_NOT_ASSOCIATED_TO_ACCOUNT = 184;

describe("RewardVault", () => {
  async function deployFixture() {
    const [owner, attestor, player, relayer, stranger] = await ethers.getSigners();

    const mock = await (await ethers.getContractFactory("MockHederaTokenService")).deploy();
    await network.provider.send("hardhat_setCode", [HTS_ADDRESS, await ethers.provider.getCode(mock)]);
    const hts = (await ethers.getContractAt(
      "MockHederaTokenService",
      HTS_ADDRESS,
    )) as unknown as MockHederaTokenService;

    const vault = (await (
      await ethers.getContractFactory("RewardVault")
    ).deploy(LIQUIDITY_CAP)) as unknown as RewardVault;
    await vault.initRewardToken(REWARD_TOKEN.name, REWARD_TOKEN.symbol, REWARD_TOKEN.decimals, {
      value: ethers.parseEther("20"),
    });
    await vault.registerGame(DEMO_ID, attestor.address, demoGame.maxPerClaim, demoGame.dailyCap);
    await vault.registerGame(SMALL_ID, attestor.address, 10, 25);

    const { chainId } = await ethers.provider.getNetwork();
    const domain = claimDomain(Number(chainId), (await vault.getAddress()) as Hex);
    const types = { Claim: [...CLAIM_TYPES.Claim] };

    const makeClaim = async (overrides: Partial<Claim> = {}): Promise<Claim> => ({
      gameId: DEMO_ID,
      player: player.address as Hex,
      amount: 42n,
      nonce: ethers.hexlify(ethers.randomBytes(32)) as Hex,
      expiry: BigInt((await time.latest()) + 600),
      ...overrides,
    });
    const sign = (claim: Claim, signer: HardhatEthersSigner = attestor) => signer.signTypedData(domain, types, claim);

    return { vault, hts, owner, attestor, player, relayer, stranger, makeClaim, sign };
  }

  describe("initRewardToken", () => {
    it("creates the token once, as owner", async () => {
      const { vault, stranger } = await loadFixture(deployFixture);
      expect(await vault.rewardToken()).to.not.equal(ethers.ZeroAddress);
      await expect(vault.initRewardToken("A", "A", 8)).to.be.revertedWithCustomError(
        vault,
        "RewardTokenAlreadyCreated",
      );
      await expect(vault.connect(stranger).initRewardToken("A", "A", 8)).to.be.revertedWithCustomError(
        vault,
        "OwnableUnauthorizedAccount",
      );
    });
  });

  describe("claim", () => {
    it("mints to the player for a valid claim relayed by anyone", async () => {
      const { vault, hts, player, relayer, makeClaim, sign } = await loadFixture(deployFixture);
      const claim = await makeClaim();
      await expect(vault.connect(relayer).claim(claim, await sign(claim)))
        .to.emit(vault, "Claimed")
        .withArgs(DEMO_ID, player.address, claim.amount, claim.nonce);
      expect(await hts.balanceOf(player.address)).to.equal(claim.amount);
    });

    it("rejects a replayed nonce", async () => {
      const { vault, makeClaim, sign } = await loadFixture(deployFixture);
      const claim = await makeClaim();
      const signature = await sign(claim);
      await vault.claim(claim, signature);
      await expect(vault.claim(claim, signature)).to.be.revertedWithCustomError(vault, "NonceAlreadyUsed");
    });

    it("rejects an expired claim", async () => {
      const { vault, makeClaim, sign } = await loadFixture(deployFixture);
      const claim = await makeClaim();
      await time.increaseTo(claim.expiry + 1n);
      await expect(vault.claim(claim, await sign(claim))).to.be.revertedWithCustomError(vault, "ClaimExpired");
    });

    it("rejects a signature from anyone but the game's attestor", async () => {
      const { vault, stranger, makeClaim, sign } = await loadFixture(deployFixture);
      const claim = await makeClaim();
      await expect(vault.claim(claim, await sign(claim, stranger))).to.be.revertedWithCustomError(
        vault,
        "InvalidSignature",
      );
    });

    it("rejects a claim altered after signing", async () => {
      const { vault, makeClaim, sign } = await loadFixture(deployFixture);
      const claim = await makeClaim();
      const signature = await sign(claim);
      await expect(vault.claim({ ...claim, amount: claim.amount + 1n }, signature)).to.be.revertedWithCustomError(
        vault,
        "InvalidSignature",
      );
    });

    it("rejects amounts above the per-claim maximum", async () => {
      const { vault, makeClaim, sign } = await loadFixture(deployFixture);
      const claim = await makeClaim({ amount: demoGame.maxPerClaim + 1n });
      await expect(vault.claim(claim, await sign(claim))).to.be.revertedWithCustomError(vault, "AmountOutOfRange");
    });

    it("enforces the daily cap and resets it the next day", async () => {
      const { vault, makeClaim, sign } = await loadFixture(deployFixture);
      const redeem = async () => {
        const claim = await makeClaim({ gameId: SMALL_ID, amount: 10n });
        return vault.claim(claim, await sign(claim));
      };
      await redeem();
      await redeem();
      await expect(redeem()).to.be.revertedWithCustomError(vault, "DailyCapExceeded").withArgs(5);
      await time.increase(24 * 60 * 60);
      await expect(redeem()).to.emit(vault, "Claimed");
    });

    it("rejects claims for paused or unknown games", async () => {
      const { vault, makeClaim, sign } = await loadFixture(deployFixture);
      await vault.setGameActive(DEMO_ID, false);
      const paused = await makeClaim();
      await expect(vault.claim(paused, await sign(paused))).to.be.revertedWithCustomError(vault, "GameInactive");

      const unknown = await makeClaim({ gameId: ethers.id("unknown") as Hex });
      await expect(vault.claim(unknown, await sign(unknown))).to.be.revertedWithCustomError(vault, "UnknownGame");
    });

    it("surfaces the HTS response code when the player is not associated", async () => {
      const { vault, hts, makeClaim, sign } = await loadFixture(deployFixture);
      await hts.setTransferResponseCode(TOKEN_NOT_ASSOCIATED_TO_ACCOUNT);
      const claim = await makeClaim();
      await expect(vault.claim(claim, await sign(claim)))
        .to.be.revertedWithCustomError(vault, "HtsCallFailed")
        .withArgs("transferToken", TOKEN_NOT_ASSOCIATED_TO_ACCOUNT);
    });
  });

  it("matches the hand-written ABI the app and scripts use", async () => {
    const { vault } = await loadFixture(deployFixture);
    const compiledAbi = ethers.Interface.from(vault.interface.fragments);
    for (const fragment of new ethers.Interface(REWARD_VAULT_ABI).fragments) {
      const signature = fragment.format("sighash");
      const compiled = fragment.type === "event" ? compiledAbi.getEvent(signature) : compiledAbi.getFunction(signature);
      expect(compiled?.format("full"), signature).to.equal(fragment.format("full"));
    }
  });

  describe("admin", () => {
    it("mints liquidity once, within the cap, to the owner", async () => {
      const { vault, hts, owner } = await loadFixture(deployFixture);
      await expect(vault.mintForLiquidity(LIQUIDITY_CAP + 1n)).to.be.revertedWithCustomError(vault, "AmountOutOfRange");
      await vault.mintForLiquidity(LIQUIDITY_CAP);
      expect(await hts.balanceOf(owner.address)).to.equal(LIQUIDITY_CAP);
      await expect(vault.mintForLiquidity(1)).to.be.revertedWithCustomError(vault, "LiquidityAlreadyMinted");
    });

    it("validates game config and restricts admin calls to the owner", async () => {
      const { vault, attestor, stranger } = await loadFixture(deployFixture);
      await expect(vault.registerGame(DEMO_ID, ethers.ZeroAddress, 1, 1)).to.be.revertedWithCustomError(
        vault,
        "InvalidGameConfig",
      );
      await expect(vault.registerGame(DEMO_ID, attestor.address, 10, 5)).to.be.revertedWithCustomError(
        vault,
        "InvalidGameConfig",
      );
      await expect(vault.connect(stranger).registerGame(DEMO_ID, attestor.address, 1, 1)).to.be.revertedWithCustomError(
        vault,
        "OwnableUnauthorizedAccount",
      );
      await expect(vault.connect(stranger).setGameActive(DEMO_ID, false)).to.be.revertedWithCustomError(
        vault,
        "OwnableUnauthorizedAccount",
      );
    });
  });
});
