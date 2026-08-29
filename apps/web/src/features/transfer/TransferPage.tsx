import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatEther, getAddress, zeroAddress, type Address } from "viem";
import { useAccount, useChainId, useConfig, useReadContracts, useSwitchChain } from "wagmi";
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
import { issuanceGroups } from "../../lib/launchTargets.ts";
import { useWizard } from "../wizard/store.ts";
import { sdkLocale } from "../../lib/locale.ts";
import { cacheGet, cacheInvalidateAccount, cacheKey, POLICIES } from "../../lib/defi/cache.ts";
import { lzExecutorLzReceiveOption } from "../../lib/lzOptions.ts";
import { shortAddr } from "../../lib/lendFormat.ts";

const PRIMARY_XFER = new Set([1, 8453, 42161, 43114, 56, 137, 10, 999]);

function fmtFee(wei: string) {
  try {
    const n = Number(formatEther(BigInt(wei)));
    if (!Number.isFinite(n) || n <= 0) return "—";
    if (n < 0.000001) return "<0.000001 ETH";
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`;
  } catch {
    return "—";
  }
}

const PCT = [10, 25, 50, 75, 100] as const;
const ZERO_PEER = `0x${"00".repeat(32)}` as const;
const DEST_WAIT_MS = 15 * 60 * 1000;
const DEST_POLL_MS = 8_000;

function peerToAddr(peer: `0x${string}`): Address | null {
  if (!peer || peer === ZERO_PEER) return null;
  try {
    const addr = getAddress(`0x${peer.slice(-40)}`);
    return addr === zeroAddress ? null : addr;
  } catch {
    return null;
  }
}

function lzScanUrl(hash: `0x${string}`, testnet: boolean) {
  return `${testnet ? "https://testnet.layerzeroscan.com" : "https://layerzeroscan.com"}/tx/${hash}`;
}

function srcExplorerTx(chainId: number, hash: `0x${string}`) {
  const explore = (Object.values(CHAINS).find((c) => c.chainId === chainId)?.explorer ?? "").replace(/\/$/, "");
  return explore ? `${explore}/tx/${hash}` : "";
}

type DestWait = {
  status: "waiting" | "ok" | "timeout";
  destToken: Address;
};

function errorFromCatch(e: unknown, locale: "en" | "zh-HK" | "zh-CN", notOft: string): LaunchError {
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
  const locale = sdkLocale(i18n.language);
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
  const [moreChains, setMoreChains] = useState(false);
  const [sentHash, setSentHash] = useState<`0x${string}` | null>(null);
  const [destWait, setDestWait] = useState<DestWait | null>(null);
  const waitGen = useRef(0);

  const srcChainId = pick?.chainId ?? chainId;
  const dst = CHAINS[dstKey as keyof typeof CHAINS];
  const destIsNative = dst?.vm !== "evm" || !dst.eid;
  const destIsSelf = Boolean(dst?.evm && dst.chainId === srcChainId);
  const destBlocked = destIsNative || destIsSelf;
  const token = pick?.contract ?? (pasted.startsWith("0x") ? (pasted as `0x${string}`) : "");

  const holdRows = useMemo(
    () =>
      evmHold.rows.filter(
        (r): r is HoldingRow & { contract: string; chainId: number } => Boolean(r.contract && r.chainId && r.raw > 0n && !r.native),
      ),
    [evmHold.rows],
  );
  const oftProbe = useReadContracts({
    contracts: holdRows.map((r) => ({
      address: r.contract as Address,
      abi: yskOftAbi,
      functionName: "endpoint" as const,
      chainId: r.chainId,
    })),
    query: { enabled: holdRows.length > 0, staleTime: 60_000 },
  });

  const walletPicks = useMemo(() => {
    const launched: Pick[] = [];
    const seen = new Set<string>();
    for (const [key, v] of Object.entries(w.perChain)) {
      if (!v.token) continue;
      const c = CHAINS[Number(key) as keyof typeof CHAINS];
      if (!c?.evm) continue;
      const k = `${c.chainId}:${v.token.toLowerCase()}`;
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
    const fromHold: Pick[] = [];
    holdRows.forEach((r, i) => {
      const hit = oftProbe.data?.[i];
      if (hit?.status !== "success" || !hit.result) return;
      const chain = Object.values(CHAINS).find((c) => c.chainId === r.chainId);
      if (!chain?.endpoint || chain.endpoint === zeroAddress) return;
      if ((hit.result as string).toLowerCase() !== chain.endpoint.toLowerCase()) return;
      const k = `${r.chainId}:${r.contract.toLowerCase()}`;
      if (seen.has(k)) return;
      seen.add(k);
      fromHold.push({
        id: r.id,
        symbol: r.symbol,
        name: r.name,
        icon: r.icon,
        amount: r.amount,
        contract: r.contract as `0x${string}`,
        chainId: r.chainId,
        chainTag: r.chainTag ?? "",
      });
    });
    return [...launched, ...fromHold];
  }, [holdRows, oftProbe.data, w.name, w.perChain, w.symbol]);

  const evmGroup = issuanceGroups().find((g) => g.vm === "evm");
  const destMain = (evmGroup?.main ?? []).filter((c) => c.eid > 0);
  const destTest = (evmGroup?.test ?? []).filter((c) => c.eid > 0);
  const destPrimary = destMain.filter((c) => PRIMARY_XFER.has(c.chainId));
  const destExtra = [...destMain.filter((c) => !PRIMARY_XFER.has(c.chainId)), ...destTest];
  const srcIsTest = Object.values(CHAINS).some((c) => c.chainId === srcChainId && c.testnet);
  const destVisible = srcIsTest
    ? destTest.concat(moreChains ? destPrimary : destPrimary.filter((c) => c.key === dstKey))
    : moreChains
      ? [...destPrimary, ...destExtra]
      : destPrimary.concat(destExtra.filter((c) => c.key === dstKey));
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
    if (pick && !walletPicks.some((p) => p.id === pick.id)) {
      setPick(null);
      setQuote("");
      setErrors([]);
    }
  }, [pick, walletPicks]);
  useEffect(() => {
    if (!canAct || (!pick && !pasted)) {
      setQuote("");
      return;
    }
    const handle = window.setTimeout(() => void quoteNow(), 200);
    return () => window.clearTimeout(handle);
  }, [canAct, pasted, pick, quoteNow]);

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
      setSentHash(hash);

      const peer = await client.readContract({
        address: token as `0x${string}`,
        abi: yskOftAbi,
        functionName: "peers",
        args: [dst.eid],
      });
      const destToken = peerToAddr(peer);
      const destClient = getPublicClient(config, { chainId: dst.chainId });
      if (!destToken || !destClient) {
        setDestWait(destToken ? { status: "timeout", destToken } : null);
        return;
      }
      const gen = ++waitGen.current;
      const before = await destClient.readContract({
        address: destToken,
        abi: yskOftAbi,
        functionName: "balanceOf",
        args: [address],
      });
      setDestWait({ status: "waiting", destToken });
      setBusy(false);
      const deadline = Date.now() + DEST_WAIT_MS;
      while (Date.now() < deadline) {
        await new Promise((r) => window.setTimeout(r, DEST_POLL_MS));
        if (waitGen.current !== gen) return;
        const now = await destClient.readContract({
          address: destToken,
          abi: yskOftAbi,
          functionName: "balanceOf",
          args: [address],
        });
        if (now >= before + value) {
          cacheInvalidateAccount(address);
          setDestWait({ status: "ok", destToken });
          return;
        }
      }
      if (waitGen.current === gen) setDestWait({ status: "timeout", destToken });
    } catch (e) {
      setErrors([errorFromCatch(e, locale, t("transfer.notOft"))]);
    } finally {
      setBusy(false);
    }
  }

  function resetSend() {
    waitGen.current += 1;
    setSentHash(null);
    setDestWait(null);
  }

  function selectPick(p: Pick) {
    setPick(p);
    setPaste(false);
    setQuote("");
    resetSend();
    const src = Object.values(CHAINS).find((c) => c.chainId === p.chainId);
    const pool = src?.testnet ? destTest : destMain;
    if (!dst || dst.chainId === p.chainId || (src?.testnet && !dst.testnet)) {
      const other = pool.find((c) => c.chainId !== p.chainId && c.eid > 0);
      if (other) setDstKey(other.key);
    }
    if (src?.testnet) setMoreChains(false);
    void switchChainAsync({ chainId: p.chainId }).catch(() => undefined);
  }

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">{t("transfer.kicker")}</p>
          <h1>{t("transfer.title")}</h1>
          <p className="mt-1 text-[15px] text-text-sub">{t("transfer.body")}</p>
        </div>
      </div>
      <div className="workspace-scroll">
        <div className="me-desk">
          <section className="me-card">
            <div className="me-card-head">
              <b>{t("transfer.walletTokens")}</b>
              <button type="button" className="transfer-paste" onClick={() => setPaste((v) => !v)}>
                {t("transfer.paste")}
              </button>
            </div>
            {paste ? (
              <input
                className="me-filter"
                value={pasted}
                placeholder="0x…"
                onChange={(e) => {
                  setPasted(e.target.value);
                  setPick(null);
                  setQuote("");
                  resetSend();
                }}
              />
            ) : null}
            {!isConnected ? (
              <p className="me-card-empty">{t("transfer.needWallet")}</p>
            ) : evmHold.loading || (holdRows.length > 0 && oftProbe.isPending && walletPicks.length === 0) ? (
              <p className="me-card-empty">{t("transfer.scanning")}</p>
            ) : walletPicks.length === 0 && !pasted ? (
              <p className="me-card-empty">{t("transfer.noTokens")}</p>
            ) : (
              <div className="me-list">
                {walletPicks.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`me-token me-token-5 ${pick?.id === p.id ? "transfer-pick-on" : ""}`}
                    onClick={() => selectPick(p)}
                  >
                    <span className="holding-ico-wrap">
                      <img src={p.icon} alt="" className="holding-ico" />
                      {p.chainTag ? <span className="holding-chain-tag">{p.chainTag}</span> : null}
                    </span>
                    <div className="holding-meta">
                      <b>{p.symbol}</b>
                      <span className="num">{shortAddr(p.contract)}</span>
                    </div>
                    <span />
                    <span />
                    <span className="num me-value">{p.amount || "—"}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="me-card">
            <div className="me-card-head">
              <b>{t("transfer.dest")}</b>
            </div>
            <div className="me-card-body">
              <div className="me-chips">
                {destVisible.map((c) => {
                  const off = c.chainId === srcChainId;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      disabled={off}
                      className={`me-chip ${dstKey === c.key && !off ? "me-chip-on" : ""}`}
                      onClick={() => {
                        setDstKey(c.key);
                        setQuote("");
                        resetSend();
                      }}
                    >
                      <img src={chainIcon(c)} alt="" width={20} height={20} />
                      {c.short}
                      {off ? <span className="me-count">{t("transfer.sameChain")}</span> : null}
                    </button>
                  );
                })}
                {destExtra.length ? (
                  <button type="button" className={`me-chip ${moreChains ? "me-chip-on" : ""}`} onClick={() => setMoreChains((v) => !v)}>
                    {moreChains ? t("transfer.lessChains") : t("transfer.moreChains")}
                    <span className="me-count">{destExtra.length}</span>
                  </button>
                ) : null}
              </div>
              <p className="field-note" style={{ marginTop: 10 }}>
                {t("transfer.nativeDest")}
              </p>
            </div>
          </section>

          <section className="me-card">
            <div className="me-card-head">
              <b>{t("transfer.amount")}</b>
            </div>
            <div className="me-card-body">
              <ChipGroup
                ariaLabel="pct"
                value={pct}
                onChange={(v) => {
                  setPct(v);
                  resetSend();
                }}
                options={PCT.map((p) => ({ value: p, label: p === 100 ? "Max" : `${p}%` }))}
              />
            </div>
          </section>

          <section className="me-card">
            <div className="me-card-head">
              <b>{t("transfer.quote")}</b>
            </div>
            <div className="lend-stats" style={{ padding: "12px 16px 0" }}>
              <div className="lend-stat">
                <b className="num">{quote ? fmtFee(quote) : "—"}</b>
                <span>{t("transfer.fee")}</span>
              </div>
            </div>
            {errors.length ? (
              <ul className="me-errors">
                {errors.map((e) => (
                  <li key={e.code}>{e.message}</li>
                ))}
              </ul>
            ) : null}
            {sentHash && dst ? (
              <div className="xfer-acts">
                {srcExplorerTx(srcChainId, sentHash) ? (
                  <a className="me-pool-btn me-pool-btn-explore" href={srcExplorerTx(srcChainId, sentHash)} target="_blank" rel="noreferrer">
                    {t("transfer.sent")} {shortAddr(sentHash)}
                  </a>
                ) : null}
                <a className="me-pool-btn me-pool-btn-explore" href={lzScanUrl(sentHash, Boolean(dst.testnet))} target="_blank" rel="noreferrer">
                  {t("transfer.lzScan")}
                </a>
              </div>
            ) : null}
            {destWait ? (
              <p className={`set-note set-note-pad ${destWait.status === "timeout" ? "xfer-dest-fail" : ""}`}>
                {destWait.status === "waiting"
                  ? t("transfer.destWait")
                  : destWait.status === "ok"
                    ? t("transfer.destOk", { token: shortAddr(destWait.destToken) })
                    : t("transfer.destTimeout")}
              </p>
            ) : null}
          </section>
        </div>
      </div>
      <div className="workspace-actions">
        <Button type="button" variant="ghost" disabled={!canAct} onClick={() => void quoteNow()}>
          {t("transfer.quote")}
        </Button>
        <Button type="button" variant="grad" disabled={!canAct || busy || !quote} onClick={() => void doSend()}>
          {busy ? t("wizard.execute.sending") : t("transfer.send")}
        </Button>
      </div>
    </section>
  );
}
