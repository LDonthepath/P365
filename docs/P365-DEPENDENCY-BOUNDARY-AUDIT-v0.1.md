# P365 Dependency & Boundary Audit v0.1

**Status:** AUDITED — NO RUNTIME REFACTOR IN THIS CHECKPOINT  
**Date:** 2026-09-15  
**Repository:** `LDonthepath/P365`  
**Scope:** current `main` branch after `lib/` → `src/backend/` restructuring

---

## 1. Audit objective

This checkpoint answers one question:

> **Who is allowed to depend on whom?**

The goal is to make the repository easier to maintain and debug **without changing runtime behavior**.

This is an architecture audit, not a feature implementation.

---

## 2. Target dependency model

P365 should converge toward the following dependency direction:

```text
                    APP / PRESENTATION
                           │
                           ▼
                     APPLICATION
                           │
                 ┌─────────┴─────────┐
                 ▼                   ▼
              DOMAIN          INFRASTRUCTURE
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
                CoinGecko         FRED          Supabase
```

### Hard rules

1. **Domain must not import providers, databases, framework-specific infrastructure, or UI.**
2. **Infrastructure may depend on domain contracts/types when implementing them.**
3. **Application/orchestration may coordinate domain + infrastructure.**
4. **Presentation/UI should consume application-facing data, not assemble provider pipelines itself.**
5. **Provider adapters must not decide market meaning.**
6. **Persistence must not contain business interpretation.**
7. **A file with multiple architectural responsibilities is an audit hotspot even when runtime behavior is currently correct.**

---

## 3. Current repository shape

The current backend has been successfully moved under `src/backend/` while Next.js routes remain under `app/`.

```text
app/
  page.tsx
  login/
  dashboard/

src/backend/
  auth.ts
  data/
  domain/
```

The restructuring itself is directionally correct: the old `lib/` boundary has been removed and backend code now has an explicit home.

However, the internal dependency boundaries are **not yet clean**.

---

## 4. Findings

### FINDING-01 — DOMAIN → DATA dependency violation

**Severity:** HIGH  
**Classification:** BOUNDARY VIOLATION  
**File:** `src/backend/domain/normalize.ts`

`domain/normalize.ts` imports types directly from `../data/`:

- `../data/types`
- `../data/crypto-market`
- `../data/fred`
- `../data/federal-reserve-events`

This makes the domain layer aware of provider/data-layer shapes.

Current direction:

```text
DOMAIN normalize.ts
       │
       ▼
     DATA
```

This conflicts with the intended architecture:

```text
DOMAIN  ←  APPLICATION  →  INFRASTRUCTURE
```

### Why this matters

`normalize.ts` currently performs two different jobs:

1. transform provider-specific records into canonical domain records;
2. live inside the domain directory as if it were domain logic.

The first job is an **application/data-boundary concern**, not pure domain logic, because it knows provider DTOs.

### Decision

**Do not move it blindly.**

The correct future refactor is to separate:

```text
provider DTO
   ↓
adapter / mapper
   ↓
canonical domain input
   ↓
domain
```

The exact destination should be decided after the remaining dependency audit, so this checkpoint does not introduce an unnecessary multi-file migration.

---

### FINDING-02 — `dashboard-data.ts` is an orchestration hotspot

**Severity:** HIGH  
**Classification:** MULTI-RESPONSIBILITY / APPLICATION HOTSPOT  
**File:** `src/backend/data/dashboard-data.ts`

This file currently coordinates:

- Alpha Vantage news
- CoinDesk news
- Forex Factory calendar
- CoinGecko market observations
- FRED macro observations
- Federal Reserve events
- provider result normalization
- news deduplication
- calendar deduplication
- canonical transformation
- context construction
- Supabase Market Memory persistence
- provider health aggregation
- dashboard response assembly

It is effectively an **application service**, even though it lives under `data/`.

The file therefore represents the clearest candidate for a future `application/` boundary.

### Decision

**Do not refactor yet in this checkpoint.**

First establish canonical contracts and provider adapters. Then extract orchestration with behavior-preserving tests/checks.

---

### FINDING-03 — APP / PRESENTATION directly imports backend internals

**Severity:** MEDIUM  
**Classification:** PRESENTATION → INTERNAL BACKEND COUPLING

Current examples include:

- `app/page.tsx` → `@/src/backend/auth`
- `app/login/actions.ts` → `@/src/backend/auth`
- `app/dashboard/page.tsx` → `@/src/backend/auth`
- `app/dashboard/page.tsx` → `@/src/backend/data/dashboard-data`
- `app/dashboard/dashboard-view.tsx` → backend `data`, `domain`, and formatting modules

This is not necessarily wrong for the current small application, but it means the UI is aware of backend implementation details.

The strongest coupling is `dashboard-view.tsx`, which imports domain types and backend data/format modules directly.

### Desired future direction

```text
APP route
  ↓
application use-case / presenter contract
  ↓
backend internals
```

The UI should eventually receive a presentation-safe view model rather than knowing how observations, evidence, contexts, and providers are assembled.

### Decision

**DEFERRED.**

Do not introduce a presentation layer until the application boundary is defined.

---

### FINDING-04 — Infrastructure → Domain dependency is directionally correct

**Severity:** LOW  
**Classification:** ACCEPTED DEPENDENCY

`src/backend/data/market-memory-store.ts` imports domain types/contracts for persistence.

This direction is acceptable:

```text
Infrastructure
      │
      ▼
    Domain
```

The store contains persistence mechanics and does not define market meaning.

### Decision

**KEEP.**

No change required in this checkpoint.

---

### FINDING-05 — Domain context logic is currently acceptably isolated

**Severity:** LOW  
**Classification:** ACCEPTED FOR CURRENT SCOPE
**File:** `src/backend/domain/context.ts`

`context.ts` depends on domain types and domain contracts only. It groups canonical observations/events into neutral contexts and explicitly avoids regime, sentiment, liquidity-flow, capital-flow, or risk inference.

This is consistent with the current P365 reasoning boundary.

### Decision

**KEEP.**

The hardcoded macro grouping is a future domain-model question, not an immediate dependency problem.

---

### FINDING-06 — Baseline logic is domain-pure enough for the current contract

**Severity:** LOW  
**Classification:** ACCEPTED
**File:** `src/backend/domain/baseline.ts`

`baseline.ts` depends on domain types only and performs factual-baseline selection without provider knowledge.

This is the correct architectural direction.

### Decision

**KEEP.**

---

### FINDING-07 — Provider modules are still mixed with DTOs and fetch mechanics

**Severity:** MEDIUM  
**Classification:** INFRASTRUCTURE HOTSPOT

The `src/backend/data/` directory currently contains both:

- provider adapters/fetchers;
- shared data types;
- dashboard orchestration;
- persistence implementation;
- formatting.

Examples:

```text
alpha-vantage.ts          provider
coindesk-rss.ts           provider
crypto-market.ts          provider
fred.ts                   provider
federal-reserve-events.ts provider
 economic-calendar.ts     provider
 dashboard-data.ts        orchestration
 market-memory-store.ts   persistence
 format.ts                presentation helper
 types.ts                 DTO/view data types
```

The directory name `data/` therefore currently hides several distinct responsibilities.

### Decision

**DEFERRED until application/infrastructure boundaries are defined.**

Do not split folders solely for visual neatness.

---

## 5. Circular dependency assessment

### Confirmed from current source inspection

No explicit domain ↔ data cycle was found in the inspected dependency paths.

The more important problem is **directional coupling**, not a confirmed circular import.

The current problematic edge is:

```text
DOMAIN → DATA
```

rather than:

```text
DOMAIN → APPLICATION → INFRASTRUCTURE
```

### Status

**No confirmed circular dependency in this checkpoint.**

A complete automated import graph should be added later when the repository has a test/build environment suitable for it.

---

## 6. Responsibility map

| Area | Current location | Architectural role | Status |
|---|---|---|---|
| Next.js routes | `app/` | Presentation / route layer | ACCEPTED |
| Login/session | `src/backend/auth.ts` | Backend service / infrastructure-adjacent | HOTSPOT |
| Provider fetchers | `src/backend/data/*.ts` | Infrastructure | ACCEPTED, MIXED |
| Canonical mapping | `src/backend/domain/normalize.ts` | Adapter/application boundary | **WRONG LOCATION** |
| Domain contracts | `src/backend/domain/contracts.ts` | Domain | ACCEPTED |
| Context builder | `src/backend/domain/context.ts` | Domain | ACCEPTED |
| Baseline | `src/backend/domain/baseline.ts` | Domain | ACCEPTED |
| Market Memory model | `src/backend/domain/market-memory.ts` | Domain contract | ACCEPTED |
| Supabase store | `src/backend/data/market-memory-store.ts` | Infrastructure | ACCEPTED |
| Dashboard orchestration | `src/backend/data/dashboard-data.ts` | Application | **WRONG LOCATION** |
| UI formatting | `src/backend/data/format.ts` | Presentation helper | MIXED |
| Dashboard view | `app/dashboard/dashboard-view.tsx` | Presentation | COUPLED |

---

## 7. Dependency scorecard

| Boundary | Assessment |
|---|---|
| App → backend | PARTIAL / acceptable for current stage |
| Presentation → domain internals | TOO COUPLED |
| Application → domain | CONCEPTUALLY CORRECT |
| Application → infrastructure | CONCEPTUALLY CORRECT |
| Domain → infrastructure | NOT ALLOWED; no confirmed direct dependency in inspected files |
| Domain → data DTOs | **VIOLATION FOUND** |
| Infrastructure → domain | ACCEPTED |
| Provider → domain | SHOULD BE THROUGH CANONICAL ADAPTER CONTRACT |
| Persistence → business logic | CURRENTLY ACCEPTABLE |
| Provider → market interpretation | SHOULD REMAIN FORBIDDEN |

---

## 8. Recommended target structure

Do not implement all of this at once.

The target should eventually become:

```text
app/
  ... Next.js routes and UI

src/backend/
  domain/
    types.ts
    contracts.ts
    observation.ts
    evidence.ts
    event.ts
    context.ts
    baseline.ts
    market-memory.ts

  application/
    dashboard/
    market-foundation/
    briefing/

  infrastructure/
    providers/
      coingecko/
      fred/
      federal-reserve/
      alpha-vantage/
      coindesk/
      forex-factory/
    persistence/
      supabase/

  presentation/
    dashboard-view-model.ts
    formatting/

  auth/
```

This is a **target architecture**, not a command to create every directory now.

---

## 9. Refactor sequence

The next refactors must remain isolated:

### Checkpoint A — Provider DTO boundary

Separate provider-specific response shapes from canonical domain inputs.

Primary candidate:

```text
src/backend/domain/normalize.ts
```

Goal:

```text
Provider DTO → adapter mapper → canonical input
```

No reasoning changes.

---

### Checkpoint B — Application orchestration

Extract dashboard orchestration from:

```text
src/backend/data/dashboard-data.ts
```

into an application-facing use case/service.

Goal:

```text
App → Application → Domain + Infrastructure
```

No runtime behavior changes.

---

### Checkpoint C — Infrastructure grouping

Only after A and B are stable, reorganize provider and persistence modules.

Goal:

```text
Infrastructure
 ├── providers
 └── persistence
```

---

### Checkpoint D — Presentation boundary

Introduce a presentation-safe dashboard view model so the UI no longer imports domain internals merely to render the screen.

---

## 10. What must NOT happen next

Do **not**:

- move every file just to make folders look clean;
- create a full monorepo prematurely;
- add `services/`, `repositories/`, `adapters/`, `use-cases/` everywhere without contracts;
- change the canonical domain model during a folder migration;
- add Regime, sentiment, liquidity-flow, capital-flow, or trading logic;
- change provider selection;
- replace CoinGecko;
- make UI changes during the dependency cleanup;
- combine multiple architecture checkpoints into one commit.

---

## 11. Audit conclusion

The `lib/` → `src/backend/` restructuring was the correct first move, but it exposed the real architectural issue:

> **The repository has a physical backend boundary, but not yet a clean dependency boundary.**

The two highest-priority problems are:

1. `domain/normalize.ts` knows about `data/` provider DTOs.
2. `data/dashboard-data.ts` is actually an application orchestrator.

The next implementation checkpoint should therefore be **Provider DTO Boundary**, not a broad folder reorganization.

The repository should only proceed to the next refactor after this audit checkpoint is accepted and the existing runtime behavior remains unchanged.
