# ysk-mint

> Language: English | [中文](./README-ZH.md)

Guided multi-chain token launcher: deploy a native LayerZero OFT, create LP, and lock it. Domain: [mint.ysk.hk](https://mint.ysk.hk). Source: [github.com/yanshekki/ysk-mint](https://github.com/yanshekki/ysk-mint).

| | |
|--|--|
| **Version** | 0.5.0 (Phase 5) |
| **License** | MIT |
| **Frontend** | Vite + React + TypeScript (no backend) |
| **Contracts** | Solidity 0.8.22, Foundry, OpenZeppelin 5.x |
| **Support** | [email@ysk.hk](mailto:email@ysk.hk) |

## Honesty

- Contracts are **not audited**.
- Mainnet chain keys exist in config but are **disabled**.
- Phase 1 includes the guided wizard, V2 LP + lock contracts, and live `eth_call` success pages. Factory addresses are still zero until a testnet deploy.
- Bonding curve is **not enabled**. Solana is listed as **SPL native issuance**, not LayerZero OFT; the program address is still empty. Platform fee defaults to **0**. There is still no audit.
- All product data is read on-chain. There is no application server.

## Packages

- `apps/web` — static SPA
- `packages/contracts` — Foundry
- `packages/sdk` — enums, errors, validation (mirrors Solidity)
- `packages/config` — chain registry and numeric bounds

## Develop

```bash
pnpm install
pnpm test
pnpm --filter @ysk-mint/web dev
```

Foundry: `forge test -vv`

## Docs

- [Architecture](./docs/architecture.md)
- [Error codes](./docs/errors.md)
- [Phases](./docs/phases.md)
- [Security checklist](./docs/security-checklist.md)
- [Audit prep](./docs/audit-prep.md)
- [Product blueprint](./docs/blueprint.md)
