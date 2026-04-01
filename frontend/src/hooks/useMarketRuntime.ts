import { useEffect, useMemo, useState } from "react";

import {
  fallbackMarketSnapshot,
  loadMarketSnapshot,
  resolveBackendWsUrl,
  type EventEnvelope,
  type MarketSnapshot,
  type MarketSnapshotResponse,
} from "../lib/market";

type ConnectionStatus = "connecting" | "live" | "degraded" | "closed";

type MarketRuntimeState = {
  snapshot: MarketSnapshotResponse;
  connectionStatus: ConnectionStatus;
  eventFeed: EventEnvelope[];
};

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

function clampEvents(events: EventEnvelope[]): EventEnvelope[] {
  return events.slice(0, 16);
}

export function useMarketRuntime(): MarketRuntimeState {
  const [state, setState] = useState<MarketRuntimeState>({
    snapshot: fallbackMarketSnapshot,
    connectionStatus: "connecting",
    eventFeed: fallbackMarketSnapshot.recent_events,
  });

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;

    void loadMarketSnapshot().then((snapshot) => {
      if (!active) {
        return;
      }

      setState({
        snapshot,
        connectionStatus: snapshot.snapshots.length > 0 ? "live" : "degraded",
        eventFeed: clampEvents(snapshot.recent_events),
      });
    });

    try {
      socket = new WebSocket(resolveBackendWsUrl());

      socket.addEventListener("open", () => {
        if (!active) {
          return;
        }
        setState((current) => ({ ...current, connectionStatus: "live" }));
      });

      socket.addEventListener("message", (message) => {
        if (!active) {
          return;
        }

        const event = JSON.parse(message.data) as EventEnvelope;
        setState((current) => {
          if (event.event_type === "market.snapshot") {
            const payload = event.payload as unknown as MarketSnapshotResponse;
            return {
              snapshot: payload,
              connectionStatus: "live",
              eventFeed: clampEvents([event, ...current.eventFeed]),
            };
          }

          if (event.event_type === "market.tick") {
            const payload = event.payload as unknown as MarketSnapshot;
            return {
              snapshot: {
                ...current.snapshot,
                generated_at: event.generated_at,
                snapshots: upsertSnapshot(current.snapshot.snapshots, payload),
                recent_events: clampEvents([event, ...current.snapshot.recent_events]),
              },
              connectionStatus: "live",
              eventFeed: clampEvents([event, ...current.eventFeed]),
            };
          }

          return {
            ...current,
            eventFeed: clampEvents([event, ...current.eventFeed]),
          };
        });
      });

      socket.addEventListener("close", () => {
        if (!active) {
          return;
        }
        setState((current) => ({ ...current, connectionStatus: "closed" }));
      });

      socket.addEventListener("error", () => {
        if (!active) {
          return;
        }
        setState((current) => ({ ...current, connectionStatus: "degraded" }));
      });
    } catch {
      setState((current) => ({ ...current, connectionStatus: "degraded" }));
    }

    return () => {
      active = false;
      socket?.close();
    };
  }, []);

  return useMemo(() => state, [state]);
}
