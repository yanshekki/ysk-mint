# Architecture

> Language: English | [中文](./architecture.zh.md)

## Goal

A static React SPA talks to wallets and public RPC (and a few protocol HTTP endpoints). Smart contracts hold launch state. Market, lending, and holdings figures are read from public nodes. The TypeScript SDK mirrors Solidity enums, custom errors, and validation bounds. There is no YSK application server and no custody.

## Layers

1. `packages/contracts` — enums, errors, validation library, OFT, factory, LP manager, locker.
2. `packages/config` — chain list, LayerZero endpoints, numeric constants, enum lock file, contract address slots (mainnet factories remain zero).
3. `packages/sdk` — decode reverts, validate drafts, encode calldata.
4. `apps/web` — locale router, document head, wallet, markets, tokenized US stocks, lending, holdings, launch wizard, settings. No product HTTP API.

## Web app

Vite + React. Routes live under an optional locale prefix. Unprefixed paths are zh-HK; `/zh-CN`, `/en`, `/ja`, and the other prefix locales wrap the same child routes. `/zh-HK/…` redirects to the unprefixed path. `/zh/…` redirects to `/zh-CN/…`.

### Locale and document head

`locale.ts` parses the prefix, canonicalizes tags, and skips language redirects for crawlers. `DocumentHead` writes `html lang`, canonical, hreflang, Open Graph, and JSON-LD. UI copy is i18n JSON (zh-HK and en bundled; other locales lazy-loaded).

### On-chain reads

DEX markets and pair pages read venue HTTP adapters and on-chain reserves. Pair charts prefer one GeckoTerminal pool OHLCV call (15m × 1000); the trade tape remains a short Gecko `/trades` or EVM log window (cap 300). `/stocks` is the same market feed filtered to tokenized US stocks and US ETFs in the baked catalog; those pairs are omitted from `/`. Native and Gecko adapters store USD TVL in `tvlQuote`; inverting a pair keeps that USD. Pair titles and headers resolve token symbols from catalog and venue metadata, not truncated mints. Lending pages read protocol rate views. Holdings merge wallet sessions and watch sets, then read balances, lending, LP, and staking. The NFT tab reads Blockscout `/nft/collections` on live hosts only (lazy, after the tab is opened); ERC-721/1155 rows are omitted from the wallet table and from the USD total. Settings can turn off chain scans and DeFi packs (`disabledChains`, `disabledDefi`); a pack that is off is skipped, not shown as 0. Paste names resolve in `domainNames/` (ENS, SNS `.sol`/`.sns`, AllDomains ANS PDA for `.skr` and other listed Solana TLDs, and the other wired name services). LST inner rows convert share tokens to native with protocol views where they exist. Lending inner rows keep `apyPct` from Aave `liquidityRate` / variable borrow and BENQI `supplyRatePerTimestamp`. Holdings LP merges V3 NFTs with V2/Aero discovered-pool balances, plus public owner HTTP for Raydium/Orca/Meteora, Rhea/Ref, and Minswap. Avalanche P-Chain native stake reads C-chain atomic export history (Glacier public) then `platform.getStake`; no export means no row. Ethereum native (beacon) stake reads Blockscout `/beacon/deposits` and `/withdrawals` for the `0x` address, then consensus HTTP validator balances (PublicNode, then Lodestar); a keywalled explorer API is not used, and a failed read is omitted rather than shown as 0. Hyperliquid perps and vault equity use the public HyperCore `info` HTTP (`clearinghouseState`, `userVaultEquities`, `subAccounts`). HyperEVM kHYPE uses the Kinetiq accountant `kHYPEToHYPE` view; hyperevmscan token lists need an API key and are not used. Token lists that paginate (Cosmos, XRPL, Aptos, Blockscout) follow continuation tokens; a failed holdings RPC is shown as “—”, not zero. Dead Blockscout hosts (BSC, Base, Linea, Blast, Mantle) use Ankr then NodeReal public indexers for token inventory and recent transfers; activity chips fail per chain instead of showing a fake 0. Discovery omits unpriced airdrops, trillion-unit supplies, and DEX quotes from pools with under about $1k depth. Hot RWAs sit in the baked catalog so V2 LP `candidatePairs` include them; Morpho positions read an allowlisted `marketId` set. Token and lock pages call `view`. Launch execution and OFT `send` are the signed paths.

### RPC and outbound

`rpcPool.ts` rotates public endpoints (official, PublicNode, 1RPC, dRPC, plus optional custom URLs in `localStorage`). A JSON-RPC rate-limit or quota error (HTTP 200 with `error`, as 1RPC usage-limit replies) is not treated as a live node — the next endpoint is tried. `outbound.ts` caps concurrent fetches (default 10 global, 2 per host; user-adjustable 1–32) and backs off on 429. Failures surface in the live dock; they are not retried as a hidden backend.

### Static hosting and cache

The SPA is uploaded as static files behind Cloudflare proxy. Vite hashes JS/CSS under `/assets/`; those may stay at the edge for a year (`immutable`). HTML (`index.html` and prerendered legal pages) must revalidate (`Cache-Control: no-cache`). `/version.json` is `no-store` and must **Bypass cache** on Cloudflare so a fresh upload is visible. A production build may inject a site-specific analytics tag when `VITE_GA_MEASUREMENT_ID` (or `GA_MEASUREMENT_ID`) is set; the default tree and CI build have no tag, and a live id must not be committed. Origin snippet: [deploy/origin-cache.conf](../deploy/origin-cache.conf). Cloudflare Cache Rules: Bypass `/version.json`, `/koios*`, `*.html`, and `/`; Eligible + Edge TTL 1 year for `/assets/*`. The origin also reverse-proxies `/koios/` to Koios (`api.koios.rest`) because Koios POST responses omit `Access-Control-Allow-Origin`, so the browser cannot read `api.koios.rest` directly. Cardano holdings then sum the stake-key UTXO set (every payment address), not only an ADA Handle’s one `addr1`. Do not use site-wide Cache Everything. Until those rules are live, **Purge Everything** after each upload or the edge keeps the old HTML (and thus the old hashed bundle). The header wordmark is YSK Mint at every width. The footer shows the baked `v…`, Powered by, and GitHub on phone, tablet, and desktop; if `/version.json` `build` differs, it offers a refresh. No service worker.

## Token deploy

`TokenFactory` deploys one `YskOFT` implementation per chain (endpoint is immutable). User tokens are EIP-1167 clones, initialized with name, symbol, decimals, supply, owner, supply mode, and module flags.

## Cross-chain

`YskOFT.send` burns on the source chain and calls EndpointV2. `lzReceive` mints on the destination. Tax modules must skip this path.

Peer wiring is `setPeer(dstEid, bytes32(peer))` in both directions. CREATE2 clone addresses **differ across chains** because each factory’s implementation is constructed with that chain’s endpoint.

Cardano, NEAR, Solana, and other non-EVM listings are independent native issuance. They are not LayerZero OFT peers. Quote and send stay off on those VMs.

## No backend

Drafts, RPC picks, address sets, and display settings sit in `localStorage`. Token pages, locks, markets, lending, and holdings use `view`, logs, and public RPC. Share links encode watch addresses in the URL; they do not hit a YSK server.
