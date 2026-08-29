# 錯誤碼

> 語言：中文（香港書面語）| [English](./errors.md)

## 規則

Solidity 在 `LaunchErrors.sol` 使用自訂錯誤。SDK 把 selector 對應到 `ErrorCode`，並顯示 `messages[locale][code]`。面向使用者的介面不得只拋出原始 revert 資料作為唯一訊息。

## 代碼

| 代碼 | 常見原因 |
|--|--|
| InvalidName | 名稱過長或僅空白 |
| InvalidSymbol | 並非 1–11 位 `[A-Za-z0-9]` |
| DecimalsOutOfRange | 並非 6–18 |
| SupplyZero / SupplyOverflow | 為零或超過 uint128 上限 |
| TaxTooHigh | 買入或賣出稅超過上限 |
| RecipientZero | 缺地址 |
| LockDurationInvalid | 定期鎖倉不在 30 日至 5 年 |
| DexUnsupported / ChainDisabled | 註冊表關閉該選項 |
| InsufficientNative / InsufficientBalance | 錢包不足以支付 |
| PeerNotSet / PeerAlreadySet | LayerZero 接線 |
| UnknownModule | 旗標位元超出遮罩 |
| MintNotAllowed | 固定供應代幣 |
| SimulationFailed | 僅 SDK；不會喚起錢包 |

Selector 為錯誤簽名的 keccak。新增錯誤不會改動既有 selector。
