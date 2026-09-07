import { useEffect, useState } from "react";
import { shortAddr, type AddrKind } from "../addrKind.ts";
import { domainNames } from "./DomainNames.ts";

/** ENS / handle only. Hex addresses are not names — never show them twice. */
export function humanDomainName(name: string | undefined, address?: string): string {
  const n = (name ?? "").trim();
  const a = (address ?? "").trim();
  if (!n) return "";
  const nl = n.toLowerCase();
  const al = a.toLowerCase();
  if (/^0x[0-9a-f]+$/i.test(n)) return "";
  if (al.startsWith("0x") && nl.includes(al.slice(0, 12))) return "";
  if (al && (nl === al || nl.replace(/^0x/, "") === al.replace(/^0x/, ""))) {
    if (n.startsWith("$") || n.includes(".") || n.includes("*")) return n;
    return "";
  }
  return n;
}

/** Domain on top + resolved address under it. A raw address is shown once. */
export function addrCardText(
  kind: AddrKind,
  value: string,
  reverseName?: string,
  savedLabel?: string,
): { title: string; sub?: string } {
  const domain = humanDomainName(savedLabel || reverseName, value);
  const addr = shortAddr(kind, value);
  if (!domain) return { title: addr };
  const same = domain.toLowerCase() === value.toLowerCase() || domain === addr;
  return same ? { title: domain } : { title: domain, sub: addr };
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
