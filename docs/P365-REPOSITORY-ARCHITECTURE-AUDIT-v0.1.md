# P365 Repository Architecture Audit v0.1

## Status

Audit baseline for repository cleanup before further Phase 1 implementation.

## Objective

Reduce structural ambiguity and future maintenance/debugging cost without changing product behavior, data semantics, or roadmap scope.

## Current Architecture

P365 is currently a single Next.js application with:

- `app/` — routes, pages, dashboard UI, login UI, global CSS.
- `lib/` — mixed backend/domain concerns including auth, data providers, normalization, persistence, and domain concepts.
- `docs/` — architecture, contracts, audits, roadmap, and data requirements.
- root configuration files — Next.js, TypeScript, ESLint, environment example, package metadata.

The current structure is functional, but `lib/` is becoming a mixed responsibility container. The audit confirms that `lib/domain/` itself is not uniformly pure: `market-memory.ts` contains durable Supabase access, while `normalize.ts` depends on provider input types. Those two files therefore should not be treated as pure domain code.

## Target Architecture

P365 should remain a single Next.js application for the current stage. Do **not** split it into separate `frontend/` and `backend/` applications yet.

The conservative target is:

```text
P365/
├── app/                              # Next.js route / presentation boundary
│   ├── login/
│   └── dashboard/
│
├── src/
│   └── backend/
│       ├── domain/                   # pure P365 domain concepts/rules
│       ├── application/              # use cases / orchestration
│       ├── infrastructure/           # external providers + persistence
│       └── services/                  # auth and cross-cutting services
│
├── docs/
└── root configuration files
```

This first cleanup separates the entire backend-oriented codebase from the Next.js route layer while preserving existing internal module relationships. A later pass can refine `backend/data` into `infrastructure/providers`, `backend/application`, and `backend/services` once dependency boundaries are explicitly verified.

## Layer Rules

### `app/`

Owns Next.js routing and presentation entry points. It may call backend application/service boundaries, but should not contain provider-specific data access or domain reasoning.

### `src/backend/domain/`

Owns pure domain concepts, canonical types, contracts, baseline/context/state/intelligence rules, and other provider-independent reasoning primitives.

Domain code must not depend on CoinGecko, FRED, Supabase, Next.js, environment variables, or provider-specific input types.

### `src/backend/application/`

Owns use cases and orchestration such as assembling dashboard data. It coordinates domain and infrastructure concerns.

### `src/backend/infrastructure/`

Owns external-world concerns: market providers, macro/news/calendar providers, persistence adapters, and provider-specific normalization/transport code.

### `src/backend/services/`

Owns cross-cutting backend services such as authentication and Market Memory service boundaries.

## Migration Map

| Current area | Immediate target | Notes |
|---|---|---|
| `app/*` | `app/*` | KEEP; preserve Next.js routing contract |
| `lib/auth.ts` | `src/backend/auth.ts` | First-pass backend move; can later become `services/auth/` |
| `lib/domain/types.ts` | `src/backend/domain/types.ts` | Pure domain types |
| `lib/domain/contracts.ts` | `src/backend/domain/contracts.ts` | Pure domain guardrails |
| `lib/domain/baseline.ts` | `src/backend/domain/baseline.ts` | Pure domain baseline logic |
| `lib/domain/context.ts` | `src/backend/domain/context.ts` | Pure context grouping logic |
| `lib/domain/intelligence.ts` | `src/backend/domain/intelligence.ts` | Pure intelligence contract logic |
| `lib/domain/risk.ts` | `src/backend/domain/risk.ts` | Domain risk model; currently deferred by roadmap |
| `lib/domain/state.ts` | `src/backend/domain/state.ts` | Domain state model; currently deferred by roadmap |
| `lib/domain/market-memory.ts` | `src/backend/services/market-memory.ts` | Contains Supabase access; not pure domain |
| `lib/domain/normalize.ts` | `src/backend/infrastructure/normalization/normalize.ts` | Depends on provider input types |
| `lib/data/*` provider adapters | `src/backend/infrastructure/providers/` | External data access |
| `lib/data/dashboard-data.ts` | `src/backend/application/dashboard-data.ts` | Application orchestration |
| `lib/data/market-memory-store.ts` | `src/backend/infrastructure/database/market-memory-store.ts` | Persistence adapter |
| `lib/data/format.ts` | `src/backend/services/format.ts` | Shared presentation-facing helper; classify again later |
| `docs/*` | `docs/*` | KEEP |
| root config | root | KEEP |

## Migration Principles

1. Behavior first: preserve existing behavior unless a separate change explicitly targets behavior.
2. One migration unit at a time.
3. Move files before redesigning their internals.
4. Update imports immediately after each move.
5. Preserve Next.js route conventions under `app/`.
6. Preserve server/client boundaries such as `server-only`.
7. Preserve environment variable names and deployment contracts.
8. Do not introduce separate frontend/backend deployables during this cleanup.
9. Do not combine repository cleanup with Phase 1 data-model changes.
10. Verify every migration checkpoint.

## Immediate Migration Strategy

The first physical move will be deliberately conservative: relocate `lib/*` under `src/backend/*` while preserving its internal directory structure. This reduces path churn and allows the repository to become structurally clearer without simultaneously redesigning every dependency.

After that move is verified, a second architectural pass can refine:

```text
src/backend/
├── domain/
├── application/
├── infrastructure/
└── services/
```

That second pass is dependency-driven, not naming-driven.

## Migration Sequence

```text
Audit
  ↓
Conservative backend move (`lib` → `src/backend`)
  ↓
Consumer import migration
  ↓
Remove obsolete `lib/`
  ↓
Lint / Build verification
  ↓
Optional second-pass layer refinement
  ↓
Resume Phase 1
```

## Scope Boundary

This cleanup is repository architecture work, temporarily outside the Phase 1 roadmap. Phase 1 remains paused at the same logical checkpoint and will resume after the repository structure is stable.
