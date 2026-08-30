# 產品說明

> 語言：中文（香港書面語）| [English](./product.md)

說明線上應用 [mint.ysk.hk](https://mint.ysk.hk) 的用法。各節註明該畫面僅讀取公開鏈上資料，抑或須在錢包簽署。並無 YSK 應用伺服器。

## 誠實說明

發幣、鎖倉及相關合約**未經審計**。配置中的主網 factory 地址仍為**零**。數字可能延遲、不全或錯誤。本站並非投資、法律或稅務意見。請閱讀[免責聲明](https://mint.ysk.hk/disclaimer)及[使用條款](https://mint.ysk.hk/terms)。

## 市場

**讀取鏈上。無須連接錢包即可瀏覽。**

首頁 `/` 列出即時去中心化交易所流動池：交易對、鏈、美元報價與**深度 USD**（池內美金總值）。場地若已公布美元 TVL（Raydium `tvl`、Orca `tvlUsdc`、Cetus `pure_tvl_in_usd`、Gecko `reserve_in_usd` 及其他已接線的原生適配器），則顯示該數字；否則用與報價欄相同的美元價，把兩邊儲備換成美金。欄名固定為「深度 USD」，不以報價代幣或 mint 當單位。可按鏈篩選或搜尋。分頁及篩選留在本瀏覽器工作階段。報價為即時價，並非成交保證。

本產品發幣池（factory 已配置時）與第三方場地並列。主網 factory 仍為零，故在部署前該等產品池為空。

## 交易對

**讀取鏈上。兌換請到場地網站。**

`/pair/:chainId/:tokenA/:tokenB` 在標題、池列、表頭及 SEO 顯示代幣**代號**（例如 `SOL / USDC`），而非截斷的 mint 或合約地址。池地址留作細字技術編號。欄位為美元報價、基礎代幣儲備及深度 USD。YSK Mint 並不執行兌換。若要交易，請從交易對頁開啟該去中心化交易所。

## 借貸

**讀取鏈上年利率。存入或借出請到協議網站。**

`/lend` 列出供應及借出年利率、使用率及類似總鎖倉數字，取自協議合約（Aave 及其他已接線市場）。`/lend/:symbol` 按資產匯總各鏈及場地。`/lend/:chainId/:token` 會轉到代號頁。

本應用不接受存款。請使用列或資產頁上的協議連結。

## 發幣

**由你簽署。合約未經審計。**

`/create` 為引導式流程。現行畫面次序：錢包 → 選鏈 → 代幣 → 規則 → 流動性 → 跨鏈 → 總覽 → 簽署 → 完成。

在已支援的 EVM 網絡，路徑會部署 OFT clone、可選流動性及可選鎖倉。原生虛擬機（Cardano、NEAR、Solana 及引導中列出的其他鏈）為獨立發行，並非 LayerZero OFT 目的地。Bonding curve 未開放。平台費預設為 0。草稿可存於 `localStorage`，直至你簽署。

## 代幣頁與鎖倉頁

**讀取 `view`。瀏覽無須簽署。**

`/token/:chainId/:address` 讀取名稱、代號、decimals、供應及擁有人。`/locks/:chainId/:lockId` 在鎖倉合約已配置時讀取鎖倉狀態。factory 仍為零時，兩頁會空白或失敗關閉。

## 跨鏈

**報價為讀取。發送須簽署。**

`/transfer` 在已連接的 EVM 上以 LayerZero `quoteSend` 報價，其後 `send` 在源鏈銷毀、在對等目的鏈增發。同一條鏈及非 EVM 網絡並非 OFT 目的地。須已設定 peer。主網 factory 仍為零，故在 factory 與 peer 上線前，主網發送無法完成。

## 持倉

**公開地址：只讀。已連接錢包：除非離開本站到協議網站，否則仍為只讀。**

`/me` 合併已連接錢包、你加入的地址及觀察組。可選分享連結把觀察組編碼入網址（見 [shareSet.ts](../apps/web/src/lib/shareSet.ts)）；持有連結者可載入該等公開地址。

### 錢包與地址組

已連接的 EVM（RainbowKit／wagmi），以及原生工作階段（NEAR、Cardano、Solana、Sui、Aptos、TON、Tron、Bitcoin、XRPL、Stellar、經 Keplr 的 Cosmos 系、Starknet）。設定頁存放「我的地址」及具名稱的觀察組。設有上限（`MAX_ADDRS`、`MAX_WATCH`）。私鑰從不進入本站。

### 倉位

持倉分頁：代幣結餘（有報價時取去中心化交易所即時價）；借貸（存／借）、流動性及質押按協議分組。協議名稱連到外部網站。數值可能滯後或漏場地。

### 活動

活動分頁列出已索引鏈的近期交易，並在索引器可辨識時加上協議標籤。紀錄不全屬預期情況。

## 設定

**僅存於本瀏覽器。無須簽署。**

`/settings` 分頁：

- **顯示** — 語言（會改寫網址前綴）、即時狀態列、隱藏零結餘、市場交易對方向、買入／賣出顏色。
- **地址** — 已連接帳戶、額外「我的」地址、觀察組。
- **鏈** — 開關市場及持倉掃描所用的鏈；RPC 策略（官方／PublicNode／1RPC／dRPC）及每鏈端點，包括僅存於本瀏覽器的自訂網址。
- **資料** — 外連連線上限（全域 1–32、每主機 1–32）及清除本機快取。

語言跟隨網址。在設定中切換語言會改寫路徑（`/` 為 zh-HK，`/zh-CN/…`、`/en/…`、`/ja/…` 等）。

## 公司與法律

**靜態文稿。無須簽署。**

頁腳：[關於](https://mint.ysk.hk/about)、[捐助](https://mint.ysk.hk/donate)、[使用條款](https://mint.ysk.hk/terms)、[免責聲明](https://mint.ysk.hk/disclaimer)。捐助為自願饋贈，不構成代幣或服務的買賣。地址與捐助頁相同：`yanshekki.eth`、`yanshekki.near`、`$yanshekki`。

## 語言與網址

十一種語言：zh-HK、zh-CN、en、es、ar、pt、id、ja、ru、fr、de。無前綴路徑為 zh-HK。簡體中文為 `/zh-CN/…`。其他語言使用 `/{code}/…`。`/zh-HK/…` 會轉到無前綴路徑。`/zh/…` 會轉到 `/zh-CN/…`。

首次到訪時，若本瀏覽器尚未儲存語言，應用可依 `navigator.languages` 選擇。**爬蟲不會被語言跳轉。** `DocumentHead` 設定 `html lang`、canonical、hreflang、Open Graph 及 JSON-LD。建置會產出網站地圖及預渲染的法律 HTML。

## 錢包

EVM 經 RainbowKit。原生錢包經各鏈注入或選擇器介面。本應用不建立錢包，亦不持有私鑰。請在連線控制項中中斷連線。頁腳網絡標記顯示目前工作階段。
