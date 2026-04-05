# Codex Provider Switching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared-history multi-provider switching layer for Codex CLI without splitting `~/.codex`.

**Architecture:** Install a local provider registry plus a `codex` wrapper that injects provider-specific configuration at runtime. Keep all history and session storage in the existing `~/.codex` directory.

**Tech Stack:** Python 3 stdlib, shell wrapper, Codex CLI runtime overrides

---

### Task 1: Write the local design and execution artifacts

**Files:**
- Create: `docs/superpowers/specs/2026-04-06-codex-provider-switching-design.md`
- Create: `docs/superpowers/plans/2026-04-06-codex-provider-switching.md`

- [ ] **Step 1: Write the design document**

```markdown
# Codex Provider Switching Design

Define the shared-history provider registry, wrapper behavior, bootstrap path, and verification criteria.
```

- [ ] **Step 2: Write the implementation plan**

```markdown
# Codex Provider Switching Implementation Plan

Describe the command files, provider registry, and verification flow.
```

- [ ] **Step 3: Verify the docs exist**

Run: `test -f docs/superpowers/specs/2026-04-06-codex-provider-switching-design.md && test -f docs/superpowers/plans/2026-04-06-codex-provider-switching.md && echo OK`
Expected: `OK`

### Task 2: Install the provider registry manager

**Files:**
- Create: `/home/wanguancheng/.local/bin/codex-provider`

- [ ] **Step 1: Write the management CLI**

```python
#!/usr/bin/env python3

# Provide bootstrap, add, list, show, switch, run, and hidden exec support.
```

- [ ] **Step 2: Make the script executable**

Run: `chmod 755 /home/wanguancheng/.local/bin/codex-provider`
Expected: no output

- [ ] **Step 3: Bootstrap from the existing mirror config**

Run: `/home/wanguancheng/.local/bin/codex-provider bootstrap`
Expected: a provider file appears in `~/.codex/providers/`

### Task 3: Install the transparent codex wrapper

**Files:**
- Create: `/home/wanguancheng/.local/bin/codex`

- [ ] **Step 1: Write the wrapper**

```bash
#!/usr/bin/env bash
exec /home/wanguancheng/.local/bin/codex-provider __exec "$@"
```

- [ ] **Step 2: Make the wrapper executable**

Run: `chmod 755 /home/wanguancheng/.local/bin/codex`
Expected: no output

- [ ] **Step 3: Verify PATH resolves to the wrapper first**

Run: `command -v codex`
Expected: `/home/wanguancheng/.local/bin/codex`

### Task 4: Verify provider switching and history sharing

**Files:**
- Test: `/home/wanguancheng/.codex/providers/`
- Test: `/home/wanguancheng/.codex/history.jsonl`

- [ ] **Step 1: Verify bootstrap state**

Run: `codex-provider list && codex-provider current`
Expected: at least one provider is listed and one current provider name is printed

- [ ] **Step 2: Verify the wrapped CLI still responds**

Run: `codex --version && codex --help >/tmp/codex-help.txt && test -s /tmp/codex-help.txt && echo OK`
Expected: version output plus `OK`

- [ ] **Step 3: Verify history storage remains shared**

Run: `test -f /home/wanguancheng/.codex/history.jsonl && test -d /home/wanguancheng/.codex/sessions && echo OK`
Expected: `OK`

- [ ] **Step 4: Verify one-off profile override path**

Run: `codex -p $(codex-provider current) --version`
Expected: version output without breaking provider resolution
