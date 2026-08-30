import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle2, AlertTriangle, XCircle, Inbox } from "lucide-react";
import { useStore } from "../lib/store";

/* ---------- helpers ---------- */

export const cls = (...p: (string | false | null | undefined)[]) => p.filter(Boolean).join(" ");

export const fmt = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const timeAgo = (ts: number) => {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export const dueLabel = (ts: number) => {
  const d = Math.ceil((ts - Date.now()) / 86_400_000);
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "due today";
  return `in ${d}d`;
};

/* ---------- animated number ---------- */

export function AnimatedNumber({ value, digits = 0, className }: { value: number; digits?: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const raf = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const dur = 650;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(from + (to - from) * e);
      if (p < 1) raf.current = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  return <span className={cls("tick-num", className)}>{fmt(shown, digits)}</span>;
}

/* ---------- badges & dots ---------- */

export type Tone = "ok" | "warn" | "bad" | "info" | "mut" | "accent";

const toneBg: Record<Tone, string> = {
  ok: "bg-ok/12 text-ok border-ok/35",
  warn: "bg-warn/12 text-warn border-warn/35",
  bad: "bg-bad/12 text-bad border-bad/35",
  info: "bg-info/12 text-info border-info/35",
  mut: "bg-panel2 text-mut border-line2",
  accent: "bg-accent/12 text-accent border-accent/35",
};

export function Badge({ tone = "mut", children, pulse }: { tone?: Tone; children: React.ReactNode; pulse?: boolean }) {
  return (
    <span className={cls("inline-flex items-center gap-1.5 rounded-md border px-2 py-[3px] font-display text-[10.5px] font-semibold uppercase tracking-[0.1em]", toneBg[tone])}>
      {pulse && <Dot tone={tone} pulse />}
      {children}
    </span>
  );
}

const toneSolid: Record<Tone, string> = {
  ok: "bg-ok text-ok", warn: "bg-warn text-warn", bad: "bg-bad text-bad",
  info: "bg-info text-info", mut: "bg-dim text-dim", accent: "bg-accent text-accent",
};

export function Dot({ tone, pulse }: { tone: Tone; pulse?: boolean }) {
  const solid = toneSolid[tone].split(" ")[0];
  return <span className={cls("inline-block h-2 w-2 rounded-full", solid, pulse && "pulse-dot", toneSolid[tone].split(" ")[1])} />;
}

export function YarnStatusBadge({ status }: { status: "ok" | "low" | "out" }) {
  if (status === "out") return <Badge tone="bad" pulse>Out of stock</Badge>;
  if (status === "low") return <Badge tone="warn">Low stock</Badge>;
  return <Badge tone="ok">In safety zone</Badge>;
}

export function MachineStatusBadge({ status }: { status: "running" | "idle" | "maintenance" }) {
  if (status === "running") return <Badge tone="ok" pulse>Running</Badge>;
  if (status === "idle") return <Badge tone="warn">Idle / Setup</Badge>;
  return <Badge tone="bad">Down</Badge>;
}

export function OrderStatusBadge({ status }: { status: "open" | "allocated" | "dispatched" }) {
  if (status === "dispatched") return <Badge tone="mut">Dispatched</Badge>;
  if (status === "allocated") return <Badge tone="info">Allocated</Badge>;
  return <Badge tone="accent">Open</Badge>;
}

/* ---------- progress ---------- */

export function ProgressBar({ value, max, tone = "ok", height = 6, live }: { value: number; max: number; tone?: Tone; height?: number; live?: boolean }) {
  const pct = max <= 0 ? 0 : Math.min(100, (value / max) * 100);
  const barTone: Record<Tone, string> = {
    ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", info: "bg-info", mut: "bg-dim", accent: "bg-accent",
  };
  return (
    <div className="w-full overflow-hidden rounded-full bg-raise" style={{ height }}>
      <motion.div
        className={cls("h-full rounded-full", barTone[tone], live && "stripes-live")}
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 90, damping: 24 }}
      />
    </div>
  );
}

/* ---------- modal ---------- */

export function Modal({ open, onClose, title, subtitle, children, footer, width = 520 }: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="card relative z-10 max-h-[88vh] w-full overflow-hidden shadow-[var(--shadow)]"
            style={{ maxWidth: width }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <h3 className="font-display text-[15px] font-semibold tracking-wide text-ink">{title}</h3>
                {subtitle && <p className="mt-0.5 text-xs text-mut">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="rounded-md border border-line p-1.5 text-mut transition-colors hover:border-line2 hover:text-ink" aria-label="Close">
                <X size={15} />
              </button>
            </div>
            <div className="max-h-[62vh] overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-panel2/60 px-5 py-3.5">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-dim">{hint}</span>}
    </label>
  );
}

/* ---------- stat ---------- */

export function Stat({ label, value, unit, tone, sub, icon }: {
  label: string; value: React.ReactNode; unit?: string; tone?: Tone; sub?: React.ReactNode; icon?: React.ReactNode;
}) {
  const accentLine: Record<Tone, string> = {
    ok: "before:bg-ok", warn: "before:bg-warn", bad: "before:bg-bad", info: "before:bg-info", mut: "before:bg-dim", accent: "before:bg-accent",
  };
  return (
    <div className={cls("card relative overflow-hidden px-4 py-3.5", tone && "before:absolute before:inset-y-0 before:left-0 before:w-[3px]", tone && accentLine[tone])}>
      <div className="flex items-center justify-between gap-2">
        <span className="label">{label}</span>
        {icon && <span className={cls("shrink-0", tone ? toneText(tone) : "text-dim")}>{icon}</span>}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="font-mono text-[26px] font-semibold leading-none text-ink">{value}</span>
        {unit && <span className="font-display text-[11px] font-semibold uppercase tracking-wider text-dim">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[11.5px] text-mut">{sub}</div>}
    </div>
  );
}

export const toneText = (tone: Tone) =>
  ({ ok: "text-ok", warn: "text-warn", bad: "text-bad", info: "text-info", mut: "text-mut", accent: "text-accent" })[tone];

/* ---------- empty state ---------- */

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Inbox size={26} className="text-dim" />
      <p className="font-display text-sm font-semibold text-mut">{title}</p>
      {hint && <p className="max-w-[260px] text-xs text-dim">{hint}</p>}
    </div>
  );
}

/* ---------- toasts ---------- */

export function ToastHost() {
  const { toasts, dismissToast } = useStore();
  const meta = {
    ok: { icon: <CheckCircle2 size={17} />, cls: "border-ok/40 text-ok" },
    warn: { icon: <AlertTriangle size={17} />, cls: "border-warn/40 text-warn" },
    bad: { icon: <XCircle size={17} />, cls: "border-bad/40 text-bad" },
  };
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(360px,90vw)] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={() => dismissToast(t.id)}
            className={cls("card pointer-events-auto flex items-start gap-3 border-l-4 px-3.5 py-3 text-left shadow-[var(--shadow)]", meta[t.kind].cls)}
          >
            <span className="mt-0.5 shrink-0">{meta[t.kind].icon}</span>
            <span className="min-w-0">
              <span className="block font-display text-[12.5px] font-semibold tracking-wide text-ink">{t.title}</span>
              {t.msg && <span className="mt-0.5 block text-xs leading-snug text-mut">{t.msg}</span>}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
