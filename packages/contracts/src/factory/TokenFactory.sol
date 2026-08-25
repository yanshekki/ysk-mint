// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {YskOFT} from "../token/YskOFT.sol";
import {Create2Clone} from "./Create2Clone.sol";
import {LaunchValidation} from "../libraries/LaunchValidation.sol";
import {LaunchErrors} from "../errors/LaunchErrors.sol";
import {IYskOFT} from "../interfaces/IYskOFT.sol";
import {ITokenFactory} from "../interfaces/ITokenFactory.sol";

contract TokenFactory is ITokenFactory {
    address public immutable override implementation;
    address public immutable override endpoint;
    address public immutable owner;
    uint16 public override platformFeeBps;
    uint256 public flatNativeFee;
    address public feeRecipient;

    constructor(address endpoint_) {
        LaunchValidation.validateNonZeroAddress(endpoint_);
        endpoint = endpoint_;
        implementation = address(new YskOFT(endpoint_));
        owner = msg.sender;
    }

    function setPlatformFee(uint16 bps, uint256 flat, address recipient) external {
        if (msg.sender != owner) revert LaunchErrors.NotOwner();
        LaunchValidation.validatePlatformFee(bps);
        if (bps > 0 || flat > 0) LaunchValidation.validateNonZeroAddress(recipient);
        platformFeeBps = bps;
        flatNativeFee = flat;
        feeRecipient = recipient;
    }

    function predictToken(bytes32 salt) external view override returns (address) {
        return Create2Clone.predict(implementation, salt, address(this));
    }

    function createToken(IYskOFT.InitParams calldata params, bytes32 salt)
        external
        payable
        override
        returns (address token)
    {
        if (msg.value < flatNativeFee) revert LaunchErrors.InsufficientNative(msg.value, flatNativeFee);
        LaunchValidation.validateBasics(params.name, params.symbol, params.decimals, params.totalSupply);
        LaunchValidation.validateSupplyMode(params.supplyMode);
        LaunchValidation.validateModuleFlags(params.moduleFlags);
        LaunchValidation.validateNonZeroAddress(params.owner);
        token = Create2Clone.cloneDeterministic(implementation, salt);
        IYskOFT(token).initialize(params);
        emit Launch(token, msg.sender, salt, params.name, params.symbol, params.supplyMode);
        if (flatNativeFee > 0) {
            (bool ok,) = feeRecipient.call{value: flatNativeFee}("");
            if (!ok) revert LaunchErrors.NativeTransferFailed();
        }
        if (address(this).balance > 0) {
            (bool refunded,) = msg.sender.call{value: address(this).balance}("");
            if (!refunded) revert LaunchErrors.NativeTransferFailed();
        }
    }
}
