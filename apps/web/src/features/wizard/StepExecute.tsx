import { useState } from "react";
import { useTranslation } from "react-i18next";
import { keccak256, parseEther, parseUnits, stringToBytes, zeroAddress } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import {
  ChainKey,
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
  type LaunchError,
} from "@ysk-mint/sdk";
import { Button } from "../../shared/ui/Button.tsx";
import { useWizard } from "./store.ts";

export function StepExecute() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "zh-HK" ? "zh-HK" : "en";
  const w = useWizard();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: wallet } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<LaunchError[]>([]);

  const contracts = launchContracts(ChainKey.BaseSepolia);

  async function run() {
    if (!address || !publicClient || !wallet) {
      setErrors([{ code: ErrorCode.RecipientZero, args: [], severity: "user", retryable: false }]);
      return;
    }
    const supply = parseUnits(w.totalSupply || "0", w.decimals);
    const tokenLp = parseUnits(w.lpTokenAmount || "0", w.decimals);
    const nativeLp = parseEther(w.lpNativeAmount || "0");
    const collected = [
      ...validateLaunchDraft(
        {
          name: w.name,
          symbol: w.symbol,
          decimals: w.decimals,
          totalSupply: supply,
          supplyMode: w.supplyMode,
          moduleFlags: 0,
          owner: address,
          chains: w.chains,
        },
        locale,
      ),
      ...validateLock(w.lockMode, w.lockDuration, locale),
      ...validateLpAmounts(tokenLp, nativeLp, locale),
    ];
    if (!isConfigured(contracts)) {
      setErrors(collected);
      return;
    }
    if (collected.length) {
      setErrors(collected);
      return;
    }
    setErrors([]);
    const salt = keccak256(stringToBytes(`${address}:${w.symbol}:${Date.now()}`));
    try {
      setBusy("simulating");
      await publicClient.simulateContract({
        account: address,
        address: contracts.factory,
        abi: tokenFactoryAbi,
        functionName: "createToken",
        args: [
          {
            name: w.name,
            symbol: w.symbol,
            decimals: w.decimals,
            totalSupply: supply,
            owner: address,
            supplyMode: w.supplyMode,
            moduleFlags: 0,
          },
          salt,
        ],
      });
      setBusy("sending");
      const createHash = await wallet.writeContract({
        address: contracts.factory,
        abi: tokenFactoryAbi,
        functionName: "createToken",
        args: [
          {
            name: w.name,
            symbol: w.symbol,
            decimals: w.decimals,
            totalSupply: supply,
            owner: address,
            supplyMode: w.supplyMode,
            moduleFlags: 0,
          },
          salt,
        ],
      });
      const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
      const launchLog = createReceipt.logs.find((l) => l.address.toLowerCase() === contracts.factory.toLowerCase());
      const tokenAddress = launchLog?.topics[1]
        ? (`0x${launchLog.topics[1].slice(26)}` as `0x${string}`)
        : undefined;
      if (!tokenAddress || tokenAddress === zeroAddress) throw new Error("missing token");
      const perChain = {
        ...w.perChain,
        [ChainKey.BaseSepolia]: { token: tokenAddress, tx: createHash },
      };
      w.set({ createTx: createHash, tokenAddress, perChain });

      setBusy("simulating");
      await publicClient.simulateContract({
        account: address,
        address: tokenAddress,
        abi: yskOftAbi,
        functionName: "approve",
        args: [contracts.manager, tokenLp],
      });
      setBusy("sending");
      const approveHash = await wallet.writeContract({
        address: tokenAddress,
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
        args: [tokenAddress, contracts.v2Router, tokenLp, 0n, 0n, w.lockMode, BigInt(w.lockDuration)],
        value: nativeLp,
      });
      setBusy("sending");
      const lpHash = await wallet.writeContract({
        address: contracts.manager,
        abi: liquidityManagerAbi,
        functionName: "addAndLock",
        args: [tokenAddress, contracts.v2Router, tokenLp, 0n, 0n, w.lockMode, BigInt(w.lockDuration)],
        value: nativeLp,
      });
      const lpReceipt = await publicClient.waitForTransactionReceipt({ hash: lpHash });
      const launched = lpReceipt.logs.find((l) => l.address.toLowerCase() === contracts.manager.toLowerCase());
      const lockId = launched?.data ? BigInt(launched.data.slice(0, 66)).toString() : undefined;
      const deployed = Object.entries(perChain)
        .filter(([, v]) => v.token)
        .map(([key, v]) => ({ chainKey: Number(key), address: v.token as `0x${string}` }));
      const peerCalls = planPeerCalls(deployed);
      for (const call of peerCalls) {
        const chain = CHAINS[call.fromChainKey as keyof typeof CHAINS];
        if (!chain) continue;
        setBusy("sending");
        await switchChainAsync({ chainId: chain.chainId });
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
      {!isConfigured(contracts) ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {t("wizard.execute.needContracts")}
        </p>
      ) : null}
      {errors.length ? (
        <ul className="list-disc pl-5 text-sm text-red-700">
          {errors.map((err) => (
            <li key={err.code}>{err.message ?? err.code}</li>
          ))}
        </ul>
      ) : null}
      <Button type="button" disabled={Boolean(busy) || !isConfigured(contracts)} onClick={() => void run()}>
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
