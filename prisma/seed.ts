/**
 * Seeds:
 *  1. the first admin account (so you can log in),
 *  2. the settings row,
 *  3. a starter catalog — the Unbusyness editions and Arrive — unless
 *     SEED_DEMO_CATALOG=false or products already exist.
 *
 * Starter plans have price 0 as placeholders: set real prices in
 * Console → Products → (product) → Plans & pricing.
 *
 * Run with: npm run db:seed
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CATALOG = [
  {
    name: "Unbusyness",
    family: "Unbusyness",
    tagline: "One place for building requests, faults, meetings and maintenance.",
    targetSegment: "Property & building managers, HOAs, residents, contractors",
    description:
      "Unbusyness handles resident requests, fault reports, meetings, cleaning and regular / emergency building maintenance — so property managers spend less time on phone calls and spreadsheets. It connects building managers, residents and maintenance contractors in one ecosystem, and is customised to each client's needs.",
    pitch:
      "Most building managers lose hours every week chasing fault reports, contractor visits and resident questions across phone, email and paper. Unbusyness puts all of it in one place: residents report, the manager assigns, the contractor fixes — and everyone sees the status.",
    keyBenefits:
      "All requests and fault reports in one place\nFaster emergency response — the right contractor notified immediately\nLess phone time and fewer repeated questions from residents\nCleaning and maintenance schedules that run themselves\nCustomised to how each client already works",
    idealCustomer:
      "Manages several buildings or 50+ units\nStill coordinates faults by phone / email / Excel\nWorks with outside contractors (plumbers, electricians, cleaners)\nAsk: How do residents report a fault today? How long until it's fixed? How many calls a day?",
    objections:
      "We already use Excel / email — Unbusyness replaces the chasing, not your process; we set it up to match how you work.\nOur residents won't use an app — reporting works from a simple link; managers can also log calls for them.\nToo expensive — compare with the hours your team spends on calls each week.",
    websiteUrl: "https://unbusyness.com",
    color: "#4f46e5",
    sortOrder: 1,
  },
  {
    name: "Unbusyness for Building Managers",
    family: "Unbusyness",
    tagline: "Run every building from one dashboard.",
    targetSegment: "Property management companies, building managers, HOAs",
    description:
      "The building-manager edition of Unbusyness: fault reports, resident requests, meetings and votes, cleaning and maintenance schedules, and contractor coordination across all buildings in your portfolio.",
    pitch:
      "You manage buildings, not phone calls. Unbusyness gives you one dashboard for every fault, request and contractor visit across all your buildings — residents see progress, so they stop calling.",
    keyBenefits:
      "Every building and every open issue on one screen\nResidents report faults themselves, with photos\nAssign contractors in one click and track the fix\nMeeting invitations, minutes and votes in one place\nReports for owners and HOA boards",
    idealCustomer:
      "Property management company with 5+ buildings\nOne or more people handling resident calls full time\nAsk: How many buildings / units? Who takes fault calls? What do owners ask you to report?",
    objections:
      "We have our own software — Unbusyness can sit next to it for faults & contractors; we customise integrations.\nNo time to switch — onboarding is done for you; start with one building.",
    websiteUrl: "https://unbusyness.com",
    color: "#0ea5e9",
    sortOrder: 2,
  },
  {
    name: "Unbusyness for Tradespeople",
    family: "Unbusyness",
    tagline: "Get jobs from building managers and get paid faster.",
    targetSegment: "Plumbers, electricians, cleaners, maintenance contractors",
    description:
      "The contractor edition of Unbusyness: receive jobs from building managers and residents, schedule visits, document the work with photos and (in Pro) send invoices.",
    pitch:
      "Building managers already use Unbusyness to send out jobs. Be the contractor they find first — get jobs straight to your phone, close them with a photo, and invoice from the same app.",
    keyBenefits:
      "New jobs from building managers and residents\nAll job details, photos and access info in one place\nFewer wasted trips and phone calls\nProof of work with photos\nInvoicing in the Pro plan",
    idealCustomer:
      "Small trades business (1–20 people) working for buildings\nAsk: How do you get jobs from property managers today? How do you invoice? How many jobs a month?",
    objections:
      "I get enough work by phone — this adds jobs from managers you don't know yet, and less admin for the ones you do.\nI'm not good with apps — it's built for the phone, three taps to accept and close a job.",
    websiteUrl: "https://unbusyness.com",
    color: "#10b981",
    sortOrder: 3,
  },
  {
    name: "Arrive",
    family: "Arrive",
    tagline: "Specialised for hotels, hospitals and other large facilities.",
    targetSegment: "Hotels, hospitals, clinics, care homes, large facilities",
    description:
      "Arrive is the specialised product for hotels, hospitals and similar institutions. Edit this description in Console → Products to describe exactly what Arrive does for these clients.",
    pitch: "",
    keyBenefits: "",
    idealCustomer: "Hotels, hospitals, clinics and care homes\nAsk: How many rooms / beds? Who is the decision maker?",
    objections: "",
    color: "#f59e0b",
    sortOrder: 4,
  },
];

async function main() {
  const name = process.env.SEED_ADMIN_NAME || "Admin";
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin account already exists for ${email}. Skipping.`);
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { name, email, passwordHash, role: "ADMIN", active: true },
    });
    console.log(`Created admin account: ${email} / ${password}`);
    console.log("Log in and change this password in Settings.");
  }

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (settings && settings.companyName === "Distribution Hub") {
    await prisma.settings.update({
      where: { id: 1 },
      data: { companyName: process.env.SEED_COMPANY_NAME || "AURELIA DISTRIBUCIJA d.o.o." },
    });
    console.log("Updated company name to AURELIA DISTRIBUCIJA d.o.o.");
  }
  if (!settings) {
    await prisma.settings.create({
      data: {
        id: 1,
        companyName: process.env.SEED_COMPANY_NAME || "AURELIA DISTRIBUCIJA d.o.o.",
        companyEmail: email,
        vatRate: 22,
        smtpHost: process.env.SMTP_HOST || null,
        smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null,
        smtpUser: process.env.SMTP_USER || null,
        smtpPass: process.env.SMTP_PASS || null,
        smtpFrom: process.env.SMTP_FROM || null,
      },
    });
    console.log("Created default settings row.");
  }

  const productCount = await prisma.product.count();
  if (process.env.SEED_DEMO_CATALOG !== "false" && productCount === 0) {
    for (const p of CATALOG) {
      await prisma.product.create({
        data: {
          ...p,
          commissionRate: 0,
          plans: {
            create: [
              {
                name: "Standard",
                price: 0,
                billing: "MONTHLY",
                unitLabel: null,
                description: "Placeholder — set the real price in Console → Products.",
              },
            ],
          },
        },
      });
    }
    console.log(`Created starter catalog: ${CATALOG.map((p) => p.name).join(", ")}.`);
  }

  if ((await prisma.emailTemplate.count()) === 0) {
    await prisma.emailTemplate.createMany({
      data: [
        {
          name: "First contact",
          purpose: "FIRST_CONTACT",
          subject: "{{product}} for {{company}}",
          body:
            "Hi {{firstName}},\n\nI'm {{sellerName}}. We help organisations like {{company}} spend less time on phone calls, emails and spreadsheets with {{product}}.\n\nWould a 20-minute demo be useful? You can pick a time here: {{bookingLink}}\n\nBest regards,",
          sortOrder: 1,
        },
        {
          name: "After the demo",
          purpose: "AFTER_DEMO",
          subject: "Thanks for your time, {{firstName}}",
          body:
            "Hi {{firstName}},\n\nThank you for the demo today. As promised, I'll send you the materials and a proposal for {{company}}.\n\nIf any questions come up, just reply here or call me on {{sellerPhone}}.\n\nBest regards,",
          sortOrder: 2,
        },
      ],
    });
    console.log("Created 2 starter email templates.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
