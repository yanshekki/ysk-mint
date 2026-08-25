import { Link } from "react-router-dom";
import { MiniSpark } from "./MiniSpark.tsx";

export type CardToken = {
  ticker: string;
  name: string;
  age: string;
  href: string;
  vol?: string;
  mc?: string;
};

export function TokenCard({ token }: { token: CardToken }) {
  return (
    <article className="tcard">
      <div className="tcard-av">{token.ticker.slice(0, 2)}</div>
      <div className="tcard-mid">
        <div className="tcard-title">
          {token.ticker}
          <span>{token.name}</span>
        </div>
        <div className="tcard-meta">
          <span>{token.age}</span>
          <span>TX —</span>
        </div>
        <div className="tcard-stats">
          <span>0%</span>
          <span>DS —</span>
          <span>0%</span>
        </div>
      </div>
      <div className="tcard-right">
        <div className="mc">
          V <b>{token.vol ?? "—"}</b> MC <b>{token.mc ?? "—"}</b>
        </div>
        <MiniSpark />
        <div className="buys">
          <Link className="buy" to={token.href}>
            買入
          </Link>
          <Link className="buy" to="/transfer">
            買入
          </Link>
        </div>
      </div>
    </article>
  );
}
