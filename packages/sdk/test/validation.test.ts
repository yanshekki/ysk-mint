import { describe, expect, it } from "vitest";
import { ChainKey, ErrorCode } from "../src/index";
import { validateBasics, validateName, validateSymbol } from "../src/validation/token";
import { validateLaunchDraft } from "../src/validation/launch";

describe("token validation", () => {
  it("accepts a normal name and symbol", () => {
    expect(validateBasics({ name: "YSK Token", symbol: "YSK", decimals: 18, totalSupply: 1n })).toEqual([]);
  });

  it("rejects whitespace-only name", () => {
    expect(validateName("   ").map((e) => e.code)).toContain(ErrorCode.InvalidName);
  });

  it("rejects symbol with space", () => {
    expect(validateSymbol("Y S").map((e) => e.code)).toContain(ErrorCode.InvalidSymbol);
  });

  it("rejects disabled mainnet chain in draft", () => {
    const errors = validateLaunchDraft({
      name: "YSK Token",
      symbol: "YSK",
      decimals: 18,
      totalSupply: 1n,
      supplyMode: 0,
      moduleFlags: 0,
      owner: "0x0000000000000000000000000000000000000001",
      chains: [ChainKey.Ethereum],
    });
    expect(errors.map((e) => e.code)).toContain(ErrorCode.ChainDisabled);
  });

  it("accepts Base Sepolia draft", () => {
    const errors = validateLaunchDraft({
      name: "YSK Token",
      symbol: "YSK",
      decimals: 18,
      totalSupply: 1n,
      supplyMode: 0,
      moduleFlags: 0,
      owner: "0x0000000000000000000000000000000000000001",
      chains: [ChainKey.BaseSepolia],
    });
    expect(errors).toEqual([]);
  });
});
