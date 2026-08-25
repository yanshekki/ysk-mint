# Error codes

> Language: English | [中文](./errors-ZH.md)

## Rule

Solidity uses custom errors in `LaunchErrors.sol`. The SDK maps selectors to `ErrorCode` and shows `messages[locale][code]`. User-facing UI must not dump raw revert data as the only message.

## Codes

| Code | Typical cause |
|--|--|
| InvalidName | Length or whitespace-only name |
| InvalidSymbol | Not 1–11 `[A-Za-z0-9]` |
| DecimalsOutOfRange | Not 6–18 |
| SupplyZero / SupplyOverflow | Zero or above uint128 max |
| TaxTooHigh | Buy or sell tax above cap |
| RecipientZero | Missing address |
| LockDurationInvalid | Timed lock outside 30d–5y |
| DexUnsupported / ChainDisabled | Registry closed that option |
| InsufficientNative / InsufficientBalance | Wallet cannot pay |
| PeerNotSet / PeerAlreadySet | LayerZero wiring |
| UnknownModule | Flag bits outside mask |
| MintNotAllowed | Fixed supply token |
| SimulationFailed | SDK only; wallet is not prompted |

Selectors are keccak of the error signature. Adding a new error does not change existing selectors.
