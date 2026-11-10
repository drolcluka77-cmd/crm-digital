# Distribution Hub CRM — instructions for the Replit Agent

**Do not port, restructure or rewrite this project.** It is a single Next.js 14
(App Router) app at the repository root and must stay that way:

- Do NOT convert it into a pnpm monorepo, an `artifacts/` layout, a separate
  Vite frontend or a separate Express/API server.
- Do NOT move files out of the root, rename folders or replace Prisma.
- The source of truth is the GitHub repository (`main` branch). Code changes are
  made there and pulled into Replit with Git → Pull/Sync. Don't commit code
  changes from Replit unless the owner explicitly asks; if you must change
  something, keep it minimal and in place.

## How it runs
- Dev: `npx prisma db push --skip-generate && npm run dev` (port 3000), set in `.replit`.
- Deploy (Autoscale): build `npm install && npm run build`,
  run `npm run start:prod` (pushes the schema, seeds the admin if missing, starts Next).
- Database: Replit PostgreSQL (Database tool). `DATABASE_URL` is provided by Replit.
- Files: Replit Object Storage (create one bucket in the Object Storage tool).
  The app picks it automatically on Replit (`lib/upload.ts`).

## Secrets needed
`SESSION_SECRET`, `APP_URL`, `CRON_SECRET`, `BOOKING_WEBHOOK_SECRET`, optionally
`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SMTP_*`. Do not set `DATABASE_URL`
by hand — the Database tool provides it.

## If something fails
Report the exact error and file — don't rewrite the architecture to work around it.
