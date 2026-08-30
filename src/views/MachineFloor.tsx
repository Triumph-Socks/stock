import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Gauge, Wrench, ClipboardList, PackagePlus, CheckCheck, Zap, Timer, FlagTriangleRight } from "lucide-react";
import { useStore } from "../lib/store";
import type { Machine } from "../lib/db";
import { AnimatedNumber, Badge, cls, Dot, Field, fmt, Modal, ProgressBar, timeAgo, toneText } from "../components/ui";

const NEEDLES = ["96N Ø4\"", "108N Ø3.75\"", "120N Ø3.25\"", "132N Ø3.5\"", "144N Ø3.5\"", "156N Ø3.75\"", "168N Ø3.75\"", "200N Ø4\""];
const SCRAP_REASONS = ["Press-off / hole at heel", "Yarn tension break", "Boarding stain", "Cuff elastic slack", "Needle line defect", "Size out of tolerance"];

function UtilRing({ pct }: { pct: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[76px] w-[76px] shrink-0">
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--raise)" strokeWidth="8" />
        <motion.circle
          cx="38" cy="38" r={r} fill="none" stroke="var(--ok)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={{ type: "spring", stiffness: 60, damping: 20 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-mono text-[15px] font-semibold text-ink">{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

/* ---------------- assign job modal ---------------- */

function AssignJobModal({ machine, onClose }: { machine: Machine; onClose: () => void }) {
  const { data, assignJob } = useStore();
  const [styleId, setStyleId] = useState(data.sockStyles[0]?.id ?? "");
  const [target, setTarget] = useState(2400);
  const [needle, setNeedle] = useState("144N Ø3.5\"");
  const [rpm, setRpm] = useState(300);
  const [yarnIds, setYarnIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const style = data.sockStyles.find((s) => s.id === styleId);
  const requiredKg = style ? +(((target * style.gramsPerPair) / 1000) * 1.06).toFixed(1) : 0;

  const toggleYarn = (id: string) =>
    setYarnIds((ids) => (ids.includes(id) ? ids.filter((y) => y !== id) : [...ids, id]));

  const submit = async () => {
    setBusy(true);
    const ok = await assignJob(machine.id, { styleId, targetPairs: target, needle, yarnIds, speedRpm: rpm });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Assign production job — ${machine.name}`}
      subtitle={`${machine.brand} · yarn is auto-issued to the floor on start`}
      width={640}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!styleId || yarnIds.length === 0 || target < 100 || busy} onClick={submit}>
            <Zap size={14} /> Start job · issue {fmt(requiredKg, 1)} kg
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sock design / style">
          <select className="select" value={styleId} onChange={(e) => setStyleId(e.target.value)}>
            {data.sockStyles.map((s) => (
              <option key={s.id} value={s.id}>{s.styleCode} — {s.name} ({s.color})</option>
            ))}
          </select>
        </Field>
        <Field label="Needle cylinder">
          <select className="select" value={needle} onChange={(e) => setNeedle(e.target.value)}>
            {NEEDLES.map((n) => <option key={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Target pairs">
          <input type="number" className="input" min={100} step={100} value={target} onChange={(e) => setTarget(Math.max(0, +e.target.value))} />
        </Field>
        <Field label="Machine speed (rpm)">
          <input type="number" className="input" min={180} max={350} value={rpm} onChange={(e) => setRpm(Math.max(0, +e.target.value))} />
        </Field>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {[1200, 2400, 3600, 5000].map((v) => (
          <button key={v} className={cls("chip cursor-pointer transition-colors hover:border-accent hover:text-accent", target === v && "border-accent/60 text-accent")} onClick={() => setTarget(v)}>
            {fmt(v)} pairs
          </button>
        ))}
      </div>

      <div className="mt-4">
        <span className="label mb-1.5 block">Required yarn batches (issued from raw stock)</span>
        <div className="max-h-44 overflow-y-auto rounded-lg border border-line">
          {data.yarns.map((y) => {
            const selected = yarnIds.includes(y.id);
            const out = y.weightKg <= 0;
            return (
              <button
                key={y.id}
                disabled={out}
                onClick={() => toggleYarn(y.id)}
                className={cls(
                  "flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left transition-colors last:border-b-0",
                  selected ? "bg-accent/10" : "hover:bg-panel2",
                  out && "cursor-not-allowed opacity-40",
                )}
              >
                <span className={cls("grid h-4 w-4 shrink-0 place-items-center rounded border", selected ? "border-accent bg-accent" : "border-line2")}>
                  {selected && <CheckCheck size={11} className="text-accent-ink" />}
                </span>
                <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-line2" style={{ background: y.colorHex }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{y.code} · {y.colorName} <span className="text-dim">({y.count})</span></span>
                  <span className="font-mono text-[10.5px] text-dim">Batch {y.batch} · {y.rack}</span>
                </span>
                <span className={cls("font-mono text-xs font-semibold", out ? "text-bad" : y.weightKg < y.minKg ? "text-warn" : "text-ok")}>
                  {fmt(y.weightKg, 1)} kg
                </span>
              </button>
            );
          })}
        </div>
        {style && (
          <p className="mt-2 text-[11.5px] text-mut">
            Material plan: <span className="font-mono font-semibold text-ink">{fmt(requiredKg, 1)} kg</span> total
            ({style.gramsPerPair} g/pair × {fmt(target)} pairs + 6% process loss) — first selected yarn carries 92% body weight.
          </p>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- output / scrap modal ---------------- */

function OutputModal({ machine, onClose }: { machine: Machine; onClose: () => void }) {
  const { logMachineOutput } = useStore();
  const [pairs, setPairs] = useState(48);
  const [scrap, setScrap] = useState(0);
  const [reason, setReason] = useState(SCRAP_REASONS[0]);
  const [busy, setBusy] = useState(false);
  const job = machine.job!;
  const remaining = job.targetPairs - job.producedPairs;

  const submit = async () => {
    setBusy(true);
    await logMachineOutput(machine.id, Math.min(pairs, Math.max(0, remaining)), scrap, reason);
    setBusy(false);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Record output — ${machine.name}`}
      subtitle={`${job.styleId.toUpperCase()} · ${fmt(job.producedPairs)} / ${fmt(job.targetPairs)} pairs · ${fmt(remaining)} remaining`}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-ok" disabled={pairs <= 0 || busy} onClick={submit}>
            <PackagePlus size={14} /> Book {fmt(Math.min(pairs, Math.max(0, remaining)))} pairs
          </button>
        </>
      }
    >
      <ProgressBar value={job.producedPairs} max={job.targetPairs} tone="ok" live height={8} />
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Good pairs to warehouse">
          <input type="number" className="input font-mono" min={0} value={pairs} onChange={(e) => setPairs(Math.max(0, +e.target.value))} />
        </Field>
        <Field label="Defective pairs (scrap)">
          <input type="number" className="input font-mono" min={0} value={scrap} onChange={(e) => setScrap(Math.max(0, +e.target.value))} />
        </Field>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[12, 48, 100, 250].map((v) => (
          <button key={v} className="chip cursor-pointer transition-colors hover:border-ok hover:text-ok" onClick={() => setPairs((p) => p + v)}>
            +{v}
          </button>
        ))}
        <button className="chip cursor-pointer transition-colors hover:border-bad hover:text-bad" onClick={() => setScrap((s) => s + 1)}>+1 scrap</button>
      </div>
      {scrap > 0 && (
        <div className="mt-3">
          <Field label="Scrap reason">
            <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
              {SCRAP_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
        </div>
      )}
    </Modal>
  );
}

function ScrapModal({ machine, onClose }: { machine: Machine; onClose: () => void }) {
  const { recordScrap } = useStore();
  const [defect, setDefect] = useState(4);
  const [waste, setWaste] = useState(0.3);
  const [reason, setReason] = useState(SCRAP_REASONS[0]);
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Log scrap — ${machine.name}`}
      subtitle="Defective knits & yarn cutting waste for calibration monitoring"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-bad"
            disabled={defect <= 0 || busy}
            onClick={async () => { setBusy(true); await recordScrap(machine.id, defect, waste, reason); setBusy(false); onClose(); }}
          >
            <FlagTriangleRight size={14} /> Record scrap
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Defective pairs">
          <input type="number" className="input font-mono" min={0} value={defect} onChange={(e) => setDefect(Math.max(0, +e.target.value))} />
        </Field>
        <Field label="Yarn waste (kg)">
          <input type="number" className="input font-mono" min={0} step={0.1} value={waste} onChange={(e) => setWaste(Math.max(0, +e.target.value))} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Reason code">
          <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
            {SCRAP_REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

/* ---------------- machine card ---------------- */

const statusEdge: Record<Machine["status"], string> = {
  running: "border-l-ok",
  idle: "border-l-warn",
  maintenance: "border-l-bad",
};

function MachineCard({ m, onAssign, onOutput, onScrap, index }: {
  m: Machine;
  onAssign: () => void;
  onOutput: () => void;
  onScrap: () => void;
  index: number;
}) {
  const { data, setMachineStatus, finishJob } = useStore();
  const style = m.job ? data.sockStyles.find((s) => s.id === m.job!.styleId) : undefined;
  const pct = m.job ? (m.job.producedPairs / m.job.targetPairs) * 100 : 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4), duration: 0.3 }}
      className={cls("card border-l-4 p-4 transition-shadow hover:shadow-[var(--shadow)]", statusEdge[m.status])}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-[17px] font-bold tracking-wide text-ink">{m.name}</h3>
            <Dot tone={m.status === "running" ? "ok" : m.status === "idle" ? "warn" : "bad"} pulse={m.status === "running"} />
          </div>
          <p className="mt-0.5 font-mono text-[10.5px] text-dim">{m.brand}</p>
        </div>
        {m.status === "running" && <Badge tone="ok" pulse>Running</Badge>}
        {m.status === "idle" && <Badge tone="warn">Idle / Setup</Badge>}
        {m.status === "maintenance" && <Badge tone="bad">Down</Badge>}
      </div>

      {m.status === "running" && m.job && style ? (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-[13px] font-semibold text-ink">{style.styleCode}</span>
            <span className="truncate text-[11px] text-mut">{style.name} · {style.color}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <AnimatedNumber value={m.job.producedPairs} className="font-mono text-[22px] font-semibold leading-none text-ink" />
            <span className="font-mono text-[12px] text-dim">/ {fmt(m.job.targetPairs)} pairs</span>
          </div>
          <div className="mt-2">
            <ProgressBar value={m.job.producedPairs} max={m.job.targetPairs} tone={pct > 92 ? "accent" : "ok"} live height={7} />
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="chip">{m.job.needle}</span>
            <span className="chip"><Gauge size={11} /> {m.job.speedRpm} rpm</span>
            <span className="chip"><Timer size={11} /> {timeAgo(m.job.startedAt)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {m.job.yarnBatchCodes.map((b) => (
              <span key={b} className="rounded bg-raise px-1.5 py-0.5 font-mono text-[10px] text-mut">{b}</span>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <button className="btn btn-ok btn-sm" onClick={onOutput}><PackagePlus size={13} /> Output</button>
            <button className="btn btn-sm" onClick={onScrap} title="Log scrap"><FlagTriangleRight size={13} /> Scrap</button>
            <button className="btn btn-sm" onClick={() => finishJob(m.id)} title="Close job & free machine"><CheckCheck size={13} /> Close</button>
          </div>
        </div>
      ) : m.status === "maintenance" ? (
        <div className="mt-3 flex h-[132px] flex-col">
          <p className="flex items-start gap-2 text-[12.5px] leading-snug text-mut">
            <Wrench size={14} className="mt-0.5 shrink-0 text-bad" /> {m.note || "Under maintenance"}
          </p>
          <p className="mt-1.5 font-mono text-[10.5px] text-dim">Down {timeAgo(m.sinceTs)}</p>
          <div className="mt-auto">
            <button className="btn btn-sm w-full" onClick={() => setMachineStatus(m.id, m.job ? "running" : "idle", "Returned to service")}>
              <Zap size={13} /> Return to service
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex h-[132px] flex-col">
          <p className="text-[12.5px] leading-snug text-mut">{m.note || "Awaiting job order"}</p>
          {m.job && (
            <p className="mt-1 font-mono text-[10.5px] text-dim">
              Last job {m.job.styleId.toUpperCase()} · {fmt(m.job.producedPairs)} / {fmt(m.job.targetPairs)} pairs
            </p>
          )}
          <p className="mt-1.5 font-mono text-[10.5px] text-dim">Idle {timeAgo(m.sinceTs)}</p>
          <div className="mt-auto grid grid-cols-2 gap-1.5">
            <button className="btn btn-primary btn-sm" onClick={onAssign}><ClipboardList size={13} /> Assign job</button>
            <button className="btn btn-bad btn-sm" onClick={() => setMachineStatus(m.id, "maintenance", "Pulled for maintenance from floor board")}>
              <Wrench size={13} /> Down
            </button>
          </div>
        </div>
      )}
    </motion.article>
  );
}

/* ---------------- view ---------------- */

type Filter = "all" | "running" | "idle" | "maintenance";

export default function MachineFloor() {
  const { data } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [assignFor, setAssignFor] = useState<Machine | null>(null);
  const [outputFor, setOutputFor] = useState<Machine | null>(null);
  const [scrapFor, setScrapFor] = useState<Machine | null>(null);

  const running = data.machines.filter((m) => m.status === "running");
  const idle = data.machines.filter((m) => m.status === "idle");
  const down = data.machines.filter((m) => m.status === "maintenance");
  const utilization = data.machines.length ? (running.length / data.machines.length) * 100 : 0;

  const today = data.dailyStats[data.dailyStats.length - 1];
  const todayScrapRate = today && today.pairs > 0 ? (today.scrapPairs / today.pairs) * 100 : 0;

  const visible = useMemo(
    () => (filter === "all" ? data.machines : data.machines.filter((m) => m.status === filter)),
    [data.machines, filter],
  );

  const filters: { id: Filter; label: string; count: number; tone: string }[] = [
    { id: "all", label: "All machines", count: data.machines.length, tone: "text-ink" },
    { id: "running", label: "Running", count: running.length, tone: "text-ok" },
    { id: "idle", label: "Idle / Setup", count: idle.length, tone: "text-warn" },
    { id: "maintenance", label: "Maintenance", count: down.length, tone: "text-bad" },
  ];

  return (
    <div className="space-y-4">
      {/* andon strip */}
      <div className="card flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4">
        <div className="flex items-center gap-4">
          <UtilRing pct={utilization} />
          <div>
            <div className="label">Fleet utilization</div>
            <div className="mt-1 font-mono text-sm font-semibold text-ink">{running.length} of {data.machines.length} knitting</div>
          </div>
        </div>
        <div className="h-10 w-px bg-line" />
        <div>
          <div className="label">Today's output</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <AnimatedNumber value={today?.pairs ?? 0} className="font-mono text-[24px] font-semibold leading-none text-ink" />
            <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-dim">pairs</span>
          </div>
        </div>
        <div>
          <div className="label">Scrap rate today</div>
          <div className={cls("mt-1 flex items-baseline gap-1.5 font-mono text-[24px] font-semibold leading-none", todayScrapRate > 3 ? "text-bad" : todayScrapRate > 2 ? "text-warn" : "text-ink")}>
            <AnimatedNumber value={todayScrapRate} digits={2} />
            <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-dim">%</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          {[
            { label: "Running", n: running.length, tone: "ok" as const },
            { label: "Idle", n: idle.length, tone: "warn" as const },
            { label: "Down", n: down.length, tone: "bad" as const },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <Dot tone={s.tone} pulse={s.tone === "ok"} />
              <span className="font-mono text-lg font-semibold text-ink">{s.n}</span>
              <span className={cls("font-display text-[10px] font-semibold uppercase tracking-widest", toneText(s.tone))}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cls(
              "chip cursor-pointer px-3 py-1.5 text-[11.5px] transition-all",
              filter === f.id ? "border-accent/60 bg-accent/12 text-accent" : "hover:border-line2 hover:text-ink",
            )}
          >
            {f.label}
            <span className={cls("font-semibold", filter === f.id ? "text-accent" : f.tone)}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* machine grid */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {visible.map((m, i) => (
          <MachineCard
            key={m.id}
            m={m}
            index={i}
            onAssign={() => setAssignFor(m)}
            onOutput={() => setOutputFor(m)}
            onScrap={() => setScrapFor(m)}
          />
        ))}
      </div>

      {assignFor && <AssignJobModal machine={assignFor} onClose={() => setAssignFor(null)} />}
      {outputFor && outputFor.job && <OutputModal machine={outputFor} onClose={() => setOutputFor(null)} />}
      {scrapFor && <ScrapModal machine={scrapFor} onClose={() => setScrapFor(null)} />}
    </div>
  );
}
