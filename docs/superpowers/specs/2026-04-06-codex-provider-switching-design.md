# Codex Provider Switching Design

## Goal

Let one local Codex CLI installation switch between multiple third-party mirror providers while keeping a single shared `~/.codex` history, session, and log store.

## Scope

This change is intentionally lightweight and local-only:

- Keep `~/.codex/` as the single source of Codex history and runtime state.
- Add a provider registry under `~/.codex/providers/`.
- Add a local management command for adding, switching, listing, and running providers.
- Keep the user experience centered on the existing `codex` command.

This change does not modify project backend or frontend code.

## Recommended Approach

Use a thin wrapper around `codex` instead of splitting `CODEX_HOME` or rewriting large chunks of `~/.codex/config.toml`.

### Why this approach

- Shared history comes for free because the wrapper still uses the same `~/.codex`.
- New mirrors can be added as data files instead of hand-editing TOML every time.
- Switching becomes cheap and reversible.
- Existing non-provider Codex settings in `~/.codex/config.toml` stay intact.

## Architecture

### Provider Registry

Store provider definitions in:

- `~/.codex/providers/<name>.json`
- `~/.codex/providers/current`

Each provider file contains:

- `name`
- `base_url`
- `model`
- `model_provider`
- `wire_api`
- `requires_openai_auth`
- `api_key_env`
- `api_key`
- `model_reasoning_effort`
- `web_search`

### Command Layer

Install:

- `~/.local/bin/codex-provider`
- `~/.local/bin/codex`

`codex-provider` handles registry operations.

`codex` becomes a tiny wrapper that:

- resolves the active provider
- injects provider-specific `-c` overrides into the real Codex CLI
- exports the provider API key through the configured environment variable
- preserves the shared `~/.codex` state directory

## Behavior

### Default behavior

Running `codex` with no provider arguments uses the provider named in `~/.codex/providers/current`.

### One-off provider override

Running `codex -p <provider-name>` uses that provider for the current invocation if the name matches a registered provider. Other profiles continue to pass through to the real Codex CLI unchanged.

### Bootstrap

On first use, `codex-provider` bootstraps one provider from the current `~/.codex/config.toml`, so the existing mirror setup becomes the initial managed provider without losing history.

## Trade-offs

### Accepted

- The wrapper becomes the main entry point for normal `codex` usage.
- Provider API keys are stored locally under the user home when the user chooses to save them.

### Avoided

- Separate `CODEX_HOME` directories per mirror, which would fragment history.
- Fragile manual editing of `config.toml` for every provider change.
- Upstream CodexBar or Codex CLI source changes for a local workflow problem.

## Verification

Success means:

1. `codex-provider list` shows the registered mirrors.
2. `codex-provider switch <name>` changes the active provider.
3. `codex --version` and `codex --help` still work through the wrapper.
4. `~/.codex/history.jsonl`, `~/.codex/sessions/`, and sqlite state/log files remain the shared store.
