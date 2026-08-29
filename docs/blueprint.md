# Product intent

> Language: English | [中文](./blueprint.zh.md)

## Status of this document

Intent note dated **2026-08-24**. It records what the launch product was meant to cover. **Current behavior is defined by** [product.md](./product.md) and [architecture.md](./architecture.md). Phases after that date (holdings, lending, RPC, locales) are not restated here.

## Positioning

A low-code multi-chain token launch path: deploy on one or more networks, create and lock LP, and use native omnichain (LayerZero OFT) so holders can send without a wrapped IOU.

Domain: [mint.ysk.hk](https://mint.ysk.hk). Source: [github.com/yanshekki/ysk-mint](https://github.com/yanshekki/ysk-mint).

## Intended capabilities

### Token launch

Guided create (name, symbol, supply, decimals, logo, description, social links); fixed supply vs mintable; keep, renounce, or transfer ownership to Timelock or Safe; contract verification; CREATE2 address prediction.

### Liquidity

Guided LP; token + native amounts; lock (burn / 30 / 90 / 180 / 365 days); prefer atomic flow; on-chain lock proof.

### Multi-chain

Select several chains in one pass; OFT burn/mint; initial supply split; cross-chain send UI; add chains later.

### Tokenomics

Transfer tax / reflection, max wallet / max transaction, lists, pause, anti-bot, renounce mint.

### Launch modes

Direct launch with immediate LP; fair launch / bonding curve (later); presale.

### Experience

Step wizard; cost estimate; dashboard; share card; my tokens; bilingual UI. No backend; launch data on-chain.

## Wizard steps

Historical intent order: 0 wallet → 1 basics → 2 tokenomics → 3 chains → 4 liquidity → 5 omnichain → 6 review → 7 execute → 8 success. The live UI order is documented in [product.md](./product.md) (wallet → chains → token → rules → LP → omni → review → sign → live).

## Stack

Frontend Vite + React + TypeScript; wagmi + viem + RainbowKit; contracts Solidity 0.8.22, OpenZeppelin 5.x, official OFT interfaces; Foundry tests. Enums, custom errors, and dual validation are required.

## Phased delivery

Phase 0 foundation; Phase 1 single-chain MVP; Phase 2 multi-chain; Phase 3 full LP / safety modules; Phase 4 transfer + dashboard; Phase 5 advanced and launch prep. Later history: [phases.md](./phases.md).
