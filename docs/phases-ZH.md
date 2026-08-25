# 階段

> 語言：中文（香港書面語）| [English](./phases.md)

所有改動在 `/home/ki/文件/ysk-mint`。每個完成的 phase 合併到 `origin/main`。

## Phase 0 — 基礎搭建

Monorepo、ENUM、錯誤、校驗、可 clone 的 OFT、Factory、錢包 SPA。

## Phase 1 — 單鏈 Wizard + LP

Base Sepolia。部署 OFT、Uniswap V2 LP、定期或銷毀鎖定。成功頁重新讀取鏈上狀態。

## Phase 2 — 多鏈 + peers

順序部署、`setPeer`、供應分配、LayerZero 報價。

## Phase 3 — 模組與 DEX 矩陣

稅、限額、anti-bot、所有權動作、更多 DEX。

## Phase 4 — 轉帳 + Dashboard

鏈上轉帳介面、以 logs 列出我的代幣、Canvas 分享卡。

## Phase 5 — 費用、Presale、審計準備（本版本）

平台費預設 0。沒有 HTTP API。Solana 在達到生產級之前保持關閉。
