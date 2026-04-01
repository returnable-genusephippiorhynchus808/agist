# Agist Roadmap

---

## v0.1.0 — MVP (shipped)

- [x] Hono HTTP API (companies, agents, routines, runs, issues)
- [x] SQLite persistence via sql.js (WAL mode, auto-save every 30s)
- [x] Scheduler: cron-based routine heartbeats (30s check interval)
- [x] Claude CLI adapter: spawn, stream stdout, parse tokens, estimate cost
- [x] WebSocket live log viewer (subscribe per agent or wildcard `*`)
- [x] SSE events for agent status and run completion
- [x] Next.js 16 dashboard (shadcn/ui, Tremor charts, React Flow org chart)
- [x] Seed script with Acme Corp demo data

---

## v0.2.0 — Stability & Security (shipped)

- [x] API key authentication (`X-Api-Key` header)
- [x] RBAC: admin vs readonly API keys
- [x] Rate limiting on mutating endpoints
- [x] CORS configurable via `CORS_ORIGINS` env var
- [x] Input length validation on prompt field
- [x] Fix double `spent_monthly_cents` update in adapter
- [x] Fix DB auto-save interval cleanup on shutdown

---

## v0.3.0 — Pagination & Filtering (shipped)

- [x] Pagination on all list endpoints (`?page=&limit=`)
- [x] Filter agents by status, model, role, search
- [x] Filter runs by status, source, date range
- [x] `GET /api/routines` — global routines list
- [x] `DELETE /api/agents/:id/runs` — bulk run cleanup
- [x] Run TTL: configurable auto-delete (`RUN_TTL_DAYS`)
- [x] Sort options on agents and runs lists

---

## v0.4.0 — Observability, Multi-Adapter & Governance (shipped)

- [x] Structured JSON logging with configurable `LOG_LEVEL`
- [x] `X-Request-Id` correlation header
- [x] Prometheus-compatible metrics at `/api/metrics`
- [x] Multi-adapter: Claude CLI, Anthropic API, OpenAI, Mock
- [x] Structured output parsing with confidence scoring
- [x] Context capsules (static, dynamic, composite) with versioning
- [x] Daily digest auto-generation (23:00 UTC)
- [x] Approval gates (pending/approved/rejected workflow)
- [x] Cross-agent signal bus (typed signals, consume/unconsumed tracking)
- [x] Wake chains (agent-to-agent triggering, max depth 5)
- [x] Company templates (import/export, 3 built-in templates)
- [x] Webhooks with HMAC signature
- [x] Audit log
- [x] CLI: `npx agist setup/start/status/logs`
- [x] Docker + Docker Compose + Caddy reverse proxy
- [x] 780+ unit/integration tests + 59 E2E tests

---

## v0.5.0 — Agent Intelligence & Write Discipline (shipped)

- [x] Agent permission model (autonomous / supervised / readonly / custom)
- [x] Permission inheritance: Company > Agent
- [x] Auto-gate creation for supervised agents on destructive actions
- [x] Write discipline: signal dedup, content-hash guard, output quality gate
- [x] Capsule staleness tracking with human-readable labels
- [x] Capsule manifest (pointer-based index sorted by priority)
- [x] Memory consolidation engine (gate-stack scheduler: 24h + 5 runs + lock)
- [x] Capsule version pruning (keep last 10, older replaced with pointer)
- [x] Digest compaction (>30 days to summary-only)
- [x] Run log tiering (7d full / 30d truncated / 30+d metadata)
- [x] Silent system runs (hidden from dashboard by default)
- [x] Standardized `AdapterDef` interface
- [x] Budget cache + webhook cache for scheduler performance
- [x] Mutual exclusion between manual and auto capsule updates
- [x] Audit log with decision reasons
- [x] E2E test DB isolation (temp DB per test run)
- [x] Agent activity feed on dashboard
- [x] 782+ tests

---

## v0.6.0 — Visual Workflows & Agent Chains (next)

- [ ] Visual workflow builder (drag-and-drop agent chains)
- [ ] Conditional wake: if agent A output contains X, wake agent B
- [ ] Parallel execution: run multiple agents concurrently
- [ ] Workflow templates (predefined multi-agent pipelines)
- [ ] Workflow run history with per-step status

---

## v0.7.0 — Multi-User & Teams

- [ ] Multi-user authentication (email/password + invite flow)
- [ ] Team roles: owner, admin, member, viewer
- [ ] Per-user audit trail
- [ ] SSO / OAuth integration
- [ ] User-scoped API keys

---

## v0.8.0 — Capsule Intelligence

- [ ] LLM-powered capsule consolidation (Anthropic API)
- [ ] Capsule relevance-gated injection (top-N per run)
- [ ] Capsule versioning UI in dashboard
- [ ] Cross-company capsule sharing
- [ ] Capsule templates

---

## v0.9.0 — Marketplace & Extensibility

- [ ] Public agent marketplace / template registry
- [ ] Plugin system for custom adapters
- [ ] Custom webhook event types
- [ ] Agent SDK (programmatic agent creation)

---

## v1.0.0 — Production-Ready GA

- [ ] better-sqlite3 migration (native, synchronous)
- [ ] DB migration system (versioned SQL files)
- [ ] Scheduled DB backups
- [ ] Complete user-facing documentation site
- [ ] GitHub Releases with signed tarballs
- [ ] 95%+ test coverage
