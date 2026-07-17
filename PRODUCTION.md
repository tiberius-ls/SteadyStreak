# Production readiness

SteadyStreak is production-capable for **manual escrow releases** with durable Postgres, hardened APIs, and an operator claims queue.

## Required environment (Vercel Production)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | **Yes** | Neon / Postgres. Production returns 503 without it. |
| `NEXT_PUBLIC_ESCROW_ADDRESS` | **Yes** | Your pool wallet (not the zero placeholder). |
| `OPERATOR_SECRET` | **Yes** for ops | Long random string. Unlocks `/operator` and mark-paid. |
| `NEXT_PUBLIC_ALLOW_DEMO` | No | Default off in production. Set `true` only for staging. |

## Health check

```text
GET https://steadystreak.vercel.app/api/health
```

Expect `"ok": true` and `"store": "postgres"`.

## Operator workflow

1. Users complete/break cycles and tap **Record claim**.
2. Claim is stored as `pending` in Postgres.
3. Open **https://steadystreak.vercel.app/operator**
4. Unlock with `OPERATOR_SECRET`.
5. Send NIM from escrow → user wallet for each total.
6. Paste release tx hash → **Mark paid**.

## Security model (v1)

| Layer | Behavior |
|-------|----------|
| Demo wallets | Disabled in production builds; rejected by APIs |
| Writes | Rate-limited per IP; address/amount validation |
| Claims queue | Operator secret required for list + mark-paid |
| Escrow keys | **Never** in the app — manual release |
| Savings privacy | Never stored on server |

## Not automatic (by design)

Automatic escrow sends need a secured server wallet (private key). That is a **future** upgrade. Production v1 uses the operator desk.

## Pre-launch checklist

- [ ] `DATABASE_URL` set (Production + Preview if needed)
- [ ] Real `NEXT_PUBLIC_ESCROW_ADDRESS`
- [ ] `OPERATOR_SECRET` set and stored offline
- [ ] `/api/health` → ok
- [ ] Real Nimiq Pay check-in works
- [ ] Claim appears on `/operator` after Record claim
- [ ] Demo button hidden on production site
- [ ] Escrow wallet funded only with pool funds

## CI

GitHub Actions runs `npm test`, `lint`, and `build` on push/PR.
