# Villa Stay Manager

A booking, guest and expense app for small villas, run as a monthly-subscription service for
many villas at once.

- **Villa Admin** (the customer) signs in at `/login` and manages one villa: bookings (entire
  villa or room by room), calendar, guests, expenses, amenities, rooms, invoices.
- **Super Admin** (the platform owner) signs in at `/admin/login` and manages the customers:
  villas, admin accounts, manual subscription status, and who has access.

Each villa is a separate tenant. A villa admin can only ever reach their own villa's data.

## Run it

You need Node 20.9 or newer and a MySQL or MariaDB server (XAMPP's MySQL is fine).

```bash
npm install
copy .env.example .env.local     # macOS/Linux: cp .env.example .env.local
npm run db:setup                 # creates the database, tables and first accounts
npm run dev
```

Open http://localhost:3000.

`.env.local` holds the database settings. The defaults (`root`, no password, database
`villa_management` on `127.0.0.1:3306`) match a standard XAMPP install; change them if yours
differ. The database and tables are also created automatically the first time the app is
used, so `db:setup` is optional. `npm run db:reset` wipes everything and starts again from the
sample data.

### Accounts created on first run

| Who | Where | Email | Password |
| --- | --- | --- | --- |
| Super Admin | `/admin/login` | `admin@villaplatform.lk` | `superadmin2026` |
| Villa Serenity (full sample data) | `/login` | `owner@villaserenity.lk` | `serenity2026` |
| Ocean Breeze Villa | `/login` | `admin@oceanbreeze.lk` | `oceanbreeze2026` |
| Palm Garden Villa (payment due) | `/login` | `admin@palmgarden.lk` | `palmgarden2026` |
| Lagoon Edge Villa (disabled) | `/login` | `admin@lagoonedge.lk` | `lagoonedge2026` |

The Super Admin email and password come from `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in
`.env.local`. **Before going live:** set your own Super Admin password, and set
`SEED_DEMO=false` so the sample villas are not created.

While developing (`npm run dev`) the villa sign-in form is pre-filled with the Villa Serenity
account. Production builds do not pre-fill anything.

## How access works

```
Villa Admin signs in  ->  is the user active?  ->  is the villa active?  ->  allowed
```

| User | Villa | Result |
| --- | --- | --- |
| Active | Active | Allowed |
| Disabled | Active | Blocked |
| Active | Disabled | Blocked |
| Disabled | Disabled | Blocked |

Both checks run on **every** request, not only at sign-in, so switching a villa or a user off
takes effect at once (their sessions are also ended). A blocked admin sees "Access temporarily
unavailable" with the support contact from Super Admin → Settings, and nothing about payments.

A villa admin sees their own subscription on the home screen and in the **Subscription** tab
(plan, monthly amount, status, next payment date and every payment recorded), read-only. Internal notes stay with the Super
Admin.

Payment status (Active / Payment due / Overdue) and access (Active / Disabled) are separate.
Villas pay by card through Dodo Payments (next section); there is no "Mark as paid" any more.

## Card payments (Dodo Payments)

Each villa admin pays the villa's monthly amount by card from their **Subscription** page. The
card form is Dodo's own checkout page; card details never reach this app.

**Setup**

1. In the Dodo dashboard, create an API key (Developer → API Keys).
2. Add a webhook (Developer → Webhooks) pointing to `https://<your-site>/api/webhooks/dodo`,
   subscribed to the `subscription.*` and `payment.*` events. Copy its signing key (`whsec_...`).
3. Put both in `.env.local` with `DODO_PAYMENTS_ENVIRONMENT` and `APP_URL` (see `.env.example`).
   Start in `test_mode` with test keys and Dodo's test cards, then switch to `live_mode` with
   live keys and a live webhook.

Until both keys are set, the Subscription page says card payments are not set up yet.

**What happens**

- The app creates one Dodo product per monthly amount (in LKR) the first time it is needed, and
  reuses it. Changing a villa's amount moves its card subscription to the new price from the
  next charge; nothing is charged at that moment.
- Payments are recorded by themselves from Dodo's webhooks, and Dodo sets the next payment date
  (it cannot be edited for a villa paying by card).
- A failed renewal only changes the payment status (Payment due / Overdue); access stays on while
  Dodo retries. The villa admin can update the card from the Subscription page.
- When Dodo cancels or expires the subscription, access switches off by itself. The villa admin
  can still sign in, but sees only "Your subscription has ended" with a button to pay again.
  Access comes back as soon as the new payment goes through. Nothing is deleted.
- A villa the Super Admin disables by hand stays off whatever Dodo says.
- Webhooks are checked against the signing key, each one is handled once, and the subscription
  is always re-read from Dodo, so retries and out-of-order delivery are safe.

## Security, in short

- **Tenant isolation is enforced on the server.** `requireVillaAdmin()` in
  `lib/server/auth.ts` takes the villa from the signed-in user's own database row. No API
  accepts a villa id from the browser, and every villa table is keyed by `(villa_id, id)`, so
  a record id from another villa simply does not exist for you.
- **Roles are separate doors.** `/api/villa/*` needs a villa session, `/api/admin/*` needs a
  Super Admin session; they use different cookies and a villa account cannot sign in to the
  admin area or the other way round.
- **Passwords** are stored only as salted scrypt hashes. Sessions are random tokens in
  httpOnly, SameSite=Lax cookies (HTTPS-only in production); only a hash of the token is
  stored. Repeated wrong passwords lock that email for ten minutes.
- **Booking rules are checked again on the server** (double bookings, villa versus room,
  check-in and check-out times, no check-out with a balance), inside a transaction that locks
  the villa, so two requests cannot both take the same nights.
- Changes are accepted only as JSON from the app's own origin.

Not included yet, and worth adding before real customers: HTTPS and a reverse proxy,
database backups, an email-based password reset, and rate limiting that survives a server
restart (the current lock is kept in memory).

## The booking rules

In `lib/availability.ts`, used by both the screens and the server:

1. An entire-villa booking blocks every room for its dates.
2. Any room booking blocks the entire villa for its dates.
3. Different rooms can be booked for the same dates.
4. The same room can never be booked twice for overlapping dates.
5. On a changeover day, the leaving guest's check-out time cannot be later than the arriving
   guest's check-in time.

```bash
npm run check:rules   # proves the rules against the sample data (no database needed)
```

## Where things are

| Path | What it is |
| --- | --- |
| `lib/server/schema.ts` | Database tables: villas, users, sessions, subscription_payments, activity_log, platform_settings, and the per-villa tables |
| `lib/server/auth.ts` | Password hashing, sessions, `requireVillaAdmin()` / `requireSuperAdmin()` |
| `lib/server/tenant.ts` | Everything a villa admin can read or change, always filtered by villa |
| `lib/server/admin.ts` | Everything the Super Admin can read or change, with the activity log |
| `lib/server/seed.ts` | First-run accounts and sample villas |
| `app/api/auth/*`, `app/api/villa/*`, `app/api/admin/*` | The API routes |
| `proxy.ts` | Sends browsers with no session cookie to the right sign-in page |
| `lib/store.tsx` | Villa screens' data: loads from the API, shows changes at once, saves them in order |
| `app/admin/*`, `components/admin/*`, `lib/admin-store.tsx` | The Super Admin area |
| `app/*` (everything else) | The villa app: home, calendar, bookings, guests, expenses, money, rooms, amenities, settings, documents |
| `lib/availability.ts`, `lib/finance.ts` | Booking rules and monthly figures, shared by browser and server |

## Database tables

`villas` (profile, plan, monthly amount, `subscription_status`, `account_status`, start and
next payment dates, internal notes) · `users` (`villa_id`, `role` = `super_admin` or
`villa_admin`, `status`, `last_login_at`; several admins can belong to one villa) · `sessions`
· `subscription_payments` (amount, payment date, period covered, note, who recorded it) ·
`activity_log` · `platform_settings` · and per villa: `rooms`, `guests`, `bookings`,
`expenses`, `amenities`.

## Not built (on purpose)

Online payments, automatic suspension, email sending, logo or image uploads, accounting,
channel-manager integrations and multiple subscription plans with different features (the
`plan` field is a label only).
