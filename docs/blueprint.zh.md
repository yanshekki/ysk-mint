# 產品意圖

> 語言：中文（香港書面語）| [English](./blueprint.md)

## 本文件狀態

意圖紀錄，日期為 **2026-08-24**。記載當時發幣產品擬覆蓋的範圍。**現行行為以** [product.zh.md](./product.zh.md) 及 [architecture.zh.md](./architecture.zh.md) **為準**。該日之後的階段（持倉、借貸、RPC、多語）不在此重述。

## 定位

低代碼多鏈代幣發行路徑：在一條或多條網絡部署、建立並鎖定流動性，以及使用原生 omnichain（LayerZero OFT），使持有人無須 wrapped 憑證即可發送。

域名：[mint.ysk.hk](https://mint.ysk.hk)。原始碼：[github.com/yanshekki/ysk-mint](https://github.com/yanshekki/ysk-mint)。

## 擬具備能力

### 基礎發幣

引導式建立（名稱、代號、總供應、decimals、標誌、說明、社群連結）；固定供應對可增發；擁有權保留、放棄或轉至 Timelock 或 Safe；合約驗證；CREATE2 地址預測。

### 流動性

引導式建立流動性；代幣加原生資產數量；鎖定（銷毀／30／90／180／365 日）；盡量原子流程；鏈上可核實的鎖定證明。

### 多鏈

一次選擇多條鏈；OFT 銷毀／增發；初始供應分配；跨鏈發送介面；其後可再加鏈。

### Tokenomics

轉帳稅／Reflection、錢包上限／單筆上限、名單、暫停、anti-bot、放棄增發。

### 啟動模式

直接發幣並即時加入流動性；公平發行／bonding curve（後期）；預售。

### 體驗

分步引導；成本估算；儀表板；分享卡；我的代幣；雙語介面。無後端；發幣資料在鏈上。

## 引導步驟

當時意圖次序：0 錢包 → 1 基本資料 → 2 Tokenomics → 3 選鏈 → 4 流動性 → 5 Omnichain → 6 總覽 → 7 執行 → 8 成功頁。現行畫面次序見 [product.zh.md](./product.zh.md)（錢包 → 選鏈 → 代幣 → 規則 → 流動性 → 跨鏈 → 總覽 → 簽署 → 完成）。

## 技術棧

前端 Vite + React + TypeScript；wagmi + viem + RainbowKit；合約 Solidity 0.8.22、OpenZeppelin 5.x、官方 OFT 介面；Foundry 測試。列舉、自訂錯誤及雙層校驗為必要項。

## 分期交付

Phase 0 基礎；Phase 1 單鏈最小可行；Phase 2 多鏈；Phase 3 完整流動性／安全模組；Phase 4 轉帳加儀表板；Phase 5 進階與上線準備。其後沿革見 [phases.zh.md](./phases.zh.md)。
