// One-time data fix for the "tâche bloquée" → "tâche en pause" rename
// (see TASK_STATUS_LABELS.PAUSED in lib/enums.ts and Task.pausedAt in
// schema.prisma): `status` is a plain string column, not a native
// Postgres enum, so the rename itself needed no schema migration — but
// any task already sitting at the old "BLOCKED" value in the database
// needs to be relabeled to "PAUSED", or the app will no longer recognize
// its status at all (TASK_STATUSES doesn't list "BLOCKED" anymore).
//
// Run this ONCE, right after deploying the rename (and after the
// migration that adds the `pausedAt` column — see
// scripts/demote-groupless-managers.js for the matching one-off for that
// change); re-running later is harmless, it'll just find nothing left to
// fix.
//
// Plain CommonJS (not TypeScript), same reasoning as prisma/seed.js: runs
// with a plain `node`, no ts-node/tsx dependency needed.
//
//   node scripts/rename-blocked-to-paused.js
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const blocked = await prisma.task.findMany({
    where: { status: "BLOCKED" },
    select: { id: true, title: true },
  });

  if (blocked.length === 0) {
    console.log("Aucune tâche encore au statut BLOCKED — rien à corriger.");
    return;
  }

  console.log(`${blocked.length} tâche(s) trouvée(s) au statut BLOCKED :`);
  for (const t of blocked) {
    console.log(`  - ${t.title}`);
  }

  // Left as-is on purpose: a BLOCKED task had no `pausedAt` concept before
  // this change, so there's no "time remaining at the moment it was
  // paused" to preserve retroactively — it just starts fresh as PAUSED
  // from right now, with its existing dueDate untouched until it's
  // resumed (see PATCH /api/tasks/[id] for the actual pause/resume
  // recalculation going forward).
  await prisma.task.updateMany({
    where: { id: { in: blocked.map((t) => t.id) } },
    data: { status: "PAUSED", pausedAt: new Date() },
  });

  console.log("Toutes remises au statut PAUSED.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
