# v1.2 Release Validation Report

Date: 2026-04-01
Milestone: v1.2 SFC-Quant Release Hardening

## Scope Verified

- `SFC-Quant` branding is now the primary user-visible product identity.
- First-run locale defaults to Simplified Chinese via the new release-specific storage key.
- Default startup requests real market data while execution remains explicitly `paper`.
- Backend and frontend both surface requested source, effective source, and runtime state truthfully.
- Browser-driven walkthrough coverage exists and is repeatable locally.

## Validation Commands

### Automated checks

```bash
python3 -m pytest -q backend/tests
npm run build
docker compose config >/dev/null
PLAYWRIGHT_BROWSERS_PATH=/Users/suhui/.cache/ms-playwright npm run e2e:release
```

Results:

- `python3 -m pytest -q backend/tests` -> `34 passed`
- `npm run build` -> passed
- `docker compose config >/dev/null` -> passed
- `npm run e2e:release` -> passed (`1 passed`)

### Local runtime acceptance

```bash
docker compose --env-file .env.example up --build -d
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/health/ready
curl http://127.0.0.1:8000/api/diagnostics/summary
curl http://127.0.0.1:5173
```

Observed runtime state during validation:

- `/health` reported `execution_mode=paper`
- `/health` reported `market_data.mode=real`
- `/health` reported `requested_source=ccxt`
- `/health` reported `effective_source=ccxt`
- `/health` reported `status=live`
- frontend title rendered as `SFC-Quant`

## Browser Validation Notes

### Native Agentic Browser attempt

The local `infsh` CLI was available, but the current guest account/store inventory did not expose the `agentic-browser` app:

- `infsh me` returned a guest user/team
- `infsh app list --search browser -l` returned `No apps found`
- `infsh app run agentic-browser ...` returned `App not found`

This was a toolchain availability issue, not a product-runtime failure.

### Equivalent browser walkthrough used for release acceptance

A local Playwright release test was added and executed successfully:

- file: `frontend/tests/release.spec.ts`
- config: `frontend/playwright.release.config.ts`

The walkthrough covered:

1. Chinese-first landing experience
2. `SFC-Quant` title and hero visibility
3. explicit `paper` / market-source / system-status truth on first screen
4. zh/en language switching
5. analysis trigger
6. paper dispatch trigger
7. strategy factory enablement
8. strategy artifact generation

## Security / Hygiene Checks

- Secret-pattern scan across tracked files returned no committed `sk-...` or `ghp_...` credentials.
- Release docs were updated to keep secrets out of frontend code and committed source.

## Conclusion

v1.2 is locally validated and ready for milestone archive / ship handoff. The only noted gap was the unavailable `infsh` Agentic Browser store app under the current guest account; equivalent browser automation passed through local Playwright execution.

