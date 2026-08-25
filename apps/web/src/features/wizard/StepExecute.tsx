import { useState } from "react";
import { useTranslation } from "react-i18next";
import { keccak256, parseEther, parseUnits, stringToBytes, zeroAddress } from "viem";
import { useAccount, useConfig, useSwitchChain } from "wagmi";
import { getPublicClient, getWalletClient } from "wagmi/actions";
import {
  ErrorCode,
  LaunchStep,
  decodeLaunchError,
  isConfigured,
  launchContracts,
  liquidityManagerAbi,
  tokenFactoryAbi,
  yskOftAbi,
  planPeerCalls,
  CHAINS,
  validateLaunchDraft,
  validateLock,
  validateLpAmounts,
  type ChainDefinition,
  type LaunchContracts,
  type LaunchError,
} from "@ysk-mint/sdk";
import { lpTokenAmount } from "./presets.ts";
import { packFlags } from "./flags.ts";
import { Button } from "../../shared/ui/Button.tsx";
import { useWizard } from "./store.ts";
import { configuredEvm, homeEvm, selectedChains, undeployedEvm } from "../../lib/launchTargets.ts";

export function StepExecute() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "zh-HK" ? "zh-HK" : "en";
  const w = useWizard();
  const { address } = useAccount();
  const config = useConfig();
  const { switchChainAsync } = useSwitchChain();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<LaunchError[]>([]);

  const nativePicked = selectedChains(w.chains).filter((c) => !c.evm);
  const ready = configuredEvm(w.chains);
  const missing = undeployedEvm(w.chains);
  const home = homeEvm(w.chains);
  const canRun = Boolean(address && ready.length);

  async function run() {
    if (!address || !home || ready.length === 0) {
      setErrors([{ code: ErrorCode.RecipientZero, args: [], severity: "user", retryable: false }]);
      return;
    }
    const supply = parseUnits(w.totalSupply || "0", w.decimals);
    const tokenLp = parseUnits(lpTokenAmount(w.totalSupply, w.lpBps), w.decimals);
    const nativeLp = parseEther(w.lpNativeAmount || "0");
    const flags = packFlags(w);
    const collected = [
      ...validateLaunchDraft(
        {
          name: w.name,
          symbol: w.symbol,
          decimals: w.decimals,
          totalSupply: supply,
          supplyMode: w.supplyMode,
          moduleFlags: flags,
          owner: address,
          chains: w.chains,
        },
        locale,
      ),
      ...validateLock(w.lockMode, w.lockDuration, locale),
      ...validateLpAmounts(tokenLp, nativeLp, locale),
    ];
    if (collected.length) {
      setErrors(collected);
      return;
    }
    setErrors([]);
    const stamp = Date.now();
    const perChain: Record<number, { token?: `0x${string}`; tx?: `0x${string}` }> = { ...w.perChain };
    let lastCreate: `0x${string}` | undefined;
    let lastLp: `0x${string}` | undefined;
    let lockId: string | undefined;
    let homeToken: `0x${string}` | undefined;

    try {
      for (const chain of ready) {
        const contracts = launchContracts(chain.key);
        if (!isConfigured(contracts)) continue;
        const isHome = chain.key === home.key;
        const created = await deployOFT({
          chain,
          contracts,
          amount: isHome ? supply : 0n,
          stamp,
        });
        perChain[chain.key] = { token: created.token, tx: created.createHash };
        lastCreate = created.createHash;
        if (isHome) {
          homeToken = created.token;
          const lp = await lockLp({ chain, contracts, token: created.token, tokenLp, nativeLp });
          lastLp = lp.lpHash;
          lockId = lp.lockId;
        }
        w.set({ perChain, createTx: lastCreate, tokenAddress: homeToken, lpTx: lastLp, lockId });
      }

      const deployed = Object.entries(perChain)
        .filter(([, v]) => v.token)
        .map(([key, v]) => ({ chainKey: Number(key), address: v.token as `0x${string}` }));
      const peerCalls = planPeerCalls(deployed);
      for (const call of peerCalls) {
        const chain = CHAINS[call.fromChainKey as keyof typeof CHAINS];
        if (!chain?.evm) continue;
        setBusy("sending");
        await switchChainAsync({ chainId: chain.chainId });
        const publicClient = getPublicClient(config, { chainId: chain.chainId });
        const wallet = await getWalletClient(config, { chainId: chain.chainId });
        if (!publicClient || !wallet) continue;
        await publicClient.simulateContract({
          account: address,
          address: call.from,
          abi: yskOftAbi,
          functionName: "setPeer",
          args: [call.dstEid, call.peer],
        });
        const peerHash = await wallet.writeContract({
          address: call.from,
          abi: yskOftAbi,
          functionName: "setPeer",
          args: [call.dstEid, call.peer],
        });
        await publicClient.waitForTransactionReceipt({ hash: peerHash });
      }
      w.set({ step: LaunchStep.Success, perChain, createTx: lastCreate, tokenAddress: homeToken, lpTx: lastLp, lockId });
    } catch (e) {
      const data = (e as { data?: `0x${string}` }).data;
      setErrors([data ? decodeLaunchError(data, locale) : decodeLaunchError("0x", locale)]);
    } finally {
      setBusy(null);
    }
  }

  async function deployOFT({
    chain,
    contracts,
    amount,
    stamp,
  }: {
    chain: ChainDefinition;
    contracts: LaunchContracts;
    amount: bigint;
    stamp: number;
  }) {
    if (!address) throw new Error("no account");
    setBusy("sending");
    await switchChainAsync({ chainId: chain.chainId });
    const publicClient = getPublicClient(config, { chainId: chain.chainId });
    const wallet = await getWalletClient(config, { chainId: chain.chainId });
    if (!publicClient || !wallet) throw new Error("missing client");
    const salt = keccak256(stringToBytes(`${address}:${w.symbol}:${chain.chainId}:${stamp}`));
    const params = {
      name: w.name,
      symbol: w.symbol,
      decimals: w.decimals,
      totalSupply: amount,
      owner: address,
      supplyMode: w.supplyMode,
      moduleFlags: packFlags(w),
    } as const;
    setBusy("simulating");
    await publicClient.simulateContract({
      account: address,
      address: contracts.factory,
      abi: tokenFactoryAbi,
      functionName: "createToken",
      args: [params, salt],
    });
    setBusy("sending");
    const createHash = await wallet.writeContract({
      address: contracts.factory,
      abi: tokenFactoryAbi,
      functionName: "createToken",
      args: [params, salt],
    });
    const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
    const launchLog = createReceipt.logs.find((l) => l.address.toLowerCase() === contracts.factory.toLowerCase());
    const token = launchLog?.topics[1] ? (`0x${launchLog.topics[1].slice(26)}` as `0x${string}`) : undefined;
    if (!token || token === zeroAddress) throw new Error("missing token");
    return { token, createHash };
  }

  async function lockLp({
    chain,
    contracts,
    token,
    tokenLp,
    nativeLp,
  }: {
    chain: ChainDefinition;
    contracts: LaunchContracts;
    token: `0x${string}`;
    tokenLp: bigint;
    nativeLp: bigint;
  }) {
    if (!address) throw new Error("no account");
    const publicClient = getPublicClient(config, { chainId: chain.chainId });
    const wallet = await getWalletClient(config, { chainId: chain.chainId });
    if (!publicClient || !wallet) throw new Error("missing client");
    setBusy("simulating");
    await publicClient.simulateContract({
      account: address,
      address: token,
      abi: yskOftAbi,
      functionName: "approve",
      args: [contracts.manager, tokenLp],
    });
    setBusy("sending");
    const approveHash = await wallet.writeContract({
      address: token,
      abi: yskOftAbi,
      functionName: "approve",
      args: [contracts.manager, tokenLp],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    setBusy("simulating");
    await publicClient.simulateContract({
      account: address,
      address: contracts.manager,
      abi: liquidityManagerAbi,
      functionName: "addAndLock",
      args: [token, contracts.v2Router, tokenLp, 0n, 0n, w.lockMode, BigInt(w.lockDuration)],
      value: nativeLp,
    });
    setBusy("sending");
    const lpHash = await wallet.writeContract({
      address: contracts.manager,
      abi: liquidityManagerAbi,
      functionName: "addAndLock",
      args: [token, contracts.v2Router, tokenLp, 0n, 0n, w.lockMode, BigInt(w.lockDuration)],
      value: nativeLp,
    });
    const lpReceipt = await publicClient.waitForTransactionReceipt({ hash: lpHash });
    const launched = lpReceipt.logs.find((l) => l.address.toLowerCase() === contracts.manager.toLowerCase());
    const lockId = launched?.data ? BigInt(launched.data.slice(0, 66)).toString() : undefined;
    return { lpHash, lockId };
  }

  return (
    <div className="space-y-4">
      {home ? (
        <p className="text-[15px] text-text-sub">{t("wizard.execute.home", { name: home.name })}</p>
      ) : (
        <p className="text-[15px] text-text-sub">{t("wizard.execute.needEvm")}</p>
      )}
      {ready.length ? (
        <ul className="space-y-1 text-[14px] text-text-sub">
          {ready.map((c) => (
            <li key={c.key}>
              {c.name}
              {home && c.key === home.key ? ` · ${t("wizard.execute.homeTag")}` : ` · ${t("wizard.execute.spokeTag")}`}
            </li>
          ))}
        </ul>
      ) : null}
      {missing.length ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {t("wizard.execute.needContracts")}
          <span className="mt-1 block">{missing.map((c) => c.name).join(" · ")}</span>
        </p>
      ) : null}
      {nativePicked.length ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{t("wizard.execute.nativePath")}</p>
      ) : null}
      {errors.length ? (
        <ul className="list-disc pl-5 text-sm text-red-700">
          {errors.map((err) => (
            <li key={err.code}>{err.message ?? err.code}</li>
          ))}
        </ul>
      ) : null}
      <Button type="button" disabled={Boolean(busy) || !canRun} onClick={() => void run()}>
        {busy === "simulating"
          ? t("wizard.execute.simulating")
          : busy === "sending"
            ? t("wizard.execute.sending")
            : t("wizard.execute.simulate")}
      </Button>
      {w.createTx ? <p className="font-mono text-xs break-all">create {w.createTx}</p> : null}
      {w.lpTx ? <p className="font-mono text-xs break-all">lp {w.lpTx}</p> : null}
    </div>
  );
}
