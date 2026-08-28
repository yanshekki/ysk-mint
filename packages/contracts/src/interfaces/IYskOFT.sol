// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {ILayerZeroEndpointV2} from "./ILayerZeroEndpointV2.sol";

interface IYskOFT {
    struct InitParams {
        string name;
        string symbol;
        uint8 decimals;
        uint256 totalSupply;
        address owner;
        uint8 supplyMode;
        uint16 moduleFlags;
    }

    struct SendParam {
        uint32 dstEid;
        bytes32 to;
        uint256 amountLD;
        uint256 minAmountLD;
        bytes extraOptions;
        bytes composeMsg;
        bytes oftCmd;
    }

    event PeerSet(uint32 indexed eid, bytes32 peer);
    event OFTSent(bytes32 indexed guid, uint32 indexed dstEid, address indexed from, uint256 amountLD);
    event OFTReceived(bytes32 indexed guid, uint32 indexed srcEid, address indexed to, uint256 amountLD);

    function initialize(InitParams calldata params) external;
    function endpoint() external view returns (address);
    function owner() external view returns (address);
    function supplyMode() external view returns (uint8);
    function moduleFlags() external view returns (uint16);
    function peers(uint32 eid) external view returns (bytes32);
    function setPeer(uint32 eid, bytes32 peer) external;
    function quoteSend(SendParam calldata sendParam, bool payInLzToken)
        external
        view
        returns (ILayerZeroEndpointV2.MessagingFee memory);
    function send(SendParam calldata sendParam, ILayerZeroEndpointV2.MessagingFee calldata fee, address refundAddress)
        external
        payable
        returns (ILayerZeroEndpointV2.MessagingReceipt memory);
    function allowInitializePath(ILayerZeroEndpointV2.Origin calldata origin) external view returns (bool);
    function nextNonce(uint32 eid, bytes32 sender) external view returns (uint64);
    function lzReceive(
        ILayerZeroEndpointV2.Origin calldata origin,
        bytes32 guid,
        bytes calldata message,
        address executor,
        bytes calldata extraData
    ) external payable;
    function mint(address to, uint256 amount) external;
}
