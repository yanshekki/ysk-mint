# Architecture

> Language: English | [中文](./architecture-ZH.md)

## Goal

A static React app talks to wallets and RPC. Smart contracts hold all launch state. The TypeScript SDK mirrors Solidity enums, custom errors, and validation bounds.

## Layers

1. `packages/contracts` — enums, errors, validation library, OFT, factory.
2. `packages/config` — chain list, LayerZero endpoints, numeric constants, enum lock file.
3. `packages/sdk` — decode reverts, validate drafts, later encode calldata.
4. `apps/web` — wallet, i18n, wizard (Phase 1+). No HTTP API.

## Token deploy

`TokenFactory` deploys one `YskOFT` implementation per chain (endpoint is immutable). User tokens are EIP-1167 clones, initialized with name, symbol, decimals, supply, owner, supply mode, and module flags.

## Cross-chain

`YskOFT.send` burns on the source chain and calls EndpointV2. `lzReceive` mints on the destination. Tax modules (Phase 3) must skip this path.

## No backend

Drafts may sit in `localStorage`. Token pages, locks, and “my tokens” read `view` functions and `eth_getLogs`.
