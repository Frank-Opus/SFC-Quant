import { useEffect, useMemo, useRef } from "react";
import {
  AreaSeries,
  ColorType,
  LineStyle,
  createChart,
  type IChartApi,
  type LogicalRange,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

import { useLocale } from "../../lib/i18n";
import type { Candle } from "../../lib/market";

type PnlChartProps = {
  candles: Candle[];
  quantity: number;
  averageEntryPrice: number;
  realizedPnl: number;
  offsetPnl: number;
  visibleRange?: LogicalRange | null;
  onVisibleRangeChange?: (range: LogicalRange | null) => void;
};

function toChartTime(value: string): UTCTimestamp {
  return Math.floor(new Date(value).getTime() / 1000) as UTCTimestamp;
}

function sameLogicalRange(left: LogicalRange | null, right: LogicalRange | null): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return Math.abs(left.from - right.from) < 0.001 && Math.abs(left.to - right.to) < 0.001;
}

export function PnlChart({
  candles,
  quantity,
  averageEntryPrice,
  realizedPnl,
  offsetPnl,
  visibleRange = null,
  onVisibleRangeChange,
}: PnlChartProps) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const visibleRangeRef = useRef<LogicalRange | null>(null);

  const seriesData = useMemo(
    () =>
      candles.map((candle) => ({
        time: toChartTime(candle.timestamp),
        value:
          realizedPnl +
          offsetPnl +
          (quantity > 0 ? quantity * (candle.close - averageEntryPrice) : 0),
      })),
    [averageEntryPrice, candles, offsetPnl, quantity, realizedPnl],
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
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: {
          time: true,
          price: false,
        },
        axisDoubleClickReset: {
          time: true,
          price: true,
        },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        rightOffset: 6,
        barSpacing: 10,
        minBarSpacing: 0.35,
        maxBarSpacing: 42,
        rightBarStaysOnScroll: true,
        lockVisibleTimeRangeOnResize: true,
      },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#7ae8ff",
      topColor: "rgba(122, 232, 255, 0.3)",
      bottomColor: "rgba(122, 232, 255, 0.01)",
      lineWidth: 2,
      crosshairMarkerVisible: true,
      lastValueVisible: true,
      priceLineVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleVisibleLogicalRangeChange = (range: LogicalRange | null) => {
      visibleRangeRef.current = range;
      onVisibleRangeChange?.(range);
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);
      seriesRef.current = null;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [onVisibleRangeChange]);

  useEffect(() => {
    seriesRef.current?.setData(seriesData);
  }, [seriesData]);

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }

    if (visibleRange === null) {
      if (seriesData.length > 0) {
        chartRef.current.timeScale().fitContent();
      }
      return;
    }

    if (sameLogicalRange(visibleRangeRef.current, visibleRange)) {
      return;
    }

    visibleRangeRef.current = visibleRange;
    chartRef.current.timeScale().setVisibleLogicalRange(visibleRange);
  }, [seriesData.length, visibleRange]);

  return (
    <div className="chart-shell pnl-shell">
      <div className="chart-headerline">
        <div>
          <p className="section-label">{t("chart.pnl.kicker")}</p>
          <h3>{t("chart.pnl.title")}</h3>
        </div>
        <p className="chart-caption">{t("chart.pnl.caption")}</p>
      </div>
      <div className="chart-canvas chart-canvas-small" ref={containerRef} />
    </div>
  );
}
