# YSK Mint

> 語言：中文（香港書面語）| [English](./README.md)

YSK Mint 是瀏覽器應用，用於鏈上市場、持倉與發幣。並無 YSK 後端伺服器，亦不託管私鑰或資產。由你在自有錢包簽署。

線上：[mint.ysk.hk](https://mint.ysk.hk)。原始碼：[github.com/yanshekki/ysk-mint](https://github.com/yanshekki/ysk-mint)。公司：[YSK Limited](https://ysk.hk)（香港）。

| | |
|--|--|
| **版本** | 1.1.1 |
| **授權** | MIT |
| **前端** | Vite + React + TypeScript（靜態 SPA） |
| **合約** | Solidity 0.8.22、Foundry、OpenZeppelin 5.x |
| **聯絡** | [email@ysk.hk](mailto:email@ysk.hk) |

## 誠實說明

- 發幣、鎖倉、流動性及相關合約**未經審計**。
- **沒有應用伺服器**。數字取自公開鏈上節點及第三方協議端點，可能延遲、不全或錯誤。
- 配置中的主網 factory 地址仍為 **零**。LayerZero OFT 銷毀／增發迴路已於 2026-08-28 在測試網證明。見 [testnet-proof.zh.md](./docs/testnet-proof.zh.md)。
- Bonding curve **未開放**。Solana 以 **SPL 獨立發行** 列入，並非 LayerZero OFT；program 地址仍空。平台費預設為 **0**。
- 本站並非投資、法律或稅務意見。請閱讀[免責聲明](https://mint.ysk.hk/disclaimer)及[使用條款](https://mint.ysk.hk/terms)。

## 功能

完整說明見[產品說明](./docs/product.zh.md)。

- **市場** — 去中心化交易所流動池、美元報價與「深度 USD」（池內美金總值）。無須連接錢包即可瀏覽。交易對頁顯示代幣代號，而非截斷合約地址。
- **借貸** — 供應及借出年利率取自鏈上。本頁只供查閱；存入或借出請到協議網站。
- **持倉** — 查閱公開地址或連接錢包。借貸、流動性、質押及活動。報價為去中心化交易所即時價。
- **發幣** — 在已支援的 EVM 網絡引導部署 OFT、加入流動性並鎖定。由你簽署。合約未經審計。
- **跨鏈** — 將本產品的 OFT 發送到已連結的 EVM 網絡。
- **設定** — 語言、鏈、RPC、連線上限及地址組。僅存於本瀏覽器。

## 捐助

若 YSK Mint 對你有幫助，歡迎送出**自願饋贈**。此不構成代幣或服務的買賣，亦不賦予任何權利、支援或退款。轉帳不可逆轉。請只發送你擬轉出的資產及網絡。YSK Limited 不會就捐助開立發票。

於應用內捐助：[mint.ysk.hk/donate](https://mint.ysk.hk/donate)

| 網絡 | 地址 |
|--|--|
| EVM（ETH／BNB／AVAX 及其他 EVM） | `yanshekki.eth` |
| NEAR | `yanshekki.near` |
| ADA（Cardano） | `$yanshekki` |

謝謝。本應用維持免費使用，無後端、不託管。

## 套件

- `apps/web` — 靜態 SPA（市場、借貸、持倉、發幣、多語）
- `packages/contracts` — Foundry（OFT、factory、LP 管理、鎖倉）
- [`@ysk-mint/sdk`](https://www.npmjs.com/package/@ysk-mint/sdk) — 列舉、錯誤、校驗（與 Solidity 鏡像）
- [`@ysk-mint/config`](https://www.npmjs.com/package/@ysk-mint/config) — 鏈註冊與數值上限

```bash
npm install @ysk-mint/sdk
```

## 開發

```bash
pnpm install
pnpm test
pnpm --filter @ysk-mint/web dev
```

Foundry：`forge test -vv`

前端型別檢查及語言鍵核對：`pnpm --filter @ysk-mint/web typecheck` 及 `pnpm --filter @ysk-mint/web i18n:check`。市場深度抽樣（即時場地 API）：`pnpm --filter @ysk-mint/web verify:depth`。持倉對齊（native／分頁代幣／質押對照公開 API）：`pnpm --filter @ysk-mint/web verify:holdings`。

## 文件

- [產品說明](./docs/product.zh.md)
- [架構](./docs/architecture.zh.md)
- [錯誤碼](./docs/errors.zh.md)
- [階段](./docs/phases.zh.md)
- [安全清單](./docs/security-checklist.zh.md)
- [測試網 OFT 證明](./docs/testnet-proof.zh.md)
- [審計準備](./docs/audit-prep.zh.md)
- [產品意圖](./docs/blueprint.zh.md)
