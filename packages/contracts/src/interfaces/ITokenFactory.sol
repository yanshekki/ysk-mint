// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {IYskOFT} from "./IYskOFT.sol";

interface ITokenFactory {
    event Launch(
        address indexed token, address indexed deployer, bytes32 indexed salt, string name, string symbol, uint8 supplyMode
    );

    function implementation() external view returns (address);
    function endpoint() external view returns (address);
    function predictToken(bytes32 salt) external view returns (address);
    function createToken(IYskOFT.InitParams calldata params, bytes32 salt) external returns (address token);
}
