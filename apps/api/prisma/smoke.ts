import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    // Keep output minimal and avoid printing secrets.
    // This is a CI smoke check that the DB is reachable and schema is usable.
    // eslint-disable-next-line no-console
    console.log('DB smoke: OK');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('DB smoke: FAILED');
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
