export type ScenarioStationInput = {
  cargoCount: number;
  totalWeightKg: number;
};

export type ScenarioDefinition = {
  id: number;
  name: string;
  stationsByCode: Record<string, ScenarioStationInput>;
};

// Based on projeisterleri.md (Example Scenarios)
export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 1,
    name: 'Senaryo 1',
    stationsByCode: {
      BSK: { cargoCount: 10, totalWeightKg: 120 },
      CYR: { cargoCount: 8, totalWeightKg: 80 },
      DRC: { cargoCount: 15, totalWeightKg: 200 },
      DRN: { cargoCount: 10, totalWeightKg: 150 },
      DLV: { cargoCount: 12, totalWeightKg: 180 },
      GBZ: { cargoCount: 5, totalWeightKg: 70 },
      GLC: { cargoCount: 7, totalWeightKg: 90 },
      KND: { cargoCount: 6, totalWeightKg: 60 },
      KRM: { cargoCount: 9, totalWeightKg: 110 },
      KRT: { cargoCount: 11, totalWeightKg: 130 },
      KRF: { cargoCount: 6, totalWeightKg: 75 },
      IZM: { cargoCount: 14, totalWeightKg: 160 },
    },
  },
  {
    id: 2,
    name: 'Senaryo 2',
    stationsByCode: {
      BSK: { cargoCount: 40, totalWeightKg: 200 },
      CYR: { cargoCount: 35, totalWeightKg: 175 },
      DRC: { cargoCount: 10, totalWeightKg: 150 },
      DRN: { cargoCount: 5, totalWeightKg: 100 },
      DLV: { cargoCount: 0, totalWeightKg: 0 },
      GBZ: { cargoCount: 8, totalWeightKg: 120 },
      GLC: { cargoCount: 0, totalWeightKg: 0 },
      KND: { cargoCount: 0, totalWeightKg: 0 },
      KRM: { cargoCount: 0, totalWeightKg: 0 },
      KRT: { cargoCount: 0, totalWeightKg: 0 },
      KRF: { cargoCount: 0, totalWeightKg: 0 },
      IZM: { cargoCount: 20, totalWeightKg: 160 },
    },
  },
  {
    id: 3,
    name: 'Senaryo 3',
    stationsByCode: {
      BSK: { cargoCount: 0, totalWeightKg: 0 },
      CYR: { cargoCount: 3, totalWeightKg: 700 },
      DRC: { cargoCount: 0, totalWeightKg: 0 },
      DRN: { cargoCount: 0, totalWeightKg: 0 },
      DLV: { cargoCount: 4, totalWeightKg: 800 },
      GBZ: { cargoCount: 5, totalWeightKg: 900 },
      GLC: { cargoCount: 0, totalWeightKg: 0 },
      KND: { cargoCount: 0, totalWeightKg: 0 },
      KRM: { cargoCount: 0, totalWeightKg: 0 },
      KRT: { cargoCount: 0, totalWeightKg: 0 },
      KRF: { cargoCount: 0, totalWeightKg: 0 },
      IZM: { cargoCount: 5, totalWeightKg: 300 },
    },
  },
  {
    id: 4,
    name: 'Senaryo 4',
    stationsByCode: {
      BSK: { cargoCount: 30, totalWeightKg: 300 },
      CYR: { cargoCount: 0, totalWeightKg: 0 },
      DRC: { cargoCount: 0, totalWeightKg: 0 },
      DRN: { cargoCount: 0, totalWeightKg: 0 },
      DLV: { cargoCount: 0, totalWeightKg: 0 },
      GBZ: { cargoCount: 0, totalWeightKg: 0 },
      GLC: { cargoCount: 15, totalWeightKg: 220 },
      KND: { cargoCount: 5, totalWeightKg: 250 },
      KRM: { cargoCount: 20, totalWeightKg: 180 },
      KRT: { cargoCount: 10, totalWeightKg: 200 },
      KRF: { cargoCount: 8, totalWeightKg: 400 },
      IZM: { cargoCount: 0, totalWeightKg: 0 },
    },
  },
];

export function getScenarioById(id: number): ScenarioDefinition | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
