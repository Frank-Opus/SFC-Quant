---
created: 2026-04-01T13:18:40.611Z
title: Add bilingual UI and real market integration
area: general
files:
  - frontend/src
  - backend/app
  - backend/app/core/config.py
  - docker-compose.yml
  - .env.example
  - docs/runbooks/operator-runbook.md
---

## Problem

The current local ship is demoable, but it is still oriented around a single-language operator experience and mock-safe market flows. The user explicitly wants Chinese/English bilingual support with a runtime language switch, and wants the product to connect to real market data instead of relying only on mock data during operator demos and future production hardening.

This is cross-cutting work because it affects frontend copy and layout, backend/runtime configuration, operator runbooks, and the market/exchange integration path. If we do not capture it now, the project may keep improving the demo shell while missing two important product-level expectations: internationalized usability and live market realism.

## Solution

Implement a bilingual i18n layer with zh-CN / en language resources, persistent language preference, and a visible in-app language toggle. Audit dashboard labels, status surfaces, risk/operator controls, and strategy factory UX so they can switch cleanly without hardcoded strings.

In parallel, add a real-market mode that reads live exchange market data through the existing exchange/ccxt seam while preserving the current safe defaults. This should remain opt-in by configuration, keep paper trading as the default execution mode, and clearly expose whether the system is using mock data or real market feeds in diagnostics, health surfaces, and the dashboard.

Suggested breakdown:
- Frontend: introduce translation resources, locale state, and switchable copy in `frontend/src`
- Backend: add explicit real-market config flags and diagnostics in `backend/app`
- Runtime: preserve `mock-safe` default while supporting opt-in real market reads via exchange adapter
- Docs: update `.env.example`, README/runbooks, and operator acceptance steps for bilingual + real-market verification
