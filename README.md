# Villa Serenity — villa management prototype

A simple booking, guest and expense app for a small villa that can be booked two ways:
the **entire villa**, or **one room at a time**. Built mobile-first for an owner who is not
comfortable with technology.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Requires Node 20.9 or newer.

Sign in with the demo details shown on the sign-in screen (`owner@villaserenity.lk` /
`serenity2026`, set in `lib/auth.ts`).

> The sign-in is a prototype: the check happens in the browser and there are no real
> accounts. Replace `lib/auth.ts` with real authentication before storing real guest data.

There is no backend. Everything is mock data kept in the browser (localStorage), so
bookings you make stay after a refresh. **More → Villa settings → Reset sample data**
starts again.

## The booking rules

All of the availability logic lives in [`lib/availability.ts`](lib/availability.ts):

1. An entire-villa booking blocks every room for its dates.
2. Any room booking blocks the entire villa for its dates.
3. Different rooms can be booked for the same dates.
4. The same room can never be booked twice for overlapping dates.

A stay covers the nights from check-in up to (not including) check-out, so one guest can
check out in the morning and another can check in that afternoon.

```bash
npm run check:rules   # proves the rules and the five prototype scenarios against the demo data
```

The same check runs every time a booking is created or edited (`lib/store.tsx`), so a
conflicting booking cannot be saved from any screen.

## Where things are

| Path | What it is |
| --- | --- |
| `app/page.tsx` | Home: today's numbers, availability, check-ins and check-outs, payments pending |
| `app/login/page.tsx`, `lib/auth.ts` | Sign-in screen and the prototype session check |
| `app/bookings/new/page.tsx` | New booking in four steps, with live availability |
| `app/calendar/page.tsx` | Visual calendar: one row for the villa, one per room |
| `app/bookings`, `app/guests`, `app/expenses`, `app/money`, `app/rooms`, `app/settings` | The remaining pages |
| `components/villa-strip.tsx` | The "villa over its rooms" availability widget |
| `components/booking-sheet.tsx` | Booking details, check in/out, payments, edit, cancel |
| `components/ui/*` | Small shadcn-style building blocks (button, sheet, fields, badges) |
| `lib/seed.ts` | Demo data. Dates are offsets from today so the dashboard is always alive |
| `lib/finance.ts` | Monthly revenue, expenses, occupied nights |
| `app/globals.css` | Design tokens (colours, radius, shadows) |

## Demo data

Dates are seeded relative to the day you first open the app. Opened on 4 Oct 2026 they match
the brief exactly: Sarah Fernando has the entire villa Oct 10–13, Michael Wilson has Ocean
View Oct 15–18 and Kasun Perera has the Garden Room Oct 16–18.

## Photos

Room and villa photos are loaded from Unsplash (`lib/photos.ts`) and need an internet
connection; without one the app shows a plain warm tone instead. Photographers: Dinuka
Lankaloka, Antonio Araujo, Tran Vinh, X F. Replace them with the villa's own photos by
dropping files into `public/` and pointing `lib/photos.ts` at them.

## Not built (on purpose)

Accounting, payroll, inventory, dynamic pricing, channel manager / OTA APIs, multiple
properties, user permissions, notifications and real receipt storage (only the file name of
an attached receipt is kept).
