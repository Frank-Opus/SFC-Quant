import { useEffect, useState } from "react";

import {
  fallbackRuntimeSnapshot,
  loadRuntimeSnapshot,
  type RuntimeSnapshot,
} from "./lib/runtime";

export default function App() {
  const [runtime, setRuntime] = useState<RuntimeSnapshot>(fallbackRuntimeSnapshot);

  useEffect(() => {
    let cancelled = false;

    void loadRuntimeSnapshot().then((snapshot) => {
      if (!cancelled) {
        setRuntime(snapshot);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">PHASE 1 FOUNDATION</p>
        <h1>dSFC-Quant</h1>
        <p className="lede">
          A custom trading workstation shell for local-first AI quant execution.
        </p>
      </section>

      <section className="runtime-panel">
        <div>
          <span className="label">Frontend Runtime</span>
          <strong>React + Vite baseline</strong>
        </div>
        <div>
          <span className="label">Current Mode</span>
          <strong>{runtime.runtime_mode}</strong>
        </div>
        <div>
          <span className="label">Design Direction</span>
          <strong>Custom trading interface, no generic template</strong>
        </div>
        <div>
          <span className="label">Live Trading</span>
          <strong>{runtime.live_trading_enabled ? "Enabled" : "Disabled"}</strong>
        </div>
        <div>
          <span className="label">AI Provider</span>
          <strong>{runtime.ai_provider}</strong>
        </div>
        <div>
          <span className="label">Safe Startup</span>
          <strong>
            {runtime.runtime_mode === "mock-safe"
              ? "Mock-safe defaults active"
              : "Runtime resolved from environment"}
          </strong>
        </div>
      </section>

      {runtime.warnings.length > 0 ? (
        <section className="runtime-panel">
          <div>
            <span className="label">Runtime Warnings</span>
            <strong>{runtime.warnings[0]}</strong>
          </div>
        </section>
      ) : null}
    </main>
  );
}
