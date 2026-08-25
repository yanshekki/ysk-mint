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
  validateLaunchDraft,
  validateLock,
  validateLpAmounts,
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
  const homeContracts = home ? launchContracts(home.key) : undefined;
  const canRun = Boolean(address && home && isConfigured(homeContracts));

  async function run() {
    if (!address || !home || !isConfigured(homeContracts)) {
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
    const salt = keccak256(stringToBytes(`${address}:${w.symbol}:${home.chainId}:${Date.now()}`));
    try {
      await switchChainAsync({ chainId: home.chainId });
      const publicClient = getPublicClient(config, { chainId: home.chainId });
      const wallet = await getWalletClient(config, { chainId: home.chainId });
      if (!publicClient || !wallet) throw new Error("missing client");

      const params = {
        name: w.name,
        symbol: w.symbol,
        decimals: w.decimals,
        totalSupply: supply,
        owner: address,
        supplyMode: w.supplyMode,
        moduleFlags: flags,
      } as const;

      setBusy("simulating");
      await publicClient.simulateContract({
        account: address,
        address: homeContracts.factory,
        abi: tokenFactoryAbi,
        functionName: "createToken",
        args: [params, salt],
      });
      setBusy("sending");
      const createHash = await wallet.writeContract({
        address: homeContracts.factory,
        abi: tokenFactoryAbi,
        functionName: "createToken",
        args: [params, salt],
      });
      const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
      const launchLog = createReceipt.logs.find((l) => l.address.toLowerCase() === homeContracts.factory.toLowerCase());
      const tokenAddress = launchLog?.topics[1]
        ? (`0x${launchLog.topics[1].slice(26)}` as `0x${string}`)
        : undefined;
      if (!tokenAddress || tokenAddress === zeroAddress) throw new Error("missing token");
      const perChain = {
        ...w.perChain,
        [home.key]: { token: tokenAddress, tx: createHash },
      };
      w.set({ createTx: createHash, tokenAddress, perChain });

      setBusy("simulating");
      await publicClient.simulateContract({
        account: address,
        address: tokenAddress,
        abi: yskOftAbi,
        functionName: "approve",
        args: [homeContracts.manager, tokenLp],
      });
      setBusy("sending");
      const approveHash = await wallet.writeContract({
        address: tokenAddress,
        abi: yskOftAbi,
        functionName: "approve",
        args: [homeContracts.manager, tokenLp],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      setBusy("simulating");
      await publicClient.simulateContract({
        account: address,
        address: homeContracts.manager,
        abi: liquidityManagerAbi,
        functionName: "addAndLock",
        args: [tokenAddress, homeContracts.v2Router, tokenLp, 0n, 0n, w.lockMode, BigInt(w.lockDuration)],
        value: nativeLp,
      });
      setBusy("sending");
      const lpHash = await wallet.writeContract({
        address: homeContracts.manager,
        abi: liquidityManagerAbi,
        functionName: "addAndLock",
        args: [tokenAddress, homeContracts.v2Router, tokenLp, 0n, 0n, w.lockMode, BigInt(w.lockDuration)],
        value: nativeLp,
      });
      const lpReceipt = await publicClient.waitForTransactionReceipt({ hash: lpHash });
      const launched = lpReceipt.logs.find((l) => l.address.toLowerCase() === homeContracts.manager.toLowerCase());
      const lockId = launched?.data ? BigInt(launched.data.slice(0, 66)).toString() : undefined;
      w.set({ lpTx: lpHash, lockId, step: LaunchStep.Success });
    } catch (e) {
      const data = (e as { data?: `0x${string}` }).data;
      setErrors([data ? decodeLaunchError(data, locale) : decodeLaunchError("0x", locale)]);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {home ? (
        <p className="text-[15px] text-text-sub">
          {t("wizard.execute.home", { name: home.name })}
        </p>
      ) : (
        <p className="text-[15px] text-text-sub">{t("wizard.execute.needEvm")}</p>
      )}
      {ready.length ? (
        <ul className="space-y-1 text-[14px] text-text-sub">
          {ready.map((c) => (
            <li key={c.key}>
              {c.name} · EID {c.eid}
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
