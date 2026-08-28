# 階段

> 語言：中文（香港書面語）| [English](./phases.md)

所有改動在 `/home/ki/文件/ysk-mint`。每個完成的 phase 合併到 `origin/main`。

## Phase 0 — 基礎搭建

Monorepo、ENUM、錯誤、校驗、可 clone 的 OFT、Factory、錢包 SPA。

## Phase 1 — 單鏈 Wizard + LP

引導式 Wizard + 鎖 LP。Execute 跟選擇裡第一條已配置嘅 EVM（唔寫死 Base Sepolia）。成功／代幣／鎖定／持倉頁讀嗰條鏈。Factory 地址在測試網部署前仍為零。

## Phase 2 — 多鏈 + peers

已配置 EVM 順序部署。Home 鏈鑄全量並鎖 LP。Spoke mint 0。然後雙向 `setPeer`。Factory 未上線前唔報價。

## Phase 3 — 模組與 DEX 矩陣

稅、限額、anti-bot、所有權動作、更多 DEX。

## Phase 4 — 轉帳 + Dashboard

跨鏈頁喺已連接 EVM 報價。原生 VM 同同一條鏈唔係 OFT 目的地。持倉掃所有已配置 Factory。分享卡只喺瀏覽器畫。

## Phase 5 — 費用、Presale、審計準備（本版本）

平台費預設 0。沒有 HTTP API。Solana 係 SPL 原生路徑（唔係 OFT）；program 未部署。

## Phase 6 — 測試網 OFT 迴路

2026-08-28：腳本喺 live LayerZero testnet 完成 Base Sepolia burn → Arb Sepolia mint。證明連結見 [testnet-proof-ZH.md](./testnet-proof-ZH.md)。主網 factory 仍為零。未經審計。Wizard LP 同瀏覽器簽名唔喺呢次證明入面。
