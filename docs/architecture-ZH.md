# 架構

> 語言：中文（香港書面語）| [English](./architecture.md)

## 目標

靜態 React 應用只對錢包與 RPC 通訊。發幣狀態全部在智能合約。TypeScript SDK 鏡像 Solidity 的 ENUM、custom error 與校驗上限。

## 分層

1. `packages/contracts` — ENUM、錯誤、校驗庫、OFT、Factory。
2. `packages/config` — 鏈清單、LayerZero endpoint、數值常數、ENUM 鎖定檔。
3. `packages/sdk` — 解碼 revert、校驗草稿，稍後編碼 calldata。
4. `apps/web` — 錢包、i18n、Wizard（Phase 1 起）。沒有 HTTP API。

## 代幣部署

`TokenFactory` 每條鏈部署一份 `YskOFT` implementation（endpoint 為 immutable）。用戶代幣是 EIP-1167 clone，初始化時寫入名稱、代號、decimals、供應、擁有人、供應模式與模組旗標。

## 跨鏈

`YskOFT.send` 在源鏈銷毀並呼叫 EndpointV2。`lzReceive` 在目的鏈增發。Phase 3 的稅務模組必須跳過這條路徑。

## 無後端

草稿可放在 `localStorage`。代幣頁、鎖定與「我的代幣」只讀 `view` 與 `eth_getLogs`。
