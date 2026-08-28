// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {LaunchEnums} from "../enums/LaunchEnums.sol";
import {LaunchErrors} from "../errors/LaunchErrors.sol";
import {LaunchValidation} from "../libraries/LaunchValidation.sol";
import {IYskOFT} from "../interfaces/IYskOFT.sol";
import {ILayerZeroEndpointV2} from "../interfaces/ILayerZeroEndpointV2.sol";
import {Limits} from "./modules/Limits.sol";
import {AccessLists} from "./modules/AccessLists.sol";
import {TaxLib} from "../libraries/TaxLib.sol";

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

    bool public paused;
    Limits.Data internal _limits;
    AccessLists.Data internal _access;
    mapping(address => bool) public isDexPair;
    uint16 public buyTaxBps;
    uint16 public sellTaxBps;
    address public taxRecipient;

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

    function _requireModule(LaunchEnums.ModuleFlag flag) private view {
        if (moduleFlags & LaunchEnums.moduleBit(flag) == 0) {
            revert LaunchErrors.ModuleDisabled(uint8(flag));
        }
    }

    function setPaused(bool value) external onlyOwner {
        _requireModule(LaunchEnums.ModuleFlag.Pause);
        paused = value;
    }

    function setLimits(uint256 maxTx, uint256 maxWallet) external onlyOwner {
        _requireModule(LaunchEnums.ModuleFlag.MaxTx);
        LaunchValidation.validateLimits(maxTx, maxWallet, totalSupply());
        _limits.maxTx = maxTx;
        _limits.maxWallet = maxWallet;
    }

    function setBlacklisted(address account, bool value) external onlyOwner {
        _requireModule(LaunchEnums.ModuleFlag.Blacklist);
        LaunchValidation.validateNonZeroAddress(account);
        _access.blacklisted[account] = value;
    }

    function setDexPair(address pair, bool value) external onlyOwner {
        LaunchValidation.validateNonZeroAddress(pair);
        isDexPair[pair] = value;
    }

    function setTax(uint16 buyBps, uint16 sellBps, address recipient) external onlyOwner {
        _requireModule(LaunchEnums.ModuleFlag.BuyTax);
        LaunchValidation.validateTax(buyBps, sellBps, recipient);
        buyTaxBps = buyBps;
        sellTaxBps = sellBps;
        taxRecipient = recipient;
    }

    function _update(address from, address to, uint256 value) internal override {
        bool bridging = from == address(0) || to == address(0) || from == endpoint || to == endpoint;
        if (!bridging) {
            if (paused) revert LaunchErrors.Paused();
            if (moduleFlags & LaunchEnums.moduleBit(LaunchEnums.ModuleFlag.Blacklist) != 0) {
                AccessLists.requireNotBlacklisted(_access, from, to);
            }
            if (moduleFlags & LaunchEnums.moduleBit(LaunchEnums.ModuleFlag.MaxTx) != 0) {
                Limits.enforceTx(_limits, value);
            }
            if (moduleFlags & LaunchEnums.moduleBit(LaunchEnums.ModuleFlag.MaxWallet) != 0) {
                Limits.enforceWallet(_limits, balanceOf(to) + value);
            }
            uint16 bps;
            if (isDexPair[from]) bps = buyTaxBps;
            else if (isDexPair[to]) bps = sellTaxBps;
            if (bps > 0) {
                (uint256 tax, uint256 remaining) = TaxLib.take(value, bps);
                if (tax > 0) super._update(from, taxRecipient, tax);
                super._update(from, to, remaining);
                return;
            }
        }
        super._update(from, to, value);
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

    /// @notice Unordered nonces — LayerZero skips inbound nonce checks when this returns 0.
    function nextNonce(uint32, bytes32) external pure override returns (uint64) {
        return 0;
    }

    function allowInitializePath(ILayerZeroEndpointV2.Origin calldata origin) external view override returns (bool) {
        return peers[origin.srcEid] == origin.sender && origin.sender != bytes32(0);
    }

    /// @notice Real EndpointV2 executor callback. `origin.sender` is the source OFT.
    function lzReceive(
        ILayerZeroEndpointV2.Origin calldata origin,
        bytes32 guid,
        bytes calldata message,
        address,
        bytes calldata
    ) external payable override {
        if (msg.sender != endpoint) revert LaunchErrors.NotOwner();
        _requirePeer(origin.srcEid);
        if (peers[origin.srcEid] != origin.sender) revert LaunchErrors.InvalidPeer();
        (bytes32 toBytes, uint256 amountLD) = abi.decode(message, (bytes32, uint256));
        address to = address(uint160(uint256(toBytes)));
        LaunchValidation.validateNonZeroAddress(to);
        if (amountLD == 0) revert LaunchErrors.ZeroAmount();
        _mint(to, amountLD);
        emit OFTReceived(guid, origin.srcEid, to, amountLD);
    }

    function _requirePeer(uint32 eid) private view {
        if (peers[eid] == bytes32(0)) revert LaunchErrors.PeerNotSet(eid);
    }

    /// @dev TYPE_3 executor lzReceive option, 200_000 gas, 0 value. Empty extraOptions use this.
    function _lzReceiveOptions(bytes calldata extra) private pure returns (bytes memory) {
        if (extra.length > 0) return extra;
        return hex"00030100110100000000000000000000000000030d40";
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
            options: _lzReceiveOptions(sendParam.extraOptions),
            payInLzToken: payInLzToken
        });
    }
}
