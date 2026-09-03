# 架構

> 語言：中文（香港書面語）| [English](./architecture.md)

## 目標

靜態 React SPA 對錢包及公開 RPC（以及少數協議 HTTP 端點）通訊。發幣狀態在智能合約。市場、借貸及持倉數字取自公開節點。TypeScript SDK 鏡像 Solidity 的列舉、自訂錯誤與校驗上限。並無 YSK 應用伺服器，亦不託管資產。

## 分層

1. `packages/contracts` — 列舉、錯誤、校驗庫、OFT、factory、流動性管理、鎖倉。
2. `packages/config` — 鏈清單、LayerZero endpoint、數值常數、列舉鎖定檔、合約地址欄位（主網 factory 仍為零）。
3. `packages/sdk` — 解碼 revert、校驗草稿、編碼 calldata。
4. `apps/web` — 語言路由、文件標頭、錢包、市場、代幣化美股、借貸、持倉、發幣引導、設定。沒有產品 HTTP API。

## 網頁應用

Vite + React。路由可帶語言前綴。無前綴路徑為 zh-HK；`/zh-CN`、`/en`、`/ja` 及其他前綴語言包覆同一組子路由。`/zh-HK/…` 轉到無前綴路徑。`/zh/…` 轉到 `/zh-CN/…`。

### 語言與文件標頭

`locale.ts` 解析前綴、規範語言標籤，並對爬蟲略過語言跳轉。`DocumentHead` 寫入 `html lang`、canonical、hreflang、Open Graph 及 JSON-LD。介面文案為 i18n JSON（zh-HK 與 en 隨包；其餘語言延遲載入）。

### 鏈上讀取

去中心化交易所市場及交易對頁讀取場地 HTTP 適配器及鏈上儲備。交易對圖表優先一次取 GeckoTerminal 池 OHLCV（15 分 × 1000）；成交帶仍是短窗的 Gecko `/trades` 或 EVM 日誌（上限 300）。`/stocks` 用同一市場資料，只保留烘焙目錄中的代幣化美股及美股 ETF；該等交易對不會出現在 `/`。原生及 Gecko 適配器把美元 TVL 存入 `tvlQuote`；反轉交易對時保留該美金。標題與表頭由目錄及場地 metadata 解析代幣代號，而非截斷 mint。借貸頁讀取協議利率視圖。持倉合併錢包工作階段與觀察組，再讀取結餘、借貸、流動性及質押。NFT 分頁只在仍活的 Blockscout 讀 `/nft/collections`（打開該分頁才掃描）；ERC-721／1155 不列入錢包表，亦不計入美元總值。設定可關閉鏈掃描及 DeFi 組（`disabledChains`、`disabledDefi`）；關閉的組會跳過，不會顯示成 0。貼上名稱由 `domainNames/` 解析（ENS、SNS `.sol`／`.sns`、AllDomains ANS PDA 的 `.skr` 及其他已列 Solana TLD，以及其餘已接名稱服務）。LST 內頁在協議有兌換視圖時把份額換成原生數量。借貸內頁保留 Aave `liquidityRate`／浮動借款利率及 BENQI `supplyRatePerTimestamp` 的 `apyPct`。持倉流動倉合併 V3 NFT、已發現池的 V2／Aero 結餘，以及 Raydium／Orca／Meteora 公開持有人 HTTP、Rhea／Ref、Minswap。Avalanche P 鏈原生質押先讀 C 鏈原子匯出（Glacier 公開），再 `platform.getStake`；沒有匯出就不列。Ethereum 原生（Beacon）質押讀 Blockscout 該 `0x` 的 `/beacon/deposits` 及 `/withdrawals`，再以共識層 HTTP 取驗證人結餘（PublicNode，其後 Lodestar）；不用要 API key 的 explorer，讀取失敗就略過，不會顯示成 0。Hyperliquid 永續及金庫權益用公開 HyperCore `info` HTTP（`clearinghouseState`、`userVaultEquities`、`subAccounts`）。HyperEVM kHYPE 用 Kinetiq accountant 的 `kHYPEToHYPE`；hyperevmscan 代幣清單要 API key，故不使用。會跟 Cosmos、XRPL、Aptos、Blockscout 等分頁延續；持倉 RPC 失敗顯示「—」，不會當 0。已死的 Blockscout 主機（BSC、Base、Linea、Blast、Mantle）改用 Ankr，再試 NodeReal 公開索引讀代幣清單及近期轉帳；活動 chip 按鏈失敗，不會顯示假的 0。發現會略過無報價空投、兆級供應，以及流動性不足約 1,000 美元的 DEX 報價。熱門 RWA 寫入烘焙目錄，V2 LP `candidatePairs` 會跟；Morpho 倉位讀白名單 `marketId`。代幣頁與鎖倉頁呼叫 `view`。發幣執行及 OFT `send` 為須簽署的路徑。

### RPC 與外連排隊

`rpcPool.ts` 輪詢公開端點（官方、PublicNode、1RPC、dRPC，以及可選的、存於 `localStorage` 的自訂網址）。JSON-RPC 限流或配額錯誤（HTTP 200 但帶 `error`，例如 1RPC usage limit）不當成節點仍然可用，會試下一個端點。`outbound.ts` 限制並行請求（預設全域 10、每主機 2；使用者可調 1–32），並在 429 時退避。失敗顯示於即時狀態列，不會當作隱藏後端重試。

### 靜態託管與快取

SPA 以靜態檔上傳，Cloudflare DNS proxy 開啟。Vite 把 JS／CSS 編成 `/assets/` 帶 hash 的檔，edge 可存一年（`immutable`）。HTML（`index.html` 及預渲染法律頁）必須再驗證（`Cache-Control: no-cache`）。`/version.json` 為 `no-store`，Cloudflare 須 **Bypass cache**，否則新上傳看不見。正式建置可在設定 `VITE_GA_MEASUREMENT_ID`（或 `GA_MEASUREMENT_ID`）時注入該站分析標籤；預設樹及 CI 建置不含標籤，亦不得把即時編號寫入倉庫。Origin 片段：[deploy/origin-cache.conf](../deploy/origin-cache.conf)。Cache Rule：Bypass `/version.json`、`/koios*`、`*.html` 及 `/`；`/assets/*` Eligible 且 Edge TTL 一年。Origin 另外把 `/koios/` 反代到 Koios（`api.koios.rest`）：Koios 的 POST 回應沒有 `Access-Control-Allow-Origin`，瀏覽器不能直接讀 `api.koios.rest`。Cardano 持倉按 stake key 加總全部付款地址的 UTXO，而不是 ADA Handle 單一 `addr1`。不要用全站 Cache Everything。規則未生效前，每次上傳要 **Purge Everything**，否則 edge 仍是舊 HTML（因而仍是舊 hashed bundle）。頂欄字標 YSK Mint 在任何寬度都顯示。頁腳在手機、平板及桌面都顯示烘焙的 `v…`、Powered by 及 GitHub；若 `/version.json` 的 `build` 不同，會提示重新整理。不加 service worker。

## 代幣部署

`TokenFactory` 每條鏈部署一份 `YskOFT` implementation（endpoint 為 immutable）。用戶代幣是 EIP-1167 clone，初始化時寫入名稱、代號、decimals、供應、擁有人、供應模式與模組旗標。

## 跨鏈

`YskOFT.send` 在源鏈銷毀並呼叫 EndpointV2。`lzReceive` 在目的鏈增發。稅務模組必須跳過這條路徑。

Peer 接線是雙向 `setPeer(dstEid, bytes32(peer))`。CREATE2 clone 地址**在不同鏈上並不相同**，因為每條鏈的 implementation 在 constructor 寫入該鏈 endpoint。

Cardano、NEAR、Solana 及其他非 EVM 項目為獨立原生發行，並非 LayerZero OFT peer。該等虛擬機不報價、不 OFT send。

## 無後端

草稿、RPC 選擇、地址組及顯示設定存於 `localStorage`。代幣頁、鎖倉、市場、借貸及持倉使用 `view`、日誌及公開 RPC。分享連結把觀察地址編碼入網址，並不請求 YSK 伺服器。
