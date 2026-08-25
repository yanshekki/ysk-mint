# Phases

> Language: English | [中文](./phases-ZH.md)

Work lives in `/home/ki/文件/ysk-mint`. Each finished phase is merged to `origin/main`.

## Phase 0 — Foundation

Monorepo, enums, errors, validation, cloneable OFT, factory, wallet SPA.

## Phase 1 — Single-chain wizard + LP

Guided wizard + LP lock. Execute follows the first configured EVM in the selection (not hardcoded Base Sepolia). Success / token / lock / me pages read that chain. Factory addresses stay zero until a testnet deploy.

## Phase 2 — Multi-chain + peers

Sequential deploys, `setPeer`, supply split, LayerZero quotes.

## Phase 3 — Modules and DEX matrix

Tax, limits, anti-bot, ownership actions, extra DEX kinds.

## Phase 4 — Transfer + dashboard

On-chain transfer UI, my tokens via logs, share card on canvas.

## Phase 5 — Fees, presale, audit prep (this release)

Default platform fee is 0. No HTTP API. Solana is a native SPL path (not OFT); the program is undeployed.
