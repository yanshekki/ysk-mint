# ysk-mint

> 語言：中文（香港書面語）| [English](./README.md)

引導式多鏈發幣平台：部署原生 LayerZero OFT、創建 LP 並鎖定。域名：[mint.ysk.hk](https://mint.ysk.hk)。原始碼：[github.com/yanshekki/ysk-mint](https://github.com/yanshekki/ysk-mint)。

| | |
|--|--|
| **版本** | 0.5.0（Phase 5） |
| **授權** | MIT |
| **前端** | Vite + React + TypeScript（無後端） |
| **合約** | Solidity 0.8.22、Foundry、OpenZeppelin 5.x |
| **支援** | [email@ysk.hk](mailto:email@ysk.hk) |

## 誠實說明

- 合約**未經審計**。
- 測試網 OFT 迴路已喺 2026-08-28 證明（Base Sepolia → Arb Sepolia mint）。見 [testnet-proof-ZH.md](./docs/testnet-proof-ZH.md)。主網 factory 仍為零。
- 配置裡有主網 chain key，但**已關閉**。
- Phase 1 包含引導式 Wizard、V2 LP + 鎖定合約，以及即時 `eth_call` 成功頁。Factory 地址在測試網部署前仍為零。
- Bonding Curve **未開放**。Solana 以 **SPL 獨立發行** 列入產品鏈，唔走 LayerZero OFT；program 地址仍空。平台費預設為 **0**。仍然未經審計。
- 產品數據全部從鏈上讀取。沒有應用伺服器。

## 套件

- `apps/web` — 靜態 SPA
- `packages/contracts` — Foundry
- `packages/sdk` — ENUM、錯誤、校驗（與 Solidity 鏡像）
- `packages/config` — 鏈註冊與數值上限

## 開發

```bash
pnpm install
pnpm test
pnpm --filter @ysk-mint/web dev
```

Foundry：`forge test -vv`

## 文件

- [架構](./docs/architecture-ZH.md)
- [錯誤碼](./docs/errors-ZH.md)
- [階段](./docs/phases-ZH.md)
- [安全清單](./docs/security-checklist-ZH.md)
- [審計準備](./docs/audit-prep-ZH.md)
- [測試網 OFT 證明](./docs/testnet-proof-ZH.md)
- [產品藍圖](./docs/blueprint.md)
