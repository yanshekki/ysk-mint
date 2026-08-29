import { Link, Navigate, useLocation, useNavigate, type LinkProps, type NavigateProps } from "react-router-dom";
import i18n from "../lib/i18n.ts";
import { canonicalLocale, localeFromPathname, localePath, type LocaleId } from "../lib/locale.ts";

function localize(to: LinkProps["to"], locale: LocaleId): LinkProps["to"] {
  if (typeof to === "string") return localePath(to, locale);
  if (to && typeof to === "object" && "pathname" in to) {
    const path = localePath(`${to.pathname || "/"}${to.search || ""}${to.hash || ""}`, locale);
    const { pathname, search, hash } = (() => {
      const hashAt = path.indexOf("#");
      const hashPart = hashAt >= 0 ? path.slice(hashAt) : "";
      const noHash = hashAt >= 0 ? path.slice(0, hashAt) : path;
      const q = noHash.indexOf("?");
      return {
        pathname: q >= 0 ? noHash.slice(0, q) : noHash,
        search: q >= 0 ? noHash.slice(q) : "",
        hash: hashPart,
      };
    })();
    return { ...to, pathname, search, hash };
  }
  return to;
}

export function LocaleLink({ to, ...rest }: LinkProps) {
  const loc = useLocation();
  const locale = localeFromPathname(loc.pathname);
  return <Link to={localize(to, locale)} {...rest} />;
}

export function LocaleNavigate({ to, ...rest }: NavigateProps) {
  const loc = useLocation();
  const locale = localeFromPathname(loc.pathname);
  return <Navigate to={localize(to, locale)} {...rest} />;
}

export function HomeRedirect() {
  const loc = useLocation();
  const locale = localeFromPathname(loc.pathname);
  return <Navigate to={localePath("/", locale)} replace />;
}

export function ZhHkRedirect() {
  const loc = useLocation();
  const rest = loc.pathname.replace(/^\/zh-HK/i, "") || "/";
  return <Navigate to={`${rest}${loc.search}${loc.hash}`} replace />;
}

export function ZhToCnRedirect() {
  const loc = useLocation();
  const rest = loc.pathname.replace(/^\/zh(?=\/|$)/i, "") || "/";
  return <Navigate to={localePath(`${rest}${loc.search}${loc.hash}`, "zh-CN")} replace />;
}

export function useSwitchLocale() {
  const navigate = useNavigate();
  const loc = useLocation();
  return (next: LocaleId) => {
    const dest = localePath(loc.pathname + loc.search + loc.hash, next);
    void i18n.changeLanguage(next).then(() => {
      if (dest !== loc.pathname + loc.search + loc.hash) navigate(dest, { replace: true });
    });
  };
}

export function useLocale() {
  return canonicalLocale(localeFromPathname(useLocation().pathname));
}
