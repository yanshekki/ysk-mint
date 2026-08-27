import { normalizeAddr, type AddrKind } from "../addrKind.ts";
import { domainCache } from "./http.ts";
import { icnsKindForName, RESOLVERS } from "./resolvers.ts";
import type { DomainHit, DomainResolver } from "./types.ts";

function suffixLen(tld: string) {
  return tld.length;
}

export class DomainNames {
  constructor(private resolvers: DomainResolver[] = RESOLVERS) {}

  looksLikeName(raw: string): boolean {
    return Boolean(this.match(raw.trim()));
  }

  match(raw: string): DomainResolver | null {
    const n = raw.trim().toLowerCase();
    if (!n) return null;
    if (n.startsWith("$")) return this.resolvers.find((r) => r.tlds.includes("$")) ?? null;
    if (n.includes("*") && !n.startsWith("0x")) return this.resolvers.find((r) => r.tlds.includes("*")) ?? null;
    let best: { r: DomainResolver; len: number } | null = null;
    for (const r of this.resolvers) {
      for (const tld of r.tlds) {
        if (!tld.startsWith(".")) continue;
        if (n.endsWith(tld) && n.length > tld.length && (!best || suffixLen(tld) > best.len)) best = { r, len: suffixLen(tld) };
      }
    }
    return best?.r ?? null;
  }

  async resolve(raw: string): Promise<DomainHit | null> {
    const name = raw.trim();
    if (!name) return null;
    return domainCache(`fwd:${name.toLowerCase()}`, () => this.resolveUncached(name));
  }

  async reverse(kind: AddrKind, address: string): Promise<DomainHit | null> {
    const addr = address.trim();
    if (!addr) return null;
    return domainCache(`rev:${kind}:${addr.toLowerCase()}`, () => this.reverseUncached(kind, addr));
  }

  private async resolveUncached(name: string): Promise<DomainHit | null> {
    const r = this.match(name);
    if (!r) return null;
    const address = await r.resolve(name).catch(() => null);
    if (!address) return null;
    const kind = r.id === "icns" ? icnsKindForName(name) : r.kind;
    const display = r.id === "ada-handle" ? (name.startsWith("$") ? name : `$${name.replace(/^\$/, "")}`) : name;
    return { name: display, address: normalizeAddr(kind, address), kind, service: r.id };
  }

  private async reverseUncached(kind: AddrKind, address: string): Promise<DomainHit | null> {
    const list = this.resolvers.filter(
      (r) => r.kind === kind || (r.id === "icns" && (kind === "cosmos" || kind === "celestia" || kind === "osmosis")),
    );
    for (const r of list) {
      const name = await r.reverse(address).catch(() => null);
      if (name) return { name, address, kind, service: r.id };
    }
    return null;
  }
}

export const domainNames = new DomainNames();
