// Kocaeli Kargo Sistemi - Örnek Senaryolar
// Yazılım Lab I - 2025-2026 Güz

export interface ScenarioCargo {
  station: string; // İlçe adı (Başiskele, Çayırova, etc.)
  count: number; // Kargo sayısı
  weight: number; // Toplam ağırlık (kg)
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  data: ScenarioCargo[];
  totalCargos: number;
  totalWeight: number;
}

// Station code mapping
export const stationCodeMap: Record<string, string> = {
  Başiskele: "BSK",
  Çayırova: "CYR",
  Darıca: "DRC",
  Derince: "DRN",
  Dilovası: "DLV",
  Gebze: "GBZ",
  Gölcük: "GLC",
  Kandıra: "KND",
  Karamürsel: "KRM",
  Kartepe: "KRT",
  Körfez: "KRF",
  İzmit: "IZM",
};

// Senaryo verileri
const scenarioData = {
  scenario1: [
    { station: "Başiskele", count: 10, weight: 120 },
    { station: "Çayırova", count: 8, weight: 80 },
    { station: "Darıca", count: 15, weight: 200 },
    { station: "Derince", count: 10, weight: 150 },
    { station: "Dilovası", count: 12, weight: 180 },
    { station: "Gebze", count: 5, weight: 70 },
    { station: "Gölcük", count: 7, weight: 90 },
    { station: "Kandıra", count: 6, weight: 60 },
    { station: "Karamürsel", count: 9, weight: 110 },
    { station: "Kartepe", count: 11, weight: 130 },
    { station: "Körfez", count: 6, weight: 75 },
    { station: "İzmit", count: 14, weight: 160 },
  ],
  scenario2: [
    { station: "Başiskele", count: 40, weight: 200 },
    { station: "Çayırova", count: 35, weight: 175 },
    { station: "Darıca", count: 10, weight: 150 },
    { station: "Derince", count: 5, weight: 100 },
    { station: "Gebze", count: 8, weight: 120 },
    { station: "İzmit", count: 20, weight: 160 },
  ],
  scenario3: [
    { station: "Çayırova", count: 3, weight: 700 },
    { station: "Dilovası", count: 4, weight: 800 },
    { station: "Gebze", count: 5, weight: 900 },
    { station: "İzmit", count: 5, weight: 300 },
  ],
  scenario4: [
    { station: "Başiskele", count: 30, weight: 300 },
    { station: "Gölcük", count: 15, weight: 220 },
    { station: "Kandıra", count: 5, weight: 250 },
    { station: "Karamürsel", count: 20, weight: 180 },
    { station: "Kartepe", count: 10, weight: 200 },
    { station: "Körfez", count: 8, weight: 400 },
  ],
};

// Helper function to calculate totals
const calculateTotals = (data: ScenarioCargo[]) => {
  return data.reduce(
    (acc, item) => ({
      totalCargos: acc.totalCargos + item.count,
      totalWeight: acc.totalWeight + item.weight,
    }),
    { totalCargos: 0, totalWeight: 0 }
  );
};

// Export scenarios with metadata
export const scenarios: Scenario[] = [
  {
    id: "scenario1",
    name: "Senaryo 1",
    description: "Tüm ilçelerden dengeli dağılım (113 kargo, 1445 kg)",
    data: scenarioData.scenario1,
    ...calculateTotals(scenarioData.scenario1),
  },
  {
    id: "scenario2",
    name: "Senaryo 2",
    description: "Batı ilçelerde yoğunlaşma (118 kargo, 905 kg)",
    data: scenarioData.scenario2,
    ...calculateTotals(scenarioData.scenario2),
  },
  {
    id: "scenario3",
    name: "Senaryo 3",
    description: "Az sayıda ağır kargo (17 kargo, 2700 kg) - Kapasite aşımı",
    data: scenarioData.scenario3,
    ...calculateTotals(scenarioData.scenario3),
  },
  {
    id: "scenario4",
    name: "Senaryo 4",
    description: "Doğu ilçelerde yoğunlaşma (88 kargo, 1550 kg)",
    data: scenarioData.scenario4,
    ...calculateTotals(scenarioData.scenario4),
  },
];

// Export raw data for API use
export const scenarioRawData = scenarioData;
