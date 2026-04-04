# Codebase Structure

**Analysis Date:** 2026-04-01

## Directory Layout

```text
[project-root]/
├── .planning/                 # GSD project state, phase artifacts, and generated codebase maps
├── backend/                   # Python FastAPI workspace
│   ├── app/                   # Application package
│   │   ├── api/routes/        # HTTP route modules
│   │   ├── core/              # Settings and runtime-resolution logic
│   │   └── models/            # Backend schema namespace placeholder
│   ├── tests/                 # Pytest smoke tests
│   ├── Dockerfile             # Backend container definition
│   └── pyproject.toml         # Backend package metadata and pytest config
├── frontend/                  # Vite React workspace
│   ├── src/                   # Browser entrypoint, UI shell, styles, and helpers
│   │   └── lib/               # Frontend integration helpers
│   ├── .dockerignore          # Frontend container build exclusions
│   ├── Dockerfile             # Frontend container definition
│   ├── package.json           # Frontend scripts and dependencies
│   └── vite.config.ts         # Vite configuration
├── openspec/                  # OpenSpec workspace scaffold
├── AGENTS.md                  # Repo-specific automation instructions
├── README.md                  # Local bootstrap and safety guidance
└── docker-compose.yml         # Two-service local runtime
```

## Directory Purposes

**`backend/`:**
- Purpose: Contain the Python control-plane workspace.
- Contains: `backend/app/`, `backend/tests/`, `backend/pyproject.toml`, `backend/Dockerfile`, and `backend/README.md`.
- Key files: `backend/app/main.py`, `backend/app/core/config.py`, `backend/app/core/runtime.py`, `backend/tests/test_health.py`.

**`backend/app/api/routes/`:**
- Purpose: Hold FastAPI route modules.
- Contains: Route registration modules such as `backend/app/api/routes/health.py` plus package markers in `backend/app/api/routes/__init__.py`.
- Key files: `backend/app/api/routes/health.py`.

**`backend/app/core/`:**
- Purpose: Hold backend-wide configuration and runtime helpers that route modules import.
- Contains: Environment-backed settings in `backend/app/core/config.py` and runtime classification in `backend/app/core/runtime.py`.
- Key files: `backend/app/core/config.py`, `backend/app/core/runtime.py`.

**`backend/app/models/`:**
- Purpose: Reserve the package location for shared backend schemas beyond the runtime snapshot.
- Contains: `backend/app/models/__init__.py` only.
- Key files: `backend/app/models/__init__.py`.

**`backend/tests/`:**
- Purpose: Store backend verification that exercises the public API surface.
- Contains: Pytest modules such as `backend/tests/test_health.py`.
- Key files: `backend/tests/test_health.py`.

**`frontend/`:**
- Purpose: Contain the browser workspace.
- Contains: `frontend/src/`, `frontend/package.json`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/Dockerfile`, and `frontend/.dockerignore`.
- Key files: `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/lib/runtime.ts`, `frontend/src/styles.css`.

**`frontend/src/`:**
- Purpose: Hold browser code that Vite compiles.
- Contains: The root component in `frontend/src/App.tsx`, bootstrap code in `frontend/src/main.tsx`, global styles in `frontend/src/styles.css`, and helpers in `frontend/src/lib/`.
- Key files: `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/styles.css`.

**`frontend/src/lib/`:**
- Purpose: Hold browser-side integration helpers that the UI shell imports.
- Contains: Runtime contract and fetch logic in `frontend/src/lib/runtime.ts`.
- Key files: `frontend/src/lib/runtime.ts`.

**`.planning/`:**
- Purpose: Hold project-level planning state and generated repository maps.
- Contains: Source-of-truth docs in `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, phase folders in `.planning/phases/`, and generated docs in `.planning/codebase/`.
- Key files: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`.

**`openspec/`:**
- Purpose: Reserve spec-driven workflow space separate from runtime code.
- Contains: `openspec/changes/`, `openspec/specs/`, and `openspec/changes/archive/` with no active spec files detected.
- Key files: `openspec/changes/`, `openspec/specs/`.

## Key File Locations

**Entry Points:**
- `docker-compose.yml`: Root runtime entry for the two-service local stack.
- `backend/app/main.py`: FastAPI application entrypoint.
- `frontend/src/main.tsx`: Browser bootstrap entrypoint referenced by `frontend/index.html`.
- `frontend/index.html`: Static HTML shell that mounts the Vite bundle into `#root`.

**Configuration:**
- `backend/pyproject.toml`: Backend package metadata, dependency list, and pytest configuration.
- `frontend/package.json`: Frontend scripts and dependency manifest.
- `frontend/vite.config.ts`: Vite dev/build host and plugin configuration.
- `backend/app/core/config.py`: Runtime environment contract for the backend.
- `.env.example`: Root environment template file is present; treat it as the operator-facing env contract and keep secrets in `.env` only.

**Core Logic:**
- `backend/app/core/runtime.py`: Runtime-mode derivation and warning generation.
- `backend/app/api/routes/health.py`: Public health endpoint for backend status.
- `frontend/src/lib/runtime.ts`: Browser-side health fetch helper plus fallback data.
- `frontend/src/App.tsx`: Current operator shell UI.

**Testing:**
- `backend/tests/test_health.py`: Backend smoke test for the health contract.
- `backend/pyproject.toml`: Declares `pytest` test discovery under `backend/tests/`.

## Naming Conventions

**Files:**
- Python modules use `snake_case.py`, such as `backend/app/core/config.py` and `backend/app/api/routes/health.py`.
- React component entry files use PascalCase for component-bearing modules, as in `frontend/src/App.tsx`.
- Frontend helper modules stay lowercase, as in `frontend/src/lib/runtime.ts` and `frontend/src/styles.css`.

**Directories:**
- Runtime code directories stay lowercase and layered by concern, such as `backend/app/api/routes/`, `backend/app/core/`, and `frontend/src/lib/`.
- Workspace roots use product boundaries rather than shared-package abstraction: `backend/` and `frontend/`.

## Where to Add New Code

**New Feature:**
- Backend endpoints: add route modules under `backend/app/api/routes/` and import them from `backend/app/main.py`.
- Backend shared logic: place config-adjacent or runtime-adjacent helpers under `backend/app/core/`; create a new subpackage under `backend/app/` only when the logic no longer fits `backend/app/core/`.
- Frontend feature surface: add feature modules directly under `frontend/src/` and keep `frontend/src/App.tsx` as the composition root until a router or feature shell exists.
- Tests: add backend API verification under `backend/tests/` using `test_<feature>.py` naming.

**New Component/Module:**
- Implementation: place reusable browser helpers in `frontend/src/lib/`; place visual or page-level modules under `frontend/src/` and import them into `frontend/src/App.tsx`.

**Utilities:**
- Shared helpers: use `backend/app/core/` for backend-wide helpers that multiple routes need, and use `frontend/src/lib/` for browser-side fetch or contract utilities.

## Special Directories

**`.planning/`:**
- Purpose: Store project planning state and generated architecture/reference docs.
- Generated: Yes
- Committed: Yes

**`frontend/dist/`:**
- Purpose: Store built frontend assets from `npm run build`.
- Generated: Yes
- Committed: No

**`frontend/node_modules/`:**
- Purpose: Store installed frontend dependencies.
- Generated: Yes
- Committed: No

**`backend/.pytest_cache/`:**
- Purpose: Store pytest cache metadata for local test runs.
- Generated: Yes
- Committed: No

**`openspec/`:**
- Purpose: Hold specification workflow artifacts separate from runtime code.
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-04-01*
