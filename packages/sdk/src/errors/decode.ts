import { decodeErrorResult } from "viem";
import { launchErrorAbi } from "./abi.js";
import {
  ErrorCode,
  RETRYABLE_CODES,
  USER_CODES,
  type ErrorCodeName,
  type LaunchError,
  type LaunchErrorSeverity,
} from "./codes.js";
import { messageFor, type Locale } from "./messages.js";

function severityOf(code: string): LaunchErrorSeverity {
  if (USER_CODES.has(code)) return "user";
  if (code === ErrorCode.Unknown || code === ErrorCode.CloneFailed) return "fatal";
  return "chain";
}

export function decodeLaunchError(data: `0x${string}` | undefined, locale: Locale = "en"): LaunchError {
  if (!data || data === "0x") {
    return {
      code: ErrorCode.Unknown,
      args: [],
      severity: "fatal",
      retryable: false,
      message: messageFor(ErrorCode.Unknown, locale),
    };
  }
  try {
    const decoded = decodeErrorResult({ abi: launchErrorAbi, data });
    const code = (ErrorCode[decoded.errorName as keyof typeof ErrorCode] ??
      ErrorCode.Unknown) as ErrorCodeName;
    return {
      code,
      args: decoded.args ? [...decoded.args] : [],
      severity: severityOf(code),
      retryable: RETRYABLE_CODES.has(code),
      message: messageFor(code, locale),
    };
  } catch {
    return {
      code: ErrorCode.Unknown,
      args: [data],
      severity: "fatal",
      retryable: false,
      message: messageFor(ErrorCode.Unknown, locale),
    };
  }
}

export function err(code: ErrorCodeName, args: unknown[] = [], locale: Locale = "en"): LaunchError {
  return {
    code,
    args,
    severity: severityOf(code),
    retryable: RETRYABLE_CODES.has(code),
    message: messageFor(code, locale),
  };
}
