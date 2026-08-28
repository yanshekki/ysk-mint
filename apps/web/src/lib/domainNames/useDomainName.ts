import { useEffect, useState } from "react";
import type { AddrKind } from "../addrKind.ts";
import { domainNames } from "./DomainNames.ts";

/** ENS / handle only. Hex addresses are not names — never show them twice. */
export function humanDomainName(name: string | undefined, address?: string): string {
  const n = (name ?? "").trim();
  const a = (address ?? "").trim().toLowerCase();
  if (!n) return "";
  const nl = n.toLowerCase();
  if (a && (nl === a || nl.replace(/^0x/, "") === a.replace(/^0x/, ""))) return "";
  if (/^0x[0-9a-f]+$/i.test(n)) return "";
  if (a && a.startsWith("0x") && nl.includes(a.slice(0, 12))) return "";
  return n;
}

export function useDomainName(kind?: AddrKind, address?: string): string {
  const [name, setName] = useState("");
  useEffect(() => {
    if (!kind || !address) {
      setName("");
      return;
    }
    let cancelled = false;
    void domainNames
      .reverse(kind, address)
      .then((hit) => {
        if (!cancelled) setName(hit?.name ?? "");
      })
      .catch(() => {
        if (!cancelled) setName("");
      });
    return () => {
      cancelled = true;
    };
  }, [kind, address]);
  return name;
}
