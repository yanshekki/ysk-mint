// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

library TaxLib {
    function take(uint256 amount, uint16 bps) internal pure returns (uint256 tax, uint256 remaining) {
        if (bps == 0 || amount == 0) return (0, amount);
        tax = (amount * bps) / 10_000;
        remaining = amount - tax;
    }
}
