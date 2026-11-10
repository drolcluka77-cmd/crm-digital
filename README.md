# Digital Products Distribution CRM

A sales CRM for a distribution centre that sells digital products (Unbusyness and its
editions, Arrive, and anything you add later) through a team of sellers.

## Who does what

| Role | Where they work | What they can do |
|---|---|---|
| **Admin** | Console (`/admin`) | Everything: build the product catalog (products, editions, plans & prices, sales playbook), upload sales materials, create managers & sellers, decide who sees which product, company & email settings. |
| **Sales manager** | Console (`/admin`) | Sees their own team only: creates seller accounts, chooses which products each seller sees, transfers leads when someone leaves, follows the team's pipeline, wins and commissions. |
| **Seller** | Seller CRM (`/crm`) | Only sees products assigned to them: product playbooks, materials, leads & customers, activity timeline, follow-ups, quotes, commission. |

## What's in it

**Catalog (admin)**
- **Products and editions.** Each product has a *family* (e.g. `Unbusyness`), so
  *Unbusyness*, *Unbusyness for Building Managers* and *Unbusyness for Tradespeople*
  appear together. Use **Duplicate** to create a new edition from an existing one.
- **Plans and pricing** per product: one-time, monthly or yearly, with a "per" unit
  (per building, per user, per bed).
- **Sales playbook** per product: elevator pitch, key benefits, ideal customer and
  qualifying questions, objection handling, and links to the website and live demo.
- **Commission %** per product. It's calculated on the first-year net value of accepted quotes.
- **Show or hide** a product for all sellers at once.

**Sales materials (admin)**
- Upload PDFs, decks, videos and images, and/or add links (YouTube, Loom, Google Slides,
  live demo). Each material is attached to a product, or marked *General* so every seller sees it.
- **Internal only** materials (scripts, battle cards) can be read by sellers but never sent to clients.
- Files are kept in private storage (`storage/`, not `public/`). Sellers can only open
  materials for products they have access to.

**Product access (admin & managers)**
- **Product access** page: a grid of sellers × products. Ticking a box saves
  immediately, and *all / none* applies a product to the whole team.
- You can also set access from a seller's card (*Team → Products*) or from the
  product page (*Who can sell this*).

**Seller CRM**
- **Today:** follow-ups due or overdue, "hot" clients who just opened a material you
  sent, leads that have gone quiet, pipeline, wins this month and your commission.
- **My products:** a playbook page per product with the pitch (one-click copy),
  benefits, questions, objections, prices, materials, an *Open demo* button and your leads for it.
- **Customers:** detailed B2B records (company, segment, size, city/country, contact
  and role, lead source, products of interest, stage, estimated value, next follow-up).
  You can filter by stage, product and "follow-up due".
- **Customer page:** log calls, meetings, demos and notes on a timeline. Set the next
  follow-up in one click, move the stage, and see which materials the client opened and how often.
- **Send materials:** email decks, PDFs and demo links as **tracked links** (`/s/…`,
  valid 90 days), with optional attachments. The first time the client opens one, it's
  added to the timeline.
- **Quotes:** pick plans from your products. Monthly, yearly and one-time lines are
  totalled separately. Quotes have a validity date, a PDF and send-by-email, and show your
  expected commission. Accepted quotes are locked; duplicate one for an upsell.
- **Lead protection:** a contact email can belong to only one seller. A second seller
  who tries to add it is told who already has it.

**Pipeline stages:** New lead → Contacted → Demo scheduled → Demo done → Quote sent → Negotiating → Won / Lost.

## 1. Run it on Replit

The repository includes `.replit` and `replit.md`, so Replit runs the app as is.
`replit.md` tells Replit's agent **not** to port or restructure the project.

1. Replit → **Create App → Import from GitHub** → `drolcluka77-cmd/crm-digital`.
   If the agent offers to "port", "migrate" or "convert" the app, say no: *"Run it as
   configured in .replit and replit.md, don't restructure."*
2. Open the **Database** tool and create a PostgreSQL database. `DATABASE_URL` is set for you.
3. Open the **Object Storage** tool and create a bucket. Uploaded PDFs and images are stored there.
4. **Secrets**: `SESSION_SECRET` (long random string), `APP_URL` (e.g.
   `https://crm-digital.replit.app`), `CRON_SECRET`, `BOOKING_WEBHOOK_SECRET`,
   optionally `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` and SMTP values.
5. Press **Run**. The first run creates the tables. Then, in the Shell, run
   `npm run db:seed` once to create the admin, the starter catalog and the templates.
6. **Publish** (Autoscale). Each start pushes the schema and creates the admin if
   it's missing. The published app uses its own production database, so log in there
   with the seed admin and **change the password**.
7. Updates: Git tab → **Pull/Sync**, then **Republish**.

Running somewhere else: any Node 20 host with PostgreSQL. Set `DATABASE_URL`, run
`npm install && npx prisma db push && npm run db:seed && npm run build && npm start`.
Use `STORAGE_DRIVER=local` to keep files in `./storage`, which needs a persistent disk.

## 2. Email (SMTP)

Console → Settings. For Gmail, use `smtp.gmail.com`, port `587`, your Gmail address
as the user, and an [App Password](https://myaccount.google.com/apppasswords) (not
your normal password). Use **Send test** to check it. Quotes, intro emails and
materials are all sent from this account, with the seller's address as *Reply-To*.

## 3. Notes on how it's built

- Next.js 14 (App Router), Prisma + PostgreSQL, nodemailer, pdf-lib, Replit Object Storage for files.
- "Enum" columns (role, status, billing…) are strings. The allowed values are in `lib/constants.ts`.
- Visibility rules are all in `lib/access.ts`.
- Files are kept in Replit Object Storage, or in `./storage` locally. Product images
  and the logo are public (`/api/files/public/…`). Sales materials are served only
  through `/api/materials/[id]` (which checks access) or a client's tracked link `/s/[token]`.
- The upload limit is 50 MB per request (`next.config.js`). For demo videos, a YouTube or Loom link works better than an upload.
- Quote PDFs use the built-in PDF fonts. Letters those fonts can't show, like
  "č", are printed without the accent ("c") instead of crashing.

## 4. Seller-success features

### Commission statements & payouts
- **My commission** (seller) and **Commissions** (console): a monthly statement with
  commission on quotes accepted that month, renewal commission and the tier bonus, minus payouts.
- **Personal rate:** Team → Edit seller → *Personal commission rate* replaces the
  product rates on that seller's new quote lines.
- **Bonus tiers:** Settings → *Monthly commission bonus tiers*, e.g. `10000:2, 25000:4`
  (+2 % of the month's won value from €10,000, +4 % from €25,000). Sellers see a
  progress bar toward the next tier.
- Admins record payouts with **Mark paid**. The seller is notified, and the open balance carries on.

### Recurring revenue
- When a quote with monthly or yearly lines is accepted, a **subscription** is created
  automatically. It holds MRR, the renewal date (Settings → *Subscription term*) and the
  renewal commission (Product → *Renewal commission %*).
- **Subscriptions** pages show MRR, ARR, renewals due in 30 days and 90-day churn.
  *Renewed* records a renewal (you can change the yearly value), and the commission goes
  onto that month's statement. *Cancel* records the reason.
- Reopening an accepted quote removes its subscription if it hasn't renewed yet.

### Email templates
- Console → **Email templates**, or per product under Products → Email templates.
  The starter set has *First contact* and *After the demo*.
- On a customer, **Email → Start from a template** fills in `{{firstName}}`, `{{company}}`,
  `{{product}}`, `{{demoLink}}`, `{{sellerName}}`, `{{sellerPhone}}` and `{{bookingLink}}`.
  Templates for the lead's products are listed first.

### Demo booking
- Each seller adds their booking page (Calendly, Cal.com, Google booking…) under **Account**.
- `{{bookingLink}}` in an email becomes a **tracked link** (`/b/…`) for that client. The
  seller is notified when the client opens it, and the client's name and email are pre-filled.
- **Booked automatically:** point your booking tool's webhook at
  `POST /api/webhooks/booking?secret=BOOKING_WEBHOOK_SECRET`. When a lead books, it
  moves to *Demo scheduled* with the demo time, and the seller is notified. This works
  with Calendly (`invitee.created`), Cal.com (`BOOKING_CREATED`), or any
  Zapier/Make step that sends `{"email": "...", "start_time": "..."}`.
- Sellers can also schedule a demo by hand on the customer page. It shows on *Today*
  and in the morning digest.

### Lead import & lead pools
- **Customers → Import CSV** (sellers) or **Lead pools → Import** (managers). Files
  from Excel with `;` work, as do English or Slovenian column names (*Podjetje*, *Ime in
  priimek*, *E-pošta*…). You check the column mapping and preview before importing.
  Duplicate emails are skipped.
- **Lead pools:** managers import a list, then assign leads to one seller or share them
  evenly between several. Each seller is notified.
- Tick **Sellers can claim** to let sellers take leads themselves under *Lead pool*,
  with an optional cap on open claimed leads per seller.

### Price guardrails & approvals
- **Max discount** per product (Products → Commission, pricing rules), or a company
  default in Settings. It counts both the % discount and lowered unit prices.
- A quote above the limit is saved as *Waiting for approval*, and the seller's manager
  is notified (admins, if the seller has no manager). Until it's approved, the seller
  can't send it, share the acceptance link or mark it Won.
- Managers approve or decline under **Approvals**, with a note to the seller. Editing
  an approved quote asks again, unless the discounts are unchanged.

### Online quote acceptance
- Sent quotes include a **View & accept online** button. The quote page also has an
  **Acceptance link** button to copy the link for chat.
- The client sees the quote, downloads the PDF and **accepts** (name, job title, terms
  checkbox) or **declines** with a reason. Accepting marks the quote Won, creates the
  subscription and notifies the seller. The name, title and IP are stored.
- The seller is also told when the client first opens the quote. Expired quotes can't be accepted.

### Training & certification
- Products → **Training**: add multiple-choice questions and a pass mark, then tick
  *Require certification to sell*.
- Sellers who have the product but haven't passed can read the playbook and
  materials. They can't quote it or send its materials until they pass the quiz.
  Answers are graded on the server, and wrong answers show the explanation.
- Product access shows each seller as *certified* or *learning*. Managers are told when
  someone passes. *Reset certifications* makes everyone take the quiz again.

### Notifications & digests
- In-app **Notifications** (badge in the menu) for: a client opened a material or quote,
  a client opened the booking link, a demo was booked, a quote was accepted or declined,
  approval requests and decisions, new leads, payouts, certifications and renewals.
  Important ones are also emailed. Each person can turn emails off under Account/Settings.
- **Daily digest:** call `GET /api/cron/daily?secret=CRON_SECRET` every morning.
  Sellers get today's demos, follow-ups due and renewals coming up. On Mondays (or with
  `&weekly=1`), managers and admins get a weekly team summary.
  On Replit, use a *Scheduled Deployment* that runs
  `curl -fsS "$APP_URL/api/cron/daily?secret=$CRON_SECRET"`, or any free cron service such as cron-job.org.

### On the road (mobile)
- On a phone, the menu becomes a top bar with a drawer and a notification bell.
- **Quick log** (`/crm/quick`): search a customer, tap *Call / Meeting / Demo*, type a
  note, choose a follow-up (tomorrow, 3 days, a week…) and save. It has big tap targets
  and a one-tap call button.
