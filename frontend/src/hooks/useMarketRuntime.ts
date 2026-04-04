import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLocale } from "../lib/i18n";
import {
  controlExecution,
  controlRiskHalt,
  dispatchExecution,
  fallbackAgentRuntime,
  fallbackExecutionStatus,
  fallbackMarketSnapshot,
  fallbackPerformanceReport,
  fallbackRiskStatus,
  fallbackStrategyStatus,
  generateStrategyArtifact,
  loadAgentRuntime,
  loadExecutionStatus,
  loadLatestAnalysis,
  loadMarketSnapshot,
  loadPaperPerformance,
  loadRiskStatus,
  loadStrategyArtifacts,
  loadStrategyStatus,
  requestLiveMode,
  isStaticPreviewMode,
  resolveBackendWsUrl,
  runAnalysis,
  runBacktest,
  updateStrategyConfig,
  type AgentRuntimeSummaryResponse,
  type AnalysisRunResult,
  type EventEnvelope,
  type ExecutionStatusResponse,
  type MarketSnapshot,
  type MarketSnapshotResponse,
  type PerformanceReport,
  type RiskStatusResponse,
  type StrategyArtifact,
  type StrategyFactoryStatusResponse,
} from "../lib/market";
import {
  fallbackWorkflowSnapshot,
  loadWorkflowSnapshot,
  type WorkflowSnapshot,
} from "../lib/workflow";

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
  agentRuntime: AgentRuntimeSummaryResponse;
  paperPerformance: PerformanceReport;
  backtestReport: PerformanceReport | null;
  latestAnalysis: AnalysisRunResult | null;
  workflow: WorkflowSnapshot;
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
  runBacktestAction: () => Promise<void>;
};

const DEFAULT_INSTRUMENT: InstrumentSelection = {
  symbol: "BTC/USDT",
  timeframe: "1m",
};

function clampEvents(events: EventEnvelope[]): EventEnvelope[] {
  const seen = new Set<string>();
  const unique: EventEnvelope[] = [];

  for (const event of events) {
    if (seen.has(event.event_id)) {
      continue;
    }
    seen.add(event.event_id);
    unique.push(event);
    if (unique.length >= 24) {
      break;
    }
  }

  return unique;
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
  const { t, formatRecommendation } = useLocale();
  const staticPreviewMode = isStaticPreviewMode();
  const [snapshot, setSnapshot] = useState<MarketSnapshotResponse>(fallbackMarketSnapshot);
  const [execution, setExecution] = useState<ExecutionStatusResponse>(fallbackExecutionStatus);
  const [risk, setRisk] = useState<RiskStatusResponse>(fallbackRiskStatus);
  const [strategyStatus, setStrategyStatus] =
    useState<StrategyFactoryStatusResponse>(fallbackStrategyStatus);
  const [strategyArtifacts, setStrategyArtifacts] = useState<StrategyArtifact[]>([]);
  const [agentRuntime, setAgentRuntime] =
    useState<AgentRuntimeSummaryResponse>(fallbackAgentRuntime);
  const [paperPerformance, setPaperPerformance] =
    useState<PerformanceReport>(fallbackPerformanceReport);
  const [backtestReport, setBacktestReport] = useState<PerformanceReport | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisRunResult | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowSnapshot>(fallbackWorkflowSnapshot);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [connectionMessage, setConnectionMessage] = useState(t("runtime.connecting"));
  const [eventFeed, setEventFeed] = useState<EventEnvelope[]>(fallbackMarketSnapshot.recent_events);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [selectedInstrument, setSelectedInstrumentState] =
    useState<InstrumentSelection>(DEFAULT_INSTRUMENT);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState(t("runtime.ready"));

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

  const refreshAgentRuntime = useCallback(async () => {
    const next = await loadAgentRuntime();
    if (!activeRef.current) {
      return;
    }
    setAgentRuntime(next);
  }, []);

  const refreshPaperPerformance = useCallback(async () => {
    const next = await loadPaperPerformance();
    if (!activeRef.current) {
      return;
    }
    setPaperPerformance(next);
  }, []);

  const refreshBacktest = useCallback(async (selection: InstrumentSelection) => {
    try {
      const next = await runBacktest(selection);
      if (!activeRef.current) {
        return;
      }
      setBacktestReport(next);
    } catch {
      if (!activeRef.current) {
        return;
      }
      setBacktestReport(null);
    }
  }, []);

  const refreshAnalysis = useCallback(async (selection: InstrumentSelection) => {
    const next = await loadLatestAnalysis(selection);
    if (!activeRef.current) {
      return;
    }
    setLatestAnalysis(next);
  }, []);

  const refreshWorkflow = useCallback(async (selection: InstrumentSelection) => {
    const next = await loadWorkflowSnapshot(selection);
    if (!activeRef.current) {
      return;
    }
    setWorkflow(next);
  }, []);

  const refreshAll = useCallback(async () => {
    const [
      nextSnapshot,
      nextExecution,
      nextRisk,
      nextStrategyStatus,
      nextAgentRuntime,
      nextPaperPerformance,
    ] = await Promise.all([
      loadMarketSnapshot(),
      loadExecutionStatus(),
      loadRiskStatus(),
      loadStrategyStatus(),
      loadAgentRuntime(),
      loadPaperPerformance(),
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
    setAgentRuntime(nextAgentRuntime);
    setPaperPerformance(nextPaperPerformance);
    setEventFeed(clampEvents(nextSnapshot.recent_events));
    setSelectedInstrumentState(resolvedInstrument);

    const [nextAnalysis, nextStrategyArtifacts, nextBacktest, nextWorkflow] = await Promise.all([
      loadLatestAnalysis(resolvedInstrument),
      loadStrategyArtifacts({
        symbol: resolvedInstrument.symbol,
        timeframe: resolvedInstrument.timeframe,
        limit: 6,
      }),
      runBacktest(resolvedInstrument).catch(() => null),
      loadWorkflowSnapshot(resolvedInstrument),
    ]);
    if (!activeRef.current) {
      return;
    }
    setLatestAnalysis(nextAnalysis);
    setStrategyArtifacts(nextStrategyArtifacts);
    setBacktestReport(nextBacktest);
    setWorkflow(nextWorkflow);
  }, []);

  const setSelectedInstrument = useCallback((selection: InstrumentSelection) => {
    setSelectedInstrumentState(selection);
  }, []);

  useEffect(() => {
    void refreshAnalysis(selectedInstrument);
  }, [refreshAnalysis, selectedInstrument]);

  useEffect(() => {
    void refreshWorkflow(selectedInstrument);
  }, [refreshWorkflow, selectedInstrument]);

  useEffect(() => {
    void refreshStrategy(selectedInstrument);
  }, [refreshStrategy, selectedInstrument]);

  useEffect(() => {
    void refreshBacktest(selectedInstrument);
  }, [refreshBacktest, selectedInstrument]);

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

    if (staticPreviewMode) {
      setConnectionStatus("degraded");
      setConnectionMessage(t("runtime.preview"));
      return;
    }

    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    setConnectionStatus(reconnectAttemptsRef.current > 0 ? "reconnecting" : "connecting");
    setConnectionMessage(
      reconnectAttemptsRef.current > 0
        ? t("runtime.reconnecting", { count: reconnectAttemptsRef.current })
        : t("runtime.connecting"),
    );

    const socket = new WebSocket(resolveBackendWsUrl());
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      reconnectAttemptsRef.current = 0;
      setReconnectAttempts(0);
      setConnectionStatus("live");
      setConnectionMessage(t("runtime.live"));
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
        setConnectionMessage(t("runtime.restored"));
        return;
      }

      if (event.event_type === "market.snapshot") {
        const payload = event.payload as unknown as MarketSnapshotResponse;
        const resolvedInstrument = resolveInstrument(payload, selectedInstrumentRef.current);
        setSnapshot(payload);
        setSelectedInstrumentState(resolvedInstrument);
        void refreshWorkflow(resolvedInstrument);
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
          void refreshWorkflow(selectedInstrumentRef.current);
        }
        return;
      }

      if (isExecutionEvent(event.event_type)) {
        void refreshExecution();
        void refreshPaperPerformance();
        void refreshWorkflow(selectedInstrumentRef.current);
      }

      if (isRiskEvent(event.event_type)) {
        void refreshRisk();
        void refreshWorkflow(selectedInstrumentRef.current);
      }

      if (isStrategyEvent(event.event_type)) {
        void refreshStrategy(selectedInstrumentRef.current);
        void refreshAgentRuntime();
        void refreshWorkflow(selectedInstrumentRef.current);
      }
    });

    socket.addEventListener("error", () => {
      if (!activeRef.current) {
        return;
      }
      setConnectionStatus("degraded");
      setConnectionMessage(t("runtime.error"));
    });

    socket.addEventListener("close", () => {
      if (!activeRef.current) {
        return;
      }

      setConnectionStatus("closed");
      setConnectionMessage(t("runtime.closed"));

      if (!shouldReconnectRef.current) {
        return;
      }

      reconnectAttemptsRef.current += 1;
      setReconnectAttempts(reconnectAttemptsRef.current);
      const delay = Math.min(6000, 800 * reconnectAttemptsRef.current);
      reconnectTimerRef.current = window.setTimeout(() => {
        setConnectionStatus("reconnecting");
        setConnectionMessage(t("runtime.reconnecting", { count: reconnectAttemptsRef.current }));
        connect();
      }, delay);
    });
  }, [
    refreshAgentRuntime,
    refreshExecution,
    refreshPaperPerformance,
    refreshRisk,
    refreshStrategy,
    refreshWorkflow,
    staticPreviewMode,
    t,
  ]);

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
    if (staticPreviewMode) {
      setConnectionStatus("degraded");
      setConnectionMessage(t("runtime.preview"));
      return;
    }
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
    socketRef.current?.close();
    connect();
  }, [connect, staticPreviewMode]);

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
        t("runtime.analysisCompleted", {
          symbol: result.symbol,
          timeframe: result.timeframe,
          recommendation: formatRecommendation(result.overall_recommendation, {
            uppercase: true,
          }),
        }),
      );
      await refreshWorkflow(selectedInstrumentRef.current);
    });
  }, [formatRecommendation, refreshWorkflow, runAction, t]);

  const dispatchAction = useCallback(async () => {
    await runAction("dispatch", async () => {
      const result = await dispatchExecution(selectedInstrumentRef.current);
      if (!activeRef.current) {
        return;
      }
      setLatestAnalysis(result.analysis);
      setExecution(result.status);
      await refreshRisk();
      await refreshPaperPerformance();
      await refreshWorkflow(selectedInstrumentRef.current);
      setActionMessage(result.message);
    });
  }, [refreshPaperPerformance, refreshRisk, refreshWorkflow, runAction]);

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
      setActionMessage(result.paused_reason ?? t("runtime.executionPaused"));
      await refreshWorkflow(selectedInstrumentRef.current);
    });
  }, [refreshWorkflow, runAction, t]);

  const resumeExecutionAction = useCallback(async () => {
    await runAction("resume", async () => {
      const result = await controlExecution({ action: "resume" });
      if (!activeRef.current) {
        return;
      }
      setExecution(result);
      setActionMessage(t("runtime.executionResumed"));
      await refreshWorkflow(selectedInstrumentRef.current);
    });
  }, [refreshWorkflow, runAction, t]);

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
      setActionMessage(result.halt_reason ?? t("runtime.haltEngaged"));
      await refreshWorkflow(selectedInstrumentRef.current);
    });
  }, [refreshExecution, refreshWorkflow, runAction, t]);

  const clearRiskHaltAction = useCallback(async () => {
    await runAction("clear-halt", async () => {
      const result = await controlRiskHalt({ action: "clear" });
      if (!activeRef.current) {
        return;
      }
      setRisk(result);
      setActionMessage(t("runtime.haltCleared"));
      await refreshWorkflow(selectedInstrumentRef.current);
    });
  }, [refreshWorkflow, runAction, t]);

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
          result.live_mode_reason ??
            (enable ? t("runtime.liveModeUpdated") : t("runtime.liveModeDisabled")),
        );
        await refreshWorkflow(selectedInstrumentRef.current);
      });
    },
    [refreshWorkflow, runAction, t],
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
        await refreshAgentRuntime();
        await refreshWorkflow(selectedInstrumentRef.current);
        setActionMessage(result.reason ?? t("runtime.strategyUpdated"));
      });
    },
    [refreshAgentRuntime, refreshStrategy, refreshWorkflow, runAction, t],
  );

  const generateStrategyAction = useCallback(async () => {
    await runAction("strategy-generate", async () => {
      const result = await generateStrategyArtifact(selectedInstrumentRef.current);
      if (!activeRef.current) {
        return;
      }
      setStrategyStatus(result.status);
      await refreshStrategy(selectedInstrumentRef.current);
      await refreshAgentRuntime();
      await refreshWorkflow(selectedInstrumentRef.current);
      setActionMessage(result.message);
    });
  }, [refreshAgentRuntime, refreshStrategy, refreshWorkflow, runAction]);

  const runBacktestAction = useCallback(async () => {
    await runAction("backtest-run", async () => {
      const result = await runBacktest(selectedInstrumentRef.current);
      if (!activeRef.current) {
        return;
      }
      setBacktestReport(result);
      setActionMessage(
        `${result.symbol ?? selectedInstrumentRef.current.symbol} ${result.timeframe ?? selectedInstrumentRef.current.timeframe} backtest ready.`,
      );
    });
  }, [runAction]);

  return useMemo(
    () => ({
      snapshot,
      execution,
      risk,
      strategyStatus,
      strategyArtifacts,
      agentRuntime,
      paperPerformance,
      backtestReport,
      latestAnalysis,
      workflow,
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
      runBacktestAction,
    }),
    [
      actionMessage,
      agentRuntime,
      backtestReport,
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
      paperPerformance,
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
      runBacktestAction,
      workflow,
    ],
  );
}
