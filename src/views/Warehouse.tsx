import React, { useMemo, useState } from "react";
import {
  legacyCreateColumnHelper as createColumnHelper,
  getCoreRowModel, getSortedRowModel,
  useLegacyTable as useReactTable,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy";
import { flexRender } from "@tanstack/react-table";
import type { SortingState } from "@tanstack/table-core";
import { ArrowDown, ArrowUp, ArrowUpDown, PackagePlus, Search, FlagTriangleRight, Archive, Lock } from "lucide-react";
import { useStore } from "../lib/store";
import type { SockStyle } from "../lib/db";
import { AnimatedNumber, Badge, cls, EmptyState, Field, fmt, Modal, Stat, timeAgo, toneText } from "../components/ui";

const col = createColumnHelper<SockStyle>();

function OutputIntakeModal({ style, onClose }: { style: SockStyle; onClose: () => void }) {
  const { recordFinishingOutput } = useStore();
  const [pairs, setPairs] = useState(120);
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Finishing output — ${style.styleCode}`}
      subtitle={`${style.name} · ${style.color} · books into rack ${style.rack}`}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-ok"
            disabled={pairs <= 0 || busy}
            onClick={async () => { setBusy(true); await recordFinishingOutput(style.id, pairs); setBusy(false); onClose(); }}
          >
            <PackagePlus size={14} /> Book {fmt(pairs)} pairs
          </button>
        </>
      }
    >
      <Field label="Finished pairs from linking / boarding">
        <input type="number" className="input font-mono" min={0} value={pairs} onChange={(e) => setPairs(Math.max(0, +e.target.value))} />
      </Field>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[60, 120, 250, 500].map((v) => (
          <button key={v} className="chip cursor-pointer transition-colors hover:border-ok hover:text-ok" onClick={() => setPairs((p) => p + v)}>+{v}</button>
        ))}
      </div>
      <p className="mt-3 text-[11.5px] text-mut">
        ≈ <span className="font-mono font-semibold text-ink">{fmt(Math.round(pairs / 12))} dozen</span> added
        · packing: {style.packing} · {style.gramsPerPair} g/pair.
      </p>
    </Modal>
  );
}

export default function Warehouse() {
  const { data } = useStore();
  const [sorting, setSorting] = useState<SortingState>([{ id: "pairsOnHand", desc: true }]);
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [intake, setIntake] = useState<SockStyle | null>(null);

  const totalPairs = data.sockStyles.reduce((a, s) => a + s.pairsOnHand, 0);
  const totalDz = data.sockStyles.reduce((a, s) => a + s.dozensOnHand, 0);
  const reservedDz = data.sockStyles.reduce((a, s) => a + s.dozensReserved, 0);
  const belowReorder = data.sockStyles.filter((s) => s.dozensOnHand - s.dozensReserved < s.reorderDozens);

  const cats = ["all", "Ankle", "Crew", "Athletic", "Kids", "Specialty"];
  const filtered = useMemo(
    () =>
      data.sockStyles.filter((s) => {
        if (cat !== "all" && s.category !== cat) return false;
        if (q && !`${s.styleCode} ${s.name} ${s.color}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [data.sockStyles, cat, q],
  );

  const columns = useMemo<LegacyColumnDef<SockStyle, any>[]>(
    () => [
      col.accessor("styleCode", {
        header: "SKU / Style",
        cell: (i) => {
          const s = i.row.original;
          return (
            <div className="flex items-center gap-3">
              <span className="h-6 w-6 shrink-0 rounded-[5px] border-2 border-line2" style={{ background: s.colorHex }} />
              <div>
                <div className="font-mono text-[12.5px] font-semibold text-ink">{s.styleCode}</div>
                <div className="text-[11px] text-dim">{s.name} · {s.color}</div>
              </div>
            </div>
          );
        },
      }),
      col.accessor("category", { header: "Class", cell: (i) => <span className="chip">{i.getValue()}</span> }),
      col.accessor("size", { header: "Size", cell: (i) => <span className="text-xs text-mut">{i.getValue()}</span> }),
      col.accessor("packing", { header: "Packing", cell: (i) => <span className="chip">{i.getValue()}</span> }),
      col.accessor("pairsOnHand", {
        header: "Pairs",
        cell: (i) => <span className="font-mono text-[13px] font-semibold text-ink">{fmt(i.getValue())}</span>,
      }),
      col.accessor("dozensOnHand", {
        header: "Dozens",
        cell: (i) => <span className="font-mono text-[13px] text-mut">{fmt(i.getValue())} dz</span>,
      }),
      col.accessor("dozensReserved", {
        header: "Reserved",
        cell: (i) => {
          const v = i.getValue();
          return v > 0
            ? <span className="inline-flex items-center gap-1 font-mono text-[12.5px] font-semibold text-info"><Lock size={11} /> {v} dz</span>
            : <span className="text-[11px] text-dim">—</span>;
        },
      }),
      col.accessor((r) => r.dozensOnHand - r.dozensReserved, {
        id: "available",
        header: "Free",
        cell: (i) => {
          const s = i.row.original;
          const free = s.dozensOnHand - s.dozensReserved;
          const low = free < s.reorderDozens;
          return (
            <span className={cls("font-mono text-[13px] font-semibold", low ? "text-warn" : "text-ok")}>{free} dz</span>
          );
        },
      }),
      col.accessor("rack", { header: "Rack", cell: (i) => <span className="chip">{i.getValue()}</span> }),
      col.display({
        id: "status",
        header: "Status",
        cell: (i) => {
          const s = i.row.original;
          const free = s.dozensOnHand - s.dozensReserved;
          if (free <= 0) return <Badge tone="bad">Fully reserved</Badge>;
          if (free < s.reorderDozens) return <Badge tone="warn">Reorder knit</Badge>;
          return <Badge tone="ok">Healthy</Badge>;
        },
      }),
      col.display({
        id: "actions",
        header: "",
        cell: (i) => (
          <button className="btn btn-ok btn-sm" onClick={() => setIntake(i.row.original)}>
            <PackagePlus size={12} /> Output
          </button>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  /* rack map: racks A–E, 4 slots each */
  const rackCells = useMemo(() => {
    const cells: { id: string; style?: SockStyle; fill: number }[] = [];
    for (const r of ["A", "B", "C", "D", "E"]) {
      for (let slot = 1; slot <= 4; slot++) {
        const id = `${r}-0${slot}`;
        const style = data.sockStyles.find((s) => s.rack === id);
        cells.push({ id, style, fill: style ? Math.min(1, style.pairsOnHand / 2600) : 0 });
      }
    }
    return cells;
  }, [data.sockStyles]);

  const scrapTodayKg = data.scrapLogs.filter((l) => Date.now() - l.ts < 86_400_000).reduce((a, l) => a + l.wasteKg, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Finished stock" value={<AnimatedNumber value={totalPairs} />} unit="pairs" tone="accent" icon={<Archive size={16} />} sub={`${fmt(totalDz)} dozen across ${data.sockStyles.length} SKUs`} />
        <Stat label="Reserved for orders" value={<AnimatedNumber value={reservedDz} />} unit="dz" tone="info" icon={<Lock size={16} />} sub="picked by wholesale allocation" />
        <Stat label="Below reorder point" value={<AnimatedNumber value={belowReorder.length} />} unit="SKUs" tone={belowReorder.length ? "warn" : "ok"} icon={<FlagTriangleRight size={16} />} sub={belowReorder.length ? belowReorder.slice(0, 2).map((s) => s.styleCode).join(", ") + (belowReorder.length > 2 ? "…" : "") : "knitting plan covers demand"} />
        <Stat label="Scrap waste · 24h" value={<AnimatedNumber value={scrapTodayKg} digits={1} />} unit="kg" tone={scrapTodayKg > 8 ? "bad" : "mut"} icon={<FlagTriangleRight size={16} />} sub="defective knits + cutting scrap" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <div className="relative min-w-[170px] flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
              <input className="input pl-9" placeholder="Search style or color…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex gap-1">
              {cats.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={cls(
                    "rounded-md border px-2.5 py-1.5 font-display text-[10.5px] font-semibold uppercase tracking-wider transition-colors",
                    cat === c ? "border-accent/50 bg-accent/12 text-accent" : "border-line bg-panel2 text-mut hover:text-ink",
                  )}
                >
                  {c === "all" ? "All" : c}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th key={h.id} onClick={h.column.getToggleSortingHandler()}>
                        <span className="inline-flex items-center gap-1">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {{ asc: <ArrowUp size={11} />, desc: <ArrowDown size={11} /> }[h.column.getIsSorted() as string] ?? <ArrowUpDown size={11} className="opacity-40" />}
                        </span>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <EmptyState title="No styles match" hint="Try another class or search term." />}
          </div>
        </div>

        <div className="space-y-4">
          {/* rack map */}
          <div className="card p-4">
            <h3 className="card-title">Warehouse rack map</h3>
            <p className="mt-0.5 text-[11px] text-dim">Carton slot occupancy for quick picking</p>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {rackCells.map((c) => (
                <div
                  key={c.id}
                  title={c.style ? `${c.id} · ${c.style.styleCode} ${c.style.name} — ${fmt(c.style.pairsOnHand)} pairs` : `${c.id} · empty slot`}
                  className={cls(
                    "group relative flex h-12 cursor-default flex-col items-center justify-center overflow-hidden rounded-md border transition-transform hover:scale-[1.04]",
                    c.style ? "border-line2 bg-panel2" : "border-dashed border-line bg-transparent",
                  )}
                >
                  {c.style && (
                    <span
                      className="absolute inset-x-0 bottom-0 transition-all duration-500"
                      style={{
                        height: `${18 + c.fill * 82}%`,
                        background: c.style.colorHex,
                        opacity: 0.75,
                      }}
                    />
                  )}
                  <span className="relative z-10 font-mono text-[9.5px] font-semibold text-ink mix-blend-luminosity">{c.id}</span>
                  <span className="relative z-10 font-mono text-[8.5px] text-ink opacity-80 mix-blend-luminosity">
                    {c.style ? `${(c.fill * 100).toFixed(0)}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* scrap monitor */}
          <div className="card flex min-h-0 flex-col">
            <div className="border-b border-line px-4 py-3">
              <h3 className="card-title">Scrap & waste monitor</h3>
              <p className="mt-0.5 text-[11px] text-dim">Calibration efficiency by machine</p>
            </div>
            <div className="max-h-[300px] flex-1 overflow-y-auto">
              {data.scrapLogs.slice(0, 10).map((l) => {
                const m = data.machines.find((m) => m.id === l.machineId);
                const s = data.sockStyles.find((st) => st.id === l.styleId);
                return (
                  <div key={l.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
                    <span className={cls("grid h-7 w-10 shrink-0 place-items-center rounded-md border font-mono text-[10px] font-bold", "border-bad/30 bg-bad/10 text-bad")}>
                      {m?.name.replace("KN-", "#")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-ink">{l.reason}</p>
                      <p className="text-[10.5px] text-dim">{s?.styleCode ?? "—"} · {timeAgo(l.ts)}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[12px] font-semibold text-bad">{l.defectPairs} pr</div>
                      <div className="font-mono text-[10px] text-dim">{l.wasteKg.toFixed(2)} kg</div>
                    </div>
                  </div>
                );
              })}
              {data.scrapLogs.length === 0 && <EmptyState title="No scrap logged" hint="Clean shift so far." />}
            </div>
          </div>
        </div>
      </div>

      {intake && <OutputIntakeModal style={intake} onClose={() => setIntake(null)} />}
    </div>
  );
}
