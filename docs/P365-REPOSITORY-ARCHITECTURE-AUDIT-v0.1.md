# P365 Repository Architecture Audit v0.1

## Status

Audit baseline for repository cleanup before further Phase 1 implementation.

## Objective

Reduce structural ambiguity and future maintenance/debugging cost without changing product behavior, data semantics, or roadmap scope.

## Current Architecture

P365 is currently a single Next.js application with:

- `app/` — routes, pages, dashboard UI, login UI, global CSS.
- `lib/` — mixed backend/domain concerns including auth, data providers, normalization, persistence, and shared types.
- `docs/` — architecture, contracts, audits, roadmap, and data requirements.
- root configuration files — Next.js, TypeScript, ESLint, environment example, package metadata.

The current structure is functional, but `lib/` is becoming a mixed responsibility container. This creates increasing discovery cost when debugging provider failures, domain logic, application orchestration, persistence, or authentication.

## Target Architecture

P365 should remain a single Next.js application for the current stage. Do **not** split it into separate `frontend/` and `backend/` applications yet.

The target separation is:

```text
P365/
├── app/                         # Next.js route / presentation boundary
│   ├── login/
│   ├── dashboard/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
│
├── src/
│   ├── domain/                  # domain concepts and pure rules
│   ├── application/             # use cases / orchestration
│   ├── infrastructure/          # external providers, database, config
│   ├── services/                # cross-cutting application services
│   └── shared/                  # generic utilities/constants
│
├── docs/
├── public/
├── tests/
└── root configuration files
```

## Layer Rules

### `app/`

Owns Next.js routing and presentation entry points. It may call application services, but should not contain provider-specific data access or domain reasoning.

### `src/domain/`

Owns P365 domain types, canonical concepts, normalization rules, contracts, and pure reasoning primitives. It must not depend on CoinGecko, FRED, Supabase, Next.js, or environment variables.

### `src/application/`

Owns use cases and orchestration. It coordinates domain logic and infrastructure interfaces without embedding provider-specific implementation details into domain code.

### `src/infrastructure/`

Owns external-world concerns: market providers, macro providers, news providers, database adapters, environment/config integration, and provider-specific transformations.

### `src/services/`

Owns cross-cutting services such as authentication/session and Market Memory service boundaries when those responsibilities are not themselves domain concepts.

### `src/shared/`

Owns genuinely generic utilities and constants. It must not become a second mixed `lib/` directory.

## Migration Principles

1. Behavior first: preserve existing behavior unless a separate change explicitly targets behavior.
2. One migration unit at a time.
3. Move files before redesigning their internals.
4. Update imports immediately after each move.
5. Preserve Next.js route conventions under `app/`.
6. Preserve server/client boundaries such as `server-only`.
7. Preserve environment variable names and deployment contracts.
8. Do not introduce `frontend/` and `backend/` applications during this cleanup.
9. Do not combine repository cleanup with Phase 1 data-model changes.
10. Verify every migration checkpoint before continuing.

## Initial Classification

| Current area | Target responsibility | Classification |
|---|---|---|
| `app/*` | Presentation / routing | KEEP IN `app/` |
| `lib/auth.ts` | Authentication service | MOVE TO `src/services/auth/` |
| `lib/data/*` provider adapters | Infrastructure | MOVE TO `src/infrastructure/providers/` |
| `lib/data/normalize.ts` | Domain normalization | MOVE TO `src/domain/` after dependency audit |
| `lib/data/types.ts` | Domain/application contracts | MOVE TO `src/domain/` after dependency audit |
| Market Memory persistence | Infrastructure/service boundary | MOVE TO `src/infrastructure/database/` and/or `src/services/market-memory/` based on dependency audit |
| `docs/*` | Architecture/documentation | KEEP |
| root config | Build/deployment | KEEP |

## Important Constraint

The audit identifies the target architecture. It does not authorize a blind bulk move of every file. Before migration, imports and dependency direction must be mapped so the cleanup does not create circular dependencies or break Next.js/Vercel deployment.

## Migration Sequence

```text
Audit
  ↓
Dependency Map
  ↓
Create Target Directories
  ↓
Move Domain Layer
  ↓
Move Infrastructure Providers
  ↓
Move Services
  ↓
Fix Application Imports
  ↓
Remove Obsolete `lib/`
  ↓
Build / Lint Verification
  ↓
Architecture Cleanup Complete
```

## Scope Boundary

This cleanup is repository architecture work, temporarily outside the Phase 1 roadmap. Phase 1 remains paused at the same logical checkpoint and will resume after the repository structure is stable.
