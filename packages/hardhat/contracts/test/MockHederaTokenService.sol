// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IHederaTokenService } from "../interfaces/IHederaTokenService.sol";

/// Test double for the HTS system contract. Tests copy its runtime code to 0x167 with `hardhat_setCode`,
/// so it must not rely on constructor-initialised state. It keeps the whole creation fee it is sent.
contract MockHederaTokenService is IHederaTokenService {
    int64 private constant SUCCESS = 22;
    address public constant TOKEN = address(0x7E57);

    int64 public transferResponseCode;
    int64 public totalSupply;
    mapping(address account => int64) public balanceOf;

    /// Makes every transferToken return `code` (e.g. 184 TOKEN_NOT_ASSOCIATED_TO_ACCOUNT); 0 restores SUCCESS.
    function setTransferResponseCode(int64 code) external {
        transferResponseCode = code;
    }

    function createFungibleToken(
        HederaToken memory,
        int64,
        int32
    ) external payable returns (int64 responseCode, address tokenAddress) {
        return (SUCCESS, TOKEN);
    }

    function mintToken(
        address,
        int64 amount,
        bytes[] memory
    ) external returns (int64 responseCode, int64 newTotalSupply, int64[] memory serialNumbers) {
        totalSupply += amount;
        balanceOf[msg.sender] += amount;
        return (SUCCESS, totalSupply, serialNumbers);
    }

    function transferToken(
        address,
        address sender,
        address recipient,
        int64 amount
    ) external returns (int64 responseCode) {
        if (transferResponseCode != 0) return transferResponseCode;
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;
        return SUCCESS;
    }
}
