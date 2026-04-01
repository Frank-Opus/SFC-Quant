import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  controlExecution,
  controlRiskHalt,
  dispatchExecution,
  fallbackExecutionStatus,
  fallbackMarketSnapshot,
  fallbackRiskStatus,
  fallbackStrategyStatus,
  generateStrategyArtifact,
  loadExecutionStatus,
  loadLatestAnalysis,
  loadMarketSnapshot,
  loadRiskStatus,
  loadStrategyArtifacts,
  loadStrategyStatus,
  requestLiveMode,
  resolveBackendWsUrl,
  runAnalysis,
  updateStrategyConfig,
  type AnalysisRunResult,
  type EventEnvelope,
  type ExecutionStatusResponse,
  type MarketSnapshot,
  type MarketSnapshotResponse,
  type RiskStatusResponse,
  type StrategyArtifact,
  type StrategyFactoryStatusResponse,
} from "../lib/market";

type ConnectionStatus = "connecting" | "live" | "reconnecting" | "degraded" | "closed";

type InstrumentSelection = {
  symbol: string;
  timeframe: string;
};

type MarketRuntimeState = {
  snapshot: MarketSnapshotResponse;
  execution: ExecutionStatusResponse;
  risk: RiskStatusResponse;
  strategyStatus: StrategyFactoryStatusResponse;
  strategyArtifacts: StrategyArtifact[];
  latestAnalysis: AnalysisRunResult | null;
  connectionStatus: ConnectionStatus;
  connectionMessage: string;
  eventFeed: EventEnvelope[];
  reconnectAttempts: number;
  lastEventAt: string | null;
  selectedInstrument: InstrumentSelection;
  pendingAction: string | null;
  actionMessage: string;
  setSelectedInstrument: (selection: InstrumentSelection) => void;
  reconnect: () => void;
  refreshAll: () => Promise<void>;
  runAnalysisAction: () => Promise<void>;
  dispatchAction: () => Promise<void>;
  pauseExecutionAction: () => Promise<void>;
  resumeExecutionAction: () => Promise<void>;
  engageRiskHaltAction: () => Promise<void>;
  clearRiskHaltAction: () => Promise<void>;
  requestLiveModeAction: (enable: boolean, confirmationText?: string) => Promise<void>;
  toggleStrategyFactoryAction: (enabled: boolean) => Promise<void>;
  generateStrategyAction: () => Promise<void>;
};

const DEFAULT_INSTRUMENT: InstrumentSelection = {
  symbol: "BTC/USDT",
  timeframe: "1m",
};

function clampEvents(events: EventEnvelope[]): EventEnvelope[] {
  return events.slice(0, 24);
}

function upsertSnapshot(
  snapshots: MarketSnapshot[],
  nextSnapshot: MarketSnapshot,
): MarketSnapshot[] {
  const key = `${nextSnapshot.symbol}:${nextSnapshot.timeframe}`;
  const filtered = snapshots.filter(
    (snapshot) => `${snapshot.symbol}:${snapshot.timeframe}` !== key,
  );
  return [nextSnapshot, ...filtered].sort((left, right) =>
    `${left.symbol}:${left.timeframe}`.localeCompare(`${right.symbol}:${right.timeframe}`),
  );
}

function resolveInstrument(
  snapshot: MarketSnapshotResponse,
  preferred: InstrumentSelection,
): InstrumentSelection {
  const matched = snapshot.snapshots.find(
    (item) => item.symbol === preferred.symbol && item.timeframe === preferred.timeframe,
  );
  if (matched) {
    return preferred;
  }

  const first = snapshot.snapshots[0];
  if (first) {
    return { symbol: first.symbol, timeframe: first.timeframe };
  }

  return preferred;
}

function isExecutionEvent(type: string): boolean {
  return type.startsWith("execution.");
}

function isRiskEvent(type: string): boolean {
  return type.startsWith("risk.");
}

function isStrategyEvent(type: string): boolean {
  return type.startsWith("strategy.");
}

export function useMarketRuntime(): MarketRuntimeState {
  const [snapshot, setSnapshot] = useState<MarketSnapshotResponse>(fallbackMarketSnapshot);
  const [execution, setExecution] = useState<ExecutionStatusResponse>(fallbackExecutionStatus);
  const [risk, setRisk] = useState<RiskStatusResponse>(fallbackRiskStatus);
  const [strategyStatus, setStrategyStatus] =
    useState<StrategyFactoryStatusResponse>(fallbackStrategyStatus);
  const [strategyArtifacts, setStrategyArtifacts] = useState<StrategyArtifact[]>([]);
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisRunResult | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [connectionMessage, setConnectionMessage] = useState("Connecting to realtime stream...");
  const [eventFeed, setEventFeed] = useState<EventEnvelope[]>(fallbackMarketSnapshot.recent_events);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [selectedInstrument, setSelectedInstrumentState] =
    useState<InstrumentSelection>(DEFAULT_INSTRUMENT);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("Operator deck ready.");

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const activeRef = useRef(true);
  const selectedInstrumentRef = useRef<InstrumentSelection>(DEFAULT_INSTRUMENT);

  useEffect(() => {
    selectedInstrumentRef.current = selectedInstrument;
  }, [selectedInstrument]);

  const refreshExecution = useCallback(async () => {
    const next = await loadExecutionStatus();
    if (!activeRef.current) {
      return;
    }
    setExecution(next);
  }, []);

  const refreshRisk = useCallback(async () => {
    const next = await loadRiskStatus();
    if (!activeRef.current) {
      return;
    }
    setRisk(next);
  }, []);

  const refreshStrategy = useCallback(async (selection: InstrumentSelection) => {
    const [nextStatus, nextArtifacts] = await Promise.all([
      loadStrategyStatus(),
      loadStrategyArtifacts({
        symbol: selection.symbol,
        timeframe: selection.timeframe,
        limit: 6,
      }),
    ]);
    if (!activeRef.current) {
      return;
    }
    setStrategyStatus(nextStatus);
    setStrategyArtifacts(nextArtifacts);
  }, []);

  const refreshAnalysis = useCallback(async (selection: InstrumentSelection) => {
    const next = await loadLatestAnalysis(selection);
    if (!activeRef.current) {
      return;
    }
    setLatestAnalysis(next);
  }, []);

  const refreshAll = useCallback(async () => {
    const [nextSnapshot, nextExecution, nextRisk, nextStrategyStatus] = await Promise.all([
      loadMarketSnapshot(),
      loadExecutionStatus(),
      loadRiskStatus(),
      loadStrategyStatus(),
    ]);

    if (!activeRef.current) {
      return;
    }

    const resolvedInstrument = resolveInstrument(
      nextSnapshot,
      selectedInstrumentRef.current,
    );

    setSnapshot(nextSnapshot);
    setExecution(nextExecution);
    setRisk(nextRisk);
    setStrategyStatus(nextStrategyStatus);
    setEventFeed(clampEvents(nextSnapshot.recent_events));
    setSelectedInstrumentState(resolvedInstrument);

    const [nextAnalysis, nextStrategyArtifacts] = await Promise.all([
      loadLatestAnalysis(resolvedInstrument),
      loadStrategyArtifacts({
        symbol: resolvedInstrument.symbol,
        timeframe: resolvedInstrument.timeframe,
        limit: 6,
      }),
    ]);
    if (!activeRef.current) {
      return;
    }
    setLatestAnalysis(nextAnalysis);
    setStrategyArtifacts(nextStrategyArtifacts);
  }, []);

  const setSelectedInstrument = useCallback((selection: InstrumentSelection) => {
    setSelectedInstrumentState(selection);
  }, []);

  useEffect(() => {
    void refreshAnalysis(selectedInstrument);
  }, [refreshAnalysis, selectedInstrument]);

  useEffect(() => {
    void refreshStrategy(selectedInstrument);
  }, [refreshStrategy, selectedInstrument]);

  useEffect(() => {
    activeRef.current = true;
    void refreshAll();

    return () => {
      activeRef.current = false;
    };
  }, [refreshAll]);

  const connect = useCallback(() => {
    if (!activeRef.current) {
      return;
    }

    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    setConnectionStatus(reconnectAttemptsRef.current > 0 ? "reconnecting" : "connecting");
    setConnectionMessage(
      reconnectAttemptsRef.current > 0
        ? `Realtime link dropped. Retrying (${reconnectAttemptsRef.current})...`
        : "Connecting to realtime stream...",
    );

    const socket = new WebSocket(resolveBackendWsUrl());
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      reconnectAttemptsRef.current = 0;
      setReconnectAttempts(0);
      setConnectionStatus("live");
      setConnectionMessage("Realtime stream live.");
    });

    socket.addEventListener("message", (message) => {
      if (!activeRef.current) {
        return;
      }

      const event = JSON.parse(message.data) as EventEnvelope;
      setLastEventAt(event.generated_at);
      setEventFeed((current) => clampEvents([event, ...current]));

      if (event.event_type === "system.connected") {
        setConnectionStatus("live");
        setConnectionMessage("Realtime stream restored.");
        return;
      }

      if (event.event_type === "market.snapshot") {
        const payload = event.payload as unknown as MarketSnapshotResponse;
        const resolvedInstrument = resolveInstrument(payload, selectedInstrumentRef.current);
        setSnapshot(payload);
        setSelectedInstrumentState(resolvedInstrument);
        return;
      }

      if (event.event_type === "market.tick") {
        const payload = event.payload as unknown as MarketSnapshot;
        setSnapshot((current) => ({
          ...current,
          generated_at: event.generated_at,
          snapshots: upsertSnapshot(current.snapshots, payload),
          recent_events: clampEvents([event, ...current.recent_events]),
        }));
        return;
      }

      if (event.event_type === "agent.analysis.completed") {
        const payload = event.payload as unknown as AnalysisRunResult;
        if (
          payload.symbol === selectedInstrumentRef.current.symbol &&
          payload.timeframe === selectedInstrumentRef.current.timeframe
        ) {
          setLatestAnalysis(payload);
        }
        return;
      }

      if (isExecutionEvent(event.event_type)) {
        void refreshExecution();
      }

      if (isRiskEvent(event.event_type)) {
        void refreshRisk();
      }

      if (isStrategyEvent(event.event_type)) {
        void refreshStrategy(selectedInstrumentRef.current);
      }
    });

    socket.addEventListener("error", () => {
      if (!activeRef.current) {
        return;
      }
      setConnectionStatus("degraded");
      setConnectionMessage("Realtime stream encountered an error.");
    });

    socket.addEventListener("close", () => {
      if (!activeRef.current) {
        return;
      }

      setConnectionStatus("closed");
      setConnectionMessage("Realtime stream closed.");

      if (!shouldReconnectRef.current) {
        return;
      }

      reconnectAttemptsRef.current += 1;
      setReconnectAttempts(reconnectAttemptsRef.current);
      const delay = Math.min(6000, 800 * reconnectAttemptsRef.current);
      reconnectTimerRef.current = window.setTimeout(() => {
        setConnectionStatus("reconnecting");
        setConnectionMessage(
          `Realtime link dropped. Retrying (${reconnectAttemptsRef.current})...`,
        );
        connect();
      }, delay);
    });
  }, [refreshExecution, refreshRisk]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      socketRef.current?.close();
    };
  }, [connect]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
    socketRef.current?.close();
    connect();
  }, [connect]);

  const runAction = useCallback(
    async (label: string, task: () => Promise<void>) => {
      setPendingAction(label);
      try {
        await task();
      } catch (error) {
        const message = error instanceof Error ? error.message : `${label} failed.`;
        setActionMessage(message);
      } finally {
        setPendingAction(null);
      }
    },
    [],
  );

  const runAnalysisAction = useCallback(async () => {
    await runAction("analysis", async () => {
      const result = await runAnalysis(selectedInstrumentRef.current);
      if (!activeRef.current) {
        return;
      }
      setLatestAnalysis(result);
      setActionMessage(
        `Analysis completed for ${result.symbol} ${result.timeframe}: ${result.overall_recommendation}.`,
      );
    });
  }, [runAction]);

  const dispatchAction = useCallback(async () => {
    await runAction("dispatch", async () => {
      const result = await dispatchExecution(selectedInstrumentRef.current);
      if (!activeRef.current) {
        return;
      }
      setLatestAnalysis(result.analysis);
      setExecution(result.status);
      await refreshRisk();
      setActionMessage(result.message);
    });
  }, [refreshRisk, runAction]);

  const pauseExecutionAction = useCallback(async () => {
    await runAction("pause", async () => {
      const result = await controlExecution({
        action: "pause",
        reason: "Paused from dashboard control.",
      });
      if (!activeRef.current) {
        return;
      }
      setExecution(result);
      setActionMessage(result.paused_reason ?? "Execution paused.");
    });
  }, [runAction]);

  const resumeExecutionAction = useCallback(async () => {
    await runAction("resume", async () => {
      const result = await controlExecution({ action: "resume" });
      if (!activeRef.current) {
        return;
      }
      setExecution(result);
      setActionMessage("Execution resumed.");
    });
  }, [runAction]);

  const engageRiskHaltAction = useCallback(async () => {
    await runAction("halt", async () => {
      const result = await controlRiskHalt({
        action: "halt",
        reason: "Operator engaged halt from dashboard.",
      });
      if (!activeRef.current) {
        return;
      }
      setRisk(result);
      await refreshExecution();
      setActionMessage(result.halt_reason ?? "Risk halt engaged.");
    });
  }, [refreshExecution, runAction]);

  const clearRiskHaltAction = useCallback(async () => {
    await runAction("clear-halt", async () => {
      const result = await controlRiskHalt({ action: "clear" });
      if (!activeRef.current) {
        return;
      }
      setRisk(result);
      setActionMessage("Risk halt cleared.");
    });
  }, [runAction]);

  const requestLiveModeAction = useCallback(
    async (enable: boolean, confirmationText?: string) => {
      await runAction(enable ? "enable-live" : "disable-live", async () => {
        const result = await requestLiveMode({
          enable,
          confirmation_text: confirmationText,
        });
        if (!activeRef.current) {
          return;
        }
        setRisk(result);
        setActionMessage(
          result.live_mode_reason ?? (enable ? "Live mode updated." : "Live mode disabled."),
        );
      });
    },
    [runAction],
  );

  const toggleStrategyFactoryAction = useCallback(
    async (enabled: boolean) => {
      await runAction(enabled ? "strategy-enable" : "strategy-disable", async () => {
        const result = await updateStrategyConfig({ enabled });
        if (!activeRef.current) {
          return;
        }
        setStrategyStatus(result);
        await refreshStrategy(selectedInstrumentRef.current);
        setActionMessage(result.reason ?? "Strategy Factory updated.");
      });
    },
    [refreshStrategy, runAction],
  );

  const generateStrategyAction = useCallback(async () => {
    await runAction("strategy-generate", async () => {
      const result = await generateStrategyArtifact(selectedInstrumentRef.current);
      if (!activeRef.current) {
        return;
      }
      setStrategyStatus(result.status);
      await refreshStrategy(selectedInstrumentRef.current);
      setActionMessage(result.message);
    });
  }, [refreshStrategy, runAction]);

  return useMemo(
    () => ({
      snapshot,
      execution,
      risk,
      strategyStatus,
      strategyArtifacts,
      latestAnalysis,
      connectionStatus,
      connectionMessage,
      eventFeed,
      reconnectAttempts,
      lastEventAt,
      selectedInstrument,
      pendingAction,
      actionMessage,
      setSelectedInstrument,
      reconnect,
      refreshAll,
      runAnalysisAction,
      dispatchAction,
      pauseExecutionAction,
      resumeExecutionAction,
      engageRiskHaltAction,
      clearRiskHaltAction,
      requestLiveModeAction,
      toggleStrategyFactoryAction,
      generateStrategyAction,
    }),
    [
      actionMessage,
      clearRiskHaltAction,
      connectionMessage,
      connectionStatus,
      dispatchAction,
      engageRiskHaltAction,
      eventFeed,
      execution,
      generateStrategyAction,
      lastEventAt,
      latestAnalysis,
      pauseExecutionAction,
      pendingAction,
      reconnect,
      reconnectAttempts,
      refreshAll,
      requestLiveModeAction,
      resumeExecutionAction,
      risk,
      runAnalysisAction,
      selectedInstrument,
      setSelectedInstrument,
      snapshot,
      strategyArtifacts,
      strategyStatus,
      toggleStrategyFactoryAction,
    ],
  );
}
