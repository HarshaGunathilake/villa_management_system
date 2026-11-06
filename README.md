# LankaStay

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
While the status is **Payment due** or **Overdue**, the villa is read-only: the admin can still
sign in and see everything, and can pay, but cannot add bookings or change anything else
(guests, check-in and check-out, expenses, rooms, amenities, settings). The server refuses every
change (`403 payment_due`, in `requireVillaCanEdit()`), and the screens show why. It is editable
again as soon as the status is Active, whether Dodo confirms a payment or the Super Admin sets it.
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

- **One price for every villa**, set in Super Admin → Settings → Subscription. New sign-ups and
  villas you add get it, and it cannot be set per villa. Changing it moves every villa to the new
  price; villas paying by card are charged it from their next payment, nothing extra at that
  moment (Dodo "change plan", no proration).
- The app creates one Dodo product per price (in LKR) the first time it is needed, and reuses it.
- Payments are recorded by themselves from Dodo's webhooks, and Dodo sets the next payment date
  (it cannot be edited for a villa paying by card).
- A failed renewal changes the payment status to Payment due / Overdue, so the villa is read-only
  (see above) while Dodo retries. The villa admin can update the card from the Subscription page;
  once the charge goes through, it is editable again by itself.
- When Dodo cancels or expires the subscription, access switches off by itself. The villa admin
  can still sign in, but sees only "Your subscription has ended" with a button to pay again.
  Access comes back as soon as the new payment goes through. Nothing is deleted.
- A villa the Super Admin disables by hand stays off whatever Dodo says.
- Webhooks are checked against the signing key, each one is handled once, and the subscription
  is always re-read from Dodo, so retries and out-of-order delivery are safe.

## Landing page

`/` is the public landing page (`app/page.tsx`): Features, Pricing, About us and Contact us, with
**Sign in** and **Register** in the top bar. The name, price, support email and phone, and whether
sign-ups are open come from Super Admin → Settings. The villa dashboard is at **/dashboard**.

## Sign-up (SaaS)

Anyone can create a villa account at **/register** (linked from the sign-in page): villa name,
location, their name, email, phone and password, and a Terms box.

- The account opens **locked**. The owner is signed in straight away but sees only "Start your
  subscription" with a button to pay the first month by card. Nothing in the villa can be seen or
  changed until then; the server refuses it (`403 subscription_ended`, `firstPayment: true`).
- When Dodo confirms the first payment, the villa opens by itself and its subscription starts
  that day. From then on it works like any other villa.
- In the Super Admin area these villas show as **Awaiting first payment** (a filter on the Villas
  page). You can still disable one by hand, or enable it without payment if you want to.
- **Anyone can sign up** in Super Admin → Settings switches sign-ups off; the Register page then
  says sign-ups are closed.
- Each address can sign up at most 5 times an hour, and an email can only be used once.
- Set `NEXT_PUBLIC_TERMS_URL` and `NEXT_PUBLIC_PRIVACY_URL` to link the Terms box to your pages.

Code: `app/register/page.tsx`, `app/api/auth/register/route.ts`, `lib/server/signup.ts`. A
signed-up villa is `account_status = 'disabled'` with `disabled_reason = 'unpaid'`.

## Email and passwords

Email is set up in **Super Admin → Settings → Email**: SMTP server, port, connection security,
username, password and sender. The password is encrypted (AES-256-GCM) with `APP_SECRET` before
it is saved, and is never sent back to the screen. **Send test email** checks the settings.

- **Email confirmation**: a villa owner who signs up gets a link by email and sees only
  "Confirm your email" until they click it; every villa route answers `403 email_unverified`,
  the payment routes included. They can resend the link (5 an hour) or correct a mistyped
  address. Links last 24 hours and only the newest works; a password reset link also counts.
  Villas you add yourself are confirmed already, and you can confirm an owner by hand on the
  villa's Owner login tab. Switch it off in Settings → Subscription.
- **Forgot password** (on both sign-in pages) emails a one-time link. It expires after 1 hour,
  works once, and signs the account out everywhere. The form gives the same answer whether or
  not the email has an account, and is rate-limited.
- **Change password**: villa owners in Settings (works while a payment is due), the Super Admin
  in Super Admin → Settings. Other devices are signed out.
- **Emails to villa owners**, each with an on/off switch: welcome (sign-up, or a villa you add),
  payment received, payment failed (renewal declined, Dodo retrying), subscription ended.
  They are sent after the response, so a slow mail server never holds up a sign-up or a
  webhook, and a failed email never fails the action.
- Every attempt is kept in `email_log` and the latest show under Settings → Email.

Set `APP_URL` in production so the links in emails point to your site.

Code: `lib/server/mail.ts` (settings, sending, log), `lib/server/emails.ts` (the emails),
`lib/server/passwords.ts`, `app/forgot-password`, `app/reset-password`.

## Super Admin area

- **Dashboard**: monthly income, sign-ups, villas awaiting the first payment, card problems.
- **Villas**: each villa has an **Owner login** tab (add, edit, reset password, switch off).
- **Subscriptions**: every subscription with its Dodo status, next charge, last payment and
  total paid; search, filters, a payment history per villa, and CSV export.
- **Reports**: income, sign-ups versus paid, first payments and cancellations by month; CSV.
- **Activity**: the full log, searched and filtered by villa, type and date on the server; CSV.
- **Settings**: platform, subscription price and sign-ups, email, your password.

## Search engines and AI answers (SEO and AEO)

- Public pages (home, features, pricing, about, contact, register) are indexable, each with
  its own title, description, canonical address and share card. Everything behind sign-in is
  `noindex` and blocked in `robots.txt`.
- `/sitemap.xml`, `/robots.txt` and `/llms.txt` (a plain summary for AI assistants) are built
  per request from `APP_URL` and the Settings, so the price and contact details always match.
- Structured data (JSON-LD): Organization, WebSite, SoftwareApplication with the LKR price,
  FAQPage on Features and Pricing, AboutPage, ContactPage and breadcrumbs.
- Set `APP_URL` to the real domain (e.g. `https://lankastay.lk`) in production, then add the
  site to Google Search Console and Bing Webmaster Tools and submit `/sitemap.xml`.

**Super Admin → Settings → Website** has two switches:
- **Let search engines index the website.** Off: every page says `noindex`, `robots.txt` blocks all
  crawlers, the sitemap is empty and `/llms.txt` is gone.
- **Coming soon page.** On: every public page (home, features, pricing, about, contact,
  register) shows a Coming soon page with a "Tell me when it opens" form, new sign-ups are refused,
  and nothing is indexed. Villa owners and the Super Admin can still sign in, and a signed-in Super
  Admin sees the real pages with a thin "Coming soon is on" bar. The waiting list is shown under
  the switches, with CSV export (table `waitlist`).

Code: `lib/server/seo.ts`, `app/robots.ts`, `app/sitemap.ts`, `app/llms.txt/route.ts`.

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

Not included yet, and worth adding before real customers: database backups, and rate limiting
that survives a server restart (the current limits are kept in memory).

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
`activity_log` · `platform_settings` · `password_resets` and `email_verifications` (hashed one-time tokens) · `email_log` · and per villa: `rooms`, `guests`, `bookings`,
`expenses`, `amenities`.

## Not built (on purpose)

Email sending (so no email verification or password reset by email yet), logo or image uploads, accounting,
channel-manager integrations and multiple subscription plans with different features (the
`plan` field is a label only).
