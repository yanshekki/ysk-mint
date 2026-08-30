# 階段

> 語言：中文（香港書面語）| [English](./phases.md)

工作位於本倉庫。下列已完成階段已合併至 `origin/main`。Phase 6 之後另列其後產品工作，以免本頁假裝應用停留在發幣引導。

## Phase 0 — 基礎

Monorepo、列舉、錯誤、校驗、可 clone 的 OFT、factory、錢包 SPA。

## Phase 1 — 單鏈引導與流動性

引導式流程及流動性鎖倉。執行跟隨所選配置中的第一條 EVM（並非寫死 Base Sepolia）。成功頁／代幣頁／鎖倉頁／持倉頁讀取該鏈。factory 地址在測試網部署前維持為零。

## Phase 2 — 多鏈與 peer

在已配置的 EVM 鏈上依序部署。主鏈增發全部供應並鎖定流動性。輻條鏈增發 0。其後雙向 `setPeer`。factory 上線前不報價。

## Phase 3 — 模組與 DEX 矩陣

稅、限額、anti-bot、擁有權操作、額外 DEX 種類。

## Phase 4 — 轉帳與儀表板

鏈上轉帳介面在已連接的 EVM 上報價。原生虛擬機及同一條鏈並非 OFT 目的地。「我的代幣」掃描每條已配置 factory。分享卡僅為 canvas。

## Phase 5 — 費用、預售、審計準備

平台費預設為 0。沒有 HTTP API。Solana 為原生 SPL 路徑（並非 OFT）；program 尚未部署。

## Phase 6 — 測試網 OFT 迴路

2026-08-28：腳本在 live LayerZero 測試網完成 Base Sepolia 銷毀及 Arb Sepolia 增發。連結見 [testnet-proof.zh.md](./testnet-proof.zh.md)。主網 factory 仍為零。未經審計。引導式流動性及瀏覽器簽署不在此次證明之內。

## 其後產品工作

Phase 6 之後，SPA 已超出發幣範圍：

- **持倉** — 合併錢包與觀察組；借貸、流動性、質押、活動標籤、分享網址。
- **市場與借貸** — 鏈上去中心化交易所看板、交易對頁、只讀年利率；存入／借出／兌換仍在協議網站。
- **市場深度** — 「深度 USD」為池內美金總值；交易對頁顯示代幣代號；`pnpm --filter @ysk-mint/web verify:depth` 抽樣核對場地美元欄。
- **持倉對齊** — 跟分頁代幣 API；讀取失敗顯示「—」而非 0；質押涵蓋 ADA、SOL、NEAR、已列入的 EVM LST、Sui、Tron frozen、Cosmos 系委託；`pnpm --filter @ysk-mint/web verify:holdings` 對照 native／代幣／質押與公開 API。
- **EVM 索引** — Blockscout 失效（BSC、Base、Linea、Blast、Mantle）時，代幣清單及活動改走 Ankr，再試 NodeReal；單鏈失敗顯示「—」，不是假的 0。Robinhood Chain 用其 Blockscout。熱門 RWA 在烘焙目錄；Morpho 倉位用白名單市場。
- **靜態託管** — hashed `/assets` 可長駐 edge；HTML 與 `/version.json` 再驗證。頁腳 `v…` 由 web 套件版本烘焙。
- **RPC 與外連** — 公開節點輪詢、僅存瀏覽器的自訂 RPC、連線上限。
- **多語與 SEO** — 網址前綴（包括 zh-CN）、對爬蟲安全的語言處理、文件標頭、網站地圖、預渲染法律頁。

現行畫面以 [product.zh.md](./product.zh.md) 為準。分層以 [architecture.zh.md](./architecture.zh.md) 為準。
