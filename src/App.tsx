import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StoreProvider, useStore } from "./lib/store";
import { Shell, type View } from "./components/Shell";
import MachineFloor from "./views/MachineFloor";
import YarnStock from "./views/YarnStock";
import Warehouse from "./views/Warehouse";
import Dispatch from "./views/Dispatch";
import Analytics from "./views/Analytics";

function BootScreen() {
  return (
    <div className="relative z-10 grid h-full place-items-center">
      <div className="flex flex-col items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-xl border border-accent/40 bg-accent/10">
          <motion.svg viewBox="0 0 32 32" className="h-8 w-8" fill="none">
            <motion.path
              d="M11 4h10v11l4.2 6.2a5 5 0 0 1-8 6.1L11 20V4z"
              stroke="var(--accent)"
              strokeWidth="2.4"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, ease: "easeInOut" }}
            />
            <motion.path
              d="M11 8.5h10M11 13h10"
              stroke="var(--ok)"
              strokeWidth="1.9"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, delay: 0.5 }}
            />
          </motion.svg>
        </div>
        <div className="text-center">
          <div className="font-display text-lg font-bold tracking-wide text-ink">
            Sock<span className="text-accent">Track</span>
          </div>
          <div className="mt-1 font-mono text-[11px] text-dim">
            opening IndexedDB ledger · seeding floor data…
          </div>
        </div>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-raise">
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    </div>
  );
}

function AppInner() {
  const { ready } = useStore();
  const [view, setView] = useState<View>("floor");

  return (
    <>
      <div className="factory-bg" aria-hidden />
      <AnimatePresence mode="wait">
        {!ready ? (
          <motion.div key="boot" className="h-full" exit={{ opacity: 0, transition: { duration: 0.25 } }}>
            <BootScreen />
          </motion.div>
        ) : (
          <motion.div key="app" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <Shell view={view} setView={setView}>
              {view === "floor" && <MachineFloor />}
              {view === "yarn" && <YarnStock />}
              {view === "warehouse" && <Warehouse />}
              {view === "dispatch" && <Dispatch />}
              {view === "analytics" && <Analytics />}
            </Shell>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  );
}
