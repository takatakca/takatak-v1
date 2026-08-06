# TAKATAK V1 — Environment Matrix

| | Local dev | CI | Staging | Production |
|---|---|---|---|---|
| Auth | Optional; foundation mode with warning | Not configured | Real Supabase (staging project) | Real Supabase (prod project) |
| Database | Embedded Postgres / local | None (no live DB in CI) | Staging Supabase DB | Production Supabase DB |
| Foundation mode | Allowed (dev runtime) | n/a (build only) | Denied (auth configured) | **Denied**; explicit override exists but is unsafe and must stay off |
| Seed | Allowed, idempotent | Never runs | Allowed for demo data if desired (staging DB only) | **Guarded off** (`ALLOW_FOUNDATION_SEED` must stay false) |
| Health detail | Detailed (non-prod runtime) | n/a | Optional via flag | **Minimal** `{status,app}` |
| Provider creds | Never real | None | Test credentials only, after official docs | Real, one provider at a time, after verified tests |
| Test data | Demo/foundation | None | Demo allowed | **No demo data ever** |
