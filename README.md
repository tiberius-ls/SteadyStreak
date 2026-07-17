# SteadyStreak

**Habit tracking + safe NIM savings + competitive staking** — a [Nimiq Pay](https://nimiq.com/nimiq-pay) Mini App.

Every day you complete your habit, you send **one combined NIM transaction**:

| Part | Risk | Outcome |
|------|------|---------|
| **Save** | Zero | Always returned to you at cycle end |
| **Stake** | At risk | Forfeited to a shared pool if you break the streak |

Survivors who finish the full cycle split the forfeited stake pool with a streak multiplier.

## Live demo

| | |
|---|---|
| **App** | [https://steadystreak.vercel.app](https://steadystreak.vercel.app) |
| **Nimiq Pay deeplink** | `nimiqpay://miniapp?url=https://steadystreak.vercel.app` |
| **Health** | [https://steadystreak.vercel.app/api/health](https://steadystreak.vercel.app/api/health) |
| **Operator desk** | [https://steadystreak.vercel.app/operator](https://steadystreak.vercel.app/operator) |
| **Source** | [github.com/tiberius-ls/SteadyStreak](https://github.com/tiberius-ls/SteadyStreak) |

Production checklist and operator workflow: **[PRODUCTION.md](./PRODUCTION.md)**.

In a normal browser, open the app and use **Continue with demo wallet**.  
On a device with Nimiq Pay installed, use the deeplink to connect a real wallet.

## Why it fits Nimiq Pay

- Wallet connect via `@nimiq/mini-app-sdk` (`init()` + `listAccounts`)
- Daily check-in is a real **`sendBasicTransactionWithData`** (save + stake, tagged with cycle ID + day)
- Native confirmation dialogs inside Nimiq Pay — no browser extension friction
- Mobile-first UI designed for the embedded Mini App WebView

## Screens

1. **Onboarding** — connect wallet, pick habit, choose 30 / 60 / 90 days  
2. **Setup** — daily save & stake amounts, full-cycle commitment preview  
3. **Home** — **Mark done**, streak, days left, private savings, pool rank  
4. **Leaderboard** — public rank by streak only (never shows savings) + Bronze / Silver / Gold  
5. **Payout** — savings principal, stake pool share, start a new cycle  

## Core logic

- Check-in only counts if the tx confirms **before midnight local time**
- Missed day → streak breaks → stakes for that cycle move to the shared pool; **savings stay reserved**
- At cycle end for survivors:

```text
multiplier = min(3, streak_days / cycle_length * 3)
weight     = own_stake * multiplier
bonus      = total_forfeited * weight / sum(weights)
payout     = savings_principal + own_stake + bonus
```

Broken users receive **savings principal only**.

## Tech stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- `@nimiq/mini-app-sdk` for Nimiq Pay wallet integration
- Client `localStorage` for personal cycles / check-ins / payouts
- API routes for public leaderboard + shared stake pools
- Optional **Postgres** (`DATABASE_URL`) for durable leaderboard / pools (Neon-compatible)
- Deployable on Vercel

## Quick start

```bash
npm install
cp .env.example .env.local   # optional: escrow + DATABASE_URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo mode (browser)

If you are **not** inside Nimiq Pay, use **Continue with demo wallet**.  
Check-ins simulate NIM transactions so you can exercise the full product flow.

### Inside Nimiq Pay

1. Open the live deeplink: `nimiqpay://miniapp?url=https://steadystreak.vercel.app`  
   (or point at your own HTTPS host / tunnel)
2. Connect wallet → set habit & amounts → **Mark done** each day

## Environment

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_ESCROW_ADDRESS` | Nimiq address receiving daily save+stake txs |
| `DATABASE_URL` | Optional Postgres URL. When set, leaderboard + pools persist. When unset, in-memory (resets on cold start). |

### Durable store (recommended for production)

1. Create a free Postgres DB (e.g. [Neon](https://neon.tech) or Vercel Storage → Postgres).
2. Copy the connection string into `DATABASE_URL` (local `.env.local` and Vercel → Project → Settings → Environment Variables).
3. Redeploy. Schema tables are created automatically on first API request.
4. Confirm: `GET /api/leaderboard` returns `"store": "postgres"` (instead of `"memory"`).

## How payouts work (operator)

SteadyStreak splits **accounting** (in the app) from **money movement** (your escrow wallet).

| Step | Who | What happens |
|------|-----|----------------|
| Daily check-in | User | One NIM tx (save + stake) → **escrow** address |
| Cycle ends or breaks | App | Shows breakdown: savings, stake, pool bonus, total |
| Claim | User | Records the claim **in-app** (does not send NIM) |
| Release | **Operator** | Sends the total from **escrow** → user wallet in Nimiq Pay / Wallet |

### Who gets what

| Outcome | User receives from escrow |
|---------|---------------------------|
| **Broken streak** | Savings principal only (stake stays in the shared pool) |
| **Completed cycle** | Savings + own stake + share of forfeited pool (streak multiplier) |

Pool cohorts are `cycleLength + startDate` (e.g. all 30-day cycles that started the same local day). Survivors split forfeited stakes with:

```text
multiplier = min(3, streak_days / cycle_length * 3)
weight     = own_stake * multiplier
bonus      = total_forfeited * weight / sum(weights)
```

### Operator checklist

1. Hold the private keys for `NEXT_PUBLIC_ESCROW_ADDRESS` (never put them in this repo or the mini app).
2. After a user claims, confirm their Payout total and wallet address.
3. Send that NIM amount from the escrow wallet to the user.
4. Optionally keep a simple sheet of claim id / amount / release tx hash.

Escrow **releases are manual by design** in v1 so the website never holds pool keys. A future version could automate via a secured operator service or on-chain rules.

## Data model

- `users` — wallet address, id  
- `cycles` — length, start_date, daily save/stake, status, pool cohort  
- `checkins` — day_number, tx_hash, save/stake amounts  
- `stakes_pool` — poolId, total_forfeited  
- `payouts` — amount breakdown + claim reference  

Personal data lives on-device. Leaderboard / pool / forfeit / survivor rows live in the server store (Postgres when `DATABASE_URL` is set, otherwise process memory).

## Tier badges

| Tier | Streak |
|------|--------|
| Bronze | 7+ days |
| Silver | 21+ days |
| Gold | 45+ days |

## Scripts

```bash
npm run dev      # development
npm run build    # production build
npm run start    # serve production build
npm run lint     # eslint
npm test         # unit tests (streak break + payout math)
```

## License

[MIT](./LICENSE)

---

Built for the Nimiq Pay Mini Apps Framework.  
Live: [steadystreak.vercel.app](https://steadystreak.vercel.app) · Deeplink: `nimiqpay://miniapp?url=https://steadystreak.vercel.app`
