# 產品說明

> 語言：中文（香港書面語）| [English](./product.md)

說明線上應用 [mint.ysk.hk](https://mint.ysk.hk) 的用法。各節註明該畫面僅讀取公開鏈上資料，抑或須在錢包簽署。並無 YSK 應用伺服器。

## 誠實說明

發幣、鎖倉及相關合約**未經審計**。配置中的主網 factory 地址仍為**零**。數字可能延遲、不全或錯誤。本站並非投資、法律或稅務意見。請閱讀[免責聲明](https://mint.ysk.hk/disclaimer)及[使用條款](https://mint.ysk.hk/terms)。

## 市場

**讀取鏈上。無須連接錢包即可瀏覽。**

首頁 `/` 列出即時去中心化交易所流動池：交易對、鏈、美元報價與**深度 USD**（池內美金總值）。場地若已公布美元 TVL（Raydium `tvl`、Orca `tvlUsdc`、Cetus `pure_tvl_in_usd`、Gecko `reserve_in_usd` 及其他已接線的原生適配器），則顯示該數字；否則用與報價欄相同的美元價，把兩邊儲備換成美金。欄名固定為「深度 USD」，不以報價代幣或 mint 當單位。可按鏈篩選或搜尋。分頁及篩選留在本瀏覽器工作階段。報價為即時價，並非成交保證。代幣化美股及美股 ETF 列於 `/stocks`，不在此頁。

本產品發幣池（factory 已配置時）與第三方場地並列。主網 factory 仍為零，故在部署前該等產品池為空。

## 代幣化美股

**讀取鏈上。無須連接錢包即可瀏覽。**

`/stocks` 列出烘焙目錄中已有的代幣化美股及美股 ETF 流動池（xStock、Ondo、bStocks、Republic 上市前包裝、Base 上的 Coinbase B20、Avalanche 的 Backed bToken）。此為鏈上包裝，並非上市股票。表格與市場相同：交易對、鏈、美元報價、深度 USD。只列出並掃描持有該等包裝的鏈（目錄所及的 ETH、OP、Base、Arb、BNB、SOL、TON、AVAX、HyperEVM、Mantle、Ink、X Layer）。打開交易對頁即可到場地的去中心化交易所。國債、黃金、信貸 RWA 及非美名稱不在此桌。

## 交易對

**讀取鏈上。兌換請到場地網站。**

`/pair/:chainId/:tokenA/:tokenB` 在標題、池列、表頭及 SEO 顯示代幣**代號**（例如 `SOL / USDC`），而非截斷的 mint 或合約地址。池地址留作細字技術編號。欄位為美元報價、基礎代幣儲備及深度 USD。價格圖一次取 GeckoTerminal 池 OHLCV（15 分鐘 K，最多 1000 根，約 10 日）。若該饋源沒有資料，則回退到近期池成交（EVM 讀 Swap 日誌；Solana 經 GeckoTerminal trades）。成交表最多 300 筆——Gecko `/trades` 與本機 EVM 日誌掃描都停在此上限。並非券商或 TradingView 行情。YSK Mint 並不執行兌換。若要交易，請從交易對頁開啟該去中心化交易所。

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

設定「我的地址」貼上欄亦解析公開名稱（ENS、SPACE ID、Bonfida `.sol`／`.sns`、AllDomains `.skr` `.abc` `.bonk` `.poor` `.solana`、Handle、SuiNS、Aptos names、TON DNS、Starknet ID、ICNS、Stellar federation、`.near`）。AllDomains `.skr` 以鏈上 PDA 解析（不另加 HTTP 索引）。名稱無法解析則不會寫入。

持倉分頁：代幣結餘（有報價時取去中心化交易所即時價）；借貸（存／借）、流動性及質押按協議分組。已列入的 LST（sAVAX、stNEAR、stETH／wstETH／rETH／weETH 及其他已列 ETH 收據、mSOL／jitoSOL／bSOL）在質押內頁顯示對等原生數量（協議兌換率或報價比率；沒有資料則略過，不會畫假的 0）。借貸內頁在協議視圖有利率時顯示當前供應／借款年利率（不是累計利息金額）。持倉流動倉包括 Uniswap 式 V3 NFT、已發現池的 V2／Aero ERC20 LP、Solana 上公開的 Raydium／Orca／Meteora 持有人 HTTP、NEAR Rhea／Ref 份額，以及錢包內的 Cardano Minswap LP；Sui／TON／Aptos 的 LP 若沒有已接好的公開持有人倉位 API 則不列。Avalanche 原生 P 鏈質押在有 C 鏈匯出紀錄可對應 `P-avax1` 時列入質押組；EVM `0x` 不能雜湊成 P 鏈地址，沒有匯出就不列（不是假的 0）。協議名稱連到外部網站。數值可能滯後或漏場地。鏈上讀取失敗顯示「—」，不會畫成假的 0。會跟 Cosmos LCD `next_key`、XRPL `marker`、Aptos FA cursor、Blockscout `next_page_params` 等分頁。Blockscout 主機失效（BSC、Base、Linea、Blast、Mantle）時，代幣發現及活動改走 Ankr，再試 NodeReal 公開索引；該鏈失敗仍顯示「—」，不會扮成空白清單。無報價的空投、兆級供應代幣，或流動性不足約 1,000 美元的 DEX 報價，不會列出亦不會計入總值。烘焙目錄含熱門 RWA（代幣化國債、黃金、信貸、Maple syrupUSDC、熱門股包裝）。仍然活的 explorer 鏈亦會對這些代號做 `balanceOf`；V2 LP 候選交易對跟目錄走（沒有池的許可制基金維持「—」）。Aave／Spark／Compound 名單仍由鏈上 `getReservesList`／`getAllMarkets` 讀取；Morpho 使用者倉位用白名單市場（已含上述 RWA）。Cardano ADA 按 stake key 加總該帳下全部付款地址的 UTXO，而不是 ADA Handle 解析到的單一 `addr1`；可提取獎賞在質押組。錢包表只計可花 native；鎖倉（ADA 獎賞、ETH Beacon 驗證人、Hyperliquid 永續／金庫、SOL／NEAR／Sui 質押、Tron frozen、Cosmos 系委託、已列入的 EVM LST 包括 HyperEVM 的 kHYPE）在有讀取器時列入質押組。Ethereum 原生質押用公開 Blockscout 存款／提款索引及共識層 HTTP 結餘；beaconcha.in 要 API key，故不使用。沒有存款亦沒有提款就不列（不是假的 0）。HyperEVM 無免 key 代幣索引，只對已 pin 的 LST 及目錄代幣做 `balanceOf`。在途跨鏈橋省略（沒有平價公開持有人 API）。抽樣：`pnpm --filter @ysk-mint/web verify:holdings`。

### NFT

NFT 分頁是系列畫廊，不是報價表。仍活的 Blockscout（ETH、OP、Arb、Polygon 及其他已接實例；已死或 Alchemy 託管的略過）按合約列出 ERC-721／ERC-1155。圖片來自瀏覽器（`ipfs://` 改寫為公開閘道）。沒有地板價，亦不估美元；件數永不計入持倉總值。索引失敗或沒有資料則略過（chip 顯示「—」），不會當成 0 件。首次打開該分頁才掃描。

### 活動

活動分頁列出已索引鏈的近期交易，並在索引器可辨識時加上協議標籤。紀錄不全屬預期情況。單鏈索引失敗時該 chip 顯示「—」（不是假的 0）。ETH、OP 及其他仍然活的 Blockscout 維持各自實例；Robinhood Chain 已接入其 Blockscout。

## 設定

**僅存於本瀏覽器。無須簽署。**

`/settings` 分頁：

- **顯示** — 語言（會改寫網址前綴）、即時狀態列、隱藏零結餘、市場交易對方向、買入／賣出顏色。
- **地址** — 已連接帳戶、額外「我的」地址、觀察組。
- **鏈** — 開關市場及持倉掃描所用的鏈，並有主流／非主流／全部開啟／全部關閉預設。同一分頁有 DeFi 掃描組（借貸、流動倉、質押 × 主流／非主流），持倉會跳過未選的協議 RPC。RPC 策略（官方／PublicNode／1RPC／dRPC）及每鏈端點，包括僅存於本瀏覽器的自訂網址。關閉即跳過，不會畫假的 0。
- **資料** — 外連連線上限（全域 1–32、每主機 1–32）及清除本機快取。

語言跟隨網址。在設定中切換語言會改寫路徑（`/` 為 zh-HK，`/zh-CN/…`、`/en/…`、`/ja/…` 等）。

## 公司與法律

**靜態文稿。無須簽署。**

頁腳：[關於](https://mint.ysk.hk/about)、[捐助](https://mint.ysk.hk/donate)、[使用條款](https://mint.ysk.hk/terms)、[免責聲明](https://mint.ysk.hk/disclaimer)，以及 [GitHub](https://github.com/yanshekki/ysk-mint)。頂欄字標 **YSK Mint** 在手機、平板及桌面均顯示。底欄在任何寬度都顯示 **Powered by YSK Limited**、烘焙的應用版本（`v…`）及 GitHub；若 `/version.json` 的 `build` 不同，會提示重新整理（不會自動 reload）。寬度 ≤1024px 時，法律連結放在「更多」；Powered by、`v…` 與 GitHub 仍在 tab 上方。捐助為自願饋贈，不構成代幣或服務的買賣。地址與捐助頁相同：`yanshekki.eth`、`yanshekki.near`、`$yanshekki`。

## 語言與網址

十一種語言：zh-HK、zh-CN、en、es、ar、pt、id、ja、ru、fr、de。無前綴路徑為 zh-HK。簡體中文為 `/zh-CN/…`。其他語言使用 `/{code}/…`。`/zh-HK/…` 會轉到無前綴路徑。`/zh/…` 會轉到 `/zh-CN/…`。

首次到訪時，若本瀏覽器尚未儲存語言，應用可依 `navigator.languages` 選擇。**爬蟲不會被語言跳轉。** `DocumentHead` 設定 `html lang`、canonical、hreflang、Open Graph 及 JSON-LD。建置會產出網站地圖及預渲染的法律 HTML。

## 錢包

EVM 經 RainbowKit。原生錢包經各鏈注入或選擇器介面。本應用不建立錢包，亦不持有私鑰。請在連線控制項中中斷連線。頁腳網絡標記顯示目前工作階段。
