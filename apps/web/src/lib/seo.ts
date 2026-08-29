import { useEffect, useState } from "react";
import { stripLocalePrefix } from "./locale.ts";

export type SeoPage =
  | "home"
  | "lend"
  | "lendAsset"
  | "create"
  | "pair"
  | "token"
  | "lock"
  | "transfer"
  | "me"
  | "settings"
  | "about"
  | "donate"
  | "terms"
  | "disclaimer"
  | "other";

export type SeoExtra = { title?: string; description?: string };

let extra: SeoExtra = {};
const listeners = new Set<() => void>();

export function setSeoExtra(next: SeoExtra) {
  extra = next;
  listeners.forEach((fn) => fn());
}

export function useSeoExtra(next: SeoExtra) {
  useEffect(() => {
    setSeoExtra(next);
    return () => setSeoExtra({});
  }, [next.title, next.description]);
}

export function useSeoExtraState() {
  const [v, setV] = useState(extra);
  useEffect(() => {
    const fn = () => setV({ ...extra });
    listeners.add(fn);
    fn();
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return v;
}

export function matchSeoPage(pathname: string): { page: SeoPage; noindex: boolean } {
  const p = stripLocalePrefix(pathname);
  if (p === "/") return { page: "home", noindex: false };
  if (p === "/lend") return { page: "lend", noindex: false };
  if (p.startsWith("/lend/")) return { page: "lendAsset", noindex: false };
  if (p === "/create") return { page: "create", noindex: false };
  if (p.startsWith("/pair/")) return { page: "pair", noindex: false };
  if (p.startsWith("/token/")) return { page: "token", noindex: false };
  if (p.startsWith("/locks/")) return { page: "lock", noindex: false };
  if (p === "/transfer") return { page: "transfer", noindex: false };
  if (p === "/settings") return { page: "settings", noindex: true };
  if (p === "/me" || p.startsWith("/me/")) return { page: "me", noindex: true };
  if (p === "/about") return { page: "about", noindex: false };
  if (p === "/donate") return { page: "donate", noindex: false };
  if (p === "/terms") return { page: "terms", noindex: false };
  if (p === "/disclaimer") return { page: "disclaimer", noindex: false };
  return { page: "other", noindex: false };
}

export function orgJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://ysk.hk/#organization",
        name: "YSK Limited",
        url: "https://ysk.hk",
        email: "email@ysk.hk",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Hong Kong",
          addressCountry: "HK",
        },
      },
      {
        "@type": "WebSite",
        "@id": "https://mint.ysk.hk/#website",
        name: "YSK Mint",
        url: "https://mint.ysk.hk",
        publisher: { "@id": "https://ysk.hk/#organization" },
      },
    ],
  };
}

export function faqJsonLd(url: string, items: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url,
    mainEntity: items
      .filter((x) => x.q && x.a)
      .map((x) => ({
        "@type": "Question",
        name: x.q,
        acceptedAnswer: { "@type": "Answer", text: x.a },
      })),
  };
}

export function webPageJsonLd(url: string, name: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url,
    name,
    description,
    isPartOf: { "@id": "https://mint.ysk.hk/#website" },
    publisher: { "@id": "https://ysk.hk/#organization" },
  };
}
