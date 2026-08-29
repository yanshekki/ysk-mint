import { describe, expect, it } from "vitest";
import { encodeErrorResult } from "viem";
import { decodeLaunchError } from "../src/errors/decode";
import { launchErrorAbi } from "../src/errors/abi";
import { ErrorCode } from "../src/errors/codes";

describe("decodeLaunchError", () => {
  it("decodes InvalidName", () => {
    const data = encodeErrorResult({ abi: launchErrorAbi, errorName: "InvalidName" });
    const decoded = decodeLaunchError(data, "en");
    expect(decoded.code).toBe(ErrorCode.InvalidName);
    expect(decoded.severity).toBe("user");
    expect(decoded.message).toMatch(/Name/);
  });

  it("decodes DecimalsOutOfRange with args", () => {
    const data = encodeErrorResult({
      abi: launchErrorAbi,
      errorName: "DecimalsOutOfRange",
      args: [5],
    });
    const decoded = decodeLaunchError(data, "zh-HK");
    expect(decoded.code).toBe(ErrorCode.DecimalsOutOfRange);
    expect(decoded.args[0]).toBe(5);
    expect(decoded.message).toMatch(/Decimals/);
  });

  it("decodes messages in zh-CN", () => {
    const data = encodeErrorResult({
      abi: launchErrorAbi,
      errorName: "DecimalsOutOfRange",
      args: [5],
    });
    const decoded = decodeLaunchError(data, "zh-CN");
    expect(decoded.code).toBe(ErrorCode.DecimalsOutOfRange);
    expect(decoded.message).toMatch(/介于/);
  });

  it("returns Unknown for garbage", () => {
    const decoded = decodeLaunchError("0xdeadbeef", "en");
    expect(decoded.code).toBe(ErrorCode.Unknown);
    expect(decoded.severity).toBe("fatal");
  });
});
