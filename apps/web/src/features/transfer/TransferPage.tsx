import { useState } from "react";
import { useTranslation } from "react-i18next";
import { parseUnits, zeroAddress } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import {
  CHAINS,
  ChainKey,
  decodeLaunchError,
  toPeerBytes32,
  yskOftAbi,
  type LaunchError,
} from "@ysk-mint/sdk";
import { Button } from "../../shared/ui/Button.tsx";

export function TransferPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "zh-HK" ? "zh-HK" : "en";
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: wallet } = useWalletClient();
  const [token, setToken] = useState("");
  const [amount, setAmount] = useState("1");
  const [dstKey, setDstKey] = useState(ChainKey.ArbSepolia);
  const [quote, setQuote] = useState<string>("");
  const [errors, setErrors] = useState<LaunchError[]>([]);
  const [busy, setBusy] = useState(false);

  const dst = CHAINS[dstKey as keyof typeof CHAINS];

  async function doQuote() {
    if (!publicClient || !address || !token) return;
    setErrors([]);
    try {
      const decimals = await publicClient.readContract({
        address: token as `0x${string}`,
        abi: yskOftAbi,
        functionName: "decimals",
      });
      const value = parseUnits(amount || "0", decimals);
      const fee = await publicClient.readContract({
        address: token as `0x${string}`,
        abi: yskOftAbi,
        functionName: "quoteSend",
        args: [
          {
            dstEid: dst.eid,
            to: toPeerBytes32(address),
            amountLD: value,
            minAmountLD: value,
            extraOptions: "0x",
            composeMsg: "0x",
            oftCmd: "0x",
          },
          false,
        ],
      });
      setQuote(fee.nativeFee.toString());
    } catch (e) {
      const data = (e as { data?: `0x${string}` }).data;
      setErrors([decodeLaunchError(data ?? "0x", locale)]);
    }
  }

  async function doSend() {
    if (!publicClient || !wallet || !address || !token) return;
    setBusy(true);
    setErrors([]);
    try {
      const decimals = await publicClient.readContract({
        address: token as `0x${string}`,
        abi: yskOftAbi,
        functionName: "decimals",
      });
      const value = parseUnits(amount || "0", decimals);
      const sendParam = {
        dstEid: dst.eid,
        to: toPeerBytes32(address),
        amountLD: value,
        minAmountLD: value,
        extraOptions: "0x" as const,
        composeMsg: "0x" as const,
        oftCmd: "0x" as const,
      };
      const fee = await publicClient.readContract({
        address: token as `0x${string}`,
        abi: yskOftAbi,
        functionName: "quoteSend",
        args: [sendParam, false],
      });
      await publicClient.simulateContract({
        account: address,
        address: token as `0x${string}`,
        abi: yskOftAbi,
        functionName: "send",
        args: [sendParam, fee, address],
        value: fee.nativeFee,
      });
      const hash = await wallet.writeContract({
        address: token as `0x${string}`,
        abi: yskOftAbi,
        functionName: "send",
        args: [sendParam, fee, address],
        value: fee.nativeFee,
      });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      const data = (e as { data?: `0x${string}` }).data;
      setErrors([decodeLaunchError(data ?? "0x", locale)]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-bold">{t("transfer.title")}</h1>
      <p className="mt-2 text-sm text-text-sub">{t("transfer.body")}</p>
      <div className="mt-6 grid gap-3">
        <input
          className="rounded-xl border border-border px-3 py-2 text-sm"
          placeholder="OFT 0x…"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <input
          className="rounded-xl border border-border px-3 py-2 text-sm"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select
          className="rounded-xl border border-border px-3 py-2 text-sm"
          value={dstKey}
          onChange={(e) => setDstKey(Number(e.target.value))}
        >
          {Object.values(CHAINS)
            .filter((c) => c.enabled)
            .map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
        </select>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => void doQuote()}>
            {t("transfer.quote")}
          </Button>
          <Button type="button" disabled={busy || token.toLowerCase() === zeroAddress} onClick={() => void doSend()}>
            {t("transfer.send")}
          </Button>
        </div>
        {quote ? (
          <p className="font-mono text-xs">
            {t("transfer.fee")} {quote}
          </p>
        ) : null}
        {errors.map((e) => (
          <p key={e.code} className="text-sm text-red-700">
            {e.message}
          </p>
        ))}
      </div>
    </section>
  );
}
