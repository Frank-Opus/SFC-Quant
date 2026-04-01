# Transfer To New Codex CLI

这份仓库已经整理成可迁移状态，给另一台机器上的 Codex CLI 接手时，按下面顺序即可。

## 1. 需要一起带走的内容

必须保留：

- 整个项目文件夹
- `.planning/`
- `AGENTS.md`
- `CLAUDE.md`
- `.codex/`  
  注意：它当前是未跟踪目录，但里面有本地 GSD / OpenSpec / skill 相关内容。  
  如果你是“复制整个文件夹”，它会一起过去。  
  如果你是“只靠 git clone”，它不会自动出现。

不需要强制带走：

- `.venv/`
- `frontend/node_modules/`
- `frontend/dist/`

这些都可以在新机器重建。

## 2. 新机器上的建议阅读顺序

1. `AGENTS.md`
2. `.planning/PROJECT.md`
3. `.planning/REQUIREMENTS.md`
4. `.planning/ROADMAP.md`
5. `.planning/STATE.md`
6. `.planning/HANDOFF.json`
7. `.planning/phases/01-foundation-local-runtime/.continue-here.md`
8. `.planning/phases/01-foundation-local-runtime/01-VERIFICATION.md`
9. `.planning/phases/01-foundation-local-runtime/01-HUMAN-UAT.md`
10. `TRANSFER_TO_NEW_CODEX.md`

## 3. 当前真实状态

- Phase 1 的 4 个计划都已经执行完
- backend 的 `pytest -q` 已通过
- frontend 的 `npm run build` 已通过
- 唯一未完成的是 Docker 环境下的人工验证

所以，**现在不要直接跳到 Phase 2**。

## 4. 新机器接手后的第一动作

如果新机器有 Docker：

```bash
cp .env.example .env
docker compose up --build
```

然后验证：

```bash
curl http://localhost:8000/health
```

预期：

- 前端能打开 `http://localhost:5173`
- 后端健康检查能打开 `http://localhost:8000/health`
- 返回包含：
  - `runtime_mode: "mock-safe"`
  - `live_trading_enabled: false`

## 5. 验证后怎么继续

如果验证通过：

- 更新 `01-HUMAN-UAT.md`
- 让 Codex CLI 继续完成 Phase 1 的正式收口
- 然后再进入 Phase 2

如果验证失败：

- 把报错贴给新的 Codex CLI
- 优先修 Docker / Compose / 启动问题
- 不要跳过这个验证门

## 6. 本次对话已经固化成哪些文件

- `.planning/HANDOFF.json`
- `.planning/phases/01-foundation-local-runtime/.continue-here.md`
- `.planning/reports/20260401-session-report.md`
- `.planning/phases/01-foundation-local-runtime/01-VERIFICATION.md`
- `.planning/phases/01-foundation-local-runtime/01-HUMAN-UAT.md`

这些文件就是“聊天摘要 + 项目状态 + 下一步动作”的替代品。
