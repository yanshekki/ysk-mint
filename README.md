# YSK Mint

> Language: English | [中文](./README.zh.md)

YSK Mint is a browser app for on-chain markets, holdings, and token launch. It has no YSK backend server and does not take custody of keys or assets. You sign in your own wallet.

Live: [mint.ysk.hk](https://mint.ysk.hk). Source: [github.com/yanshekki/ysk-mint](https://github.com/yanshekki/ysk-mint). Company: [YSK Limited](https://ysk.hk) (Hong Kong).

| | |
|--|--|
| **Version** | 1.1.0 |
| **License** | MIT |
| **Frontend** | Vite + React + TypeScript (static SPA) |
| **Contracts** | Solidity 0.8.22, Foundry, OpenZeppelin 5.x |
| **Contact** | [email@ysk.hk](mailto:email@ysk.hk) |

## Honesty

- Launch, lock, liquidity, and related contracts are **not audited**.
- There is **no application server**. Figures come from public chain nodes and third-party protocol endpoints. They can be delayed, incomplete, or wrong.
- Mainnet factory addresses in config remain **zero**. A LayerZero OFT burn/mint loop was proven on testnet on 2026-08-28. See [testnet-proof.md](./docs/testnet-proof.md).
- Bonding curve is **not enabled**. Solana is listed as **SPL native issuance**, not LayerZero OFT; the program address is empty. Platform fee defaults to **0**.
- Nothing here is investment, legal, or tax advice. See the [Disclaimer](https://mint.ysk.hk/disclaimer) and [Terms of Use](https://mint.ysk.hk/terms).

## Features

Full walkthrough: [Product guide](./docs/product.md).

- **Markets** — live DEX pools, USD quotes, and Depth USD (the pool’s dollar value). No wallet required to browse. Pair pages show token symbols, not truncated contract addresses.
- **Lending** — supply and borrow APY from on-chain rates. Read-only; deposit or borrow on the protocol’s site.
- **Holdings** — look up public addresses or connect wallets. Lending, LP, staking, and activity. Quotes are DEX spots.
- **Launch** — guided OFT deploy, LP, and lock on supported EVM networks. You sign. Contracts are not audited.
- **Bridge** — send this product’s OFT between linked EVM networks.
- **Settings** — language, chains, RPC, connection limits, and address sets. Stored in this browser only.

## Support the project

If YSK Mint is useful, please send a **voluntary gift**. It is not a sale of tokens or services. It does not buy rights, support, or a refund. Transfers are irreversible. Send only the asset and network you intend. YSK Limited does not issue invoices for donations.

Donate in the app: [mint.ysk.hk/donate](https://mint.ysk.hk/donate)

| Network | Address |
|--|--|
| EVM (ETH / BNB / AVAX and other EVM) | `yanshekki.eth` |
| NEAR | `yanshekki.near` |
| ADA (Cardano) | `$yanshekki` |

Thank you. The app stays free to use, with no backend and no custody.

## Packages

- `apps/web` — static SPA (markets, lending, holdings, launch, i18n)
- `packages/contracts` — Foundry (OFT, factory, LP manager, locker)
- [`@ysk-mint/sdk`](https://www.npmjs.com/package/@ysk-mint/sdk) — enums, errors, validation (mirrors Solidity)
- [`@ysk-mint/config`](https://www.npmjs.com/package/@ysk-mint/config) — chain registry and numeric bounds

```bash
npm install @ysk-mint/sdk
```

## Develop

```bash
pnpm install
pnpm test
pnpm --filter @ysk-mint/web dev
```

Foundry: `forge test -vv`

Web typecheck and i18n key check: `pnpm --filter @ysk-mint/web typecheck` and `pnpm --filter @ysk-mint/web i18n:check`. Market depth spot-check (live venue APIs): `pnpm --filter @ysk-mint/web verify:depth`.

## Docs

- [Product guide](./docs/product.md)
- [Architecture](./docs/architecture.md)
- [Error codes](./docs/errors.md)
- [Phases](./docs/phases.md)
- [Security checklist](./docs/security-checklist.md)
- [Testnet OFT proof](./docs/testnet-proof.md)
- [Audit prep](./docs/audit-prep.md)
- [Product intent](./docs/blueprint.md)
