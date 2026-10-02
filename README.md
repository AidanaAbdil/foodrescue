# FoodRescue

Rescue surplus food from local stores at a discount. Stores list "surprise bags" of unsold food; customers reserve them and pick them up during a time window.

Built with Next.js 16 (App Router), React 19, Tailwind CSS 4, and Prisma 7 with SQLite.

## Getting started

Requires Node.js 20.19+ (22 or 24 LTS recommended).

```bash
npm install                 # install packages (also generates the Prisma client)
                            # create a .env file that sets DATABASE_URL (see prisma.config.ts)
npx prisma migrate dev      # create the local database
npm run db:seed             # fill it with sample stores and bags
npm run dev                 # start the site at http://localhost:3000
```

Demo accounts (password `password123`):

- `customer@example.com`: a customer
- `owner@example.com`: owns the sample stores

## Useful commands

| Command              | What it does                                              |
| -------------------- | --------------------------------------------------------- |
| `npm run dev`        | Start the development server                              |
| `npm run db:seed`    | Reset the sample data (pickup times are relative to now)  |
| `npm run db:migrate` | Apply changes made in `prisma/schema.prisma`              |
| `npm run db:studio`  | Browse and edit the database in your browser              |
| `npm run lint`       | Check the code for common mistakes                        |

## Project layout

```
prisma/schema.prisma   database tables (users, stores, bags, orders, sessions)
prisma/seed.ts         sample data
src/app/               pages (each folder is a URL) and server actions
src/components/        reusable UI pieces
src/lib/               helpers: database client, sessions, passwords, formatting
```
