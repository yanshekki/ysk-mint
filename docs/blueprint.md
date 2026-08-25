# ysk-mint 開發藍圖

> 原文規格（2026-08-24）。實施以倉庫內 architecture／phases 為準；本檔保留產品意圖。

## 1. 專案定位

ysk-mint 係一個無代碼／低代碼多鏈 Token 發幣平台，引導用戶完成：

1. 喺一條或多條鏈部署 Token
2. 創建同鎖定 LP
3. 原生 omnichain（LayerZero OFT），持有人可直接跨鏈轉帳，唔使 wrapped

域名：mint.ysk.hk。GitHub：https://github.com/yanshekki/ysk-mint。

## 2. 必須覆蓋嘅功能

### 基礎發幣

無代碼引導式創建（Name、Symbol、總供應量、Decimals、Logo、Description、社群連結）；固定供應 vs Mintable；所有權保留／放棄／轉 Timelock 或 Safe；合約驗證；CREATE2 預測地址。

### 流動性

引導式創建 LP；Token + Native 數量；鎖定（銷毀／30/90/180/365 日）；盡量原子操作；鏈上可驗證鎖定證明。

### 多鏈

一次過選擇多條鏈；OFT burn/mint；初始供應分配；跨鏈轉帳介面；之後可再加鏈。

### Tokenomics

交易稅／Reflection、Max Wallet／Max Transaction、黑白名單、暫停、Anti-Bot、放棄 mint。

### 啟動模式

直接發幣 + 即時 LP；Fair Launch／Bonding Curve（後期）；Presale。

### 體驗

分步 Wizard；成本預估；Dashboard；分享卡片；我的代幣；中英雙語。無後端，數據上鏈。

## 3. Wizard 步驟

0 連接錢包 → 1 基本資料 → 2 Tokenomics → 3 選鏈 → 4 流動性 → 5 Omnichain → 6 總覽 → 7 執行 → 8 成功頁。

## 4. 技術棧

前端 Vite + React + TypeScript；wagmi + viem + RainbowKit；合約 Solidity 0.8.22、OpenZeppelin 5.x、官方 OFT 介面；Foundry 測試。ENUM、custom error、雙層校驗為強制項。

## 5. 開發階段

Phase 0 基礎；Phase 1 單鏈 MVP；Phase 2 多鏈；Phase 3 完整 LP／安全模組；Phase 4 轉帳＋Dashboard；Phase 5 進階與上線準備。
