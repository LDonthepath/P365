# P365 Repository Architecture Migration v0.1

## Scope

Conservative repository layout cleanup. No product behavior or Phase 1 data semantics are changed.

## Target

```text
P365/
├── app/                    # Next.js route / presentation boundary
└── src/
    └── backend/
        ├── auth.ts
        ├── data/
        └── domain/
```

## Migration map

- `lib/auth.ts` → `src/backend/auth.ts`
- `lib/data/*` → `src/backend/data/*`
- `lib/domain/*` → `src/backend/domain/*`
- `app/*` remains unchanged because it is the Next.js App Router boundary.

## Rules

- Preserve behavior.
- Preserve environment variables.
- Preserve `server-only` boundaries.
- Preserve relative module relationships inside `data/` and `domain/`.
- Update only consumer import paths required by the move.
- Remove the obsolete `lib/` tree only after all imports are migrated.
- Run lint/build verification before completion.
