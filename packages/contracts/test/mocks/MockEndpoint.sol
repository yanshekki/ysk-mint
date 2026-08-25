// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {ILayerZeroEndpointV2} from "../../src/interfaces/ILayerZeroEndpointV2.sol";
import {IYskOFT} from "../../src/interfaces/IYskOFT.sol";

contract MockEndpoint is ILayerZeroEndpointV2 {
    uint64 public nonce;
    address public lastSender;
    MessagingParams public lastParams;

    function quote(MessagingParams calldata, address) external pure returns (MessagingFee memory) {
        return MessagingFee({nativeFee: 0.01 ether, lzTokenFee: 0});
    }

    function send(MessagingParams calldata params, address) external payable returns (MessagingReceipt memory) {
        lastSender = msg.sender;
        lastParams = params;
        nonce += 1;
        bytes32 guid = keccak256(abi.encode(nonce, msg.sender, params.dstEid, params.message));
        return MessagingReceipt({
            guid: guid, nonce: nonce, fee: MessagingFee({nativeFee: msg.value, lzTokenFee: 0})
        });
    }

    function deliver(address dstOFT, uint32 srcEid, bytes32 guid, bytes calldata message) external {
        IYskOFT(dstOFT).lzReceive(srcEid, guid, message);
    }
}
