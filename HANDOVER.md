# FoodRescue — handover

Read this before making any change. It is the state of the project as of **2026-10-02**
(see `git log` for the latest commit; pushed to `github.com/AidanaAbdil/foodrescue`, branch `main`).
Also read `AGENTS.md` and `README.md`.

---

## 1. What this is

A "Too Good To Go"-style web app for **Kazakhstan**: cafés, bakeries and shops sell
unsold food in discounted **surprise bags**; customers order and pay online, then pick
the bag up during a time window by showing a short pickup code.

Two kinds of users:
- **Customers** browse, search, order and pay, see "My orders", cancel (refund before pickup starts).
- **Store owners** set up a store, add/edit/hide bags (with photos), see who's coming, mark orders
  collected. They **cannot order** (separate customer account needed).

**Next planned step: putting the site online** (see §9). After that: real Kaspi Pay / Halyk ePay.

---

## 2. Working with the user (important)

- **Beginner with dev tooling.** Explain in plain language, give exact copy-paste commands,
  say what each step does. Warn against things like `sudo git`.
- **Native Kazakh speaker** (also reads Russian). She reviews all Kazakh text — ask her, don't
  suggest an outside reviewer. When adding Kazakh strings, list them in a table for her review.
- **Git:** commit after each finished feature **and `git push` right after every commit**
  (her standing instruction). Never commit `.env`, `dev.db`, `uploads/`.
- **Never wipe her data.** Her own accounts exist in the local DB (a store owner with a store, and a
  customer). `npm run db:seed` is safe (only replaces the two demo accounts), but don't reset the
  database or delete users without asking. An earlier version of the seed deleted all users and
  wiped her account — she noticed.
- **Brand identity matters** to her: she rejected the original teal for looking like Too Good To Go
  and chose **Terracotta & Sage** (§6). Don't drift back toward TGTG's look.
- She decided: Kazakhstan only; Russian + Kazakh + English; online payment only; full refund only
  before pickup starts; sample stores in Almaty and Astana.

---

## 3. Running it

```bash
npm install            # also runs prisma generate
npm run dev            # http://localhost:3000
npm run db:seed        # refresh demo data (keeps real accounts)
npx prisma migrate dev --name <change> && npx prisma generate   # after editing schema.prisma
npx tsc --noEmit && npx eslint src prisma                       # run before every commit
```

- `.env` (git-ignored) contains only `DATABASE_URL="file:./dev.db"`. Optional settings:
  `PAYMENT_PROVIDER` (default `test`), `APP_URL` (site address for links in emails),
  `EMAIL_PROVIDER` (none yet → emails are printed in the `npm run dev` terminal),
  `TEST_REFUNDS_FAIL=true` (makes test refunds fail, to try the retry logic).
- **After a migration, restart `npm run dev`.** The Prisma client is cached on `globalThis` across
  hot reloads, so new tables are `undefined` until restart (`Cannot read properties of undefined
  (reading 'findMany')`). There is no `.env.example` yet (a permission check blocked copying `.env`;
  writing one from scratch is fine if wanted).
- **Demo accounts** (password `password123`): `customer@example.com` (Алия Нурланова),
  `owner@example.com` (Ерлан Сейтжанов, owns 4 sample stores: 2 Almaty, 2 Astana).

### Environment quirks (her Mac)
- Node **24.21** (Prisma 7 CLI needs ≥20.19; an old Node 20.17 caused crashes earlier). If you see
  `NODE_MODULE_VERSION` errors: `npm rebuild better-sqlite3`.
- **`head` is not the usual command** on this machine (it's a Perl HTTP tool). Use `sed -n 1,20p`.
- BSD tools: no `cat -A`; `sed -i ''` syntax. zsh: unquoted globs like `--include=*.tsx` fail.
- No Homebrew, no `gh` CLI. Git pushes over HTTPS with her stored credentials.
- `sqlite3` CLI does **not** enforce foreign keys unless you run `PRAGMA foreign_keys=ON;` first.

---

## 4. Stack — and "this is not the Next.js you know"

- **Next.js 16.3** (App Router, Turbopack), **React 19.2**, **Tailwind CSS 4**, **TypeScript**.
- **Prisma 7** with the `prisma-client` generator → `src/generated/prisma` (git-ignored),
  SQLite via `@prisma/adapter-better-sqlite3`. Config in `prisma.config.ts`.
- `AGENTS.md` says: read `node_modules/next/dist/docs/` before writing Next code. Things already
  relied on:
  - `params` / `searchParams` are **Promises**; typed with global `PageProps<"/route">`,
    `LayoutProps`, `RouteContext`.
  - `cookies()` / `headers()` are async; cookies can only be **set** in Server Actions / Route Handlers.
  - `redirect()` throws — keep it outside `try/catch`.
  - Server Action files (`"use server"`) may **only export async functions** (constants live in `src/lib`).
  - Server Action body limit raised to 5 MB in `next.config.ts` (photo uploads).
  - `public/` files are only reliably served if present at build time → uploads use a route handler.
  - Middleware is now called **proxy** (not used yet).
- No external auth/i18n/validation libraries — all hand-rolled and small (see below).

---

## 5. Architecture map

```
prisma/schema.prisma        User, Session, Store, SurpriseBag, Order, Payment (+ enums)
prisma/seed.ts              demo data (Almaty/Astana, tenge); only touches DEMO_EMAILS
src/app/                    pages; each folder is a URL
  page.tsx                  home: hero, search, city filter, near-me, categories, grid
  bags/[id]/page.tsx        bag details + ReserveForm
  orders/page.tsx           customer's orders (pending/upcoming/past), pay/cancel
  pay/test/[paymentId]/     TEST payment page (stand-in for Kaspi/Halyk)
  dashboard/…               store owner: stats, pickups, bag list, new/edit bag, store setup
  login/, signup/           auth pages (support ?next= return path)
  uploads/[file]/route.ts   serves uploaded photos
  not-found.tsx             localized 404
  actions/                  Server Actions: auth, orders, payments, dashboard, photos, locale
src/lib/
  session.ts                sessions, getCurrentUser (cached), requireUser/requireOwner, safeReturnPath
  password.ts               scrypt hashing (node:crypto)
  payments/service.ts       the payment state machine (holds, confirm, fail, cancel, refund)
  payments/provider.ts      provider interface + selection (PAYMENT_PROVIDER)
  payments/test-provider.ts fake provider
  uploads.ts                save/validate/delete/read photos in ./uploads
  format.ts                 price input parsing (tenge→tiyn), discount %
  geo.ts                    haversine km, coords parsing
  categories.ts             category emoji + list (names are in dictionaries)
  orders.ts                 MAX_PER_ORDER = 3
src/i18n/                   config, server (getI18n), client (useI18n), shared (formatters), dictionaries
src/components/             Header, MobileMenu, LanguageSwitcher, BagCard, StatCard, ReserveForm,
                            auth/*, dashboard/* (BagForm, PhotoField, StoreSetupForm, LocationPicker…),
                            search/NearMeButton
```

Pattern: **Server Components query Prisma directly**; mutations are **Server Actions** used as
form `action`s (work without JS too); client components only where interaction needs it.

---

## 6. Key decisions and conventions

### Money, time, units (Kazakhstan)
- Prices are **Int in tiyn** (1 ₸ = 100 tiyn). Owners type whole tenge (`1490`, `1 490`);
  `parsePrice` converts. Display: `f.price()` → "1 490 ₸" (no decimals).
- **All times are Kazakhstan time, UTC+5 (`Asia/Almaty`)**, regardless of server clock:
  parse form dates with `parseLocalDateTime`, "today" with `startOfToday()`, format with `f.time/f.day`.
  Never use `new Date(y, m, d)` / `toLocaleTimeString()` without the time zone.
- Distances in **km**; 24-hour clock.

### Languages (`src/i18n`)
- Locale from cookie `locale` (set by the РУС · ҚАЗ · ENG switcher), else `Accept-Language`, else **ru**.
  URLs are not localized (trade-off: weaker SEO for kk/en; could move to `/kk/...` later).
- `dictionaries/ru.ts` is the source of truth; `kk.ts` and `en.ts` are typed `Dictionary`, so
  **missing keys fail `tsc`**. Server: `const { dict, f, fill, plural } = await getI18n()`.
  Client: `useI18n()`. Server Actions return already-translated error strings.
- Placeholders `{n}`, `{store}` via `fill()`; plurals via `plural(n, forms)` (Intl.PluralRules;
  Russian needs one/few/many).
- **Kazakh grammar rules learned:**
  - Don't attach case endings to numbers/times in templates ("3-ге" is wrong, should be "3-ке";
    it varies). Rephrase instead, e.g. "Төлеу мерзімі: {time}".
  - Kazakh puts the number **inside** the sentence: stat labels are templates like
    `"Бүгін {n} тапсырыс берілді"`; `StatCard` renders text-before / big number / text-after.
- Glossary she chose for Kazakh: **дүкен** (store), **алып кету** (pickup), **тапсырыс беру**
  (to order), **тосын сый пакеті** (surprise bag), **Жеке парақша** (dashboard),
  tagline **"Тағам қоқысқа емес, дастарқанға лайық."**
- Russian search treats ё = е.

### Brand / UI
- Colors are tokens in `src/app/globals.css`: `brand` #c2553a (terracotta), `brand-dark` #8f3b26,
  `brand-light` #e3ebdd (soft sage), `accent` #5e7d5a (sage), page bg #faf6f1. Chosen to pass
  WCAG AA with white text; terracotta text on the page bg is too faint → use `brand-dark` there.
- Font Geist with `cyrillic` + `cyrillic-ext` (Kazakh letters).
- Header: inline links on `lg+`, ☰ `MobileMenu` below. Check layouts at 375 px width.

### Auth & sessions
- **Rate limiting** (`src/lib/rate-limit.ts`, `AuthAttempt` table): 5 wrong passwords per email /
  15 min, 20 failed logins per IP / 15 min, 3 reset emails per address / hour. The IP comes from
  `x-forwarded-for`, which is only trustworthy behind a hosting proxy that sets it.
- **Password reset**: `/forgot-password` → one-time link (`PasswordResetToken`, hashed, 1 hour) →
  `/reset-password?token=…`. Same reply whether or not the email exists. Resetting logs out all
  devices. Email goes through `src/lib/mailer.ts` (printed to the terminal until a provider is added).
- Random 32-byte token in an httpOnly cookie `session`; DB stores only its SHA-256 (`Session.tokenHash`),
  30-day expiry. `secure` only in production.
- Login uses one generic error message and a dummy hash for unknown emails (no account enumeration).
- `?next=` return paths pass through `safeReturnPath` (blocks `//evil.com`).
- Roles: CUSTOMER, STORE_OWNER (ADMIN exists in schema, unused). Sign-up can't create ADMIN.
- **Only customers can order** (her decision): store accounts see a notice instead of the order
  form, have no "My orders" (`/orders` redirects to `/dashboard`), and `reserveBag` refuses them.

### Orders & payments (`src/lib/payments/service.ts`)
```
order ──► PENDING_PAYMENT (bag held 15 min, Order.expiresAt)
            ├─ paid ─────────► RESERVED ──► COLLECTED (owner marks)
            │                    └─ cancel before pickupStart ─► CANCELLED + refund
            └─ declined / timed out ─► EXPIRED (stock released)
late payment on an EXPIRED order → re-take stock if available, else automatic refund
```
- **Every state change is a conditional `updateMany` (`where: { status: … }`)**, so double clicks,
  races and late callbacks can't oversell, pay, refund or release stock twice. Keep this pattern.
- Stock is held by decrementing `quantityAvailable` in the same conditional update that checks it.
- Expiry has **no background job**: `releaseExpiredHolds()` runs at the top of pages that show stock
  (home, bag page, orders, dashboard, pay page, reserveBag).
- When a hold expires the **Payment stays PENDING on purpose** (customer may still pay at the
  provider). This was a real bug found in testing — don't "tidy" it to FAILED.
- Provider interface: `createPayment`, `resumeUrl`, `refund`. Only `test` exists. It throws in
  production unless `ALLOW_TEST_PAYMENTS=true`.
- Pickup codes: 2 Latin letters (no I/O) + 4 digits, unique, shown only after payment.
- `paymentHousekeeping()` (called at the top of stock/order pages) releases expired holds and
  **retries failed refunds**; meanwhile the customer sees "refund in progress".
- Store dashboard shows only paid orders; "reserved" counts RESERVED+COLLECTED.

### Photos (`src/lib/uploads.ts`)
- Picked in `PhotoField`, shrunk in the browser (≤1600 px JPEG, EXIF rotation), uploaded immediately
  via `uploadBagPhoto`; URL travels in hidden `imageUrl`. Server checks magic bytes (JPEG/PNG/WebP),
  ≤4 MB, random UUID names, saves to `./uploads` (git-ignored), served by `/uploads/[file]` with
  immutable caching + `nosniff`. `saveBag` only accepts the bag's current photo or an existing
  upload; replaced/removed uploads are deleted, and uploads older than a day that no bag uses are
cleaned up whenever someone uploads. Sample data uses Unsplash (allowed in `next.config.ts`).

### Push notifications (stores and customers)
- Web Push (`web-push`), keys in `.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`;
  generated locally, git-ignored — a new server needs its own keys, and changing keys invalidates
  existing subscriptions). `PushSubscription` per device with its locale.
- `src/components/PushToggle.tsx` ("🔔 Notifications on this device") on /dashboard and on
  /orders (customers): asks permission, subscribes via the service worker, saves with
  `savePushSubscription`. iPhone needs the site installed to the Home Screen first (iOS 16.4+);
  the toggle checks that first. Waiting for the service worker times out after 10 s (registers it if
  missing) and failures are shown in red, never silently. When on, a "Test" link sends a test
  notification to that device only (`sendTestPush`).
- Customers: `storeCancelOrder` (store "Can't hand over" or admin) → `notifyStoreCancelled` →
  "Order CODE cancelled · {store} can't hand over… full refund", opens /orders.
- `confirmPayment` → `notifyNewOrder` (src/lib/push.ts) → "🔔 New order CODE · bag × n · pickup …"
  to all the owner's devices; tapping opens /dashboard (`public/sw.js`, cache `offline-v3`).
  Expired subscriptions (404/410) are deleted. Sending never breaks a payment.
- The service worker is now registered in development too (push needs it).
- Verified with a real (non-headless) Chrome window: notification arrived via FCM. Headless Chrome
  has no push service.
- Header shows "Dashboard (n)" for owners with paid orders waiting today (admins: "Admin (n)" stores
  to review); `src/lib/header-counts.ts`. `LiveCount` polls `/api/counts` every 15 s and on tab focus
  and calls `router.refresh()` when the number changed; order/review actions call `refresh()` so
  the header redraws at once (a `redirect` to the same page alone keeps the old header).
- Push only reaches the owner of the store whose bag was ordered: test with your own store's bag.
- This is the start of the "staff app" direction she chose; next: a "pack N bags" reminder before
  pickup (needs a scheduled job on the server), customer notifications.

### Account, store contact, store-side cancel, error screens (2026-10-02)
- `/account` (`AccountForms`, `src/app/actions/account.ts`): change name, email (password needed),
  password (logs out other devices via `deleteOtherSessions`), and delete the account: refused while
  paid orders are waiting (as customer or at own stores); otherwise wipes name/email/password/consent
  (`deletedAt` set, email → `deleted-<id>@deleted.invalid`), deletes sessions/favourites/reset
  tokens, hides the owner's stores/bags/schedules, keeps orders/payments anonymously.
- Store `phone` (required in the form, normalised to +7…, `src/lib/phone.ts`) and `openingHours`;
  call links on store/bag/order pages; dashboard reminder when missing.
- Owner dashboard pickups: "Can't hand over" (`storeCancelOrder`, full refund, no restock,
  `Order.cancelledBy`) and "Didn't show up" (`markNoShow`, status NO_SHOW, only after pickup start,
  no refund); both confirm first (`ConfirmSubmit`). Admin shows per-customer no-show counts.
- `src/app/error.tsx` (translated, `retry` prop in Next 16), `global-error.tsx`, `loading.tsx`.
  Note: with `loading.tsx`, pages stream, so `redirect()` during rendering arrives as a 200 with a
  `<meta http-equiv="refresh">` instead of a 307. Browsers follow it; tests must look for it.

### Cities, map & store list
- `Store.city` holds a code from `src/lib/cities.ts` (ALMATY, ASTANA; names in `dict.cities`,
  shown via `cityName`). Store form uses a select; `saveStore` rejects anything else. Existing
  free-text cities were converted by two migrations (SQLite `lower()` is ASCII-only, hence the
  second, Cyrillic one). To add a city: `CITIES` + `cities` in each dictionary.
- Store form map: `MapPicker` → `StoreMap` (Leaflet + react-leaflet, client-only via
  `next/dynamic`, OpenStreetMap tiles, CSS divIcon pin, neutral credit). Tapping/dragging sets
  lat/lng; a point picks its city (`cityAt`, 50 km); changing city clears an out-of-city pin.
  At scale switch tiles to a provider (2GIS is the local favourite; needs an API key).
- Address ↔ map (`src/lib/geocode.ts`, actions in `src/app/actions/geocode.ts`, owners only):
  OpenStreetMap Nominatim via our server (1 req/s, cached, identifying User-Agent — its policy
  forbids search-as-you-type). "Find on map" expands abbreviations (пр./ул./мкр…), searches inside
  the city's box and only accepts results whose city matches (same-named streets exist in Kaskelen
  etc.); otherwise asks to place the pin manually. Tapping the map suggests the street address
  (auto-fills an empty field). Live suggestions + better house data → 2GIS Suggest/Geocoder API
  at launch (needs a key; paid after a demo month).
- Homepage "All stores" lists every approved store in the city (search matches names), with
  "N bags on sale" / "Next bag …" / "No bags right now"; sorted by bags, then next bag, or distance.
- Her `~/.npm` cache has root-owned files (old `sudo`), so `npm install` fails with EACCES. She can
  fix it with `sudo chown -R 501:20 ~/.npm`; until then install with `--cache <some temp dir>`.

### Store pages, sold out & favourites
- `/stores/[id]`: store info, map link, regular bags with "Next bag" (`nextWindow` in
  src/lib/schedules.ts), available bags, and today's sold-out bags. Reachable even when everything
  is sold out; non-approved stores only for owner/admin.
- Homepage keeps today's sold-out bags in a greyed "Already sold out" section (same filters).
- `Favorite` (userId+storeId). `FavoriteButton` (customers only; logged out → login link) on store
  and bag pages; `/favorites` lists favourite stores with current bags or the next bag time.
  Header shows "Favourites" for customers. Notifying favourites about new bags = later (push).

### New-order alerts & regular bags
- Dashboard `NewOrderAlert` polls `/dashboard/updates` (owner-only JSON: newest paid order) every
  10 s → pop-up, `router.refresh()`, 🔔 in the tab title, optional Web-Audio chime (button; choice in
  localStorage). No email/push yet.
- `BagSchedule` = a regular bag (weekdays "1,…,7" ISO, start/end "HH:MM" Almaty, quantity per day).
  `publishScheduledBags()` (src/lib/schedules.ts) creates the SurpriseBag for today and tomorrow;
  `@@unique([scheduleId, scheduleDate])` prevents duplicates. Runs via `runHousekeeping()`
  (src/lib/housekeeping.ts), which replaced direct `paymentHousekeeping()` calls in pages.
- Editing a schedule deletes its upcoming, not-yet-ordered bags and re-publishes; pause hides them
  (ordered bags stay on sale); delete removes them and unlinks ordered ones (`untouchedUpcoming`).
- Photos can be shared by a schedule and its bags → always use `deleteUploadIfUnused`.
- `BagForm` has `mode`: "new" (Once/Regularly switch) · "bag" · "schedule".

### Store approval & admin
- `Store.status` PENDING → APPROVED / REJECTED (+ `rejectionReason`). New stores start PENDING; only
  APPROVED stores' bags reach the homepage, bag pages (owner/admin can preview) and `reserveBag`.
  Saving a REJECTED store's details puts it back to PENDING. Existing stores were set APPROVED by
  the migration.
- `/admin` (role ADMIN, `requireAdmin`): approve/reject/hide stores (reason required, owner sees it
  on the dashboard), and "cancel & refund" paid orders a store can't hand over (`adminCancelOrder`,
  no restock). Header shows "Admin (n)" with the pending count.
- Make an admin: sign up normally, then `npm run make-admin -- email` (refuses store-owner accounts;
  `--remove` reverts). Seed adds a demo admin `admin@example.com` (password123).
- Test gotcha: admin pages also contain the Log out form — pick forms by content, not position.

### Legal pages & consent
- `/privacy` and `/terms` render `src/content/legal/{ru,kk,en}.ts` (DRAFTS with `[placeholders]` for
  the ИП details and contact email; lawyer review needed; `LEGAL_IS_DRAFT` shows a draft note).
- Sign-up requires a consent checkbox; `User.consentAt/consentVersion` record it. `ConsentBanner`
  asks logged-in users without the current `LEGAL_VERSION` to agree (`acceptTerms`). Bump
  `LEGAL_VERSION` when the texts change meaningfully.
- `rich()` in `src/i18n/rich.tsx` puts links inside translated sentences (cases differ per language).
- The terms promise a full refund if a store can't hand over an order → admins can cancel+refund.

### Food labels
- `SurpriseBag.isHalal / isVegetarian / isVegan` + `allergens` (comma-separated codes from
  `ALLERGENS` in `src/lib/labels.ts`). Vegan ⇒ vegetarian (enforced in `saveBag`). Chips via
  `FoodLabels`; homepage filters `?halal=1&veg=1&vegan=1`; the bag page always shows an allergy note.
- Pickup windows may cross midnight (end before start = next day), max 12 hours.

### Location / search
- Customers: "Near me" = browser geolocation → `?near=lat,lng` (3 decimals) → sorted by km.
- Owners set store coordinates with "use my current location" (setup form, dashboard banner, or the
  store edit page `/dashboard/stores/[id]/edit`, linked from the store names on the dashboard).
  No address geocoding.
- Filtering happens in JS after one query (fine at current scale; move to SQL when large).

### Security checklist used everywhere
Ownership checks inside every owner action (`store: { ownerId: user.id }`), server-side validation
of every field, prices/amounts computed on the server, no user-supplied URLs rendered by `next/image`.

---

### Installable app (PWA)
- Option 1 of 3 she chose (PWA now; a store app via Capacitor or a native app later). Manifest in
  `src/app/manifest.ts` (localized description), icons generated by `npm run icons`
  (`scripts/generate-icons.mjs`, uses local Chrome; rerun after a rebrand), `appleWebApp` + `viewport`
  (white theme colour, `viewportFit: "cover"`) in `src/app/layout.tsx`, safe-area padding on header/footer.
- `public/sw.js`: network-only for pages, falls back to `public/offline.html` (static, trilingual,
  icon drawn inline). **Bump `CACHE` in sw.js when changing it.** Registered only in production
  (`ServiceWorkerRegistration`). `/sw.js` is served with no-cache headers; site-wide security headers
  live in `next.config.ts`.
- `InstallHint` (homepage only): tip for iPhone/iPad Safari users, dismissal stored in localStorage.
- Tested in headless Chrome: no manifest/installability errors, service worker controls the page,
  offline page shown when the server is killed with `kill -9` (a graceful stop keeps serving open
  keep-alive connections and fools the test), iPhone tip shows/dismisses, not shown on Android.
- Customer push: only "store can't hand over" so far; "pickup starts soon" reminders are next.

### Demo link (current way to show the app)
- `npm run demo` (`scripts/demo.mjs`): `next build` + `next start -p 3001` with `DEMO=true`,
  `PAYMENT_PROVIDER=test`, `ALLOW_TEST_PAYMENTS=true`, then a Cloudflare quick tunnel
  (`~/.local/bin/cloudflared`, official signed/notarized binary) → random `*.trycloudflare.com`
  HTTPS link. `DEMO=true` shows a demo banner (`footer.demo` text), adds noindex meta and a
  disallow-all `robots.txt`. Verified through the tunnel: private files (.env, dev.db, code, .git)
  all 404; login/order/pay work; session cookie is Secure.
- She runs it herself in her own terminal so she controls when the link is open.

## 7. How things were tested (no test suite in the repo yet)

- `npx tsc --noEmit` + `npx eslint src prisma` before every commit.
- End-to-end scripts (Node `fetch`) that submit the **real forms the way a no-JS browser does**:
  fetch the page, copy the form's hidden `$ACTION_*` inputs, add fields, POST with `redirect: "manual"`,
  carry the `session` cookie. Used for auth, reservations (incl. 6 parallel orders for the last bag),
  dashboard ownership, i18n pages in all 3 locales, and all payment paths.
- Headless Chrome via the DevTools protocol (`--remote-debugging-port`) for screenshots, geolocation
  override, and file uploads (`DOM.setFileInputFiles`). Check `document.documentElement.scrollWidth`
  for horizontal overflow at 375 px.
- Gotcha: the first `<form>` on many pages is the **language switcher**, and a hidden **Log out**
  submit button exists in the mobile menu — select forms/buttons precisely in scripts.
- Clean up test users/bags/uploads afterwards (they were). Those scripts were not saved to the repo;
  turning them into a real test suite (e.g. Playwright) would be valuable.

---

## 8. Known gaps / TODO

Fixed on 2026-10-02: store editing, login rate limiting, password reset, refund retries,
abandoned-upload clean-up, and a first production build (`npm run build` passes; `next start`
smoke-tested).

**Planned for the next session** (her "must-haves" not done yet): earnings reports for stores
(sold per day/week/month, what they'll be paid), an automated test suite (Playwright: ordering,
payments/refunds, admin, owner actions), and link previews (Open Graph images/titles for bag and
store pages, so shared links show a card in WhatsApp/Telegram).

Still open:
- **Not deployed.** SQLite file + local `uploads/` folder only.
- **Email**: no provider connected (reset links print to the terminal). Connect one (e.g. Resend)
  in `src/lib/mailer.ts` before launch, and set `APP_URL`.
- **Real payments**: needs her ИП, a live HTTPS site, a Kaspi Pay contract (Kaspi's API also requires
  an IPSec VPN tunnel from the server) and/or Halyk ePay (use its hosted payment page to avoid PCI DSS).
  Then add a provider in `src/lib/payments/` + a webhook route calling `confirmPayment`/`failPayment`
  (verify signatures!). With `PAYMENT_PROVIDER=test` in production, ordering fails with a plain
  500 error by design (no stock is held).
- No background jobs: expiries, refund retries and upload clean-up run during page requests.
  Fine at this size; use a scheduled job once deployed.
- **Store notifications:** push for new orders is built (see "Push notifications for stores").
  Still to do from the staff-app idea: She prefers a **staff app** approach (like Too Good To Go's store app): staff
  install the app on a phone/tablet, get push notifications for new orders and a "pack N bags
  today" reminder before pickup, and confirm pickups there. Telegram bot was discussed as an
  alternative; cash-register (POS) integration only for big chains, much later. Needs the site
  deployed (push needs an always-on server with HTTPS).
- Features not built yet: push/email/SMS notifications, admin tools, store time zones (all UTC+5),
  favourites, public store pages, address geocoding, automated test suite (Playwright).
- Localized URLs for SEO (`/kk/…`) if search ranking matters.
- Kazakh strings for **payments**, **photos**, **password reset**, **store editing** and
  **rate limiting** were written by Claude and sent to her for review — check for corrections.

## 9. Next step: deployment (researched, paused on 2026-10-02)

She paused deployment to **choose a new brand name** first ("FoodRescue" doesn't work well in
Kazakh/Russian). Don't deploy until she decides; then rename everywhere (logo, metadata, all three
dictionaries, emails, README) and put the name in one constant.

**Name candidates** (.kz free per `whois -h whois.nic.kz` on 2026-10-02; re-check before buying):
Jarty (жарты, "half"), Qalmasyn (қалмасын, "let nothing be left"), Keshki (кешкі, "evening"),
Tamaq Saqta, Obal Bolmasyn, Artyq As. Taken: obal, saqta, saqtau, artyq, dastarqan, kesh, obalemes.
Claude suggested Jarty or Qalmasyn and a trademark check at Kazpatent.

**Decisions already made:**
- First goal is a **demo site** (test payments, clearly marked), not a public launch: she has no ИП yet.
  For the demo set `ALLOW_TEST_PAYMENTS=true` and hide it from search engines (noindex).
- **Host on a VPS in Kazakhstan.** Kazakhstan's personal-data law (Law No. 94-V, Art. 12(2)) requires
  databases with personal data to be stored in Kazakhstan; .kz domains must also point to servers in
  Kazakhstan and use HTTPS; Kaspi's API needs a fixed IP for its VPN. So no Vercel/EU hosting.
  (Advise her to confirm the legal details with a lawyer/accountant when registering the ИП; the law
  was amended in Nov 2025.)
- VPS to rent (she buys it): PS.kz or Hoster.kz (Almaty/Astana), **Ubuntu 24.04 LTS, ≥2 GB RAM**,
  1–2 vCPU, 25 GB+ SSD, **public IPv4** (not IPv6-only), ~3 000 ₸/month. Domain from a Kazakh registrar.
- An SSH key was created on her Mac for this: `~/.ssh/foodrescue_ed25519` (public half
  `foodrescue_ed25519.pub`, to paste into the provider's order form). Never ask for passwords in chat;
  if needed she runs `ssh-copy-id -i ~/.ssh/foodrescue_ed25519.pub root@IP` herself.

**Planned setup on the VPS** (Claude does it over SSH, explaining each step):
1. Run `npm run build` locally first (it passes as of 2026-10-02).
2. Keep SQLite + the uploads folder on the VPS disk at first (persistent, simplest), but outside the
   app folder (e.g. `/srv/<app>/data`): make the upload folder configurable (currently
   `process.cwd()/uploads` in `src/lib/uploads.ts`) and point `DATABASE_URL` there.
3. Deploy by `rsync` from her Mac (no GitHub credentials on the server), then on the server:
   `npm ci`, `npx prisma migrate deploy`, `npm run build`, restart.
4. Run the app with systemd (auto-restart on crash/reboot), Caddy in front for automatic HTTPS
   (Let's Encrypt), a firewall allowing only SSH/80/443.
5. Daily backups of the database (`sqlite3 .backup`) and uploads, keeping ~2 weeks.
6. Production env: `NODE_ENV=production`, `DATABASE_URL`, `APP_URL`, `PAYMENT_PROVIDER=test` +
   `ALLOW_TEST_PAYMENTS=true` (demo only), later `EMAIL_PROVIDER`.
7. Later, at scale or for the real launch: Postgres, object storage for photos (a Kazakh provider,
   to respect data localization), real email, Kaspi/Halyk.
