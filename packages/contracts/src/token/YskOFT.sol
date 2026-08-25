// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {LaunchEnums} from "../enums/LaunchEnums.sol";
import {LaunchErrors} from "../errors/LaunchErrors.sol";
import {LaunchValidation} from "../libraries/LaunchValidation.sol";
import {IYskOFT} from "../interfaces/IYskOFT.sol";
import {ILayerZeroEndpointV2} from "../interfaces/ILayerZeroEndpointV2.sol";

/// @notice Cloneable OFT. Endpoint is immutable (set on the per-chain implementation).
///         Name/symbol/decimals live in storage so EIP-1167 clones can initialize.
///         Tax/limit modules are Phase 3; this file stays a composition root.
contract YskOFT is ERC20, IYskOFT {
    address public immutable override endpoint;

    string private _storedName;
    string private _storedSymbol;
    uint8 private _storedDecimals;
    address private _owner;
    bool private _initialized;
    uint8 public override supplyMode;
    uint16 public override moduleFlags;
    mapping(uint32 => bytes32) public override peers;

    modifier onlyOwner() {
        if (msg.sender != _owner) revert LaunchErrors.NotOwner();
        _;
    }

    constructor(address endpoint_) ERC20("", "") {
        LaunchValidation.validateNonZeroAddress(endpoint_);
        endpoint = endpoint_;
    }

    function initialize(InitParams calldata params) external override {
        if (_initialized) revert LaunchErrors.AlreadyInitialized();
        LaunchValidation.validateBasics(params.name, params.symbol, params.decimals, params.totalSupply);
        LaunchValidation.validateSupplyMode(params.supplyMode);
        LaunchValidation.validateModuleFlags(params.moduleFlags);
        LaunchValidation.validateNonZeroAddress(params.owner);

        _initialized = true;
        _storedName = params.name;
        _storedSymbol = params.symbol;
        _storedDecimals = params.decimals;
        _owner = params.owner;
        supplyMode = params.supplyMode;
        moduleFlags = params.moduleFlags;
        _mint(params.owner, params.totalSupply);
    }

    function name() public view override returns (string memory) {
        return _storedName;
    }

    function symbol() public view override returns (string memory) {
        return _storedSymbol;
    }

    function decimals() public view override returns (uint8) {
        return _storedDecimals;
    }

    function owner() public view override returns (address) {
        return _owner;
    }

    function mint(address to, uint256 amount) external override onlyOwner {
        if (!_initialized) revert LaunchErrors.NotInitialized();
        if (supplyMode != uint8(LaunchEnums.SupplyMode.Mintable)) revert LaunchErrors.MintNotAllowed();
        LaunchValidation.validateNonZeroAddress(to);
        if (amount == 0) revert LaunchErrors.ZeroAmount();
        if (totalSupply() + amount > LaunchValidation.MAX_SUPPLY) revert LaunchErrors.SupplyOverflow();
        _mint(to, amount);
    }

    function setPeer(uint32 eid, bytes32 peer) external override onlyOwner {
        if (peer == bytes32(0)) revert LaunchErrors.InvalidPeer();
        if (peers[eid] != bytes32(0)) revert LaunchErrors.PeerAlreadySet(eid);
        peers[eid] = peer;
        emit PeerSet(eid, peer);
    }

    function quoteSend(SendParam calldata sendParam, bool payInLzToken)
        external
        view
        override
        returns (ILayerZeroEndpointV2.MessagingFee memory)
    {
        _requirePeer(sendParam.dstEid);
        if (sendParam.amountLD == 0) revert LaunchErrors.ZeroAmount();
        return ILayerZeroEndpointV2(endpoint).quote(_messagingParams(sendParam, payInLzToken), address(this));
    }

    function send(SendParam calldata sendParam, ILayerZeroEndpointV2.MessagingFee calldata, address refundAddress)
        external
        payable
        override
        returns (ILayerZeroEndpointV2.MessagingReceipt memory receipt)
    {
        if (!_initialized) revert LaunchErrors.NotInitialized();
        _requirePeer(sendParam.dstEid);
        if (sendParam.amountLD == 0) revert LaunchErrors.ZeroAmount();
        if (sendParam.to == bytes32(0)) revert LaunchErrors.InvalidPeer();
        if (balanceOf(msg.sender) < sendParam.amountLD) {
            revert LaunchErrors.InsufficientBalance(balanceOf(msg.sender), sendParam.amountLD);
        }

        _burn(msg.sender, sendParam.amountLD);
        ILayerZeroEndpointV2.MessagingParams memory params = _messagingParams(sendParam, false);
        receipt = ILayerZeroEndpointV2(endpoint).send{value: msg.value}(
            params, refundAddress == address(0) ? msg.sender : refundAddress
        );
        emit OFTSent(receipt.guid, sendParam.dstEid, msg.sender, sendParam.amountLD);
    }

    /// @notice Endpoint (or tests) delivers a mint on the destination chain.
    function lzReceive(uint32 srcEid, bytes32 guid, bytes calldata message) external override {
        if (msg.sender != endpoint) revert LaunchErrors.NotOwner();
        _requirePeer(srcEid);
        (bytes32 toBytes, uint256 amountLD) = abi.decode(message, (bytes32, uint256));
        address to = address(uint160(uint256(toBytes)));
        LaunchValidation.validateNonZeroAddress(to);
        if (amountLD == 0) revert LaunchErrors.ZeroAmount();
        _mint(to, amountLD);
        emit OFTReceived(guid, srcEid, to, amountLD);
    }

    function _requirePeer(uint32 eid) private view {
        if (peers[eid] == bytes32(0)) revert LaunchErrors.PeerNotSet(eid);
    }

    function _messagingParams(SendParam calldata sendParam, bool payInLzToken)
        private
        view
        returns (ILayerZeroEndpointV2.MessagingParams memory)
    {
        return ILayerZeroEndpointV2.MessagingParams({
            dstEid: sendParam.dstEid,
            receiver: peers[sendParam.dstEid],
            message: abi.encode(sendParam.to, sendParam.amountLD),
            options: sendParam.extraOptions,
            payInLzToken: payInLzToken
        });
    }
}
