# Audit prep

> Language: English | [中文](./audit-prep.zh.md)

## Scope

- `YskOFT`, `TokenFactory`, `LiquidityManager`, `LiquidityLocker`
- `Presale` (soft/hard cap, refund)
- `BondingCurve` is disabled on purpose

## Not in this release

- Solana SPL program (listed in the product, not deployed)
- A production bonding curve
- A hosted API
- Any claim that the code is audited

## Suggested checks

- Custom errors on every user path
- OFT mint/burn skips tax and max-tx
- Timed lock cannot withdraw early; burn cannot withdraw
- CREATE2 clone addresses differ per LayerZero endpoint
- Platform fee defaults to 0
- Unknown DEX kinds revert
