import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash("123456", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@kargo.com" },
    update: {},
    create: {
      email: "admin@kargo.com",
      passwordHash: adminPassword,
      fullName: "Admin Kullanıcı",
      role: "admin",
      isActive: true,
    },
  });
  console.log("✅ Admin user created:", admin.email);

  // Create regular user
  const userPassword = await bcrypt.hash("123456", 10);
  const user = await prisma.user.upsert({
    where: { email: "user@kargo.com" },
    update: {},
    create: {
      email: "user@kargo.com",
      passwordHash: userPassword,
      fullName: "Normal Kullanıcı",
      role: "user",
      isActive: true,
    },
  });
  console.log("✅ Regular user created:", user.email);

  // Seed default system parameters (used by planning)
  const systemParameters = [
    {
      paramKey: "cost_per_km",
      paramValue: 1,
      description: "KM başı maliyet",
    },
    {
      paramKey: "rental_cost_500kg",
      paramValue: 200,
      description: "500kg kiralık araç maliyeti",
    },
  ];

  for (const p of systemParameters) {
    await prisma.systemParameter.upsert({
      where: { paramKey: p.paramKey },
      update: {
        paramValue: p.paramValue,
        description: p.description,
        updatedById: admin.id,
      },
      create: {
        paramKey: p.paramKey,
        paramValue: p.paramValue,
        description: p.description,
        updatedById: admin.id,
      },
    });
  }
  console.log("✅ System parameters seeded");

  // Create some sample vehicles
  const vehicles = [
    {
      plateNumber: "41 KOU 001",
      name: "Araç 1",
      capacityKg: 1000,
      ownership: "owned" as const,
    },
    {
      plateNumber: "41 KOU 002",
      name: "Araç 2",
      capacityKg: 1500,
      ownership: "owned" as const,
    },
    {
      plateNumber: "41 KOU 003",
      name: "Araç 3",
      capacityKg: 2000,
      ownership: "owned" as const,
    },
  ];

  for (const v of vehicles) {
    await prisma.vehicle.upsert({
      where: { plateNumber: v.plateNumber },
      update: {},
      create: v,
    });
  }
  console.log("✅ Sample vehicles created");

  // Kocaeli İlçe Merkezleri İstasyonları
  const stations = [
    {
      name: "Başiskele Dağıtım Merkezi",
      code: "BSK",
      lat: 40.7133,
      long: 29.9317,
    },
    {
      name: "Çayırova Dağıtım Merkezi",
      code: "CYR",
      lat: 40.8166,
      long: 29.3733,
    },
    { name: "Darıca Dağıtım Merkezi", code: "DRC", lat: 40.7733, long: 29.4 },
    {
      name: "Derince Dağıtım Merkezi",
      code: "DRN",
      lat: 40.7558,
      long: 29.8317,
    },
    {
      name: "Dilovası Dağıtım Merkezi",
      code: "DLV",
      lat: 40.7869,
      long: 29.5444,
    },
    { name: "Gebze Dağıtım Merkezi", code: "GBZ", lat: 40.8028, long: 29.4307 },
    {
      name: "Gölcük Dağıtım Merkezi",
      code: "GLC",
      lat: 40.7167,
      long: 29.8167,
    },
    {
      name: "İzmit Merkez Depo",
      code: "IZM",
      lat: 40.7654,
      long: 29.9408,
      isHub: false,
    },
    {
      name: "Umuttepe Merkez Depo",
      code: "UMT",
      // Kocaeli Üniversitesi Umuttepe Yerleşkesi (OSM)
      lat: 40.8187372,
      long: 29.922908,
      isHub: true,
    }, // Merkez depo (Hub)
    { name: "Kandıra Dağıtım Merkezi", code: "KND", lat: 41.07, long: 30.15 },
    {
      name: "Karamürsel Dağıtım Merkezi",
      code: "KRM",
      lat: 40.6917,
      long: 29.6167,
    },
    {
      name: "Kartepe Dağıtım Merkezi",
      code: "KRT",
      lat: 40.7533,
      long: 30.0217,
    },
    {
      name: "Körfez Dağıtım Merkezi",
      code: "KRF",
      lat: 40.7767,
      long: 29.7333,
    },
  ];

  for (const station of stations) {
    await prisma.station.upsert({
      where: { code: station.code },
      update: {
        name: station.name,
        latitude: station.lat,
        longitude: station.long,
        isHub: station.isHub || false,
        isActive: true,
      },
      create: {
        name: station.name,
        code: station.code,
        latitude: station.lat,
        longitude: station.long,
        isHub: station.isHub || false,
        isActive: true,
      },
    });
  }
  console.log("✅ Kocaeli ilçe istasyonları eklendi");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    await prisma.$disconnect();
    console.error(error);
    process.exit(1);
  });
