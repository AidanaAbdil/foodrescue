# Automated tests

These tests use the site in a real Chrome window (hidden) the way people do:
they order and pay, cancel, hand over orders, sign up a store, approve it, and
check that nobody can see or change what isn't theirs.

## Run them

```
npm test
```

The first lines show the site being built (about a minute). Then each test
gets a ✓ (passed) or ✘ (failed). Run them before every commit that changes
how the site works.

- **Your data is safe.** The tests use their own database, `test.db`, which is
  deleted and refilled with the demo data on every run. `dev.db` is never touched.
- They build into `.next-test` and run on port 3100, so `npm run dev` and
  `npm run demo` can keep running.

## When a test fails

`npm run test:report` opens a page in the browser showing every step of the
failed test: screenshots, clicks and what the page looked like.

## Files

- `helpers.ts`: create accounts, stores, bags and paid orders; log in; buy a bag
- `customer.spec.ts`: ordering, paying, declining, cancelling, refunds
- `store.spec.ts`: handing over, "can't hand over", "didn't show up", earnings, new store sign-up and approval, regular bags
- `access.spec.ts`: who may see and do what, login limits
- `home.spec.ts`: search, tabs, "Show more", languages, link previews
