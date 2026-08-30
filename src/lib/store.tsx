import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  db, ensureSeed, dayKey,
  type Yarn, type YarnLog, type Machine, type SockStyle, type Order,
  type ScrapLog, type AuditLog, type DailyStat,
} from "./db";

export interface DataState {
  yarns: Yarn[];
  yarnLogs: YarnLog[];
  machines: Machine[];
  sockStyles: SockStyle[];
  orders: Order[];
  scrapLogs: ScrapLog[];
  auditLogs: AuditLog[];
  dailyStats: DailyStat[];
}

export type ToastKind = "ok" | "warn" | "bad";
export interface Toast { id: number; kind: ToastKind; title: string; msg?: string }

export interface AssignJobInput {
  styleId: string;
  targetPairs: number;
  needle: string;
  yarnIds: string[];
  speedRpm: number;
}

interface StoreValue {
  ready: boolean;
  data: DataState;
  online: boolean;
  theme: "dark" | "light";
  toggleTheme: () => void;
  toasts: Toast[];
  toast: (kind: ToastKind, title: string, msg?: string) => void;
  dismissToast: (id: number) => void;
  assignJob: (machineId: number, input: AssignJobInput) => Promise<boolean>;
  logMachineOutput: (machineId: number, pairs: number, scrapPairs: number, reason?: string) => Promise<void>;
  setMachineStatus: (machineId: number, status: Machine["status"], note?: string) => Promise<void>;
  finishJob: (machineId: number) => Promise<void>;
  transferYarn: (yarnId: string, kg: number, note: string) => Promise<boolean>;
  receiveYarn: (yarnId: string, kg: number, note: string) => Promise<void>;
  recordFinishingOutput: (styleId: string, pairs: number) => Promise<void>;
  allocateOrder: (orderId: string) => Promise<boolean>;
  dispatchOrder: (orderId: string) => Promise<boolean>;
  recordScrap: (machineId: number, defectPairs: number, wasteKg: number, reason: string) => Promise<void>;
}

const Ctx = createContext<StoreValue | null>(null);

const empty: DataState = {
  yarns: [], yarnLogs: [], machines: [], sockStyles: [], orders: [], scrapLogs: [], auditLogs: [], dailyStats: [],
};

const ACTOR = "Floor Tablet · Unit 2";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<DataState>(empty);
  const [online, setOnline] = useState(navigator.onLine);
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("socktrack-theme") as "dark" | "light") || "dark");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(1);
  const consumptionBuf = useRef(new Map<number, number>());
  const tickCount = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("socktrack-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  const toast = useCallback((kind: ToastKind, title: string, msg?: string) => {
    const id = toastId.current++;
    setToasts((ts) => [...ts.slice(-3), { id, kind, title, msg }]);
    window.setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 4400);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  const refresh = useCallback(async () => {
    const [yarns, yarnLogs, machines, sockStyles, orders, scrapLogs, auditLogs, dailyStats] = await Promise.all([
      db.yarns.orderBy("code").toArray(),
      db.yarnLogs.orderBy("ts").reverse().limit(60).toArray(),
      db.machines.orderBy("id").toArray(),
      db.sockStyles.orderBy("styleCode").toArray(),
      db.orders.orderBy("dueTs").toArray(),
      db.scrapLogs.orderBy("ts").reverse().limit(40).toArray(),
      db.auditLogs.orderBy("ts").reverse().limit(30).toArray(),
      db.dailyStats.orderBy("id").toArray(),
    ]);
    setData({ yarns, yarnLogs, machines, sockStyles, orders, scrapLogs, auditLogs, dailyStats });
  }, []);

  /* ---------- boot ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      await ensureSeed();
      await refresh();
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, [refresh]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  /* ---------- live floor simulation ---------- */
  useEffect(() => {
    if (!ready) return;
    const t = window.setInterval(async () => {
      const running = await db.machines.where("status").equals("running").toArray();
      if (running.length === 0) return;
      tickCount.current++;
      const today = dayKey(Date.now());
      let dayPairs = 0;
      let dayScrap = 0;
      let dayYarn = 0;
      const styleDelta = new Map<string, number>();
      const completed: Machine[] = [];

      await db.transaction("rw", [db.machines, db.sockStyles, db.scrapLogs, db.dailyStats], async () => {
        for (const m of running) {
          if (!m.job) continue;
          const style = await db.sockStyles.get(m.job.styleId);
          if (!style) continue;
          const remaining = m.job.targetPairs - m.job.producedPairs;
          if (remaining <= 0) { completed.push(m); continue; }
          const gain = Math.min(remaining, 3 + Math.floor(Math.random() * 5));
          const scrap = Math.random() < 0.16 ? 1 + Math.floor(Math.random() * 3) : 0;
          const kg = +(((gain + scrap) * style.gramsPerPair) / 1000).toFixed(3);

          const produced = m.job.producedPairs + gain;
          m.job = { ...m.job, producedPairs: produced };
          if (produced >= m.job.targetPairs) completed.push(m);
          await db.machines.put({ ...m });

          await db.sockStyles.update(style.id, {
            pairsOnHand: style.pairsOnHand + gain,
            dozensOnHand: Math.round((style.pairsOnHand + gain) / 12),
          });

          consumptionBuf.current.set(m.id, (consumptionBuf.current.get(m.id) || 0) + kg);
          dayPairs += gain;
          dayYarn += kg;
          styleDelta.set(style.id, gain);

          if (scrap > 0) {
            dayScrap += scrap;
            await db.scrapLogs.add({
              machineId: m.id, styleId: style.id, defectPairs: scrap,
              wasteKg: +((scrap * style.gramsPerPair) / 1000).toFixed(2),
              reason: "Auto-detected press-off", ts: Date.now(),
            });
          }
        }

        for (const m of completed) {
          if (m.job && m.job.producedPairs < m.job.targetPairs) {
            m.job = { ...m.job, producedPairs: m.job.targetPairs };
          }
          await db.machines.put({ ...m, status: "idle", note: "Job complete — awaiting collection", job: m.job });
        }

        if (dayPairs > 0 || dayScrap > 0) {
          const stat = await db.dailyStats.get(today);
          if (stat) {
            await db.dailyStats.put({
              ...stat,
              pairs: stat.pairs + dayPairs,
              scrapPairs: stat.scrapPairs + dayScrap,
              yarnKg: +(stat.yarnKg + dayYarn).toFixed(1),
            });
          } else {
            await db.dailyStats.put({ id: today, pairs: dayPairs, scrapPairs: dayScrap, yarnKg: +dayYarn.toFixed(1) });
          }
        }
      });

      // flush accumulated consumption to yarn audit trail every few ticks
      if (tickCount.current % 5 === 0 && consumptionBuf.current.size > 0) {
        const entries = [...consumptionBuf.current.entries()];
        consumptionBuf.current.clear();
        await db.transaction("rw", [db.yarns, db.yarnLogs], async () => {
          for (const [machineId, kg] of entries) {
            const m = await db.machines.get(machineId);
            const code = m?.job?.yarnBatchCodes?.[0];
            if (!code) continue;
            const yarn = await db.yarns.where("batch").equals(code).first();
            if (!yarn) continue;
            await db.yarnLogs.add({
              yarnId: yarn.id, kind: "consumption", kg: +kg.toFixed(2),
              note: `Auto-deduct — ${m?.name} production run (batch ${code})`, machineId, ts: Date.now(),
            });
          }
        });
      }

      if (completed.length > 0) {
        for (const m of completed) toast("ok", `${m.name} job complete`, `Target ${m.job?.targetPairs.toLocaleString()} pairs reached — machine idle.`);
        await db.auditLogs.add({ ts: Date.now(), actor: "System", action: "JOB_COMPLETE", detail: completed.map((m) => m.name).join(", ") + " target reached" });
      }

      await refresh();
    }, 3500);
    return () => window.clearInterval(t);
  }, [ready, refresh, toast]);

  /* ---------- actions ---------- */

  const audit = useCallback((action: string, detail: string, actor = ACTOR) =>
    db.auditLogs.add({ ts: Date.now(), actor, action, detail }), []);

  const assignJob = useCallback(async (machineId: number, input: AssignJobInput) => {
    const [machine, style] = await Promise.all([db.machines.get(machineId), db.sockStyles.get(input.styleId)]);
    if (!machine || !style) return false;
    const requiredKg = +(((input.targetPairs * style.gramsPerPair) / 1000) * 1.06).toFixed(1);
    const yarns = await Promise.all(input.yarnIds.map((id) => db.yarns.get(id)));
    const valid = yarns.filter((y): y is Yarn => !!y && y.weightKg > 0);
    if (valid.length === 0) { toast("bad", "No yarn selected", "Pick at least one yarn batch with stock."); return false; }

    // first yarn carries body weight, the rest split the remainder
    const shares = valid.map((_, i) => (i === 0 ? 0.92 : 0.08 / (valid.length - 1)));
    for (let i = 0; i < valid.length; i++) {
      const need = +(requiredKg * shares[i]).toFixed(1);
      if (valid[i].weightKg < need) {
        toast("bad", "Insufficient yarn", `${valid[i].code} ${valid[i].batch} needs ${need} kg, only ${valid[i].weightKg.toFixed(1)} kg on hand.`);
        return false;
      }
    }
    await db.transaction("rw", [db.machines, db.yarns, db.yarnLogs], async () => {
      for (let i = 0; i < valid.length; i++) {
        const need = +(requiredKg * shares[i]).toFixed(1);
        const y = valid[i];
        await db.yarns.update(y.id, { weightKg: +(y.weightKg - need).toFixed(1), updatedAt: Date.now() });
        await db.yarnLogs.add({
          yarnId: y.id, kind: "transfer", kg: need,
          note: `Issued to floor — ${machine.name} job ${style.styleCode}`, machineId, ts: Date.now(),
        });
      }
      await db.machines.update(machineId, {
        status: "running",
        sinceTs: Date.now(),
        note: undefined,
        job: {
          styleId: input.styleId, targetPairs: input.targetPairs, producedPairs: 0,
          needle: input.needle, yarnBatchCodes: valid.map((y) => y.batch),
          startedAt: Date.now(), speedRpm: input.speedRpm,
        },
      });
    });
    await audit("JOB_STARTED", `${machine.name} started ${style.styleCode} × ${input.targetPairs.toLocaleString()} pairs — ${requiredKg} kg yarn issued`);
    toast("ok", `Job assigned to ${machine.name}`, `${style.styleCode} · ${input.targetPairs.toLocaleString()} pairs · ${requiredKg} kg yarn issued to floor.`);
    await refresh();
    return true;
  }, [audit, refresh, toast]);

  const logMachineOutput = useCallback(async (machineId: number, pairs: number, scrapPairs: number, reason?: string) => {
    const m = await db.machines.get(machineId);
    if (!m || !m.job) return;
    const style = await db.sockStyles.get(m.job.styleId);
    if (!style) return;
    const produced = Math.min(m.job.targetPairs, m.job.producedPairs + pairs);
    const today = dayKey(Date.now());
    await db.transaction("rw", [db.machines, db.sockStyles, db.scrapLogs, db.dailyStats], async () => {
      await db.machines.update(machineId, { job: { ...m.job!, producedPairs: produced } });
      await db.sockStyles.update(style.id, {
        pairsOnHand: style.pairsOnHand + pairs,
        dozensOnHand: Math.round((style.pairsOnHand + pairs) / 12),
      });
      if (scrapPairs > 0) {
        await db.scrapLogs.add({
          machineId, styleId: style.id, defectPairs: scrapPairs,
          wasteKg: +((scrapPairs * style.gramsPerPair) / 1000).toFixed(2),
          reason: reason || "Manual entry", ts: Date.now(),
        });
      }
      const stat = await db.dailyStats.get(today);
      if (stat) await db.dailyStats.put({ ...stat, pairs: stat.pairs + pairs, scrapPairs: stat.scrapPairs + scrapPairs });
      else await db.dailyStats.put({ id: today, pairs, scrapPairs, yarnKg: 0 });
    });
    await audit("OUTPUT_LOGGED", `${m.name} +${pairs} pairs ${style.styleCode}${scrapPairs > 0 ? ` · ${scrapPairs} scrap` : ""}`);
    toast("ok", `Output recorded — ${m.name}`, `+${pairs} pairs ${style.styleCode} into warehouse${scrapPairs > 0 ? `, ${scrapPairs} pairs to scrap` : ""}.`);
    await refresh();
  }, [audit, refresh, toast]);

  const setMachineStatus = useCallback(async (machineId: number, status: Machine["status"], note?: string) => {
    const m = await db.machines.get(machineId);
    if (!m) return;
    await db.machines.update(machineId, { status, sinceTs: Date.now(), note: note ?? (status === "idle" ? "Awaiting job order" : undefined) });
    if (status === "maintenance") await audit("MACHINE_DOWN", `${m.name} flagged — ${note || "maintenance"}`, "Maint · Ibrahim");
    if (status === "running") await audit("MACHINE_RESUMED", `${m.name} back in production`);
    if (status === "idle") await audit("MACHINE_IDLE", `${m.name} set idle`);
    toast(status === "maintenance" ? "warn" : "ok", `${m.name} → ${status.toUpperCase()}`, note);
    await refresh();
  }, [audit, refresh, toast]);

  const finishJob = useCallback(async (machineId: number) => {
    const m = await db.machines.get(machineId);
    if (!m || !m.job) return;
    const styleId = m.job.styleId;
    await db.machines.update(machineId, { status: "idle", note: "Job closed — awaiting collection", job: undefined, sinceTs: Date.now() });
    await audit("JOB_CLOSED", `${m.name} job ${styleId.toUpperCase()} closed at ${m.job.producedPairs.toLocaleString()} pairs`);
    toast("ok", `${m.name} job closed`, "Machine released and set to idle.");
    await refresh();
  }, [audit, refresh, toast]);

  const transferYarn = useCallback(async (yarnId: string, kg: number, note: string) => {
    const y = await db.yarns.get(yarnId);
    if (!y) return false;
    if (kg > y.weightKg) { toast("bad", "Exceeds stock", `${y.code} has only ${y.weightKg.toFixed(1)} kg available.`); return false; }
    await db.transaction("rw", [db.yarns, db.yarnLogs], async () => {
      await db.yarns.update(yarnId, { weightKg: +(y.weightKg - kg).toFixed(1), updatedAt: Date.now() });
      await db.yarnLogs.add({ yarnId, kind: "transfer", kg, note: note || "Manual transfer to knitting floor", ts: Date.now() });
    });
    await audit("YARN_ISSUED", `${kg} kg ${y.code} ${y.batch} → floor (${note || "manual"})`);
    toast("ok", "Yarn issued to floor", `${kg} kg of ${y.code} · ${y.colorName} deducted from ${y.rack}.`);
    await refresh();
    return true;
  }, [audit, refresh, toast]);

  const receiveYarn = useCallback(async (yarnId: string, kg: number, note: string) => {
    const y = await db.yarns.get(yarnId);
    if (!y) return;
    await db.transaction("rw", [db.yarns, db.yarnLogs], async () => {
      await db.yarns.update(yarnId, { weightKg: +(y.weightKg + kg).toFixed(1), updatedAt: Date.now() });
      await db.yarnLogs.add({ yarnId, kind: "receipt", kg, note: note || "Goods receipt — purchase order", ts: Date.now() });
    });
    await audit("YARN_RECEIVED", `${kg} kg ${y.code} ${y.batch} booked into ${y.rack}`);
    toast("ok", "Stock received", `${kg} kg of ${y.code} added — new balance ${(y.weightKg + kg).toFixed(1)} kg.`);
    await refresh();
  }, [audit, refresh, toast]);

  const recordFinishingOutput = useCallback(async (styleId: string, pairs: number) => {
    const s = await db.sockStyles.get(styleId);
    if (!s) return;
    const today = dayKey(Date.now());
    await db.transaction("rw", [db.sockStyles, db.dailyStats], async () => {
      await db.sockStyles.update(styleId, {
        pairsOnHand: s.pairsOnHand + pairs,
        dozensOnHand: Math.round((s.pairsOnHand + pairs) / 12),
      });
      const stat = await db.dailyStats.get(today);
      if (stat) await db.dailyStats.put({ ...stat, pairs: stat.pairs + pairs });
      else await db.dailyStats.put({ id: today, pairs, scrapPairs: 0, yarnKg: 0 });
    });
    await audit("FINISHING_OUTPUT", `${s.styleCode} +${pairs} pairs from linking/boarding → ${s.rack}`, "Finishing · Meena");
    toast("ok", "Finished goods booked", `+${pairs} pairs ${s.styleCode} into rack ${s.rack}.`);
    await refresh();
  }, [audit, refresh, toast]);

  const allocateOrder = useCallback(async (orderId: string) => {
    const order = await db.orders.get(orderId);
    if (!order || order.status !== "open") return false;
    const shortages: string[] = [];
    for (const item of order.items) {
      const s = await db.sockStyles.get(item.styleId);
      if (!s) continue;
      const available = s.dozensOnHand - s.dozensReserved;
      if (available < item.dozens) shortages.push(`${s.styleCode}: needs ${item.dozens} dz, free ${available} dz`);
    }
    if (shortages.length > 0) {
      toast("bad", "Cannot allocate — short stock", shortages.join(" · "));
      return false;
    }
    await db.transaction("rw", db.sockStyles, async () => {
      for (const item of order.items) {
        const s = await db.sockStyles.get(item.styleId);
        if (s) await db.sockStyles.update(s.id, { dozensReserved: s.dozensReserved + item.dozens });
      }
    });
    await db.orders.update(orderId, { status: "allocated" });
    const totalDz = order.items.reduce((a, i) => a + i.dozens, 0);
    await audit("ORDER_ALLOCATED", `${order.code} ${order.customer} reserved ${totalDz} dz`);
    toast("ok", `${order.code} allocated`, `${totalDz} dozen reserved across ${order.items.length} SKUs for ${order.customer}.`);
    await refresh();
    return true;
  }, [audit, refresh, toast]);

  const dispatchOrder = useCallback(async (orderId: string) => {
    const order = await db.orders.get(orderId);
    if (!order || order.status !== "allocated") return false;
    await db.transaction("rw", db.sockStyles, async () => {
      for (const item of order.items) {
        const s = await db.sockStyles.get(item.styleId);
        if (!s) continue;
        const pairs = item.dozens * 12;
        await db.sockStyles.update(s.id, {
          pairsOnHand: Math.max(0, s.pairsOnHand - pairs),
          dozensOnHand: Math.max(0, s.dozensOnHand - item.dozens),
          dozensReserved: Math.max(0, s.dozensReserved - item.dozens),
        });
      }
    });
    await db.orders.update(orderId, { status: "dispatched" });
    const totalDz = order.items.reduce((a, i) => a + i.dozens, 0);
    await audit("ORDER_DISPATCHED", `${order.code} ${order.customer} — ${totalDz} dz left the dock`, "Dispatch · Kader");
    toast("ok", `${order.code} dispatched`, `${totalDz} dozen for ${order.customer} deducted from warehouse stock.`);
    await refresh();
    return true;
  }, [audit, refresh, toast]);

  const recordScrap = useCallback(async (machineId: number, defectPairs: number, wasteKg: number, reason: string) => {
    const m = await db.machines.get(machineId);
    const today = dayKey(Date.now());
    await db.transaction("rw", [db.scrapLogs, db.dailyStats], async () => {
      await db.scrapLogs.add({ machineId, defectPairs, wasteKg, reason, ts: Date.now(), styleId: m?.job?.styleId });
      const stat = await db.dailyStats.get(today);
      if (stat) await db.dailyStats.put({ ...stat, scrapPairs: stat.scrapPairs + defectPairs });
      else await db.dailyStats.put({ id: today, pairs: 0, scrapPairs: defectPairs, yarnKg: 0 });
    });
    await audit("SCRAP_LOGGED", `${m?.name ?? "Machine " + machineId} ${defectPairs} defective pairs — ${reason}`, "QC · Selvi");
    toast("warn", "Scrap recorded", `${defectPairs} pairs · ${wasteKg} kg waste — ${reason}.`);
    await refresh();
  }, [audit, refresh, toast]);

  const value = useMemo<StoreValue>(() => ({
    ready, data, online, theme, toggleTheme, toasts, toast, dismissToast,
    assignJob, logMachineOutput, setMachineStatus, finishJob,
    transferYarn, receiveYarn, recordFinishingOutput, allocateOrder, dispatchOrder, recordScrap,
  }), [ready, data, online, theme, toggleTheme, toasts, toast, dismissToast, assignJob, logMachineOutput, setMachineStatus, finishJob, transferYarn, receiveYarn, recordFinishingOutput, allocateOrder, dispatchOrder, recordScrap]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside provider");
  return v;
}
