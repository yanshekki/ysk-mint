# Phases

> Language: English | [中文](./phases-ZH.md)

Work lives in `/home/ki/文件/ysk-mint`. Each finished phase is merged to `origin/main`.

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

## Phase 5 — Fees, presale, audit prep (this release)

Default platform fee is 0. No HTTP API. Solana is a native SPL path (not OFT); the program is undeployed.

## Phase 6 — Testnet OFT loop

2026-08-28: a script burned on live LayerZero testnet Base Sepolia and minted on Arb Sepolia. Links: [testnet-proof.md](./testnet-proof.md). Mainnet factories stay zero. Not audited. Wizard LP and browser signatures are not part of this proof.
