import { PrismaClient } from "@prisma/client";
import { seedDemoData } from "../src/lib/demo-seed";

const prisma = new PrismaClient();

seedDemoData(prisma)
  .then((r) => {
    console.log(`Seeded ${r.users} users, ${r.companies} companies, ${r.contacts} contacts, ${r.deals} deals.`);
    console.log("Log in with admin@crm.local / Password123!");
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
