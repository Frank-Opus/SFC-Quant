import { useEffect, useMemo, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import { useLocale } from "../../lib/i18n";
import type { Candle } from "../../lib/market";

export type PriceMarker = {
  time: string;
  position: "aboveBar" | "belowBar" | "inBar";
  shape: "arrowUp" | "arrowDown" | "circle" | "square";
  color: string;
  text: string;
};

type PriceChartProps = {
  candles: Candle[];
  markers: PriceMarker[];
  symbol: string;
  timeframe: string;
};

function toChartTime(value: string): UTCTimestamp {
  return Math.floor(new Date(value).getTime() / 1000) as UTCTimestamp;
}

export function PriceChart({ candles, markers, symbol, timeframe }: PriceChartProps) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markerApiRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  const candleData = useMemo(
    () =>
      candles.map((candle) => ({
        time: toChartTime(candle.timestamp),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    [candles],
  );

  const volumeData = useMemo(
    () =>
      candles.map((candle) => ({
        time: toChartTime(candle.timestamp),
        value: candle.volume,
        color:
          candle.close >= candle.open
            ? "rgba(126, 255, 198, 0.38)"
            : "rgba(255, 133, 120, 0.38)",
      })),
    [candles],
  );

  const markerData = useMemo<SeriesMarker<Time>[]>(
    () =>
      markers.map((marker) => ({
        time: toChartTime(marker.time),
        position: marker.position,
        shape: marker.shape,
        color: marker.color,
        text: marker.text,
      })),
    [markers],
  );

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(214, 225, 255, 0.72)",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)", style: LineStyle.Dotted },
        horzLines: { color: "rgba(255,255,255,0.04)", style: LineStyle.Dotted },
      },
      crosshair: {
        vertLine: { color: "rgba(110,231,255,0.35)", width: 1 },
        horzLine: { color: "rgba(110,231,255,0.25)", width: 1 },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#82ffbe",
      downColor: "#ff8578",
      wickUpColor: "#82ffbe",
      wickDownColor: "#ff8578",
      borderVisible: false,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: "rgba(110,231,255,0.7)",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });

    chart.priceScale("").applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    markerApiRef.current = createSeriesMarkers(candleSeries, []);

    const observer = new ResizeObserver(() => {
      chart.timeScale().fitContent();
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      markerApiRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    candleSeriesRef.current?.setData(candleData);
    volumeSeriesRef.current?.setData(volumeData);
    markerApiRef.current?.setMarkers(markerData);
    chartRef.current?.timeScale().fitContent();
  }, [candleData, markerData, volumeData]);

  return (
    <div className="chart-shell">
      <div className="chart-headerline">
        <div>
          <p className="section-label">{t("chart.price.kicker")}</p>
          <h3>
            {symbol} <span>{timeframe}</span>
          </h3>
        </div>
        <p className="chart-caption">{t("chart.price.caption")}</p>
      </div>
      <div className="chart-canvas" ref={containerRef} />
    </div>
  );
}
