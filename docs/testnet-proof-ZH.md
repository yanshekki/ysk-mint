# 測試網 OFT 證明

> 語言：中文（香港書面語）| [English](./testnet-proof.md)

2026-08-28 UTC。**唔係審計。主網 factory 仍為零。** 呢次只證明：YskOFT 喺 live LayerZero testnet 可以由 Base Sepolia burn，Arb Sepolia mint。

## 結果

| | |
|--|--|
| 狀態 | **成功**（dest `balanceOf` 對得上；Scan `DELIVERED`） |
| 帳戶 | `0x9A22193506591eb29e50BC63B894e524a27faEc9` |
| 路徑 | Base Sepolia（eid 40245）→ Arb Sepolia（eid 40231） |
| 代幣 | YSKE2E，18 decimals，總供應 1 000 000 |
| 發送 | 100 000 |
| 之後 home | 900 000 |
| 之後 spoke | 100 000 |
| `quoteSend` nativeFee | 0.000106671047710967 ETH |
| GUID | `0x016077141552cc29ffed602dba732de56961108c19956089b32249c53c543d93` |

## 合約

Factory 地址兩條鏈相同：同一錢包 nonce、同一 bytecode、同一 testnet Endpoint `0x6EDCE65403992e310A62460808c4b910D972f10f`。Clone 代幣地址唔同。

| | Base Sepolia | Arb Sepolia |
|--|--|--|
| Factory | [`0x41f67ced…d3a3b7`](https://sepolia.basescan.org/address/0x41f67ced8009e22e1bd6020d754a626737d3a3b7) | [`0x41f67ced…d3a3b7`](https://sepolia.arbiscan.io/address/0x41f67ced8009e22e1bd6020d754a626737d3a3b7) |
| OFT | [`0x000b6700…26358289`](https://sepolia.basescan.org/token/0x000b6700213c5423D5d0c05342C11DdC26358289) | [`0xE3197e1D…798f279FA1`](https://sepolia.arbiscan.io/token/0xE3197e1Dfb2cd585f55C719d9D9341988f279FA1) |

## 交易

- 源鏈 send（burn）：[Base Sepolia `0x5eba7ad3…47c29f`](https://sepolia.basescan.org/tx/0x5eba7ad308cc493faa63dcdd3d212f9874ba466745b0ffd51f7efd763a47c29f)
- 對方鏈 lzReceive（mint）：[Arb Sepolia `0x981e7c1b…029e0e`](https://sepolia.arbiscan.io/tx/0x981e7c1ba634ca9eac11c1aeea3c387ffde6e30f75b75b251c52c4e1e0029e0e)
- LayerZero Scan（testnet API `DELIVERED`）：[guid](https://testnet.layerzeroscan.com/tx/0x5eba7ad308cc493faa63dcdd3d212f9874ba466745b0ffd51f7efd763a47c29f)

Scan API：`GET https://scan-testnet.layerzero-api.com/v1/messages/tx/0x5eba7ad3…` → `status.name = DELIVERED`，destination `SUCCEEDED`。

## 點跑

`apps/web/scripts/e2e-testnet-oft.mjs`：每條鏈錢包 deploy Locker／Manager／Factory → home `createToken(1e6)`、spoke `createToken(0)` → 雙向 `setPeer` → `quoteSend` → `send`。**今次冇鎖 LP。**

## 今次唔包括

- Wizard 瀏覽器簽名、Mock V2 LP
- 主網 factory／router（`packages/config/src/contracts.ts` 仍為 `0x0`）
- 審計意見
- ADA／NEAR／SOL／Sui／Aptos
