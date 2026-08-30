# Security checklist

> Language: English | [中文](./security-checklist.zh.md)

This is a **product checklist**, not an audit opinion. The app does not take custody of keys or assets. Do not describe the product as audited.

## Always shown to the user

- Ownership: keep, renounce, or transfer to Safe/Timelock.
- Mintable vs fixed supply.
- LP lock mode and remaining time (on-chain `view`).
- Tax and max-tx flags, and that OFT transfers stay 1:1.
- Contract verification link when available.

## Custody and keys

- Private keys never enter this site. Signatures stay in the user’s wallet (RainbowKit / native selectors).
- Watch sets and share URLs are public addresses only. A share link is not a login and not a key export.
- YSK Limited does not operate a custodian, sequencer, or withdrawal queue for user funds.

## RPC and local data

- Custom RPC URLs and address books live in this browser (`localStorage`). They are not uploaded to a YSK server.
- Public node rotation can fail, rate-limit, or return stale data. Treat figures as unverified.
- Market Depth USD comes from protocol TVL endpoints and DEX quotes. It can be delayed, incomplete, or wrong.
- Outbound caps limit concurrent fetches; they are not a security boundary.

## Engineering rules

- Custom errors, no `require(string)` as the user path.
- Dual validation (SDK then contract).
- Simulate before wallet prompt.
- Unknown module bits revert.
- Mainnet factory slots stay zero until an explicit deploy.

## Do not claim

- “Audited”
- “Cannot be rugged”
- Guaranteed yield, fill, or APY
- Mainnet-ready while factory addresses are zero
