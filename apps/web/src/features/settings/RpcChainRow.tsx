import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChainDefinition } from "@ysk-mint/config";
import { parseRpc, pingRpc } from "../../lib/rpc.ts";
import { rpcEndpoints } from "../../lib/rpcCatalog.ts";
import { rpcActiveLabel, rpcLastGood, rpcOrderedEndpoints, subscribeRpcSession } from "../../lib/rpcPool.ts";
import { chainIcon } from "../../lib/chainIcon.ts";
import { useUserSettings } from "../../lib/userSettings.ts";
import { rpcBadgeLabel, rpcHost, rpcProvLabel } from "./rpcLabels.ts";

function useRpcSession() {
  const [, setN] = useState(0);
  useEffect(() => subscribeRpcSession(() => setN((n) => n + 1)), []);
}

export function RpcChainRow({ chain }: { chain: ChainDefinition }) {
  const { t } = useTranslation();
  useRpcSession();
  const saved = useUserSettings((s) => s.rpcByChain?.[String(chain.chainId)] ?? "");
  const pick = useUserSettings((s) => s.rpcPickByChain?.[String(chain.chainId)]);
  const setRpc = useUserSettings((s) => s.setRpc);
  const setRpcPick = useUserSettings((s) => s.setRpcPick);
  const endpoints = useMemo(() => rpcEndpoints(chain.chainId), [chain.chainId]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(saved);
  const [bad, setBad] = useState(false);
  const [ping, setPing] = useState<"" | "ok" | "bad" | "mismatch">("");
  const [probing, setProbing] = useState<string | null>(null);
  useEffect(() => {
    setText(saved);
  }, [saved]);

  const badge = rpcActiveLabel(chain.chainId);
  const good = rpcLastGood(chain.chainId);
  const inheriting = !saved && (!pick || pick === "inherit");
  const selectedId = saved ? "custom" : !inheriting && pick ? pick : "";
  const overridden = !inheriting;
  const inheritUrl = rpcOrderedEndpoints(chain.chainId).find((e) => e.id !== "custom");

  function commitCustom(raw: string) {
    const next = raw.trim();
    if (!next) {
      setBad(false);
      setPing("");
      setRpc(chain.chainId, undefined);
      return;
    }
    const url = parseRpc(next);
    if (!url) {
      setBad(true);
      setPing("");
      return;
    }
    setBad(false);
    setRpcPick(chain.chainId, undefined);
    setRpc(chain.chainId, url);
    void pingRpc(url, chain.chainId).then(setPing);
  }

  function choose(id: string) {
    setPing("");
    setBad(false);
    setRpc(chain.chainId, undefined);
    setText("");
    setRpcPick(chain.chainId, id);
  }

  function inherit() {
    setPing("");
    setBad(false);
    setText("");
    setRpc(chain.chainId, undefined);
    setRpcPick(chain.chainId, undefined);
  }

  async function probe(url: string) {
    setProbing(url);
    const r = await pingRpc(url, chain.chainId);
    setPing(r);
    setProbing(null);
  }

  const pingNote = ping === "ok" ? t("settings.rpcOk") : ping === "mismatch" ? t("settings.rpcMismatch") : ping === "bad" ? t("settings.rpcFail") : "";

  return (
    <div className={`set-rpc-row ${bad ? "is-bad" : ""}`}>
      <button type="button" className="set-rpc-sum" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="holding-ico-wrap">
          <img src={chainIcon(chain)} alt="" className="holding-ico" />
        </span>
        <div className="holding-meta">
          <b>
            {chain.name}
            {overridden ? <span className="me-count">{saved ? t("settings.rpcCustom") : rpcProvLabel(selectedId, t)}</span> : null}
          </b>
          <span>
            {chain.short} · {chain.chainId}
            {good ? ` · ${t("settings.rpcUsing", { name: rpcHost(good) })}` : ""}
          </span>
        </div>
        <span className="me-count">{rpcBadgeLabel(badge, t)}</span>
      </button>
      {open ? (
        <div className="set-rpc-body">
          {pingNote ? (
            <div className="set-rpc-acts">
              <span className="set-note">{pingNote}</span>
            </div>
          ) : null}
          <div className="set-rpc-eps" role="radiogroup" aria-label={`${chain.short} RPC`}>
            <label className="set-rpc-ep">
              <input
                type="radio"
                name={`rpc-${chain.chainId}`}
                checked={inheriting}
                onChange={inherit}
                aria-label={t("settings.rpcInherit")}
              />
              <div className="set-rpc-ep-meta">
                <b>{t("settings.rpcInherit")}</b>
                <span className="set-rpc-ep-host">
                  {inheritUrl ? `${rpcProvLabel(inheritUrl.id, t)} · ${rpcHost(inheritUrl.url)}` : t("settings.rpcStrategy")}
                </span>
              </div>
            </label>
            {endpoints.map((ep) => {
              const on = !inheriting && !saved && selectedId === ep.id;
              return (
                <div key={`${ep.id}:${ep.url}`} className="set-rpc-ep">
                  <input
                    type="radio"
                    name={`rpc-${chain.chainId}`}
                    checked={on}
                    onChange={() => {
                      if (on) return;
                      choose(ep.id);
                    }}
                    aria-label={rpcProvLabel(ep.id, t)}
                  />
                  <div className="set-rpc-ep-meta">
                    <b>{rpcProvLabel(ep.id, t)}</b>
                    <span className="set-rpc-ep-host">{rpcHost(ep.url)}</span>
                  </div>
                  <button
                    type="button"
                    className="me-pool-btn me-pool-btn-explore"
                    disabled={probing === ep.url}
                    onClick={() => void probe(ep.url)}
                  >
                    {t("settings.rpcProbe")}
                  </button>
                </div>
              );
            })}
            <div className="set-rpc-ep is-custom">
              <input
                type="radio"
                name={`rpc-${chain.chainId}`}
                checked={Boolean(saved)}
                onChange={() => {
                  if (text.trim() && text.trim() !== saved.trim()) commitCustom(text);
                }}
                aria-label={t("settings.rpcCustom")}
              />
              <div className="set-rpc-ep-meta">
                <b>{t("settings.rpcCustom")}</b>
                <input
                  className="field-text set-rpc-input"
                  value={text}
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  placeholder={t("settings.rpcPlaceholder")}
                  aria-label={`${chain.short} RPC`}
                  aria-invalid={bad || undefined}
                  onChange={(e) => {
                    setText(e.target.value);
                    setPing("");
                    if (bad) setBad(false);
                  }}
                  onBlur={() => {
                    if (text.trim() === saved.trim()) return;
                    commitCustom(text);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
              </div>
            </div>
          </div>
          {bad ? <p className="set-rpc-err">{t("settings.rpcBad")}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
