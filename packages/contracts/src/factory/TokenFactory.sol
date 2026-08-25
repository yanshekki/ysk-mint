// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {YskOFT} from "../token/YskOFT.sol";
import {Create2Clone} from "./Create2Clone.sol";
import {LaunchValidation} from "../libraries/LaunchValidation.sol";
import {IYskOFT} from "../interfaces/IYskOFT.sol";
import {ITokenFactory} from "../interfaces/ITokenFactory.sol";

contract TokenFactory is ITokenFactory {
    address public immutable override implementation;
    address public immutable override endpoint;

    constructor(address endpoint_) {
        LaunchValidation.validateNonZeroAddress(endpoint_);
        endpoint = endpoint_;
        implementation = address(new YskOFT(endpoint_));
    }

    function predictToken(bytes32 salt) external view override returns (address) {
        return Create2Clone.predict(implementation, salt, address(this));
    }

    function createToken(IYskOFT.InitParams calldata params, bytes32 salt)
        external
        override
        returns (address token)
    {
        LaunchValidation.validateBasics(params.name, params.symbol, params.decimals, params.totalSupply);
        LaunchValidation.validateSupplyMode(params.supplyMode);
        LaunchValidation.validateModuleFlags(params.moduleFlags);
        LaunchValidation.validateNonZeroAddress(params.owner);
        token = Create2Clone.cloneDeterministic(implementation, salt);
        IYskOFT(token).initialize(params);
        emit Launch(token, msg.sender, salt, params.name, params.symbol, params.supplyMode);
    }
}
