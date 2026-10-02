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
- Push notifications not built yet (natural next step for "your bag is ready").

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
