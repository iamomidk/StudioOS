import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const seed = Number.parseInt(process.env.PERF_SEED ?? '42', 10);
const orgCount = Number.parseInt(process.env.PERF_ORG_COUNT ?? '3', 10);
const usersPerOrg = Number.parseInt(process.env.PERF_USERS_PER_ORG ?? '6', 10);
const bookingsPerOrg = Number.parseInt(process.env.PERF_BOOKINGS_PER_ORG ?? '20', 10);
const rentalsPerOrg = Number.parseInt(process.env.PERF_RENTALS_PER_ORG ?? '25', 10);

let state = seed >>> 0;
function rand() {
  state = (state * 1664525 + 1013904223) >>> 0;
  return state / 2 ** 32;
}

const organizations = [];
for (let i = 0; i < orgCount; i += 1) {
  const orgId = `perf-org-${i + 1}`;
  organizations.push({
    id: orgId,
    users: Array.from({ length: usersPerOrg }, (_, j) => ({
      id: `${orgId}-user-${j + 1}`,
      role: ['owner', 'manager', 'shooter', 'editor'][j % 4]
    })),
    bookings: Array.from({ length: bookingsPerOrg }, (_, j) => ({
      id: `${orgId}-booking-${j + 1}`,
      durationHours: Math.floor(rand() * 10) + 1,
      status: ['draft', 'confirmed', 'completed'][j % 3]
    })),
    rentals: Array.from({ length: rentalsPerOrg }, (_, j) => ({
      id: `${orgId}-rental-${j + 1}`,
      status: ['reserved', 'picked_up', 'returned'][j % 3],
      valueCents: Math.floor(rand() * 80000) + 5000
    }))
  });
}

const output = {
  generatedAt: new Date().toISOString(),
  seed,
  parameters: {
    orgCount,
    usersPerOrg,
    bookingsPerOrg,
    rentalsPerOrg
  },
  organizations
};

const outputPath = path.resolve('artifacts/perf/synthetic-data.json');
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(output, null, 2));
process.stdout.write(`Wrote deterministic synthetic data manifest to ${outputPath}\n`);
