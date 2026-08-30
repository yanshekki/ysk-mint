# Product guide

> Language: English | [中文](./product.zh.md)

How to use the live app at [mint.ysk.hk](https://mint.ysk.hk). Each section notes whether the screen only reads public chain data, or whether you must sign in a wallet. There is no YSK application server.

## Honesty

Launch, lock, and related contracts are **not audited**. Mainnet factory addresses in config remain **zero**. Figures can be delayed, incomplete, or wrong. Nothing here is investment, legal, or tax advice. See the [Disclaimer](https://mint.ysk.hk/disclaimer) and [Terms of Use](https://mint.ysk.hk/terms).

## Markets

**Read on-chain. No wallet required to browse.**

The home route `/` lists live DEX pools: pair, chain, USD quote, and **Depth USD** (the pool’s dollar value). When a venue publishes USD TVL (Raydium `tvl`, Orca `tvlUsdc`, Cetus `pure_tvl_in_usd`, Gecko `reserve_in_usd`, and the other wired native adapters), that figure is shown. Otherwise the app converts both reserves through the same USD quote as the price column. The column is always labeled Depth USD — not a quote-token or mint. Filter by chain or search. Pagination and filters stay in this browser session. Quotes are spots, not a promise of fill.

YSK launch-pool rows (when a factory is configured) appear alongside third-party venues. Mainnet factories are still zero, so those product pools are empty until a deploy.

## Trading pairs

**Read on-chain. Swap on the venue’s site.**

`/pair/:chainId/:tokenA/:tokenB` shows token **symbols** (for example `SOL / USDC`) in the title, pool rows, headers, and SEO — not truncated mint or contract addresses. Pool addresses stay as a small technical id. Columns are USD quote, base-token reserve, and Depth USD. YSK Mint does not execute a swap. Open the DEX from the pair page when you want to trade.

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

Holdings tab: token balances quoted at DEX spots where available; lending (supply/borrow), LP, and staking lines grouped by protocol. Protocol names link out. Values can lag or miss venues.

### Activity

Activity tab lists recent transactions for indexed chains, with tags where the indexer recognizes a protocol. Incomplete history is expected.

## Settings

**Local to this browser. No signature.**

`/settings` tabs:

- **Display** — language (changes the URL prefix), live dock, hide-zero, market pair orientation, buy/sell colors.
- **Addresses** — connected accounts, extra “mine” addresses, watch sets.
- **Chains** — enable/disable chains for market and holdings scans; RPC strategy (official / PublicNode / 1RPC / dRPC) and per-chain endpoints, including a custom URL stored only in this browser.
- **Data** — outbound connection caps (global 1–32, per-host 1–32) and wipe of the local cache.

Language follows the URL. Switching language in Settings rewrites the path (`/` = zh-HK, `/zh-CN/…`, `/en/…`, `/ja/…`, and so on).

## Company and legal

**Static copy. No signature.**

Footer: [About](https://mint.ysk.hk/about), [Donate](https://mint.ysk.hk/donate), [Terms of Use](https://mint.ysk.hk/terms), [Disclaimer](https://mint.ysk.hk/disclaimer). Donate is a voluntary gift; it is not a sale of tokens or services. Addresses match the Donate page: `yanshekki.eth`, `yanshekki.near`, `$yanshekki`.

## Languages and URLs

Eleven locales: zh-HK, zh-CN, en, es, ar, pt, id, ja, ru, fr, de. Unprefixed paths are zh-HK. Simplified Chinese is `/zh-CN/…`. Other languages use `/{code}/…`. `/zh-HK/…` redirects to the unprefixed path. `/zh/…` redirects to `/zh-CN/…`.

On a first visit, if this browser has no stored locale, the app may pick from `navigator.languages`. **Crawlers are not language-redirected.** `DocumentHead` sets `html lang`, canonical, hreflang, Open Graph, and JSON-LD. Build emits a sitemap and prerendered legal HTML.

## Wallets

EVM via RainbowKit. Native wallets via each chain’s injected or selector API. This app does not create wallets and does not hold private keys. Disconnect from the connect control. Network chips in the footer show which sessions are active.
