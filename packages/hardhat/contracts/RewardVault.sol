// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IHederaTokenService } from "./interfaces/IHederaTokenService.sol";

/// @title RewardVault
/// @notice Treasury and supply key of an HTS reward token. Tokens are minted only when a player redeems a claim
/// signed by the game's attestor, within the game's per-claim and daily caps.
contract RewardVault is Ownable, ReentrancyGuard, EIP712 {
    struct Claim {
        bytes32 gameId;
        address player;
        uint256 amount;
        bytes32 nonce;
        uint64 expiry;
    }

    struct Game {
        address signer;
        bool active;
        uint64 maxPerClaim;
        uint64 dailyCap;
        uint64 day;
        uint64 mintedToday;
    }

    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("Claim(bytes32 gameId,address player,uint256 amount,bytes32 nonce,uint64 expiry)");

    IHederaTokenService private constant HTS = IHederaTokenService(address(0x167));
    int64 private constant HTS_SUCCESS = 22;
    uint256 private constant SUPPLY_KEY = 16;
    int64 private constant AUTO_RENEW_PERIOD = 7_776_000;
    uint64 private constant MAX_HTS_AMOUNT = uint64(type(int64).max);

    uint64 public immutable liquidityCap;
    address public rewardToken;
    bool public liquidityMinted;
    mapping(bytes32 gameId => Game) public games;
    mapping(bytes32 nonce => bool) public usedNonces;

    event RewardTokenCreated(address indexed token);
    event GameRegistered(bytes32 indexed gameId, address signer, uint64 maxPerClaim, uint64 dailyCap);
    event GameActiveSet(bytes32 indexed gameId, bool active);
    event Claimed(bytes32 indexed gameId, address indexed player, uint256 amount, bytes32 nonce);

    error HtsCallFailed(string operation, int64 responseCode);
    error RewardTokenAlreadyCreated();
    error RewardTokenNotCreated();
    error InvalidGameConfig();
    error UnknownGame(bytes32 gameId);
    error GameInactive(bytes32 gameId);
    error ClaimExpired(uint64 expiry);
    error NonceAlreadyUsed(bytes32 nonce);
    error AmountOutOfRange(uint256 amount, uint64 maxPerClaim);
    error DailyCapExceeded(uint64 remaining);
    error InvalidSignature();
    error LiquidityAlreadyMinted();
    error RefundFailed();

    constructor(uint64 liquidityCap_) Ownable(msg.sender) EIP712("RewardVault", "1") {
        if (liquidityCap_ > MAX_HTS_AMOUNT) revert InvalidGameConfig();
        liquidityCap = liquidityCap_;
    }

    /// @notice Creates the HTS reward token with this vault as treasury and supply key.
    /// @dev msg.value pays the HTS creation fee; any unused HBAR is refunded to the owner.
    function initRewardToken(string calldata name, string calldata symbol, int32 decimals) external payable onlyOwner {
        if (rewardToken != address(0)) revert RewardTokenAlreadyCreated();

        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](1);
        keys[0].keyType = SUPPLY_KEY;
        keys[0].key.contractId = address(this);

        IHederaTokenService.HederaToken memory token;
        token.name = name;
        token.symbol = symbol;
        token.treasury = address(this);
        token.tokenKeys = keys;
        token.expiry = IHederaTokenService.Expiry(0, address(this), AUTO_RENEW_PERIOD);

        (int64 rc, address created) = HTS.createFungibleToken{ value: msg.value }(token, 0, decimals);
        if (rc != HTS_SUCCESS) revert HtsCallFailed("createFungibleToken", rc);
        rewardToken = created;
        emit RewardTokenCreated(created);

        uint256 leftover = address(this).balance;
        if (leftover > 0) {
            (bool ok, ) = msg.sender.call{ value: leftover }("");
            if (!ok) revert RefundFailed();
        }
    }

    /// @notice Adds or updates a game. Daily usage is kept on update so caps cannot be reset by re-registering.
    function registerGame(bytes32 gameId, address signer, uint64 maxPerClaim, uint64 dailyCap) external onlyOwner {
        if (signer == address(0) || maxPerClaim == 0 || dailyCap < maxPerClaim || dailyCap > MAX_HTS_AMOUNT) {
            revert InvalidGameConfig();
        }
        Game storage game = games[gameId];
        game.signer = signer;
        game.active = true;
        game.maxPerClaim = maxPerClaim;
        game.dailyCap = dailyCap;
        emit GameRegistered(gameId, signer, maxPerClaim, dailyCap);
    }

    function setGameActive(bytes32 gameId, bool active) external onlyOwner {
        if (games[gameId].signer == address(0)) revert UnknownGame(gameId);
        games[gameId].active = active;
        emit GameActiveSet(gameId, active);
    }

    /// @notice Redeems an attested claim. Anyone may submit it; tokens always go to `claim.player`.
    function claim(Claim calldata c, bytes calldata signature) external nonReentrant {
        if (rewardToken == address(0)) revert RewardTokenNotCreated();
        Game storage game = games[c.gameId];
        if (game.signer == address(0)) revert UnknownGame(c.gameId);
        if (!game.active) revert GameInactive(c.gameId);
        if (block.timestamp > c.expiry) revert ClaimExpired(c.expiry);
        if (usedNonces[c.nonce]) revert NonceAlreadyUsed(c.nonce);
        if (c.amount == 0 || c.amount > game.maxPerClaim) revert AmountOutOfRange(c.amount, game.maxPerClaim);

        bytes32 structHash = keccak256(abi.encode(CLAIM_TYPEHASH, c.gameId, c.player, c.amount, c.nonce, c.expiry));
        if (ECDSA.recover(_hashTypedDataV4(structHash), signature) != game.signer) revert InvalidSignature();

        uint64 today = uint64(block.timestamp / 1 days);
        if (game.day != today) {
            game.day = today;
            game.mintedToday = 0;
        }
        uint64 amount = uint64(c.amount);
        if (game.mintedToday + amount > game.dailyCap) revert DailyCapExceeded(game.dailyCap - game.mintedToday);

        game.mintedToday += amount;
        usedNonces[c.nonce] = true;
        _mintTo(c.player, amount);
        emit Claimed(c.gameId, c.player, c.amount, c.nonce);
    }

    /// @notice One-time mint to the owner to seed the DEX pool, capped at `liquidityCap`.
    function mintForLiquidity(uint64 amount) external onlyOwner {
        if (rewardToken == address(0)) revert RewardTokenNotCreated();
        if (liquidityMinted) revert LiquidityAlreadyMinted();
        if (amount == 0 || amount > liquidityCap) revert AmountOutOfRange(amount, liquidityCap);
        liquidityMinted = true;
        _mintTo(msg.sender, amount);
    }

    function _mintTo(address to, uint64 amount) private {
        int64 htsAmount = int64(amount);
        (int64 rc, , ) = HTS.mintToken(rewardToken, htsAmount, new bytes[](0));
        if (rc != HTS_SUCCESS) revert HtsCallFailed("mintToken", rc);
        rc = HTS.transferToken(rewardToken, address(this), to, htsAmount);
        if (rc != HTS_SUCCESS) revert HtsCallFailed("transferToken", rc);
    }
}
