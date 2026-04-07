import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPrimitivePaneRenderer,
  type IPrimitivePaneView,
  type IPriceLine,
  type ISeriesPrimitive,
  type Logical,
  type LogicalRange,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesAttachedParameter,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";

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
  visibleRange?: LogicalRange | null;
  onVisibleRangeChange?: (range: LogicalRange | null) => void;
};

type RangePresetId = "6h" | "24h" | "7d" | "all" | "live";
type SessionKey = "asia" | "london" | "newyork";

type SessionSegment = {
  startIndex: number;
  endIndex: number;
  label: string;
  fill: string;
  stroke: string;
};

type SwingPoint = {
  index: number;
  time: UTCTimestamp;
  price: number;
  kind: "high" | "low";
};

type TrendSegment = {
  startIndex: number;
  endIndex: number;
  startPrice: number;
  endPrice: number;
  label: string;
  color: string;
};

type ZoneBand = {
  fromPrice: number;
  toPrice: number;
  label: string;
  fill: string;
  stroke: string;
};

type StructureOverlayModel = {
  trends: TrendSegment[];
  zones: ZoneBand[];
};

type ChartLayerKey = "ema" | "vwap" | "sessions" | "structure" | "range";

type ChartLayerState = Record<ChartLayerKey, boolean>;

const SESSION_META: Record<SessionKey, { label: string; fill: string; stroke: string }> = {
  asia: {
    label: "ASIA",
    fill: "rgba(120, 180, 255, 0.05)",
    stroke: "rgba(120, 180, 255, 0.18)",
  },
  london: {
    label: "LONDON",
    fill: "rgba(255, 196, 107, 0.055)",
    stroke: "rgba(255, 196, 107, 0.18)",
  },
  newyork: {
    label: "NEW YORK",
    fill: "rgba(130, 255, 190, 0.05)",
    stroke: "rgba(130, 255, 190, 0.18)",
  },
};

class SessionBandRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly getChart: () => IChartApi | null,
    private readonly getSegments: () => SessionSegment[],
  ) {}

  draw(): void {}

  drawBackground(target: CanvasRenderingTarget2D): void {
    const chart = this.getChart();
    if (!chart) {
      return;
    }

    const timeScale = chart.timeScale();
    const segments = this.getSegments();

    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save();
      context.textBaseline = "top";
      context.font = "600 10px IBM Plex Sans, sans-serif";

      for (const segment of segments) {
        const start = timeScale.logicalToCoordinate(segment.startIndex as Logical);
        const end = timeScale.logicalToCoordinate(segment.endIndex as Logical);

        if (start === null && end === null) {
          continue;
        }

        const x1 = Math.max(0, Math.min(start ?? 0, end ?? mediaSize.width));
        const x2 = Math.min(mediaSize.width, Math.max(start ?? 0, end ?? mediaSize.width));
        const width = x2 - x1;

        if (width <= 1) {
          continue;
        }

        context.fillStyle = segment.fill;
        context.fillRect(x1, 0, width, mediaSize.height);

        context.strokeStyle = segment.stroke;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x1 + 0.5, 0);
        context.lineTo(x1 + 0.5, mediaSize.height);
        context.stroke();

        if (width > 64) {
          context.fillStyle = segment.stroke;
          context.fillText(segment.label, x1 + 8, 8);
        }
      }

      context.restore();
    });
  }
}

class SessionBandPaneView implements IPrimitivePaneView {
  private readonly paneRenderer: SessionBandRenderer;

  constructor(getChart: () => IChartApi | null, getSegments: () => SessionSegment[]) {
    this.paneRenderer = new SessionBandRenderer(getChart, getSegments);
  }

  zOrder(): "bottom" {
    return "bottom";
  }

  renderer(): IPrimitivePaneRenderer {
    return this.paneRenderer;
  }
}

class SessionBandsPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private segments: SessionSegment[] = [];
  private requestUpdate: (() => void) | null = null;
  private readonly paneView = new SessionBandPaneView(
    () => this.chart,
    () => this.segments,
  );

  attached({ chart, requestUpdate }: SeriesAttachedParameter<Time>): void {
    this.chart = chart as IChartApi;
    this.requestUpdate = requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.requestUpdate = null;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }

  setSegments(segments: SessionSegment[]): void {
    this.segments = segments;
    this.requestUpdate?.();
  }
}

class StructureOverlayRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly getChart: () => IChartApi | null,
    private readonly getSeries: () => ISeriesApi<"Candlestick"> | null,
    private readonly getModel: () => StructureOverlayModel,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this.getChart();
    const series = this.getSeries();
    if (!chart || !series) {
      return;
    }

    const timeScale = chart.timeScale();
    const model = this.getModel();

    target.useMediaCoordinateSpace(({ context }) => {
      context.save();
      context.lineWidth = 1.5;
      context.textBaseline = "bottom";
      context.font = "600 10px IBM Plex Sans, sans-serif";

      for (const trend of model.trends) {
        const x1 = timeScale.logicalToCoordinate(trend.startIndex as Logical);
        const x2 = timeScale.logicalToCoordinate(trend.endIndex as Logical);
        const y1 = series.priceToCoordinate(trend.startPrice);
        const y2 = series.priceToCoordinate(trend.endPrice);

        if (x1 === null || x2 === null || y1 === null || y2 === null) {
          continue;
        }

        context.strokeStyle = trend.color;
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.stroke();

        context.fillStyle = trend.color;
        context.fillText(trend.label, x2 + 8, y2 - 6);
      }

      context.restore();
    });
  }

  drawBackground(target: CanvasRenderingTarget2D): void {
    const series = this.getSeries();
    if (!series) {
      return;
    }

    const model = this.getModel();

    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save();
      context.textBaseline = "top";
      context.font = "600 10px IBM Plex Sans, sans-serif";

      for (const zone of model.zones) {
        const top = series.priceToCoordinate(zone.toPrice);
        const bottom = series.priceToCoordinate(zone.fromPrice);

        if (top === null || bottom === null) {
          continue;
        }

        const y1 = Math.max(0, Math.min(top, bottom));
        const y2 = Math.min(mediaSize.height, Math.max(top, bottom));
        const height = y2 - y1;

        if (height <= 1) {
          continue;
        }

        context.fillStyle = zone.fill;
        context.fillRect(0, y1, mediaSize.width, height);

        context.strokeStyle = zone.stroke;
        context.lineWidth = 1;
        context.strokeRect(0.5, y1 + 0.5, mediaSize.width - 1, Math.max(height - 1, 0));

        context.fillStyle = zone.stroke;
        context.fillText(zone.label, 8, y1 + 8);
      }

      context.restore();
    });
  }
}

class StructureOverlayPaneView implements IPrimitivePaneView {
  private readonly paneRenderer: StructureOverlayRenderer;

  constructor(
    getChart: () => IChartApi | null,
    getSeries: () => ISeriesApi<"Candlestick"> | null,
    getModel: () => StructureOverlayModel,
  ) {
    this.paneRenderer = new StructureOverlayRenderer(getChart, getSeries, getModel);
  }

  zOrder(): "normal" {
    return "normal";
  }

  renderer(): IPrimitivePaneRenderer {
    return this.paneRenderer;
  }
}

class StructureOverlayPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<"Candlestick"> | null = null;
  private model: StructureOverlayModel = { trends: [], zones: [] };
  private requestUpdate: (() => void) | null = null;
  private readonly paneView = new StructureOverlayPaneView(
    () => this.chart,
    () => this.series,
    () => this.model,
  );

  attached({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>): void {
    this.chart = chart as IChartApi;
    this.series = series as ISeriesApi<"Candlestick">;
    this.requestUpdate = requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }

  setModel(model: StructureOverlayModel): void {
    this.model = model;
    this.requestUpdate?.();
  }
}

function toChartTime(value: string): UTCTimestamp {
  return Math.floor(new Date(value).getTime() / 1000) as UTCTimestamp;
}

function timeframeToMinutes(value: string): number {
  const match = value.trim().match(/^(\d+)([mhdw])$/i);
  if (!match) {
    return 1;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "m":
      return amount;
    case "h":
      return amount * 60;
    case "d":
      return amount * 60 * 24;
    case "w":
      return amount * 60 * 24 * 7;
    default:
      return amount;
  }
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

function resolveSessionKey(timestamp: string): SessionKey | null {
  const hour = new Date(timestamp).getUTCHours();
  if (hour >= 0 && hour < 8) {
    return "asia";
  }
  if (hour >= 8 && hour < 13) {
    return "london";
  }
  if (hour >= 13 && hour < 21) {
    return "newyork";
  }
  return null;
}

function buildSessionSegments(candles: Candle[]): SessionSegment[] {
  const segments: SessionSegment[] = [];
  let active: { key: SessionKey; startIndex: number } | null = null;

  for (let index = 0; index < candles.length; index += 1) {
    const key = resolveSessionKey(candles[index].timestamp);
    if (!key) {
      if (active) {
        const meta = SESSION_META[active.key];
        segments.push({
          startIndex: active.startIndex,
          endIndex: index,
          label: meta.label,
          fill: meta.fill,
          stroke: meta.stroke,
        });
        active = null;
      }
      continue;
    }

    if (!active) {
      active = { key, startIndex: index };
      continue;
    }

    if (active.key !== key) {
      const meta = SESSION_META[active.key];
      segments.push({
        startIndex: active.startIndex,
        endIndex: index,
        label: meta.label,
        fill: meta.fill,
        stroke: meta.stroke,
      });
      active = { key, startIndex: index };
    }
  }

  if (active) {
    const meta = SESSION_META[active.key];
    segments.push({
      startIndex: active.startIndex,
      endIndex: candles.length,
      label: meta.label,
      fill: meta.fill,
      stroke: meta.stroke,
    });
  }

  return segments;
}

function buildEmaSeries(candles: Candle[], period: number) {
  if (candles.length === 0) {
    return [];
  }

  const multiplier = 2 / (period + 1);
  let ema = candles[0].close;

  return candles.map((candle, index) => {
    ema = index === 0 ? candle.close : candle.close * multiplier + ema * (1 - multiplier);
    return {
      time: toChartTime(candle.timestamp),
      value: ema,
    };
  });
}

function buildVwapSeries(candles: Candle[]) {
  let cumulativeTypicalPriceVolume = 0;
  let cumulativeVolume = 0;

  return candles.map((candle) => {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativeTypicalPriceVolume += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;

    return {
      time: toChartTime(candle.timestamp),
      value: cumulativeVolume > 0 ? cumulativeTypicalPriceVolume / cumulativeVolume : candle.close,
    };
  });
}

function buildSwingPoints(candles: Candle[]): SwingPoint[] {
  if (candles.length < 5) {
    return [];
  }

  const points: SwingPoint[] = [];

  for (let index = 2; index < candles.length - 2; index += 1) {
    const current = candles[index];
    const leftOne = candles[index - 1];
    const leftTwo = candles[index - 2];
    const rightOne = candles[index + 1];
    const rightTwo = candles[index + 2];

    const isSwingHigh =
      current.high > leftOne.high &&
      current.high > leftTwo.high &&
      current.high > rightOne.high &&
      current.high > rightTwo.high;

    const isSwingLow =
      current.low < leftOne.low &&
      current.low < leftTwo.low &&
      current.low < rightOne.low &&
      current.low < rightTwo.low;

    if (isSwingHigh) {
      points.push({
        index,
        time: toChartTime(current.timestamp),
        price: current.high,
        kind: "high",
      });
    }

    if (isSwingLow) {
      points.push({
        index,
        time: toChartTime(current.timestamp),
        price: current.low,
        kind: "low",
      });
    }
  }

  return points;
}

function buildSwingMarkers(points: SwingPoint[]): SeriesMarker<Time>[] {
  return points
    .map((point) => ({
      time: point.time,
      position: point.kind === "high" ? ("aboveBar" as const) : ("belowBar" as const),
      shape: "circle" as const,
      color:
        point.kind === "high" ? "rgba(255, 196, 107, 0.95)" : "rgba(120, 179, 255, 0.95)",
      text: point.kind === "high" ? "SH" : "SL",
    }))
    .slice(-24);
}

function buildStructureOverlay(candles: Candle[], swings: SwingPoint[]): StructureOverlayModel {
  if (candles.length === 0) {
    return { trends: [], zones: [] };
  }

  const highs = swings.filter((point) => point.kind === "high");
  const lows = swings.filter((point) => point.kind === "low");
  const recentWindow = candles.slice(-Math.min(candles.length, 48));
  const averageRange =
    recentWindow.reduce((sum, candle) => sum + (candle.high - candle.low), 0) /
    Math.max(recentWindow.length, 1);
  const zonePadding = Math.max(averageRange * 0.35, (candles.at(-1)?.close ?? 0) * 0.0025);

  const trends: TrendSegment[] = [];
  const zones: ZoneBand[] = [];

  const recentHighs = highs.slice(-2);
  if (recentHighs.length === 2) {
    trends.push({
      startIndex: recentHighs[0].index,
      endIndex: recentHighs[1].index,
      startPrice: recentHighs[0].price,
      endPrice: recentHighs[1].price,
      label: "RESIST TREND",
      color: "rgba(255, 196, 107, 0.9)",
    });

    const resistanceCenter =
      recentHighs.reduce((sum, point) => sum + point.price, 0) / recentHighs.length;
    zones.push({
      fromPrice: resistanceCenter - zonePadding,
      toPrice: resistanceCenter + zonePadding,
      label: "RESISTANCE",
      fill: "rgba(255, 196, 107, 0.06)",
      stroke: "rgba(255, 196, 107, 0.18)",
    });
  }

  const recentLows = lows.slice(-2);
  if (recentLows.length === 2) {
    trends.push({
      startIndex: recentLows[0].index,
      endIndex: recentLows[1].index,
      startPrice: recentLows[0].price,
      endPrice: recentLows[1].price,
      label: "SUPPORT TREND",
      color: "rgba(120, 179, 255, 0.92)",
    });

    const supportCenter =
      recentLows.reduce((sum, point) => sum + point.price, 0) / recentLows.length;
    zones.push({
      fromPrice: supportCenter - zonePadding,
      toPrice: supportCenter + zonePadding,
      label: "SUPPORT",
      fill: "rgba(120, 179, 255, 0.055)",
      stroke: "rgba(120, 179, 255, 0.18)",
    });
  }

  return { trends, zones };
}

export function PriceChart({
  candles,
  markers,
  symbol,
  timeframe,
  visibleRange = null,
  onVisibleRangeChange,
}: PriceChartProps) {
  const { t, formatCompactNumber, formatDateTime, formatNumber } = useLocale();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const emaFastSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaSlowSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const markerApiRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const structureLinesRef = useRef<IPriceLine[]>([]);
  const sessionBandsPrimitiveRef = useRef<SessionBandsPrimitive | null>(null);
  const structureOverlayPrimitiveRef = useRef<StructureOverlayPrimitive | null>(null);
  const chartKeyRef = useRef<string>("");
  const candleLookupRef = useRef<Map<UTCTimestamp, Candle>>(new Map());
  const visibleRangeRef = useRef<LogicalRange | null>(null);
  const [activePreset, setActivePreset] = useState<RangePresetId>("live");
  const [hoveredTime, setHoveredTime] = useState<UTCTimestamp | null>(null);
  const [localVisibleRange, setLocalVisibleRange] = useState<LogicalRange | null>(null);
  const [layerState, setLayerState] = useState<ChartLayerState>({
    ema: true,
    vwap: true,
    sessions: true,
    structure: true,
    range: true,
  });

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

  const externalMarkerData = useMemo<SeriesMarker<Time>[]>(
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

  const emaFastData = useMemo(() => buildEmaSeries(candles, 9), [candles]);
  const emaSlowData = useMemo(() => buildEmaSeries(candles, 21), [candles]);
  const vwapData = useMemo(() => buildVwapSeries(candles), [candles]);
  const swingPoints = useMemo(() => buildSwingPoints(candles), [candles]);
  const swingMarkerData = useMemo(() => buildSwingMarkers(swingPoints), [swingPoints]);
  const structureOverlay = useMemo(
    () => buildStructureOverlay(candles, swingPoints),
    [candles, swingPoints],
  );
  const markerData = useMemo(
    () => [...externalMarkerData, ...(layerState.structure ? swingMarkerData : [])],
    [externalMarkerData, layerState.structure, swingMarkerData],
  );
  const sessionSegments = useMemo(() => buildSessionSegments(candles), [candles]);

  const candleLookup = useMemo(
    () => new Map(candles.map((candle) => [toChartTime(candle.timestamp), candle])),
    [candles],
  );

  const candleIndexLookup = useMemo(
    () => new Map(candles.map((candle, index) => [toChartTime(candle.timestamp), index])),
    [candles],
  );

  const rangePresets = useMemo(() => {
    const timeframeMinutes = timeframeToMinutes(timeframe);
    const resolveBars = (minutes: number) =>
      Math.max(Math.min(Math.ceil(minutes / timeframeMinutes), candles.length), 12);

    return [
      { id: "6h" as const, label: "6H", bars: resolveBars(6 * 60) },
      { id: "24h" as const, label: "24H", bars: resolveBars(24 * 60) },
      { id: "7d" as const, label: "7D", bars: resolveBars(7 * 24 * 60) },
    ];
  }, [candles.length, timeframe]);

  const applyRangePreset = useCallback(
    (presetId: RangePresetId) => {
      if (!chartRef.current || candleData.length === 0) {
        return;
      }

      const timeScale = chartRef.current.timeScale();
      setActivePreset(presetId);

      if (presetId === "all") {
        timeScale.fitContent();
        return;
      }

      const bars =
        presetId === "live"
          ? Math.min(
              rangePresets.find((preset) => preset.id === "24h")?.bars ?? candleData.length,
              candleData.length,
            )
          : Math.min(
              rangePresets.find((preset) => preset.id === presetId)?.bars ?? candleData.length,
              candleData.length,
            );

      const from = Math.max(-1, candleData.length - bars - 1);
      const to = candleData.length + 2;

      timeScale.setVisibleLogicalRange({ from, to });

      if (presetId === "live") {
        timeScale.scrollToRealTime();
      }
    },
    [candleData.length, rangePresets],
  );

  const activeCandle = useMemo(() => {
    if (candleData.length === 0) {
      return null;
    }

    const fallback = candles.at(-1) ?? null;
    if (!hoveredTime) {
      return fallback;
    }

    return candleLookup.get(hoveredTime) ?? fallback;
  }, [candleData.length, candleLookup, candles, hoveredTime]);

  const activeCandleIndex = useMemo(() => {
    if (!activeCandle) {
      return -1;
    }

    return candleIndexLookup.get(toChartTime(activeCandle.timestamp)) ?? -1;
  }, [activeCandle, candleIndexLookup]);

  const previousClose =
    activeCandleIndex > 0 ? candles[activeCandleIndex - 1]?.close ?? null : activeCandle?.open ?? null;
  const changeAmount = activeCandle && previousClose !== null ? activeCandle.close - previousClose : null;
  const changePercent =
    activeCandle && previousClose && previousClose !== 0
      ? (changeAmount ?? 0) / previousClose
      : null;
  const activeVwap =
    activeCandleIndex >= 0 ? vwapData[activeCandleIndex]?.value ?? null : null;
  const vwapDelta =
    activeCandle && activeVwap !== null ? activeCandle.close - activeVwap : null;

  const visibleWindowStats = useMemo(() => {
    if (candles.length === 0) {
      return null;
    }

    const from = Math.max(0, Math.floor(localVisibleRange?.from ?? 0));
    const to = Math.min(candles.length - 1, Math.ceil(localVisibleRange?.to ?? candles.length - 1));
    const windowCandles = candles.slice(from, to + 1);

    if (windowCandles.length === 0) {
      return null;
    }

    const high = Math.max(...windowCandles.map((candle) => candle.high));
    const low = Math.min(...windowCandles.map((candle) => candle.low));
    const range = high - low;
    const rangePct = low !== 0 ? range / low : 0;

    return {
      bars: windowCandles.length,
      high,
      low,
      range,
      rangePct,
    };
  }, [candles, localVisibleRange]);

  const toggleLayer = useCallback((layer: ChartLayerKey) => {
    setLayerState((current) => ({
      ...current,
      [layer]: !current[layer],
    }));
  }, []);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(214, 225, 255, 0.72)",
        fontFamily: "\"IBM Plex Sans\", \"Sora\", sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)", style: LineStyle.Dotted },
        horzLines: { color: "rgba(255,255,255,0.04)", style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(110,231,255,0.35)", width: 1, style: LineStyle.Solid },
        horzLine: { color: "rgba(110,231,255,0.25)", width: 1, style: LineStyle.Dashed },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        axisDoubleClickReset: {
          time: true,
          price: true,
        },
      },
      kineticScroll: {
        mouse: true,
        touch: true,
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        textColor: "rgba(214, 225, 255, 0.78)",
        scaleMargins: {
          top: 0.14,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 10,
        minBarSpacing: 0.35,
        maxBarSpacing: 42,
        rightBarStaysOnScroll: true,
        lockVisibleTimeRangeOnResize: true,
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
    const emaFastSeries = chart.addSeries(LineSeries, {
      color: "rgba(255, 196, 107, 0.92)",
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    const emaSlowSeries = chart.addSeries(LineSeries, {
      color: "rgba(120, 179, 255, 0.92)",
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    const vwapSeries = chart.addSeries(LineSeries, {
      color: "rgba(255, 255, 255, 0.68)",
      lineWidth: 2,
      lineStyle: LineStyle.Dotted,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
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
    emaFastSeriesRef.current = emaFastSeries;
    emaSlowSeriesRef.current = emaSlowSeries;
    vwapSeriesRef.current = vwapSeries;
    markerApiRef.current = createSeriesMarkers(candleSeries, []);
    sessionBandsPrimitiveRef.current = new SessionBandsPrimitive();
    structureOverlayPrimitiveRef.current = new StructureOverlayPrimitive();
    candleSeries.attachPrimitive(sessionBandsPrimitiveRef.current);
    candleSeries.attachPrimitive(structureOverlayPrimitiveRef.current);
    const handleCrosshairMove = (param: { time?: Time }) => {
      if (!param.time || typeof param.time !== "number") {
        setHoveredTime(null);
        return;
      }

      if (!candleLookupRef.current.has(param.time as UTCTimestamp)) {
        setHoveredTime(null);
        return;
      }

      setHoveredTime(param.time as UTCTimestamp);
    };

    const handleVisibleLogicalRangeChange = (range: LogicalRange | null) => {
      visibleRangeRef.current = range;
      setLocalVisibleRange(range);
      onVisibleRangeChange?.(range);
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);
      if (sessionBandsPrimitiveRef.current) {
        candleSeries.detachPrimitive(sessionBandsPrimitiveRef.current);
      }
      if (structureOverlayPrimitiveRef.current) {
        candleSeries.detachPrimitive(structureOverlayPrimitiveRef.current);
      }
      markerApiRef.current = null;
      structureLinesRef.current = [];
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      emaFastSeriesRef.current = null;
      emaSlowSeriesRef.current = null;
      vwapSeriesRef.current = null;
      sessionBandsPrimitiveRef.current = null;
      structureOverlayPrimitiveRef.current = null;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [onVisibleRangeChange]);

  useEffect(() => {
    candleSeriesRef.current?.setData(candleData);
    volumeSeriesRef.current?.setData(volumeData);
    emaFastSeriesRef.current?.setData(layerState.ema ? emaFastData : []);
    emaSlowSeriesRef.current?.setData(layerState.ema ? emaSlowData : []);
    vwapSeriesRef.current?.setData(layerState.vwap ? vwapData : []);
    markerApiRef.current?.setMarkers(markerData);
    sessionBandsPrimitiveRef.current?.setSegments(layerState.sessions ? sessionSegments : []);
    structureOverlayPrimitiveRef.current?.setModel(
      layerState.structure ? structureOverlay : { trends: [], zones: [] },
    );
    candleLookupRef.current = candleLookup;

    const nextKey = `${symbol}:${timeframe}`;
    const instrumentChanged = chartKeyRef.current !== nextKey;

    if (instrumentChanged) {
      chartKeyRef.current = nextKey;
      setHoveredTime(null);
      applyRangePreset("live");
      return;
    }

    if (activePreset === "live") {
      applyRangePreset("live");
    }
  }, [
    activePreset,
    applyRangePreset,
    candleData,
    candleLookup,
    emaFastData,
    emaSlowData,
    layerState.ema,
    layerState.sessions,
    layerState.structure,
    layerState.vwap,
    markerData,
    sessionSegments,
    structureOverlay,
    symbol,
    timeframe,
    vwapData,
    volumeData,
  ]);

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }

    if (visibleRange === null) {
      return;
    }

    if (sameLogicalRange(visibleRangeRef.current, visibleRange)) {
      return;
    }

    visibleRangeRef.current = visibleRange;
    setLocalVisibleRange(visibleRange);
    chartRef.current.timeScale().setVisibleLogicalRange(visibleRange);
  }, [visibleRange]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) {
      return;
    }

    for (const line of structureLinesRef.current) {
      candleSeries.removePriceLine(line);
    }
    structureLinesRef.current = [];

    if (!visibleWindowStats || !layerState.range) {
      return;
    }

    structureLinesRef.current = [
      candleSeries.createPriceLine({
        price: visibleWindowStats.high,
        color: "rgba(130, 255, 190, 0.76)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "RANGE HIGH",
      }),
      candleSeries.createPriceLine({
        price: visibleWindowStats.low,
        color: "rgba(255, 133, 120, 0.78)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "RANGE LOW",
      }),
    ];

    return () => {
      for (const line of structureLinesRef.current) {
        candleSeries.removePriceLine(line);
      }
      structureLinesRef.current = [];
    };
  }, [layerState.range, visibleWindowStats]);

  const interactionButtons = [
    ...rangePresets.map((preset) => ({
      id: preset.id,
      label: preset.label,
    })),
    { id: "live" as const, label: t("chart.price.live") },
  ];

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
      <div className="chart-toolbar">
        <div className="chart-toolbar-group">
          {interactionButtons.map((button) => (
            <button
              className="chart-chip"
              data-active={button.id === activePreset}
              key={button.id}
              onClick={() => applyRangePreset(button.id)}
              type="button"
            >
              {button.label}
            </button>
          ))}
        </div>
        <div className="chart-toolbar-group">
          <button
            className="chart-chip chart-chip-secondary"
            onClick={() => applyRangePreset("all")}
            type="button"
          >
            {t("chart.price.reset")}
          </button>
        </div>
      </div>
      <div className="chart-control-panel">
        <span className="chart-control-title">{t("chart.price.layers")}</span>
        <div className="chart-toolbar-group">
          <button className="chart-chip" data-active={layerState.ema} onClick={() => toggleLayer("ema")} type="button">
            {t("chart.price.layer.ema")}
          </button>
          <button className="chart-chip" data-active={layerState.vwap} onClick={() => toggleLayer("vwap")} type="button">
            {t("chart.price.layer.vwap")}
          </button>
          <button className="chart-chip" data-active={layerState.sessions} onClick={() => toggleLayer("sessions")} type="button">
            {t("chart.price.layer.sessions")}
          </button>
          <button className="chart-chip" data-active={layerState.structure} onClick={() => toggleLayer("structure")} type="button">
            {t("chart.price.layer.structure")}
          </button>
          <button className="chart-chip" data-active={layerState.range} onClick={() => toggleLayer("range")} type="button">
            {t("chart.price.layer.range")}
          </button>
        </div>
      </div>
      <div className="chart-legend">
        {layerState.ema ? <span className="chart-legend-item">
          <i className="chart-legend-swatch chart-legend-swatch-ema-fast" />
          EMA 9
        </span> : null}
        {layerState.ema ? <span className="chart-legend-item">
          <i className="chart-legend-swatch chart-legend-swatch-ema-slow" />
          EMA 21
        </span> : null}
        {layerState.vwap ? <span className="chart-legend-item">
          <i className="chart-legend-swatch chart-legend-swatch-vwap" />
          VWAP
        </span> : null}
        {layerState.structure ? <span className="chart-legend-item">
          <i className="chart-legend-swatch chart-legend-swatch-support" />
          SUPPORT
        </span> : null}
        {layerState.structure ? <span className="chart-legend-item">
          <i className="chart-legend-swatch chart-legend-swatch-resistance" />
          RESISTANCE
        </span> : null}
        {layerState.sessions ? <span className="chart-legend-item">
          <i className="chart-legend-swatch chart-legend-swatch-asia" />
          ASIA
        </span> : null}
        {layerState.sessions ? <span className="chart-legend-item">
          <i className="chart-legend-swatch chart-legend-swatch-london" />
          LONDON
        </span> : null}
        {layerState.sessions ? <span className="chart-legend-item">
          <i className="chart-legend-swatch chart-legend-swatch-newyork" />
          NEW YORK
        </span> : null}
      </div>
      {activeCandle ? (
        <div className="chart-stats">
          <div className="chart-stat">
            <span>O</span>
            <strong>{formatNumber(activeCandle.open, 2)}</strong>
          </div>
          <div className="chart-stat">
            <span>H</span>
            <strong>{formatNumber(activeCandle.high, 2)}</strong>
          </div>
          <div className="chart-stat">
            <span>L</span>
            <strong>{formatNumber(activeCandle.low, 2)}</strong>
          </div>
          <div className="chart-stat">
            <span>C</span>
            <strong>{formatNumber(activeCandle.close, 2)}</strong>
          </div>
          <div className="chart-stat">
            <span>VOL</span>
            <strong>{formatCompactNumber(activeCandle.volume)}</strong>
          </div>
          <div className="chart-stat">
            <span>DELTA</span>
            <strong data-positive={(changeAmount ?? 0) >= 0}>
              {changeAmount !== null ? `${formatNumber(changeAmount, 2)} / ${formatNumber((changePercent ?? 0) * 100, 2)}%` : "--"}
            </strong>
          </div>
          <div className="chart-stat chart-stat-time">
            <span>{t("chart.price.focus")}</span>
            <strong>{formatDateTime(activeCandle.timestamp)}</strong>
          </div>
        </div>
      ) : null}
      {visibleWindowStats ? (
        <div className="chart-structure-strip">
          {layerState.range ? <span className="chart-structure-pill chart-structure-pill-high">
            Range High {formatNumber(visibleWindowStats.high, 2)}
          </span> : null}
          {layerState.range ? <span className="chart-structure-pill chart-structure-pill-low">
            Range Low {formatNumber(visibleWindowStats.low, 2)}
          </span> : null}
          <span className="chart-structure-pill">
            Window {visibleWindowStats.bars} bars
          </span>
          <span className="chart-structure-pill">
            Span {formatNumber(visibleWindowStats.range, 2)} / {formatNumber(visibleWindowStats.rangePct * 100, 2)}%
          </span>
          {layerState.vwap && activeVwap !== null ? (
            <span className="chart-structure-pill">
              VWAP {formatNumber(activeVwap, 2)} / {formatNumber(vwapDelta ?? 0, 2)}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="chart-canvas" ref={containerRef} />
      <div className="chart-footnote">
        <span>{t("chart.price.interactionHint")}</span>
      </div>
    </div>
  );
}
