import type { AddrKind } from "../addrKind.ts";

export type DomainHit = {
  name: string;
  address: string;
  kind: AddrKind;
  service: string;
};

export type DomainResolver = {
  id: string;
  kind: AddrKind;
  tlds: string[];
  resolve: (name: string) => Promise<string | null>;
  reverse: (address: string) => Promise<string | null>;
};
