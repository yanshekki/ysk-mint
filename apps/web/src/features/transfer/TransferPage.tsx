import { useState } from "react";
import { useTranslation } from "react-i18next";
import { zeroAddress } from "viem";
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
import { ChipGroup } from "../../shared/ui/ChipGroup.tsx";
import { TokenRow } from "../../shared/ui/TokenRow.tsx";

const PCT = [10, 25, 50, 75, 100] as const;

export function TransferPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "zh-HK" ? "zh-HK" : "en";
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: wallet } = useWalletClient();
  const [token, setToken] = useState("");
  const [pct, setPct] = useState<(typeof PCT)[number]>(25);
  const [dstKey, setDstKey] = useState(ChainKey.ArbSepolia);
  const [quote, setQuote] = useState<string>("");
  const [errors, setErrors] = useState<LaunchError[]>([]);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);

  const dst = CHAINS[dstKey as keyof typeof CHAINS];
  const enabled = Object.values(CHAINS).filter((c) => c.enabled);
  const destIsNative = dst?.vm === "near" || dst?.vm === "cardano" || dst?.vm === "solana";

  async function amountOf(): Promise<bigint> {
    if (!publicClient || !address || !token) return 0n;
    const [decimals, bal] = await Promise.all([
      publicClient.readContract({ address: token as `0x${string}`, abi: yskOftAbi, functionName: "decimals" }),
      publicClient.readContract({ address: token as `0x${string}`, abi: yskOftAbi, functionName: "balanceOf", args: [address] }),
    ]);
    void decimals;
    return (bal * BigInt(pct)) / 100n;
  }

  async function doQuote() {
    if (!publicClient || !address || !token) return;
    setErrors([]);
    try {
      const value = await amountOf();
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
      const value = await amountOf();
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
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">Bridge</p>
          <h1>{t("transfer.title")}</h1>
          <p className="mt-1 text-[15px] text-text-sub">{t("transfer.body")}</p>
        </div>
      </div>
      <div className="split">
        <div className="split-pane space-y-6">
          <div>
            <p className="mb-2 text-[14px] font-bold">{t("transfer.token")}</p>
            {manual ? (
              <input className="field-text num" value={token} onChange={(e) => setToken(e.target.value)} placeholder="0x…" />
            ) : (
              <TokenRow
                title={token ? token.slice(0, 6) : t("transfer.pick")}
                subtitle={token || t("transfer.pickHint")}
                onClick={() => setManual(true)}
              />
            )}
          </div>
          <div>
            <p className="mb-2 text-[14px] font-bold">{t("transfer.amount")}</p>
            <ChipGroup
              ariaLabel="pct"
              value={pct}
              onChange={setPct}
              options={PCT.map((p) => ({ value: p, label: p === 100 ? "Max" : `${p}%` }))}
            />
          </div>
          <div>
            <p className="mb-2 text-[14px] font-bold">{t("transfer.dest")}</p>
            <ChipGroup
              ariaLabel="dst"
              value={dstKey}
              onChange={setDstKey}
              options={enabled.map((c) => ({ value: c.key, label: c.short }))}
            />
            {destIsNative ? <p className="mt-2 text-[14px] text-text-muted">{t("transfer.nativeDest")}</p> : null}
          </div>
        </div>
        <div className="split-pane flex flex-col gap-4">
          <p className="text-[14px] font-bold">{t("transfer.quote")}</p>
          <p className="num text-2xl font-black">{quote ? quote : "—"}</p>
          {quote ? <p className="num text-[14px] text-text-muted">{t("transfer.fee")}</p> : null}
          {errors.map((e) => (
            <p key={e.code} className="text-[15px] text-red-700">
              {e.message}
            </p>
          ))}
          <div className="mt-auto flex gap-2">
            <Button type="button" variant="ghost" disabled={destIsNative} onClick={() => void doQuote()}>
              {t("transfer.quote")}
            </Button>
            <Button
              type="button"
              variant="grad"
              disabled={destIsNative || busy || !token || token.toLowerCase() === zeroAddress}
              onClick={() => void doSend()}
            >
              {t("transfer.send")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
