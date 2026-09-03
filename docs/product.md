# Product guide

> Language: English | [中文](./product.zh.md)

How to use the live app at [mint.ysk.hk](https://mint.ysk.hk). Each section notes whether the screen only reads public chain data, or whether you must sign in a wallet. There is no YSK application server.

## Honesty

Launch, lock, and related contracts are **not audited**. Mainnet factory addresses in config remain **zero**. Figures can be delayed, incomplete, or wrong. Nothing here is investment, legal, or tax advice. See the [Disclaimer](https://mint.ysk.hk/disclaimer) and [Terms of Use](https://mint.ysk.hk/terms).

## Markets

**Read on-chain. No wallet required to browse.**

The home route `/` lists live DEX pools: pair, chain, USD quote, and **Depth USD** (the pool’s dollar value). When a venue publishes USD TVL (Raydium `tvl`, Orca `tvlUsdc`, Cetus `pure_tvl_in_usd`, Gecko `reserve_in_usd`, and the other wired native adapters), that figure is shown. Otherwise the app converts both reserves through the same USD quote as the price column. The column is always labeled Depth USD — not a quote-token or mint. Filter by chain or search. Pagination and filters stay in this browser session. Quotes are spots, not a promise of fill. Tokenized US stocks and US ETFs are listed on `/stocks`, not here.

YSK launch-pool rows (when a factory is configured) appear alongside third-party venues. Mainnet factories are still zero, so those product pools are empty until a deploy.

## Tokenized US stocks

**Read on-chain. No wallet required to browse.**

`/stocks` lists DEX pools for tokenized US stocks and US ETFs already in the baked catalog (xStock, Ondo, bStocks, Republic pre-IPO, Coinbase B20 on Base, and Backed bTokens on Avalanche). These are on-chain wrappers, not listed shares. The table is the same shape as Markets: pair, chain, USD quote, Depth USD. Only chains that hold those wrappers are listed and scanned (ETH, OP, Base, Arb, BNB, SOL, TON, AVAX, HyperEVM, Mantle, Ink, X Layer where catalogued). Open the pair page to use the venue’s DEX. Treasuries, gold, credit RWAs, and non-US names stay off this desk.

## Trading pairs

**Read on-chain. Swap on the venue’s site.**

`/pair/:chainId/:tokenA/:tokenB` shows token **symbols** (for example `SOL / USDC`) in the title, pool rows, headers, and SEO — not truncated mint or contract addresses. Pool addresses stay as a small technical id. Columns are USD quote, base-token reserve, and Depth USD. The price chart uses one public GeckoTerminal pool OHLCV call (15-minute candles, up to 1000 ≈ 10 days). If that feed is missing, it falls back to recent pool swaps (EVM logs; Solana via GeckoTerminal trades). The trade table shows up to 300 prints — Gecko `/trades` and our EVM log scan both stop there. It is not a broker or TradingView market feed. YSK Mint does not execute a swap. Open the DEX from the pair page when you want to trade.

## Lending

**Read on-chain rates. Deposit or borrow on the protocol’s site.**

`/lend` lists supply and borrow APY, utilization, and TVL-style figures from protocol contracts (Aave and other wired markets). `/lend/:symbol` groups one asset across chains and venues. `/lend/:chainId/:token` redirects to the symbol page.

This app does not take deposits. Use the protocol link on the row or asset page.

## Launch

**You sign. Contracts are not audited.**

`/create` is a guided wizard. Current UI order: wallet → chains → token → rules → LP → omni → review → sign → live.

On supported EVM networks the path deploys an OFT clone, optional LP, and optional lock. Native VMs (Cardano, NEAR, Solana, and others listed in the wizard) are independent issuance, not LayerZero OFT destinations. Bonding curve is off. Platform fee defaults to 0. Drafts may sit in `localStorage` until you sign.

## Token and lock pages

**Read `view` functions. No signature to browse.**

`/token/:chainId/:address` reads name, symbol, decimals, supply, and owner. `/locks/:chainId/:lockId` reads locker state when a locker address is configured. Both stay empty or fail closed while factories are zero.

## Bridge

**Quote is a read. Send requires a signature.**

`/transfer` quotes LayerZero `quoteSend` on the connected EVM, then `send` burns on source and mints on a peer destination. Same-chain and non-EVM networks are not OFT destinations. Peers must already be set. Mainnet factories remain zero, so a mainnet send will not work until factories and peers are live.

## Holdings

**Public addresses: read-only. Connected wallets: still read-only unless you leave to a protocol site.**

`/me` merges connected wallets, addresses you added, and watch sets. Optional share links encode a watch set in the URL (see [shareSet.ts](../apps/web/src/lib/shareSet.ts)); anyone with the link can load those public addresses.

### Wallets and address sets

Connected EVM (RainbowKit / wagmi) plus native sessions (NEAR, Cardano, Solana, Sui, Aptos, TON, Tron, Bitcoin, XRPL, Stellar, Cosmos-family via Keplr, Starknet). Settings holds “my addresses” and named watch sets. Limits apply (`MAX_ADDRS`, `MAX_WATCH`). Keys never enter this site.

### Positions

Settings “my addresses” paste also resolves public names (ENS, SPACE ID, Bonfida `.sol` / `.sns`, AllDomains `.skr` `.abc` `.bonk` `.poor` `.solana`, Handle, SuiNS, Aptos names, TON DNS, Starknet ID, ICNS, Stellar federation, `.near`). AllDomains `.skr` is on-chain PDA (no extra HTTP indexer). A name that does not resolve is not saved.

Holdings tab: token balances quoted at DEX spots where available; lending (supply/borrow), LP, and staking lines grouped by protocol. Staking inner rows for listed LSTs (sAVAX, stNEAR, stETH/wstETH/rETH/weETH and other listed ETH receipts, mSOL/jitoSOL/bSOL) show the equivalent native amount when a protocol share rate or a quoted ratio exists. Lending inner rows show the current supply/borrow APY % when the protocol view returns it (not lifetime dollar interest). Holdings LP includes Uniswap-style V3 NFTs plus V2/Aero ERC20 LP from discovered pools, Solana Raydium/Orca/Meteora owner HTTP when public, NEAR Rhea/Ref shares, and Cardano Minswap LP tokens in the wallet; Sui/TON/Aptos LP is omitted unless a public owner-position API is already wired. Avalanche native P-Chain stake is listed under staking when C-chain export history maps the `0x` to a `P-avax1` address; there is no hash from EVM to P-chain, so no export means no row (not a fake 0). Protocol names link out. Values can lag or miss venues. Quotes sit in a ~30s RAM cache with no polling; tap Refresh quotes beside the USD total to drop that cache (and the ADA/NEAR in-memory spots) and rerun the quote then DeFi wave — balances are not reread. A failed chain read shows as “—” rather than a fake zero. Paged token lists (Cosmos LCD `next_key`, XRPL `marker`, Aptos FA cursor, Blockscout `next_page_params`) are followed. When a Blockscout host is down (BSC, Base, Linea, Blast, Mantle), token discovery and activity fall back to Ankr then NodeReal public indexers; a failed chain still shows “—” rather than a fake empty list. Indexer spam (unpriced airdrops, trillion-supply tokens, or a DEX quote from a pool with under about $1k depth) is omitted from the desk and from the USD total. Tokens not in the baked catalog also need about $25k pool depth, and the bag must be a small share of that pool — airdrops that are most of a thin WBNB pool stay off. Native coins (ADA, ETH, …) are never run through that filter; a missing DEX quote leaves the amount and shows “—” for value. The baked catalog includes hot RWAs (tokenized treasuries, gold, credit, Maple syrupUSDC, and popular stock wrappers). Live-explorer chains still `balanceOf` those symbols; V2 LP candidate pairs follow the catalog (permissioned funds without a pool stay “—”). Aave / Spark / Compound lists stay on-chain (`getReservesList` / `getAllMarkets`); Morpho user positions use an allowlisted market set that includes those RWA markets. Cardano ADA is the stake-key UTXO total (every payment address under that stake), not only the one `addr1` an ADA Handle resolves to; withdrawable rewards stay in the staking group. Spendable native stays in the wallet table; locked value (ADA rewards, ETH beacon validators, Hyperliquid perps/vaults, SOL/NEAR/Sui stake, Tron frozen, Cosmos-family delegations, listed EVM LSTs including kHYPE on HyperEVM) is in the staking group when a reader exists. Ethereum native stake uses public Blockscout deposit/withdrawal indexes plus a consensus HTTP balance; beaconcha.in is keywalled so it is not used. No deposit and no withdrawal means no row (not a fake 0). HyperEVM has no keyless token indexer; pinned LSTs and catalog tokens are `balanceOf`’d. In-flight bridges are omitted (no cheap public owner API). Spot-check: `pnpm --filter @ysk-mint/web verify:holdings`.

### NFT

The NFT tab is a collection gallery, not a price table. Live Blockscout hosts (ETH, OP, Arb, Polygon, and the other wired instances — not dead or Alchemy-hosted explorers) list ERC-721 and ERC-1155 by contract. Images come from the explorer (`ipfs://` rewritten to a public gateway). There is no floor price and no USD figure; pieces never enter the holdings total. A failed or missing indexer is skipped (chip “—”), not shown as 0. The scan waits until you open the tab.

### Activity

Activity tab lists recent transactions for indexed chains, with tags where the indexer recognizes a protocol. Incomplete history is expected. A per-chain indexer failure shows “—” on that chip (not a fake 0). ETH, OP, and other live Blockscout hosts stay on their own instance; Robinhood Chain is wired to its Blockscout host.

## Settings

**Local to this browser. No signature.**

`/settings` tabs:

- **Display** — language (changes the URL prefix), live dock, hide-zero, market pair orientation, buy/sell colors.
- **Addresses** — connected accounts, extra “mine” addresses, watch sets.
- **Chains** — enable/disable chains for market and holdings scans, with Mainstream / Long-tail / all-on / all-off presets. **Default is Mainstream** (ETH, AVAX, Base, Arb, ADA, NEAR, BNB, SOL, TRX, POL, SUI, TON, APT, OP, plus core lending/LP/staking packs). The same tab has DeFi scan packs (lending, LP, staking × mainstream / long-tail) so holdings skip unused protocol RPC. RPC strategy (official / PublicNode / 1RPC / dRPC) and per-chain endpoints, including a custom URL stored only in this browser. Off means skip, not a fake 0. Restore defaults also returns to Mainstream.
- **Data** — outbound connection caps (global 1–32, per-host 1–32) and wipe of the local cache.

Language follows the URL. Switching language in Settings rewrites the path (`/` = zh-HK, `/zh-CN/…`, `/en/…`, `/ja/…`, and so on).

## Company and legal

**Static copy. No signature.**

Footer: [About](https://mint.ysk.hk/about), [Donate](https://mint.ysk.hk/donate), [Terms of Use](https://mint.ysk.hk/terms), [Disclaimer](https://mint.ysk.hk/disclaimer), and [GitHub](https://github.com/yanshekki/ysk-mint). The header wordmark is **YSK Mint** on phone, tablet, and desktop. The bar shows **Powered by YSK Limited**, the baked app version (`v…`), and GitHub at every width; if `/version.json` `build` differs, it offers a refresh (it does not auto-reload). On widths ≤1024px, legal links sit in More; Powered by, `v…`, and GitHub stay above the tab bar. Donate is a voluntary gift; it is not a sale of tokens or services. Addresses match the Donate page: `yanshekki.eth`, `yanshekki.near`, `$yanshekki`.

## Languages and URLs

Eleven locales: zh-HK, zh-CN, en, es, ar, pt, id, ja, ru, fr, de. Unprefixed paths are zh-HK. Simplified Chinese is `/zh-CN/…`. Other languages use `/{code}/…`. `/zh-HK/…` redirects to the unprefixed path. `/zh/…` redirects to `/zh-CN/…`.

On a first visit, if this browser has no stored locale, the app may pick from `navigator.languages`. **Crawlers are not language-redirected.** `DocumentHead` sets `html lang`, canonical, hreflang, Open Graph, and JSON-LD. Build emits a sitemap and prerendered legal HTML.

## Wallets

EVM via RainbowKit. Native wallets via each chain’s injected or selector API. This app does not create wallets and does not hold private keys. Disconnect from the connect control. Network chips in the footer show which sessions are active.
