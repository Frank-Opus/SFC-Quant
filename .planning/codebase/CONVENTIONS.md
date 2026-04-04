# Coding Conventions

**Analysis Date:** 2026-04-01

## Naming Patterns

**Files:**
- Use `snake_case` for Python modules and package directories in `backend/app/`, as shown by `backend/app/core/config.py`, `backend/app/core/runtime.py`, and `backend/app/api/routes/health.py`.
- Use `PascalCase` for top-level React component files in `frontend/src/`, as shown by `frontend/src/App.tsx`.
- Use lowercase or `camelCase`-style utility filenames for frontend support modules, as shown by `frontend/src/lib/runtime.ts` and `frontend/src/styles.css`.
- Keep Python package markers as minimal `__init__.py` files, as shown by `backend/app/__init__.py`, `backend/app/api/__init__.py`, and `backend/tests/__init__.py`.

**Functions:**
- Use `snake_case` for Python functions and validators, as shown by `backend/app/core/config.py` (`get_settings`, `normalize_app_mode`, `normalize_ai_provider`) and `backend/app/core/runtime.py` (`resolve_runtime`).
- Use `camelCase` for TypeScript functions and helpers, as shown by `frontend/src/lib/runtime.ts` (`resolveBackendBaseUrl`, `loadRuntimeSnapshot`).
- Use `PascalCase` for React function components and type-like runtime objects, as shown by `frontend/src/App.tsx` (`App`).

**Variables:**
- Use `snake_case` for Python locals and fields, as shown by `backend/app/core/runtime.py` (`exchange_credentials_present`, `live_trading_requested`, `runtime_mode`).
- Use `camelCase` for frontend state, locals, and exported values, as shown by `frontend/src/App.tsx` (`setRuntime`, `cancelled`) and `frontend/src/lib/runtime.ts` (`fallbackRuntimeSnapshot`).
- Use uppercase snake case only for environment variable names referenced through settings or docs, as shown by `backend/app/core/config.py` and `README.md`.

**Types:**
- Use `PascalCase` for Python classes and Pydantic models, as shown by `backend/app/core/config.py` (`Settings`) and `backend/app/core/runtime.py` (`RuntimeSnapshot`).
- Use `PascalCase` for TypeScript object types, as shown by `frontend/src/lib/runtime.ts` (`RuntimeSnapshot`).

## Code Style

**Formatting:**
- No dedicated formatter config is detected in the repository root, `backend/`, or `frontend/`; match the existing file-local style instead of introducing a new formatter profile.
- Use 4-space indentation in Python files, matching `backend/app/main.py` and `backend/app/core/runtime.py`.
- Use 2-space indentation, semicolons, and double-quoted strings in TypeScript files, matching `frontend/src/main.tsx`, `frontend/src/App.tsx`, and `frontend/src/lib/runtime.ts`.
- Use compact CSS blocks with one selector per block and multi-line property wrapping only when needed, matching `frontend/src/styles.css`.

**Linting:**
- No ESLint, Prettier, Biome, Ruff, or MyPy config files are detected.
- Treat `frontend/tsconfig.app.json` as the primary frontend static-quality gate: `strict`, `isolatedModules`, `forceConsistentCasingInFileNames`, and `noEmit` are enabled there.
- Treat `backend/pyproject.toml` as the current backend quality config source; it defines packaging metadata and `pytest` discovery, but it does not define lint rules.

## Import Organization

**Order:**
1. Standard-library imports first in Python modules, as shown by `backend/app/core/config.py` importing `functools.lru_cache`.
2. Third-party imports next, as shown by `backend/app/core/config.py` importing `pydantic` and `pydantic_settings`, and `frontend/src/main.tsx` importing `react` and `react-dom/client`.
3. Local application imports last, separated by a blank line, as shown by `backend/app/main.py`, `backend/app/api/routes/health.py`, and `frontend/src/App.tsx`.

**Path Aliases:**
- No TypeScript path aliases are configured in `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, or `frontend/tsconfig.node.json`.
- Use relative imports in the frontend, as shown by `frontend/src/App.tsx` and `frontend/src/main.tsx`.
- Use package-root imports in the backend with the `app.` namespace, as shown by `backend/app/main.py` and `backend/tests/test_health.py`.

## Error Handling

**Patterns:**
- Keep backend route handlers thin and derive response payloads from typed helpers, as shown by `backend/app/main.py` and `backend/app/api/routes/health.py` delegating to `resolve_runtime(get_settings())`.
- Return typed models or typed dictionaries from backend entrypoints instead of ad hoc structures, as shown by `backend/app/core/runtime.py` (`RuntimeSnapshot`) and `backend/app/main.py` (`dict[str, object]`).
- Use defensive frontend fallbacks around network boundaries, as shown by `frontend/src/lib/runtime.ts`, which catches fetch failures and returns `fallbackRuntimeSnapshot`.
- No centralized exception handler layer is detected; new error handling should stay local and explicit until a shared pattern exists.

## Logging

**Framework:** None detected

**Patterns:**
- No logging framework or `console` logging is present in `backend/app/` or `frontend/src/`.
- Prefer preserving the current quiet baseline unless a new feature introduces a documented logging requirement.

## Comments

**When to Comment:**
- Existing code relies on descriptive naming instead of inline comments, as shown across `backend/app/` and `frontend/src/`.
- Add comments only when a block would otherwise be hard to infer; the only current explicit comment-like guidance is the package docstring in `backend/tests/__init__.py`.

**JSDoc/TSDoc:**
- Not detected in `frontend/src/`.
- Not detected as Python docstrings on functions or classes in `backend/app/`.

## Function Design

**Size:** Keep functions small and single-purpose, matching `backend/app/api/routes/health.py` (`healthcheck`), `backend/app/main.py` (`root`), and `frontend/src/lib/runtime.ts` (`resolveBackendBaseUrl`).

**Parameters:**
- Prefer zero-argument accessors for cached or global configuration, as shown by `backend/app/core/config.py` (`get_settings()`).
- Pass a typed object instead of many primitive arguments when deriving runtime state, as shown by `backend/app/core/runtime.py` (`resolve_runtime(settings: Settings)`).

**Return Values:**
- Use explicit return annotations in Python, as shown by `backend/app/main.py` and `backend/app/api/routes/health.py`.
- Export typed promise-returning async helpers in TypeScript, as shown by `frontend/src/lib/runtime.ts` (`Promise<RuntimeSnapshot>`).

## Module Design

**Exports:**
- Use default exports for the top-level React component entry, as shown by `frontend/src/App.tsx`.
- Use named exports for shared frontend types, constants, and helpers, as shown by `frontend/src/lib/runtime.ts`.
- Keep backend modules narrowly scoped around one concern per file: config in `backend/app/core/config.py`, runtime derivation in `backend/app/core/runtime.py`, route wiring in `backend/app/api/routes/health.py`, and app assembly in `backend/app/main.py`.

**Barrel Files:**
- Python package `__init__.py` files exist in `backend/app/`, `backend/app/api/`, `backend/app/api/routes/`, `backend/app/core/`, and `backend/app/models/`, but they do not currently act as re-export barrels.
- No TypeScript barrel files are detected in `frontend/src/`.

---

*Convention analysis: 2026-04-01*
