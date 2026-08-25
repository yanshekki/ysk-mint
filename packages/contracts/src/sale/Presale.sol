// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {LaunchEnums} from "../enums/LaunchEnums.sol";
import {LaunchErrors} from "../errors/LaunchErrors.sol";
contract Presale {
    address public immutable owner;
    uint256 public immutable softCap;
    uint256 public immutable hardCap;
    uint64 public immutable endTime;
    uint8 public status;
    uint256 public raised;
    mapping(address => uint256) public contributed;

    event Contributed(address indexed user, uint256 amount);
    event Finalized(uint8 status, uint256 raised);
    event Refunded(address indexed user, uint256 amount);

    constructor(uint256 softCap_, uint256 hardCap_, uint64 duration) {
        if (softCap_ == 0 || hardCap_ < softCap_) revert LaunchErrors.SaleCapExceeded();
        owner = msg.sender;
        softCap = softCap_;
        hardCap = hardCap_;
        endTime = uint64(block.timestamp) + duration;
        status = uint8(LaunchEnums.SaleStatus.Active);
    }

    function contribute() external payable {
        if (status != uint8(LaunchEnums.SaleStatus.Active)) revert LaunchErrors.SaleNotActive();
        if (block.timestamp >= endTime) revert LaunchErrors.SaleNotActive();
        if (msg.value == 0) revert LaunchErrors.ZeroAmount();
        if (raised + msg.value > hardCap) revert LaunchErrors.SaleCapExceeded();
        raised += msg.value;
        contributed[msg.sender] += msg.value;
        emit Contributed(msg.sender, msg.value);
    }

    function finalize() external {
        if (msg.sender != owner) revert LaunchErrors.NotOwner();
        if (status != uint8(LaunchEnums.SaleStatus.Active)) revert LaunchErrors.SaleNotActive();
        if (block.timestamp < endTime && raised < hardCap) revert LaunchErrors.SaleNotFinalizable();
        if (raised >= softCap) {
            status = uint8(LaunchEnums.SaleStatus.Finalized);
            (bool ok,) = owner.call{value: raised}("");
            if (!ok) revert LaunchErrors.NativeTransferFailed();
        } else {
            status = uint8(LaunchEnums.SaleStatus.Failed);
        }
        emit Finalized(status, raised);
    }

    function refund() external {
        if (status != uint8(LaunchEnums.SaleStatus.Failed)) revert LaunchErrors.SaleNotFailed();
        uint256 amount = contributed[msg.sender];
        if (amount == 0) revert LaunchErrors.ZeroAmount();
        contributed[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert LaunchErrors.NativeTransferFailed();
        emit Refunded(msg.sender, amount);
    }
}
