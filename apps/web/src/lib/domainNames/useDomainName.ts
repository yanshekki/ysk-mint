import { useEffect, useState } from "react";
import type { AddrKind } from "../addrKind.ts";
import { domainNames } from "./DomainNames.ts";

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
