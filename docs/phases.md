# Phases

> Language: English | [中文](./phases.zh.md)

Work lives in this repository. Each finished phase below was merged to `origin/main`. Later product work is listed after Phase 6 so this page does not pretend the app stopped at the wizard.

## Phase 0 — Foundation

Monorepo, enums, errors, validation, cloneable OFT, factory, wallet SPA.

## Phase 1 — Single-chain wizard + LP

Guided wizard + LP lock. Execute follows the first configured EVM in the selection (not hardcoded Base Sepolia). Success / token / lock / me pages read that chain. Factory addresses stay zero until a testnet deploy.

## Phase 2 — Multi-chain + peers

Sequential deploys on configured EVM chains. Home chain mints full supply and locks LP. Spokes mint 0. Then bidirectional `setPeer`. Quotes stay off until factories are live.

## Phase 3 — Modules and DEX matrix

Tax, limits, anti-bot, ownership actions, extra DEX kinds.

## Phase 4 — Transfer + dashboard

On-chain transfer UI quotes on the connected EVM. Native VMs and the same chain are not OFT destinations. My tokens scan every configured factory. Share card is canvas-only.

## Phase 5 — Fees, presale, audit prep

Default platform fee is 0. No HTTP API. Solana is a native SPL path (not OFT); the program is undeployed.

## Phase 6 — Testnet OFT loop

2026-08-28: a script burned on live LayerZero testnet Base Sepolia and minted on Arb Sepolia. Links: [testnet-proof.md](./testnet-proof.md). Mainnet factories stay zero. Not audited. Wizard LP and browser signatures are not part of this proof.

## Later product work

After Phase 6 the SPA grew beyond launch:

- **Holdings** — merged wallets and watch sets; lending, LP, staking, activity tags, share URLs.
- **Markets and lending** — on-chain DEX boards, pair pages, read-only APY; deposit/borrow/swap stay on protocol sites.
- **Market depth** — Depth USD is the pool’s dollar value; pair pages show token symbols; `pnpm --filter @ysk-mint/web verify:depth` spot-checks venue USD fields.
- **Holdings parity** — paged token APIs are followed; failed reads show “—” not zero; staking covers ADA, SOL, NEAR, listed EVM LSTs (including kHYPE), Sui, Tron frozen, Cosmos-family delegations, Ethereum beacon validators, Avalanche P-Chain, and Hyperliquid perps/vaults. Settings can skip DeFi packs. The NFT tab lists ERC-721/1155 from live Blockscout only and never enters the USD total. Cardano native ADA is the stake-key UTXO total (same-origin `/koios` proxy; Koios POST has no CORS). `pnpm --filter @ysk-mint/web verify:holdings` compares native / tokens / stake to public APIs.
- **EVM indexers** — when Blockscout is down (BSC, Base, Linea, Blast, Mantle), token inventory and activity use Ankr then NodeReal; a per-chain fail is “—”, not a fake 0. Robinhood Chain uses its Blockscout host. Hot RWAs sit in the baked catalog; Morpho positions use an allowlisted market set. Unpriced airdrops, trillion-unit supplies, and DEX quotes from pools with under about $1k depth are omitted from the desk and the USD total.
- **Static hosting** — hashed `/assets` may stay at the edge; HTML and `/version.json` revalidate. The footer bakes `v1.4.3`. Cloudflare must Bypass `/koios*`. A site-specific analytics tag may be injected at build with `VITE_GA_MEASUREMENT_ID`; the repository does not store a live id.
- **RPC and outbound** — public node rotation, custom RPC in the browser, connection caps.
- **Locales and SEO** — URL prefixes (including zh-CN), crawler-safe language, document head, sitemap, prerendered legal pages.
- **Tokenized US stocks** — `/stocks` lists catalogued US stock and ETF wrappers (xStock, Ondo, bStocks, Republic, Coinbase B20, Backed). Those pairs are omitted from `/`. `pnpm --filter @ysk-mint/web verify:equity` checks the classifier.
- **Pair chart** — one public GeckoTerminal OHLCV call (15m × 1000 ≈ 10 days). The trade table is capped at 300 prints (Gecko `/trades` / EVM logs).

Authoritative surface: [product.md](./product.md). Authoritative layers: [architecture.md](./architecture.md).
