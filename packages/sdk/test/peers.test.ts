import { describe, expect, it } from "vitest";
import { ChainKey } from "@ysk-mint/config";
import { planPeerCalls, toPeerBytes32, validateSupplySplit } from "../src/oft/peers";
import { ErrorCode } from "../src/errors/codes";

const a = "0x0000000000000000000000000000000000000001" as const;
const b = "0x0000000000000000000000000000000000000002" as const;

describe("planPeerCalls", () => {
  it("wires both directions and does not assume equal addresses", () => {
    const calls = planPeerCalls([
      { chainKey: ChainKey.BaseSepolia, address: a },
      { chainKey: ChainKey.ArbSepolia, address: b },
    ]);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.peer).toBe(toPeerBytes32(b));
    expect(calls[1]?.peer).toBe(toPeerBytes32(a));
    expect(calls[0]?.from).not.toBe(calls[1]?.from);
  });
});

describe("validateSupplySplit", () => {
  it("requires the parts to sum to total", () => {
    expect(
      validateSupplySplit(10n, [
        { chainKey: ChainKey.BaseSepolia, amount: 4n },
        { chainKey: ChainKey.ArbSepolia, amount: 6n },
      ]),
    ).toEqual([]);
    expect(
      validateSupplySplit(10n, [{ chainKey: ChainKey.BaseSepolia, amount: 3n }]).map((e) => e.code),
    ).toContain(ErrorCode.SupplyOverflow);
  });
});
