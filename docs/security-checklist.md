# Security checklist

> Language: English | [中文](./security-checklist-ZH.md)

This is a **product checklist**, not an audit opinion.

## Always shown to the user

- Ownership: keep, renounce, or transfer to Safe/Timelock.
- Mintable vs fixed supply.
- LP lock mode and remaining time (on-chain `view`).
- Tax and max-tx flags, and that OFT transfers stay 1:1.
- Contract verification link when available.

## Engineering rules

- Custom errors, no `require(string)` as the user path.
- Dual validation (SDK then contract).
- Simulate before wallet prompt.
- Unknown module bits revert.
- Mainnet disabled until a later phase.

## Do not claim

- “Audited”
- “Cannot be rugged”
- Mainnet-ready while testnet-only flags are on
