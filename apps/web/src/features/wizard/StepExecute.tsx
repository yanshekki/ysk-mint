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
import { chainIcon } from "../../lib/chainIcon.ts";
import { canWalletDeploy, ensureStack, needsMockRouter, resolvedContracts } from "../../lib/launchStack.ts";
import {
  ISSUANCE_GROUP_TITLE,
  blockedEvm,
  deployableEvm,
  homeEvm,
  issuanceGroups,
  selectedEvm,
} from "../../lib/launchTargets.ts";

export function StepExecute() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "zh-HK" ? "zh-HK" : "en";
  const w = useWizard();
  const { address } = useAccount();
  const config = useConfig();
  const { switchChainAsync } = useSwitchChain();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<LaunchError[]>([]);

  const selected = new Set(w.chains);
  const groups = issuanceGroups()
    .map((g) => ({
      vm: g.vm,
      main: g.main.filter((c) => selected.has(c.key)),
      test: g.test.filter((c) => selected.has(c.key)),
    }))
    .filter((g) => g.main.length || g.test.length);
  const evmTargets = selectedEvm(w.chains).filter((c) => isConfigured(resolvedContracts(c)) || canWalletDeploy(c));
  const toDeploy = deployableEvm(w.chains);
  const blocked = blockedEvm(w.chains);
  const home = homeEvm(w.chains);
  const canRun = Boolean(address && evmTargets.length);
  const nativeCount = groups.filter((g) => g.vm !== "evm").reduce((n, g) => n + g.main.length + g.test.length, 0);
  const useMockLp = toDeploy.some((c) => needsMockRouter(c));

  function evmStatus(c: ChainDefinition) {
    if (isConfigured(resolvedContracts(c))) return t("wizard.execute.ready");
    if (canWalletDeploy(c)) return t("wizard.execute.willDeploy");
    return t("wizard.execute.mainnetZero");
  }

  async function run() {
    if (!address || !home || evmTargets.length === 0) {
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
    const ordered = [home, ...evmTargets.filter((c) => c.key !== home.key)];

    try {
      for (const chain of ordered) {
        await switchChainAsync({ chainId: chain.chainId });
        const publicClient = getPublicClient(config, { chainId: chain.chainId });
        const wallet = await getWalletClient(config, { chainId: chain.chainId });
        if (!publicClient || !wallet) continue;
        if (canWalletDeploy(chain) && !isConfigured(resolvedContracts(chain))) setBusy("deploying");
        const contracts = await ensureStack({ chain, publicClient, wallet, account: address });
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
      const err = e as { data?: `0x${string}`; cause?: { data?: `0x${string}` }; shortMessage?: string; message?: string };
      const data = err.data ?? err.cause?.data;
      if (data && data !== "0x") {
        setErrors([decodeLaunchError(data, locale)]);
      } else {
        const msg = (err.shortMessage || err.message || String(e)).slice(0, 280);
        setErrors([{ code: ErrorCode.Unknown, args: [], severity: "user", retryable: true, message: msg }]);
      }
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
    <div className="review-desk">
      <header className="oft-head">
        <p className="oft-lede">
          {home ? t("wizard.execute.home", { name: home.name }) : t("wizard.execute.needEvm")}
        </p>
      </header>

      {groups.map((g) => (
        <section key={g.vm} className="chain-group">
          <p className="chain-group-title">{t(ISSUANCE_GROUP_TITLE[g.vm] ?? "wizard.chains.groupEvm")}</p>
          <div className="chain-row">
            {[...g.main, ...g.test].map((c) => (
              <article key={c.key} className="oft-chain">
                <img src={chainIcon(c)} alt="" width={32} height={32} />
                <div>
                  <b>{c.name}</b>
                  <span>
                    {c.evm
                      ? `${home && c.key === home.key ? t("wizard.execute.homeTag") : t("wizard.execute.spokeTag")} · ${evmStatus(c)}`
                      : t("wizard.execute.nativeSkip")}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="chain-group">
        <p className="chain-group-title">{t("wizard.review.notes")}</p>
        <ul className="review-notes">
          {!address ? <li>{t("wizard.execute.needWallet")}</li> : null}
          {toDeploy.length ? <li>{t("wizard.execute.walletDeploy")}</li> : null}
          {blocked.length ? <li>{t("wizard.execute.blocked")}</li> : null}
          {nativeCount ? <li>{t("wizard.execute.nativeSkip")}</li> : null}
          {useMockLp ? <li>{t("wizard.execute.mockLp")}</li> : null}
        </ul>
      </section>

      {errors.length ? (
        <ul className="me-errors">
          {errors.map((err) => (
            <li key={err.code}>{err.message ?? err.code}</li>
          ))}
        </ul>
      ) : null}

      <Button type="button" variant="grad" disabled={Boolean(busy) || !canRun} onClick={() => void run()}>
        {busy === "deploying"
          ? t("wizard.execute.deploying")
          : busy === "simulating"
            ? t("wizard.execute.simulating")
            : busy === "sending"
              ? t("wizard.execute.sending")
              : toDeploy.length
                ? t("wizard.execute.deploySign")
                : t("wizard.execute.simulate")}
      </Button>
      {home && (w.createTx || w.lpTx) ? (
        <div className="xfer-acts">
          {w.createTx ? (
            <a className="me-pool-btn me-pool-btn-explore" href={`${home.explorer.replace(/\/$/, "")}/tx/${w.createTx}`} target="_blank" rel="noreferrer">
              {t("transfer.explorer")} {w.createTx.slice(0, 6)}…{w.createTx.slice(-4)}
            </a>
          ) : null}
          {w.lpTx ? (
            <a className="me-pool-btn me-pool-btn-explore" href={`${home.explorer.replace(/\/$/, "")}/tx/${w.lpTx}`} target="_blank" rel="noreferrer">
              LP {w.lpTx.slice(0, 6)}…{w.lpTx.slice(-4)}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
