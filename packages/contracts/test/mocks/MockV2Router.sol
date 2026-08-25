// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockLP is ERC20 {
    constructor() ERC20("MOCK-LP", "MLP") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockV2Factory {
    address public pair;

    constructor(address pair_) {
        pair = pair_;
    }

    function getPair(address, address) external view returns (address) {
        return pair;
    }
}

contract MockV2Router {
    MockLP public lp;
    MockV2Factory public factoryContract;
    address public WETH = address(0xBEEF);

    constructor() {
        lp = new MockLP();
        factoryContract = new MockV2Factory(address(lp));
    }

    function factory() external view returns (address) {
        return address(factoryContract);
    }

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256,
        uint256,
        address to,
        uint256
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
        IERC20(token).transferFrom(msg.sender, address(this), amountTokenDesired);
        amountToken = amountTokenDesired;
        amountETH = msg.value;
        liquidity = amountTokenDesired + msg.value;
        lp.mint(to, liquidity);
    }
}
