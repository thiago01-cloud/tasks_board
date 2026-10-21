// One-time data fix for the "un manager est toujours rattaché à un
// groupe" invariant (see demoteGrouplessManager() in lib/groups.ts): that
// function only runs going forward, right after something REMOVES an
// agent from their last group (or sets their role to MANAGER directly
// with none to begin with) — it can't reach back and fix MANAGER rows
// that were already groupless in the database before this invariant
// existed. Run this ONCE, right after deploying that change, to sweep
// current data; re-running later is harmless (it'll simply find nothing
// left to fix, since the invariant keeps itself correct from then on).
//
// Plain CommonJS (not TypeScript), same reasoning as prisma/seed.js: runs
// with a plain `node`, no ts-node/tsx dependency needed.
//
//   node scripts/demote-groupless-managers.js
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const groupless = await prisma.agent.findMany({
    where: { role: "MANAGER", groups: { none: {} } },
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true } },
      company: { select: { name: true } },
    },
  });

  if (groupless.length === 0) {
    console.log("Aucun manager sans groupe trouvé — rien à corriger.");
    return;
  }

  console.log(`${groupless.length} manager(s) sans groupe trouvé(s) :`);
  for (const a of groupless) {
    console.log(`  - ${a.user.firstName} ${a.user.lastName} (${a.company.name})`);
  }

  await prisma.agent.updateMany({
    where: { id: { in: groupless.map((a) => a.id) } },
    data: { role: "MEMBER" },
  });

  console.log("Tous remis à l'état de membre.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
