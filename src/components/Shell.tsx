import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Factory, Cable, Package, Truck, BarChart3, Sun, Moon, Wifi, WifiOff } from "lucide-react";
import { useStore } from "../lib/store";
import { cls, Dot, ToastHost } from "./ui";

export type View = "floor" | "yarn" | "warehouse" | "dispatch" | "analytics";

const NAV: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "floor", label: "Machine Floor", icon: <Factory size={17} /> },
  { id: "yarn", label: "Yarn Stock", icon: <Cable size={17} /> },
  { id: "warehouse", label: "Finished Goods", icon: <Package size={17} /> },
  { id: "dispatch", label: "Wholesale Dispatch", icon: <Truck size={17} /> },
  { id: "analytics", label: "Yield Analytics", icon: <BarChart3 size={17} /> },
];

const VIEW_TITLE: Record<View, { t: string; s: string }> = {
  floor: { t: "Production Floor — Andon Board", s: "Live knitting machine fleet · Unit 2 hall" },
  yarn: { t: "Raw Material & Yarn Stock", s: "Batch-tracked yarn inventory · safety thresholds" },
  warehouse: { t: "Finished Goods Warehouse", s: "Multi-unit sock SKUs · rack locations" },
  dispatch: { t: "B2B Wholesale Dispatch", s: "Order allocation · challans · dock scheduling" },
  analytics: { t: "Material Yield Analytics", s: "Consumption vs output · scrap & utilization" },
};

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const h = now.getHours();
  const shift = h >= 6 && h < 14 ? "Shift A" : h >= 14 && h < 22 ? "Shift B" : "Shift C";
  return (
    <div className="hidden items-center gap-3 border-l border-line pl-4 md:flex">
      <div className="text-right">
        <div className="font-mono text-[15px] font-semibold leading-none text-ink">
          {now.toLocaleTimeString("en-GB")}
        </div>
        <div className="mt-1 font-display text-[9.5px] font-semibold uppercase tracking-[0.16em] text-dim">
          {shift} · {now.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
        </div>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3 px-4 pb-5 pt-5">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[9px] border border-accent/40 bg-accent/12">
        <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none" aria-hidden>
          <path d="M11 4h10v11l4.2 6.2a5 5 0 0 1-8 6.1L11 20V4z" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M11 8.5h10M11 13h10" stroke="var(--ok)" strokeWidth="1.9" />
        </svg>
      </div>
      <div>
        <div className="font-display text-[17px] font-bold leading-none tracking-wide text-ink">
          Sock<span className="text-accent">Track</span>
        </div>
        <div className="mt-1 font-display text-[9px] font-semibold uppercase tracking-[0.2em] text-dim">
          Knitworks ERP · v2.4
        </div>
      </div>
    </div>
  );
}

export function Shell({ view, setView, children }: { view: View; setView: (v: View) => void; children: React.ReactNode }) {
  const { online, theme, toggleTheme, data } = useStore();
  const lowYarn = data.yarns.filter((y) => y.weightKg < y.minKg).length;
  const downMachines = data.machines.filter((m) => m.status === "maintenance").length;
  const title = VIEW_TITLE[view];

  return (
    <div className="relative z-10 flex h-full">
      {/* sidebar */}
      <aside className="hidden w-[230px] shrink-0 flex-col border-r border-line bg-panel/70 backdrop-blur-sm lg:flex">
        <Logo />
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map((n) => (
            <button key={n.id} className={cls("nav-item", view === n.id && "active")} onClick={() => setView(n.id)}>
              <span className="nav-glyph text-mut">{n.icon}</span>
              <span className="flex-1">{n.label}</span>
              {n.id === "yarn" && lowYarn > 0 && (
                <span className="rounded bg-warn/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-warn">{lowYarn}</span>
              )}
              {n.id === "floor" && downMachines > 0 && (
                <span className="rounded bg-bad/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-bad">{downMachines}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-3 p-4">
          <div className="card border-line bg-panel2/60 p-3">
            <div className="flex items-center gap-2">
              <Dot tone={online ? "ok" : "warn"} pulse={!online} />
              <span className="font-display text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mut">
                {online ? "Online · Synced" : "Offline · Local-first"}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-dim">
              {online
                ? "IndexedDB ledger mirroring to cloud."
                : "Internet down — all entries persist on this tablet via IndexedDB."}
            </p>
          </div>
          <div className="px-1 font-mono text-[10px] leading-relaxed text-dim">
            Lakshmi Knitworks Pvt Ltd<br />SIPCOT Unit 2 · Tiruppur
          </div>
        </div>
      </aside>

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-4 border-b border-line bg-panel/70 px-4 py-3 backdrop-blur-sm md:px-6">
          <div className="lg:hidden">
            <div className="font-display text-[15px] font-bold tracking-wide text-ink">
              Sock<span className="text-accent">Track</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[16px] font-semibold tracking-wide text-ink md:text-[17px]">{title.t}</h1>
            <p className="hidden truncate text-[11.5px] text-dim sm:block">{title.s}</p>
          </div>

          <button
            onClick={toggleTheme}
            className="btn btn-sm"
            title="Toggle dark / light"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <span
            className={cls(
              "hidden items-center gap-1.5 rounded-md border px-2 py-1 font-display text-[10px] font-semibold uppercase tracking-[0.12em] sm:inline-flex",
              online ? "border-ok/35 bg-ok/10 text-ok" : "border-warn/40 bg-warn/12 text-warn blink-live",
            )}
          >
            {online ? <Wifi size={12} /> : <WifiOff size={12} />}
            {online ? "Live" : "Offline"}
          </span>

          <Clock />
        </header>

        {/* mobile nav */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-line bg-panel/60 px-3 py-2 lg:hidden">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={cls(
                "flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 font-display text-[11px] font-semibold uppercase tracking-wider",
                view === n.id ? "border-accent/40 bg-accent/12 text-accent" : "border-line bg-panel2 text-mut",
              )}
            >
              {n.icon}
              {n.label}
            </button>
          ))}
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <ToastHost />
    </div>
  );
}
