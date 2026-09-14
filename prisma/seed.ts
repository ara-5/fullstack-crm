import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEAL_STAGES, type DealStage } from "../src/lib/constants";

const prisma = new PrismaClient();

// Deterministic pseudo-random numbers so every seed produces the same demo data.
let state = 42;
const rand = () => (state = (state * 16807) % 2147483647) / 2147483647;
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);

async function main() {
  await prisma.$transaction([
    prisma.emailLog.deleteMany(),
    prisma.activity.deleteMany(),
    prisma.deal.deleteMany(),
    prisma.contact.deleteMany(),
    prisma.company.deleteMany(),
    prisma.automationRule.deleteMany(),
    prisma.webhook.deleteMany(),
    prisma.apiKey.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash("Password123!", 10);
  const users = await Promise.all(
    [
      { name: "Ada Admin", email: "admin@crm.local", role: "ADMIN" },
      { name: "Max Manager", email: "manager@crm.local", role: "MANAGER" },
      { name: "Riley Rep", email: "rep@crm.local", role: "REP" },
      { name: "Sam Seller", email: "sam@crm.local", role: "REP" },
    ].map((u) => prisma.user.create({ data: { ...u, passwordHash } })),
  );
  const sellers = users.slice(1);

  const companySeed = [
    ["Northwind Traders", "northwind.com", "Retail", "201-500"],
    ["Globex Corporation", "globex.com", "Manufacturing", "1000+"],
    ["Initech", "initech.io", "Software", "51-200"],
    ["Umbrella Health", "umbrellahealth.com", "Healthcare", "501-1000"],
    ["Stark Logistics", "starklogistics.com", "Logistics", "201-500"],
    ["Wayne Financial", "waynefin.com", "Finance", "1000+"],
    ["Hooli", "hooli.xyz", "Software", "1000+"],
    ["Acme Studios", "acmestudios.co", "Media", "11-50"],
  ] as const;

  const companies = await Promise.all(
    companySeed.map(([name, domain, industry, size]) =>
      prisma.company.create({
        data: { name, domain, industry, size, ownerId: pick(sellers).id, createdAt: daysFromNow(-200 * rand()) },
      }),
    ),
  );

  const firstNames = ["Olivia", "Liam", "Emma", "Noah", "Ava", "Elijah", "Sophia", "James", "Mia", "Lucas", "Amara", "Kenji", "Priya", "Mateo", "Zara"];
  const lastNames = ["Nguyen", "Patel", "Garcia", "Kim", "Okafor", "Silva", "Müller", "Rossi", "Haddad", "Johnson", "Tanaka", "Cohen"];
  const titles = ["CEO", "CTO", "VP Sales", "Head of Operations", "Procurement Lead", "Marketing Director", "IT Manager"];
  const statuses = ["LEAD", "LEAD", "PROSPECT", "PROSPECT", "CUSTOMER", "CHURNED"] as const;
  const sources = ["Website", "Referral", "LinkedIn", "Conference", "Cold outreach"];

  const contacts = [];
  for (let i = 0; i < 24; i++) {
    const company = companies[i % companies.length];
    const firstName = pick(firstNames);
    const lastName = pick(lastNames);
    contacts.push(
      await prisma.contact.create({
        data: {
          firstName,
          lastName,
          email: `${firstName}.${lastName}${i}@${company.domain}`.toLowerCase(),
          phone: `+1 555 01${String(i).padStart(2, "0")}`,
          title: pick(titles),
          status: pick(statuses),
          source: pick(sources),
          tags: pick(["vip", "newsletter", "", "decision-maker", "trial"]),
          companyId: company.id,
          ownerId: company.ownerId,
          createdAt: daysFromNow(-180 * rand()),
        },
      }),
    );
  }

  const dealNames = ["Annual license", "Pilot program", "Expansion", "Renewal", "Onboarding package", "Enterprise plan"];
  const stageWeights: DealStage[] = ["LEAD", "LEAD", "QUALIFIED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "WON", "WON", "LOST"];
  const deals = [];
  for (let i = 0; i < 32; i++) {
    const contact = pick(contacts);
    const stage = pick(stageWeights);
    const createdAt = daysFromNow(-180 * rand());
    const closed = stage === "WON" || stage === "LOST";
    const closedAt = closed ? new Date(Math.min(Date.now(), createdAt.getTime() + (10 + 40 * rand()) * DAY)) : null;
    deals.push(
      await prisma.deal.create({
        data: {
          title: `${companies.find((c) => c.id === contact.companyId)?.name} — ${pick(dealNames)}`,
          value: Math.round((2000 + rand() * 48000) / 100) * 100,
          stage,
          probability: DEAL_STAGES.find((s) => s.id === stage)!.probability,
          expectedClose: closed ? null : daysFromNow(5 + 60 * rand()),
          closedAt,
          contactId: contact.id,
          companyId: contact.companyId,
          ownerId: contact.ownerId,
          createdAt,
        },
      }),
    );
  }

  const taskSubjects = ["Send proposal", "Follow up on pricing", "Schedule demo", "Prepare contract", "Check in after trial", "Quarterly business review"];
  for (let i = 0; i < 40; i++) {
    const deal = pick(deals);
    const type = pick(["TASK", "TASK", "CALL", "MEETING", "EMAIL", "NOTE"] as const);
    const dueOffset = Math.round(-10 + 24 * rand());
    const done = type === "NOTE" || rand() < 0.35;
    await prisma.activity.create({
      data: {
        type,
        subject: type === "NOTE" ? "Discovery call notes" : pick(taskSubjects),
        body: type === "NOTE" ? "Budget approved for Q4. Main concern is migration effort." : null,
        priority: pick(["LOW", "MEDIUM", "HIGH"] as const),
        dueAt: type === "NOTE" ? null : daysFromNow(dueOffset),
        completedAt: done ? daysFromNow(Math.min(0, dueOffset)) : null,
        dealId: deal.id,
        contactId: deal.contactId,
        companyId: deal.companyId,
        ownerId: deal.ownerId,
      },
    });
  }

  await prisma.automationRule.createMany({
    data: [
      {
        name: "Deal won → onboarding kickoff task",
        trigger: "deal.stage_changed",
        conditions: JSON.stringify({ toStage: "WON" }),
        action: "CREATE_TASK",
        actionConfig: JSON.stringify({ subject: "Kick off onboarding for {{deal.title}}", dueInDays: 2, priority: "HIGH" }),
      },
      {
        name: "Deal won → mark contact as customer",
        trigger: "deal.stage_changed",
        conditions: JSON.stringify({ toStage: "WON" }),
        action: "UPDATE_CONTACT_STATUS",
        actionConfig: JSON.stringify({ status: "CUSTOMER" }),
      },
      {
        name: "New contact → welcome email",
        active: false,
        trigger: "contact.created",
        conditions: "{}",
        action: "SEND_EMAIL",
        actionConfig: JSON.stringify({ subject: "Welcome, {{contact.firstName}}!", body: "Hi {{contact.firstName}},\n\nThanks for your interest. We'll be in touch shortly." }),
      },
    ],
  });

  console.log(`Seeded ${users.length} users, ${companies.length} companies, ${contacts.length} contacts, ${deals.length} deals.`);
  console.log("Log in with admin@crm.local / Password123!");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
