import { useEffect, useMemo, useRef } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useTranslation } from "react-i18next";
import { OHLCV_BUCKET_SEC } from "../../lib/poolOhlcv.ts";
import { pickCandleBucket, swapsToCandles, type SwapCandle } from "../../lib/swapCandles.ts";
import type { SwapRow } from "../../lib/usePairSwaps.ts";

function cssVar(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function PairTradeChart({
  ohlcv = [],
  rows = [],
  waiting = false,
}: {
  ohlcv?: SwapCandle[];
  rows?: SwapRow[];
  waiting?: boolean;
}) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const tickCandles = useMemo(() => swapsToCandles(rows), [rows]);
  const candles = ohlcv.length ? ohlcv : waiting ? [] : tickCandles;
  const bucket = ohlcv.length ? OHLCV_BUCKET_SEC : pickCandleBucket(rows);
  const asArea = candles.length > 0 && candles.length < 8;

  useEffect(() => {
    const el = host.current;
    if (!el || !candles.length) return;
    const buy = cssVar("--trade-buy", "#10b981");
    const sell = cssVar("--trade-sell", "#ef4444");
    const text = cssVar("--text-sub", "#64748b");
    const grid = cssVar("--border-color", "#e2e8f0");
    const bg = cssVar("--bg-white", "#ffffff");
    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: bg },
        textColor: text,
        attributionLogo: true,
      },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: grid },
      timeScale: { borderColor: grid, timeVisible: true, secondsVisible: bucket <= 60 },
      crosshair: { mode: CrosshairMode.Normal },
      autoSize: true,
    });
    chartRef.current = chart;
    const candleData = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    const volData = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? buy : sell,
    }));
    if (asArea) {
      const area = chart.addSeries(AreaSeries, {
        lineColor: buy,
        topColor: `${buy}55`,
        bottomColor: `${buy}00`,
        lineWidth: 2,
        priceLineVisible: true,
      });
      area.setData(candleData.map((c) => ({ time: c.time, value: c.close })));
    } else {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: buy,
        downColor: sell,
        borderUpColor: buy,
        borderDownColor: sell,
        wickUpColor: buy,
        wickDownColor: sell,
      });
      series.setData(candleData);
    }
    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    vol.setData(volData);
    chart.timeScale().fitContent();
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [asArea, bucket, candles]);

  if (!candles.length) return null;
  const tf = bucket >= 900 ? t("lp.chartTf15m") : bucket >= 300 ? t("lp.chartTf5m") : t("lp.chartTf1m");
  return (
    <div className="pair-chart-wrap">
      <div className="me-card-head">
        <b>{t("lp.chart")}</b>
        <span className="me-count">{tf}</span>
      </div>
      <div className="pair-chart" ref={host} />
    </div>
  );
}
