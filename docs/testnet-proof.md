# Testnet OFT proof

> Language: English | [中文](./testnet-proof.zh.md)

2026-08-28 UTC. **Not an audit. Mainnet factories stay zero.** This run only proves that YskOFT can burn on live LayerZero testnet Base Sepolia and mint on Arb Sepolia.

## Result

| | |
|--|--|
| Status | **Pass** (dest `balanceOf` matched; Scan `DELIVERED`) |
| Account | `0x9A22193506591eb29e50BC63B894e524a27faEc9` |
| Path | Base Sepolia (eid 40245) → Arb Sepolia (eid 40231) |
| Token | YSKE2E, 18 decimals, supply 1,000,000 |
| Sent | 100,000 |
| Home after | 900,000 |
| Spoke after | 100,000 |
| `quoteSend` nativeFee | 0.000106671047710967 ETH |
| GUID | `0x016077141552cc29ffed602dba732de56961108c19956089b32249c53c543d93` |

## Contracts

Factory addresses match across the two chains: same wallet nonce, bytecode, and testnet Endpoint `0x6EDCE65403992e310A62460808c4b910D972f10f`. Clone token addresses differ.

| | Base Sepolia | Arb Sepolia |
|--|--|--|
| Factory | [`0x41f67ced…d3a3b7`](https://sepolia.basescan.org/address/0x41f67ced8009e22e1bd6020d754a626737d3a3b7) | [`0x41f67ced…d3a3b7`](https://sepolia.arbiscan.io/address/0x41f67ced8009e22e1bd6020d754a626737d3a3b7) |
| OFT | [`0x000b6700…26358289`](https://sepolia.basescan.org/token/0x000b6700213c5423D5d0c05342C11DdC26358289) | [`0xE3197e1D…798f279FA1`](https://sepolia.arbiscan.io/token/0xE3197e1Dfb2cd585f55C719d9D9341988f279FA1) |

## Transactions

- Source send (burn): [Base Sepolia `0x5eba7ad3…47c29f`](https://sepolia.basescan.org/tx/0x5eba7ad308cc493faa63dcdd3d212f9874ba466745b0ffd51f7efd763a47c29f)
- Destination lzReceive (mint): [Arb Sepolia `0x981e7c1b…029e0e`](https://sepolia.arbiscan.io/tx/0x981e7c1ba634ca9eac11c1aeea3c387ffde6e30f75b75b251c52c4e1e0029e0e)
- LayerZero Scan (testnet API `DELIVERED`): [guid](https://testnet.layerzeroscan.com/tx/0x5eba7ad308cc493faa63dcdd3d212f9874ba466745b0ffd51f7efd763a47c29f)

Scan API: `GET https://scan-testnet.layerzero-api.com/v1/messages/tx/0x5eba7ad3…` → `status.name = DELIVERED`, destination `SUCCEEDED`.

## How

`apps/web/scripts/e2e-testnet-oft.mjs`: wallet-deploy Locker / Manager / Factory on each chain → home `createToken(1e6)`, spoke `createToken(0)` → bidirectional `setPeer` → `quoteSend` → `send`. **No LP lock in this run.**

## Not in this proof

- Wizard browser signatures or mock V2 LP
- Mainnet factory / router (`packages/config/src/contracts.ts` still `0x0`)
- An audit opinion
- ADA / NEAR / SOL / Sui / Aptos
