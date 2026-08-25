import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ChainKey,
  DexKind,
  LaunchStatus,
  LaunchStep,
  LockMode,
  ModuleFlag,
  OwnershipAction,
  SupplyMode,
} from "@ysk-mint/config";

const lock = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../config/enum-parity.json"), "utf8"),
);

describe("enum parity", () => {
  it("matches packages/config/enum-parity.json", () => {
    expect(ChainKey).toEqual(lock.ChainKey);
    expect(DexKind).toEqual(lock.DexKind);
    expect(LockMode).toEqual(lock.LockMode);
    expect(OwnershipAction).toEqual(lock.OwnershipAction);
    expect(SupplyMode).toEqual(lock.SupplyMode);
    expect(LaunchStep).toEqual(lock.LaunchStep);
    expect(LaunchStatus).toEqual(lock.LaunchStatus);
    expect(ModuleFlag).toEqual(lock.ModuleFlag);
  });
});
