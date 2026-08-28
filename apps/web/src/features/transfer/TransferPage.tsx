import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { zeroAddress } from "viem";
import { useAccount, useChainId, useConfig, useSwitchChain } from "wagmi";
import { getPublicClient, getWalletClient } from "wagmi/actions";
import {
  CHAINS,
  ChainKey,
  ErrorCode,
  decodeLaunchError,
  toPeerBytes32,
  yskOftAbi,
  type LaunchError,
} from "@ysk-mint/sdk";
import { Button } from "../../shared/ui/Button.tsx";
import { ChipGroup } from "../../shared/ui/ChipGroup.tsx";
import { useEvmHoldings, type HoldingRow } from "../../lib/useHoldings.ts";
import { chainIcon } from "../../lib/chainIcon.ts";
import { ISSUANCE_GROUP_TITLE, issuanceGroups } from "../../lib/launchTargets.ts";
import { useWizard } from "../wizard/store.ts";
import { cacheGet, cacheInvalidateAccount, cacheKey, POLICIES } from "../../lib/defi/cache.ts";
import { lzExecutorLzReceiveOption } from "../../lib/lzOptions.ts";

const PCT = [10, 25, 50, 75, 100] as const;
const ZERO_PEER = `0x${"00".repeat(32)}` as const;

function errorFromCatch(e: unknown, locale: "en" | "zh-HK", notOft: string): LaunchError {
  const err = e as { data?: `0x${string}`; cause?: { data?: `0x${string}` }; message?: string };
  const data = err.data ?? err.cause?.data;
  if (data && data !== "0x") return decodeLaunchError(data, locale);
  const msg = `${err.message ?? ""} ${String(e)}`;
  if (/quoteSend|peers|returned no data|does not match|execution reverted|Function does not exist/i.test(msg)) {
    return { code: ErrorCode.Unknown, args: [], severity: "user", retryable: false, message: notOft };
  }
  return decodeLaunchError("0x", locale);
}

type Pick = {
  id: string;
  symbol: string;
  name: string;
  icon: string;
  amount: string;
  contract: `0x${string}`;
  chainId: number;
  chainTag: string;
};

export function TransferPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "zh-HK" ? "zh-HK" : "en";
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const config = useConfig();
  const { switchChainAsync } = useSwitchChain();
  const w = useWizard();
  const evmHold = useEvmHoldings(address);
  const [pick, setPick] = useState<Pick | null>(null);
  const [pct, setPct] = useState<(typeof PCT)[number]>(25);
  const [dstKey, setDstKey] = useState(ChainKey.Base);
  const [quote, setQuote] = useState("");
  const [errors, setErrors] = useState<LaunchError[]>([]);
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState(false);
  const [pasted, setPasted] = useState("");

  const srcChainId = pick?.chainId ?? chainId;
  const dst = CHAINS[dstKey as keyof typeof CHAINS];
  const destIsNative = dst?.vm !== "evm" || !dst.eid;
  const destIsSelf = Boolean(dst?.evm && dst.chainId === srcChainId);
  const destBlocked = destIsNative || destIsSelf;
  const token = pick?.contract ?? (pasted.startsWith("0x") ? (pasted as `0x${string}`) : "");

  const walletPicks = useMemo(() => {
    const fromHold: Pick[] = evmHold.rows
      .filter((r): r is HoldingRow & { contract: string; chainId: number } => Boolean(r.contract && r.chainId && r.raw > 0n && !r.native))
      .map((r) => ({
        id: r.id,
        symbol: r.symbol,
        name: r.name,
        icon: r.icon,
        amount: r.amount,
        contract: r.contract as `0x${string}`,
        chainId: r.chainId,
        chainTag: r.chainTag ?? "",
      }));
    const seen = new Set(fromHold.map((p) => `${p.chainId}:${p.contract.toLowerCase()}`));
    const launched: Pick[] = [];
    for (const [key, v] of Object.entries(w.perChain)) {
      if (!v.token) continue;
      const c = CHAINS[Number(key) as keyof typeof CHAINS];
      if (!c?.evm) continue;
      const k = `${c.chainId}:${v.token.toLowerCase()}`;
      if (seen.has(k)) continue;
      seen.add(k);
      launched.push({
        id: `launch-${key}`,
        symbol: w.symbol || "OFT",
        name: w.name || w.symbol || "OFT",
        icon: chainIcon(c),
        amount: "",
        contract: v.token,
        chainId: c.chainId,
        chainTag: c.short,
      });
    }
    return [...launched, ...fromHold];
  }, [evmHold.rows, w.name, w.perChain, w.symbol]);

  const groups = issuanceGroups().filter((g) => g.vm === "evm");
  const canAct = Boolean(address && token && token.toLowerCase() !== zeroAddress && !destBlocked && dst?.eid);

  const quoteNow = useCallback(async () => {
    if (!address || !token || destBlocked || !dst?.eid) return;
    setErrors([]);
    setQuote("");
    try {
      if (pick && pick.chainId !== chainId) {
        await switchChainAsync({ chainId: pick.chainId });
      }
      const client = getPublicClient(config, { chainId: pick?.chainId ?? srcChainId });
      if (!client) throw new Error("missing client");
      const peer = await cacheGet(
        {
          key: cacheKey("xfer.peer", pick?.chainId ?? srcChainId, token, dst.eid),
          policy: POLICIES.meta,
        },
        () =>
          client.readContract({
            address: token as `0x${string}`,
            abi: yskOftAbi,
            functionName: "peers",
            args: [dst.eid],
          }),
      );
      if (peer === ZERO_PEER) {
        setErrors([
          {
            code: ErrorCode.PeerNotSet,
            args: [],
            severity: "user",
            retryable: false,
            message: t("transfer.peerMissing"),
          },
        ]);
        return;
      }
      const bal = await client.readContract({
        address: token as `0x${string}`,
        abi: yskOftAbi,
        functionName: "balanceOf",
        args: [address],
      });
      const value = (bal * BigInt(pct)) / 100n;
      const fee = await client.readContract({
        address: token as `0x${string}`,
        abi: yskOftAbi,
        functionName: "quoteSend",
        args: [
          {
            dstEid: dst.eid,
            to: toPeerBytes32(address),
            amountLD: value,
            minAmountLD: value,
            extraOptions: lzExecutorLzReceiveOption(),
            composeMsg: "0x",
            oftCmd: "0x",
          },
          false,
        ],
      });
      setQuote(fee.nativeFee.toString());
    } catch (e) {
      setErrors([errorFromCatch(e, locale, t("transfer.notOft"))]);
    }
  }, [address, chainId, config, destBlocked, dst?.eid, locale, pct, pick, srcChainId, switchChainAsync, t, token]);

  useEffect(() => {
    if (!canAct) {
      setQuote("");
      return;
    }
    const handle = window.setTimeout(() => void quoteNow(), 200);
    return () => window.clearTimeout(handle);
  }, [canAct, quoteNow]);

  async function doSend() {
    if (!address || !token || !dst?.eid) return;
    setBusy(true);
    setErrors([]);
    try {
      if (pick && pick.chainId !== chainId) {
        await switchChainAsync({ chainId: pick.chainId });
      }
      const client = getPublicClient(config, { chainId: pick?.chainId ?? srcChainId });
      const signer = await getWalletClient(config, { chainId: pick?.chainId ?? srcChainId });
      if (!client || !signer) throw new Error("missing client");
      const bal = await client.readContract({
        address: token as `0x${string}`,
        abi: yskOftAbi,
        functionName: "balanceOf",
        args: [address],
      });
      const value = (bal * BigInt(pct)) / 100n;
      const sendParam = {
        dstEid: dst.eid,
        to: toPeerBytes32(address),
        amountLD: value,
        minAmountLD: value,
        extraOptions: lzExecutorLzReceiveOption(),
        composeMsg: "0x" as const,
        oftCmd: "0x" as const,
      };
      const fee = await client.readContract({
        address: token as `0x${string}`,
        abi: yskOftAbi,
        functionName: "quoteSend",
        args: [sendParam, false],
      });
      await client.simulateContract({
        account: address,
        address: token as `0x${string}`,
        abi: yskOftAbi,
        functionName: "send",
        args: [sendParam, fee, address],
        value: fee.nativeFee,
      });
      const hash = await signer.writeContract({
        address: token as `0x${string}`,
        abi: yskOftAbi,
        functionName: "send",
        args: [sendParam, fee, address],
        value: fee.nativeFee,
      });
      await client.waitForTransactionReceipt({ hash });
      cacheInvalidateAccount(address);
      setQuote(fee.nativeFee.toString());
    } catch (e) {
      setErrors([errorFromCatch(e, locale, t("transfer.notOft"))]);
    } finally {
      setBusy(false);
    }
  }

  function selectPick(p: Pick) {
    setPick(p);
    setPaste(false);
    setQuote("");
    if (dst.chainId === p.chainId) {
      const other = groups[0]?.main.find((c) => c.evm && c.chainId !== p.chainId && c.eid > 0);
      if (other) setDstKey(other.key);
    }
    void switchChainAsync({ chainId: p.chainId }).catch(() => undefined);
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
      <div className="workspace-body">
        <div className="workspace-main">
          <div className="workspace-scroll">
            <div className="transfer-desk">
              <section className="chain-group">
                <p className="chain-group-title">{t("transfer.walletTokens")}</p>
                {!isConnected ? (
                  <p className="field-note">{t("transfer.needWallet")}</p>
                ) : walletPicks.length === 0 ? (
                  <p className="field-note">{t("transfer.noTokens")}</p>
                ) : (
                  <div className="chain-row">
                    {walletPicks.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`oft-chain transfer-pick ${pick?.id === p.id ? "transfer-pick-on" : ""}`}
                        onClick={() => selectPick(p)}
                      >
                        <img src={p.icon} alt="" width={32} height={32} />
                        <div>
                          <b>
                            {p.symbol} <span className="transfer-tag">{p.chainTag}</span>
                          </b>
                          <span className="num">{p.amount || p.contract.slice(0, 8) + "…"}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" className="transfer-paste" onClick={() => setPaste((v) => !v)}>
                  {t("transfer.paste")}
                </button>
                {paste ? (
                  <input
                    className="field-text num"
                    value={pasted}
                    placeholder="0x…"
                    onChange={(e) => {
                      setPasted(e.target.value);
                      setPick(null);
                      setQuote("");
                    }}
                  />
                ) : null}
              </section>

              <section className="chain-group">
                <p className="chain-group-title">{t("transfer.amount")}</p>
                <ChipGroup
                  ariaLabel="pct"
                  value={pct}
                  onChange={setPct}
                  options={PCT.map((p) => ({ value: p, label: p === 100 ? "Max" : `${p}%` }))}
                />
              </section>

              {groups.map((g) => {
                const destBtn = (c: (typeof g.main)[number]) => {
                  const off = c.vm !== "evm" || !c.eid || c.chainId === srcChainId;
                  const on = dstKey === c.key && !off;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      disabled={off}
                      className={`oft-chain transfer-pick ${on ? "transfer-pick-on" : ""}`}
                      onClick={() => {
                        setDstKey(c.key);
                        setQuote("");
                      }}
                    >
                      <img src={chainIcon(c)} alt="" width={32} height={32} />
                      <div>
                        <b>{c.name}</b>
                        <span>
                          {c.evm && c.eid
                            ? c.chainId === srcChainId
                              ? t("transfer.sameChain")
                              : `EID ${c.eid}`
                            : t("transfer.nativeDest")}
                        </span>
                      </div>
                    </button>
                  );
                };
                return (
                  <section key={g.vm} className="chain-group">
                    <p className="chain-group-title">
                      {g.vm === "evm" ? `${t("transfer.dest")} · ` : ""}
                      {t(ISSUANCE_GROUP_TITLE[g.vm] ?? "wizard.chains.groupEvm")}
                    </p>
                    {g.vm === "evm" ? (
                      <>
                        <div className="chain-row">{g.main.map(destBtn)}</div>
                        {g.test.length ? (
                          <>
                            <p className="chain-sub">{t("wizard.chains.testnets")}</p>
                            <div className="chain-row">{g.test.map(destBtn)}</div>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <div className="chain-row">
                        {g.main.map(destBtn)}
                        {g.test.map(destBtn)}
                      </div>
                    )}
                  </section>
                );
              })}

              <section className="chain-group">
                <p className="chain-group-title">{t("transfer.quote")}</p>
                <div className="review-stat">
                  <span className="review-k">{t("transfer.fee")}</span>
                  <span className="review-v num">{quote || "—"}</span>
                </div>
                {errors.map((e) => (
                  <p key={e.code} className="text-[15px] text-red-700">
                    {e.message}
                  </p>
                ))}
              </section>
            </div>
          </div>
          <div className="workspace-actions">
            <Button type="button" variant="ghost" disabled={!canAct} onClick={() => void quoteNow()}>
              {t("transfer.quote")}
            </Button>
            <Button type="button" variant="grad" disabled={!canAct || busy || !quote} onClick={() => void doSend()}>
              {t("transfer.send")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
