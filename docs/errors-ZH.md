# 錯誤碼

> 語言：中文（香港書面語）| [English](./errors.md)

## 規則

Solidity 使用 `LaunchErrors.sol` 的 custom error。SDK 把 selector 對到 `ErrorCode`，並顯示 `messages[locale][code]`。用戶介面不得只拋出原始 revert 資料。

## 代碼

| 代碼 | 常見原因 |
|--|--|
| InvalidName | 名稱長度或只有空格 |
| InvalidSymbol | 不是 1–11 個 `[A-Za-z0-9]` |
| DecimalsOutOfRange | 不是 6–18 |
| SupplyZero / SupplyOverflow | 為零或超過 uint128 上限 |
| TaxTooHigh | 買或賣稅超過上限 |
| RecipientZero | 缺少地址 |
| LockDurationInvalid | 定期鎖定不在 30 日至 5 年 |
| DexUnsupported / ChainDisabled | 註冊表關閉該選項 |
| InsufficientNative / InsufficientBalance | 錢包不足以支付 |
| PeerNotSet / PeerAlreadySet | LayerZero 接線 |
| UnknownModule | 旗標超出遮罩 |
| MintNotAllowed | 固定供應代幣 |
| SimulationFailed | 只在 SDK；不會彈出錢包 |

Selector 是錯誤簽名的 keccak。新增錯誤不會改變既有 selector。
