# 審計準備

> 語言：中文（香港書面語）| [English](./audit-prep.md)

## 範圍

- `YskOFT`、`TokenFactory`、`LiquidityManager`、`LiquidityLocker`
- `Presale`（Soft／Hard Cap、退款）
- `BondingCurve` 刻意停用

## 本版本不含

- Solana
- 可上線的 Bonding Curve
- 托管 API
- 任何「已審計」宣稱

## 建議檢查

- 用戶路徑全部用 custom error
- OFT mint/burn 跳過稅與 max-tx
- 定期鎖定未到期不可提取；銷毀不可提取
- 各鏈 CREATE2 clone 地址因 LayerZero endpoint 而不同
- 平台費預設為 0
- 未知 DEX 會 revert
