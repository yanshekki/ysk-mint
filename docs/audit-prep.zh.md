# 審計準備

> 語言：中文（香港書面語）| [English](./audit-prep.md)

## 範圍

- `YskOFT`、`TokenFactory`、`LiquidityManager`、`LiquidityLocker`
- `Presale`（軟／硬頂、退款）
- `BondingCurve` 刻意關閉

## 不在本版本

- Solana SPL program（產品有列出，尚未部署）
- 生產用 bonding curve
- 託管式 API
- 任何「程式已經審計」的宣稱

## 建議檢查

- 每條使用者路徑使用自訂錯誤
- OFT 增發／銷毀跳過稅及單筆上限
- 定期鎖倉不可提前提取；銷毀後不可提取
- CREATE2 clone 地址因 LayerZero endpoint 而異
- 平台費預設為 0
- 未知 DEX 種類會 revert
