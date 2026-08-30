import Dexie, { type Table } from "dexie";

/* ================= Types ================= */

export type YarnType = "Cotton" | "Polyester" | "Nylon" | "Spandex" | "Elastic" | "Acrylic";

export interface Yarn {
  id: string;
  code: string;
  type: YarnType;
  colorName: string;
  colorHex: string;
  colorKey: string; // e.g. WT-01
  count: string; // Ne count or denier
  batch: string;
  weightKg: number;
  minKg: number;
  rack: string;
  supplier: string;
  updatedAt: number;
}

export type YarnLogKind = "consumption" | "transfer" | "receipt" | "adjust";

export interface YarnLog {
  id?: number;
  yarnId: string;
  kind: YarnLogKind;
  kg: number;
  note: string;
  machineId?: number;
  ts: number;
}

export type MachineStatus = "running" | "idle" | "maintenance";

export interface MachineJob {
  styleId: string;
  targetPairs: number;
  producedPairs: number;
  needle: string;
  yarnBatchCodes: string[];
  startedAt: number;
  speedRpm: number;
}

export interface Machine {
  id: number;
  name: string; // KN-01
  brand: string;
  status: MachineStatus;
  job?: MachineJob;
  note?: string;
  sinceTs: number;
}

export type SockCategory = "Ankle" | "Crew" | "Athletic" | "Kids" | "Specialty";

export interface SockStyle {
  id: string;
  styleCode: string;
  name: string;
  category: SockCategory;
  size: string;
  color: string;
  colorHex: string;
  packing: "Single Pair" | "3-Pack" | "5-Pack" | "Dozen Box";
  gramsPerPair: number;
  pairsOnHand: number;
  dozensOnHand: number;
  dozensReserved: number;
  reorderDozens: number;
  rack: string;
}

export interface OrderItem {
  styleId: string;
  dozens: number;
}

export type OrderStatus = "open" | "allocated" | "dispatched";

export interface Order {
  id: string;
  code: string;
  customer: string;
  city: string;
  items: OrderItem[];
  status: OrderStatus;
  dueTs: number;
  createdTs: number;
}

export interface ScrapLog {
  id?: number;
  machineId: number;
  styleId?: string;
  defectPairs: number;
  wasteKg: number;
  reason: string;
  ts: number;
}

export interface AuditLog {
  id?: number;
  ts: number;
  actor: string;
  action: string;
  detail: string;
}

export interface DailyStat {
  id: string; // YYYY-MM-DD
  pairs: number;
  yarnKg: number;
  scrapPairs: number;
}

/* ================= Database ================= */

export class SockTrackDB extends Dexie {
  yarns!: Table<Yarn, string>;
  yarnLogs!: Table<YarnLog, number>;
  machines!: Table<Machine, number>;
  sockStyles!: Table<SockStyle, string>;
  orders!: Table<Order, string>;
  scrapLogs!: Table<ScrapLog, number>;
  auditLogs!: Table<AuditLog, number>;
  dailyStats!: Table<DailyStat, string>;

  constructor() {
    super("socktrack-erp");
    this.version(1).stores({
      yarns: "id, code, type, batch",
      yarnLogs: "++id, yarnId, ts",
      machines: "id, status",
      sockStyles: "id, styleCode, category",
      orders: "id, status, dueTs",
      scrapLogs: "++id, machineId, ts",
      auditLogs: "++id, ts",
      dailyStats: "id",
    });
  }
}

export const db = new SockTrackDB();

/* ================= Seed ================= */

const H = 3600_000;
const D = 24 * H;

export const dayKey = (t: number) => {
  const d = new Date(t);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const Y = (
  id: string, code: string, type: YarnType, colorName: string, colorHex: string, colorKey: string,
  count: string, batch: string, weightKg: number, minKg: number, rack: string, supplier: string,
): Yarn => ({ id, code, type, colorName, colorHex, colorKey, count, batch, weightKg, minKg, rack, supplier, updatedAt: Date.now() - Math.floor(Math.random() * 3 * D) });

const S = (
  id: string, styleCode: string, name: string, category: SockCategory, size: string, color: string,
  colorHex: string, packing: SockStyle["packing"], gramsPerPair: number, pairs: number,
  reorderDozens: number, rack: string,
): SockStyle => ({
  id, styleCode, name, category, size, color, colorHex, packing, gramsPerPair,
  pairsOnHand: pairs, dozensOnHand: Math.round(pairs / 12), dozensReserved: 0, reorderDozens, rack,
});

const seedYarns: Yarn[] = [
  Y("y01", "YRN-C01", "Cotton", "Raw White", "#efe9dc", "WT-01", "Ne 20/1 Combed", "CW-2418", 420, 150, "R1-A", "Nilgiri Spinning"),
  Y("y02", "YRN-C02", "Cotton", "Jet Black", "#181b21", "BK-09", "Ne 20/1 Combed", "CJ-1187", 92, 120, "R1-B", "Nilgiri Spinning"),
  Y("y03", "YRN-C03", "Cotton", "Marine Navy", "#20304f", "NV-22", "Ne 30/2 Carded", "CN-3320", 260, 100, "R1-C", "Aegis Fibres"),
  Y("y04", "YRN-C04", "Cotton", "Heather Grey", "#9aa1ab", "GY-14", "Ne 20/1 Combed", "CH-7741", 178, 90, "R1-D", "Nilgiri Spinning"),
  Y("y05", "YRN-C05", "Cotton", "Forest Green", "#1f4d3a", "GN-31", "Ne 26/1 Combed", "CF-9051", 0, 80, "R2-A", "Aegis Fibres"),
  Y("y06", "YRN-P01", "Polyester", "Optic White", "#f2f4f7", "WT-04", "150D/48f DTY", "PO-5527", 310, 120, "R2-B", "PolyWeave Mills"),
  Y("y07", "YRN-P02", "Polyester", "Signal Blue", "#2456d6", "BL-07", "150D/48f DTY", "PB-2210", 84, 100, "R2-C", "PolyWeave Mills"),
  Y("y08", "YRN-N01", "Nylon", "Skin Nude", "#e6c7a4", "NU-11", "70D/24f FDY", "NS-8843", 140, 60, "R3-A", "Meridian Nylon"),
  Y("y09", "YRN-N02", "Nylon", "Charcoal", "#3a3f47", "CH-05", "100D/36f DTY", "NC-4419", 212, 80, "R3-B", "Meridian Nylon"),
  Y("y10", "YRN-S01", "Spandex", "Bare 20D", "#f5f0e8", "SP-20", "20D Bare Lycra", "SP-0912", 46, 25, "R4-A", "FlexCore Elastomers"),
  Y("y11", "YRN-S02", "Spandex", "Covered Black 40D", "#26282e", "SP-40", "40D ACY Black", "SB-1130", 17, 20, "R4-B", "FlexCore Elastomers"),
  Y("y12", "YRN-E01", "Elastic", "Rubber White 38s", "#eceae2", "EL-38", "38s Covered Rubber", "EL-6602", 64, 30, "R4-C", "FlexCore Elastomers"),
  Y("y13", "YRN-A01", "Acrylic", "Brick Red", "#c2372f", "RD-18", "2/28 Nm HTH", "AR-3308", 126, 60, "R3-C", "Aegis Fibres"),
];

const seedStyles: SockStyle[] = [
  S("s01", "ANK-101", "Court Low Ankle", "Ankle", "Adult 39–42", "Optic White", "#eef0f2", "3-Pack", 42, 1260, 40, "A-01"),
  S("s02", "ANK-102", "Court Low Ankle", "Ankle", "Adult 39–42", "Jet Black", "#1b1e24", "3-Pack", 42, 940, 35, "A-02"),
  S("s03", "ANK-103", "Everyday Ankle", "Ankle", "Adult 36–40", "Heather Grey", "#9aa1ab", "Dozen Box", 40, 2100, 60, "A-03"),
  S("s04", "CRW-201", "Heritage Crew", "Crew", "Adult 39–44", "Marine Navy", "#243352", "Dozen Box", 52, 1680, 55, "B-01"),
  S("s05", "CRW-202", "Tipped Crew", "Crew", "Adult 39–44", "Navy/Red Tip", "#243352", "Single Pair", 50, 720, 30, "B-02"),
  S("s06", "CRW-203", "Weekend Crew", "Crew", "Adult 36–41", "Heather Grey", "#a4abb4", "Dozen Box", 51, 1340, 45, "B-03"),
  S("s07", "CRW-204", "Ranger Crew", "Crew", "Adult 40–45", "Forest Green", "#275845", "Dozen Box", 54, 560, 30, "B-04"),
  S("s08", "ATH-301", "RunPro Cushion", "Athletic", "Adult 39–44", "Optic White", "#f0f2f5", "Single Pair", 56, 2480, 80, "C-01"),
  S("s09", "ATH-302", "RunPro Cushion", "Athletic", "Adult 39–44", "Jet Black", "#1c1f25", "Single Pair", 56, 1820, 70, "C-02"),
  S("s10", "ATH-303", "CourtGrip Terry", "Athletic", "Adult 40–45", "Signal Blue", "#2b55c4", "Dozen Box", 58, 900, 40, "C-03"),
  S("s11", "KID-401", "Mini Crew Play", "Kids", "Kids 24–30", "Assorted Brights", "#e8a13c", "5-Pack", 30, 1560, 50, "D-01"),
  S("s12", "KID-402", "School Ankle", "Kids", "Kids 28–34", "Optic White", "#f1f3f5", "5-Pack", 28, 2040, 60, "D-02"),
  S("s13", "KID-403", "Junior Crew", "Kids", "Kids 30–36", "Heather Grey", "#a0a7b0", "Dozen Box", 32, 780, 35, "D-03"),
  S("s14", "THM-501", "Thermo Loop Crew", "Specialty", "Adult 39–45", "Charcoal", "#3b4048", "Single Pair", 64, 460, 25, "E-01"),
  S("s15", "DIA-502", "SoftTop Non-Bind", "Specialty", "Adult 38–44", "Optic White", "#f0f1f3", "3-Pack", 44, 640, 30, "E-02"),
  S("s16", "BSP-503", "Boardroom Seamless", "Specialty", "Adult 39–44", "Jet Black", "#1a1d22", "Single Pair", 46, 830, 35, "E-03"),
];

const job = (styleId: string, target: number, produced: number, needle: string, batches: string[], hrsAgo: number, rpm: number): MachineJob => ({
  styleId, targetPairs: target, producedPairs: produced, needle, yarnBatchCodes: batches, startedAt: Date.now() - hrsAgo * H, speedRpm: rpm,
});

const seedMachines: Machine[] = [
  { id: 1, name: "KN-01", brand: "Lonati E1530", status: "running", job: job("s01", 3600, 2890, "144N Ø3.5\"", ["CW-2418", "SP-0912"], 6.2, 310), sinceTs: Date.now() - 6.2 * H },
  { id: 2, name: "KN-02", brand: "Lonati E1530", status: "running", job: job("s02", 3200, 1750, "144N Ø3.5\"", ["CJ-1187", "SB-1130"], 4.1, 305), sinceTs: Date.now() - 4.1 * H },
  { id: 3, name: "KN-03", brand: "Santoni FB15", status: "running", job: job("s04", 2800, 2410, "156N Ø3.75\"", ["CN-3320", "SP-0912"], 7.5, 298), sinceTs: Date.now() - 7.5 * H },
  { id: 4, name: "KN-04", brand: "Santoni FB15", status: "running", job: job("s08", 4000, 1120, "132N Ø3.5\"", ["PO-5527", "NC-4419", "SP-0912"], 2.8, 322), sinceTs: Date.now() - 2.8 * H },
  { id: 5, name: "KN-05", brand: "Lonati E1220", status: "running", job: job("s09", 3800, 3050, "132N Ø3.5\"", ["CJ-1187", "SB-1130"], 6.9, 315), sinceTs: Date.now() - 6.9 * H },
  { id: 6, name: "KN-06", brand: "Lonati E1220", status: "running", job: job("s03", 5000, 2200, "144N Ø3.5\"", ["CH-7741", "SP-0912"], 5.3, 300), sinceTs: Date.now() - 5.3 * H },
  { id: 7, name: "KN-07", brand: "Santoni FB15", status: "running", job: job("s11", 4500, 4180, "120N Ø3.25\"", ["CW-2418", "AR-3308", "EL-6602"], 7.1, 290), sinceTs: Date.now() - 7.1 * H },
  { id: 8, name: "KN-08", brand: "Lonati E1530", status: "running", job: job("s06", 3000, 990, "156N Ø3.75\"", ["CH-7741", "SP-0912"], 2.2, 308), sinceTs: Date.now() - 2.2 * H },
  { id: 9, name: "KN-09", brand: "Lonati E1530", status: "running", job: job("s10", 2600, 1610, "144N Ø3.5\"", ["PB-2210", "NC-4419"], 3.6, 312), sinceTs: Date.now() - 3.6 * H },
  { id: 10, name: "KN-10", brand: "Santoni FB15", status: "running", job: job("s12", 5200, 2650, "120N Ø3.25\"", ["CW-2418", "SP-0912"], 5.8, 295), sinceTs: Date.now() - 5.8 * H },
  { id: 11, name: "KN-11", brand: "Lonati E1220", status: "running", job: job("s16", 2400, 1980, "168N Ø3.75\"", ["CJ-1187", "SB-1130"], 4.7, 318), sinceTs: Date.now() - 4.7 * H },
  { id: 12, name: "KN-12", brand: "Santoni FB15", status: "running", job: job("s14", 2200, 620, "96N Ø4\"", ["NC-4419", "AR-3308"], 1.9, 285), sinceTs: Date.now() - 1.9 * H },
  { id: 13, name: "KN-13", brand: "Lonati E1530", status: "idle", note: "Awaiting next job order", sinceTs: Date.now() - 1.2 * H },
  { id: 14, name: "KN-14", brand: "Lonati E1530", status: "idle", note: "Threading — Spandex 20D on creel", sinceTs: Date.now() - 0.6 * H },
  { id: 15, name: "KN-15", brand: "Santoni FB15", status: "idle", note: "Cylinder change 144N → 156N", sinceTs: Date.now() - 2.4 * H },
  { id: 16, name: "KN-16", brand: "Lonati E1220", status: "idle", note: "Awaiting yarn issue — Forest GN-31", sinceTs: Date.now() - 3.1 * H },
  { id: 17, name: "KN-17", brand: "Lonati E1220", status: "idle", note: "Setting up — kids 5-pack program", sinceTs: Date.now() - 0.9 * H },
  { id: 18, name: "KN-18", brand: "Santoni FB15", status: "maintenance", note: "Broken needle latch — cylinder 156N", sinceTs: Date.now() - 5.5 * H },
  { id: 19, name: "KN-19", brand: "Lonati E1530", status: "maintenance", note: "Drive belt replacement", sinceTs: Date.now() - 9 * H },
  { id: 20, name: "KN-20", brand: "Santoni FB15", status: "maintenance", note: "Servo motor fault E-41", sinceTs: Date.now() - 26 * H },
];

const seedOrders: Order[] = [
  { id: "o1", code: "ORD-2201", customer: "Metro Retail Group", city: "Chennai", items: [{ styleId: "s01", dozens: 60 }, { styleId: "s04", dozens: 40 }], status: "open", dueTs: Date.now() + 5 * D, createdTs: Date.now() - 1.2 * D },
  { id: "o2", code: "ORD-2202", customer: "StepUp Distributors", city: "Coimbatore", items: [{ styleId: "s08", dozens: 80 }, { styleId: "s11", dozens: 35 }], status: "allocated", dueTs: Date.now() + 3 * D, createdTs: Date.now() - 2.1 * D },
  { id: "o3", code: "ORD-2203", customer: "CityMart Chain", city: "Bengaluru", items: [{ styleId: "s03", dozens: 90 }, { styleId: "s12", dozens: 70 }, { styleId: "s06", dozens: 45 }], status: "open", dueTs: Date.now() + 7 * D, createdTs: Date.now() - 0.4 * D },
  { id: "o4", code: "ORD-2199", customer: "Trailhead Outfitters", city: "Pune", items: [{ styleId: "s09", dozens: 55 }, { styleId: "s14", dozens: 20 }], status: "dispatched", dueTs: Date.now() - 1 * D, createdTs: Date.now() - 6 * D },
  { id: "o5", code: "ORD-2204", customer: "LittleSteps Kidswear", city: "Hyderabad", items: [{ styleId: "s11", dozens: 40 }, { styleId: "s13", dozens: 30 }], status: "open", dueTs: Date.now() + 9 * D, createdTs: Date.now() - 0.15 * D },
];

const scrapReasons = ["Press-off / hole at heel", "Yarn tension break", "Boarding stain", "Cuff elastic slack", "Needle line defect"];

export async function ensureSeed() {
  const count = await db.yarns.count();
  if (count > 0) return;
  const now = Date.now();

  const yarnLogs: YarnLog[] = [
    { yarnId: "y01", kind: "transfer", kg: 60, note: "Issued to floor — KN-01 job ANK-101", machineId: 1, ts: now - 6.2 * H },
    { yarnId: "y03", kind: "transfer", kg: 48, note: "Issued to floor — KN-03 job CRW-201", machineId: 3, ts: now - 7.5 * H },
    { yarnId: "y06", kind: "transfer", kg: 84, note: "Issued to floor — KN-04 job ATH-301", machineId: 4, ts: now - 2.8 * H },
    { yarnId: "y10", kind: "transfer", kg: 9, note: "Spandex creel top-up — knitting bay A", ts: now - 3.4 * H },
    { yarnId: "y04", kind: "receipt", kg: 200, note: "GRN-8841 from Nilgiri Spinning", ts: now - 1.1 * D },
    { yarnId: "y11", kind: "consumption", kg: 6, note: "Auto-deduct — KN-05 run ATH-302", machineId: 5, ts: now - 5 * H },
    { yarnId: "y02", kind: "consumption", kg: 11, note: "Auto-deduct — KN-02 run ANK-102", machineId: 2, ts: now - 3 * H },
    { yarnId: "y09", kind: "transfer", kg: 26, note: "Issued to floor — KN-12 job THM-501", machineId: 12, ts: now - 1.9 * H },
    { yarnId: "y13", kind: "receipt", kg: 126, note: "GRN-8856 from Aegis Fibres", ts: now - 2.3 * D },
    { yarnId: "y07", kind: "consumption", kg: 8, note: "Auto-deduct — KN-09 run ATH-303", machineId: 9, ts: now - 2.6 * H },
    { yarnId: "y12", kind: "transfer", kg: 12, note: "Elastic issue — kids line creel", ts: now - 8 * H },
    { yarnId: "y05", kind: "adjust", kg: -4, note: "Cycle count correction R2-A", ts: now - 1.6 * D },
  ];

  const scrapLogs: ScrapLog[] = Array.from({ length: 14 }, (_, i) => {
    const m = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 4, 7][i];
    const defect = 2 + Math.floor(Math.random() * 9);
    return {
      machineId: m,
      styleId: seedMachines[m - 1].job?.styleId,
      defectPairs: defect,
      wasteKg: +((defect * 0.05) + Math.random() * 0.4).toFixed(2),
      reason: scrapReasons[i % scrapReasons.length],
      ts: now - Math.floor(Math.random() * 10) * H,
    };
  });

  const auditLogs: AuditLog[] = [
    { ts: now - 0.2 * H, actor: "Shift A · Ravi", action: "OUTPUT_LOGGED", detail: "KN-07 +48 pairs KID-401 Mini Crew Play" },
    { ts: now - 1.4 * H, actor: "Shift A · Ravi", action: "YARN_ISSUED", detail: "84 kg PO-5527 → KN-04 (ATH-301)" },
    { ts: now - 2.2 * H, actor: "Maint · Ibrahim", action: "MACHINE_DOWN", detail: "KN-20 flagged — servo motor fault E-41" },
    { ts: now - 3 * H, actor: "WH · Deepa", action: "ORDER_ALLOCATED", detail: "ORD-2202 StepUp Distributors reserved 115 dz" },
    { ts: now - 5.2 * H, actor: "System", action: "JOB_STARTED", detail: "KN-12 started THM-501 × 2,200 pairs" },
    { ts: now - 26 * H, actor: "WH · Deepa", action: "ORDER_DISPATCHED", detail: "ORD-2199 Trailhead Outfitters — 75 dz left dock 2" },
  ];

  const dailyStats: DailyStat[] = Array.from({ length: 14 }, (_, i) => {
    const t = now - (13 - i) * D;
    const pairs = i === 13 ? 4860 : 9400 + Math.floor(Math.random() * 4600);
    const scrap = Math.round(pairs * (0.016 + Math.random() * 0.022));
    return { id: dayKey(t), pairs, yarnKg: Math.round(pairs * 0.118 + Math.random() * 140), scrapPairs: scrap };
  });

  await db.transaction("rw", [db.yarns, db.yarnLogs, db.machines, db.sockStyles, db.orders, db.scrapLogs, db.auditLogs, db.dailyStats], async () => {
    await db.yarns.bulkPut(seedYarns);
    await db.sockStyles.bulkPut(seedStyles);
    await db.machines.bulkPut(seedMachines);
    await db.orders.bulkPut(seedOrders);
    await db.yarnLogs.bulkAdd(yarnLogs);
    await db.scrapLogs.bulkAdd(scrapLogs);
    await db.auditLogs.bulkAdd(auditLogs);
    await db.dailyStats.bulkPut(dailyStats);
  });
}

export const styleById = (styles: SockStyle[], id?: string) => styles.find((s) => s.id === id);

export const yarnStatus = (y: Yarn): "ok" | "low" | "out" =>
  y.weightKg <= 0 ? "out" : y.weightKg < y.minKg ? "low" : "ok";
