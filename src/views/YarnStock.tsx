import React, { useMemo, useState } from "react";
import {
  legacyCreateColumnHelper as createColumnHelper,
  getCoreRowModel, getSortedRowModel,
  useLegacyTable as useReactTable,
  type LegacyColumnDef, type LegacyFeatures,
} from "@tanstack/react-table/legacy";
import { flexRender } from "@tanstack/react-table";
import type { SortingState } from "@tanstack/table-core";
import { ArrowDownToLine, ArrowUpFromLine, ArrowUpDown, ArrowDown, ArrowUp, Search, Scale, AlertTriangle, Boxes } from "lucide-react";

const TriangleAlert = AlertTriangle;
import { useStore } from "../lib/store";
import { yarnStatus, type Yarn, type YarnLogKind } from "../lib/db";
import { AnimatedNumber, Badge, cls, EmptyState, Field, fmt, Modal, ProgressBar, Stat, timeAgo, YarnStatusBadge } from "../components/ui";

const col = createColumnHelper<Yarn>();

const kindMeta: Record<YarnLogKind, { label: string; tone: "ok" | "warn" | "bad" | "info"; icon: React.ReactNode; sign: string }> = {
  consumption: { label: "Consumption", tone: "bad", icon: <ArrowDown size={12} />, sign: "−" },
  transfer: { label: "Floor issue", tone: "warn", icon: <ArrowUpFromLine size={12} />, sign: "−" },
  receipt: { label: "Receipt", tone: "ok", icon: <ArrowDownToLine size={12} />, sign: "+" },
  adjust: { label: "Adjustment", tone: "info", icon: <Scale size={12} />, sign: "±" },
};

function YarnModal({ yarn, mode, onClose }: { yarn: Yarn; mode: "transfer" | "receipt"; onClose: () => void }) {
  const { transferYarn, receiveYarn } = useStore();
  const [kg, setKg] = useState(mode === "transfer" ? 25 : 100);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const isT = mode === "transfer";

  return (
    <Modal
      open
      onClose={onClose}
      title={isT ? `Issue yarn to floor — ${yarn.code}` : `Receive stock — ${yarn.code}`}
      subtitle={`${yarn.colorName} · ${yarn.count} · Batch ${yarn.batch} · On hand ${fmt(yarn.weightKg, 1)} kg`}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className={cls("btn", isT ? "btn-primary" : "btn-ok")}
            disabled={kg <= 0 || busy}
            onClick={async () => {
              setBusy(true);
              if (isT) {
                const ok = await transferYarn(yarn.id, kg, note);
                setBusy(false);
                if (ok) onClose();
              } else {
                await receiveYarn(yarn.id, kg, note);
                setBusy(false);
                onClose();
              }
            }}
          >
            {isT ? <ArrowUpFromLine size={14} /> : <ArrowDownToLine size={14} />}
            {isT ? `Deduct ${fmt(kg, 1)} kg` : `Book in ${fmt(kg, 1)} kg`}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Weight (kg)">
          <input type="number" className="input font-mono" min={0} step={0.5} value={kg} onChange={(e) => setKg(Math.max(0, +e.target.value))} />
        </Field>
        <Field label={isT ? "Destination / note" : "GRN / supplier note"}>
          <input className="input" placeholder={isT ? "e.g. KN-13 creel top-up" : "e.g. GRN-8890 Nilgiri Spinning"} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(isT ? [10, 25, 50] : [100, 200, 400]).map((v) => (
          <button key={v} className="chip cursor-pointer transition-colors hover:border-accent hover:text-accent" onClick={() => setKg(v)}>
            {v} kg
          </button>
        ))}
      </div>
      {isT && kg > yarn.weightKg && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-bad">
          <TriangleAlert size={13} /> Requested weight exceeds on-hand stock ({fmt(yarn.weightKg, 1)} kg).
        </p>
      )}
      {isT && yarn.weightKg - kg < yarn.minKg && kg <= yarn.weightKg && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-warn">
          <TriangleAlert size={13} /> This issue drops {yarn.code} below its {yarn.minKg} kg safety minimum — a reorder alert will trigger.
        </p>
      )}
    </Modal>
  );
}

export default function YarnStock() {
  const { data } = useStore();
  const [sorting, setSorting] = useState<SortingState>([{ id: "weightKg", desc: true }]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<{ yarn: Yarn; mode: "transfer" | "receipt" } | null>(null);

  const totalKg = data.yarns.reduce((a, y) => a + y.weightKg, 0);
  const low = data.yarns.filter((y) => yarnStatus(y) === "low");
  const out = data.yarns.filter((y) => yarnStatus(y) === "out");
  const types = [...new Set(data.yarns.map((y) => y.type))];

  const filtered = useMemo(
    () =>
      data.yarns.filter((y) => {
        if (typeFilter !== "all" && y.type !== typeFilter) return false;
        if (statusFilter !== "all" && yarnStatus(y) !== statusFilter) return false;
        if (q) {
          const s = `${y.code} ${y.colorName} ${y.batch} ${y.colorKey} ${y.type}`.toLowerCase();
          if (!s.includes(q.toLowerCase())) return false;
        }
        return true;
      }),
    [data.yarns, typeFilter, statusFilter, q],
  );

  const columns = useMemo<LegacyColumnDef<Yarn, any>[]>(
    () => [
      col.accessor("code", {
        header: "Yarn / Color",
        cell: (i) => {
          const y = i.row.original;
          return (
            <div className="flex items-center gap-3">
              <span className="h-6 w-6 shrink-0 rounded-full border-2 border-line2 shadow-inner" style={{ background: y.colorHex }} />
              <div>
                <div className="font-mono text-[12.5px] font-semibold text-ink">{y.code}</div>
                <div className="text-[11px] text-dim">{y.colorName} · <span className="uppercase">{y.colorKey}</span></div>
              </div>
            </div>
          );
        },
      }),
      col.accessor("type", {
        header: "Fibre",
        cell: (i) => <span className="chip">{i.getValue()}</span>,
      }),
      col.accessor("count", { header: "Count / Denier", cell: (i) => <span className="font-mono text-xs text-mut">{i.getValue()}</span> }),
      col.accessor("batch", { header: "Batch / Lot", cell: (i) => <span className="font-mono text-xs text-mut">{i.getValue()}</span> }),
      col.accessor("weightKg", {
        header: "On Hand",
        cell: (i) => {
          const y = i.row.original;
          const st = yarnStatus(y);
          return (
            <div className="min-w-[130px]">
              <div className="flex items-baseline gap-1">
                <span className={cls("font-mono text-[13.5px] font-semibold", st === "out" ? "text-bad" : st === "low" ? "text-warn" : "text-ink")}>
                  {fmt(y.weightKg, 1)}
                </span>
                <span className="text-[10.5px] text-dim">kg</span>
                <span className="ml-1 text-[10px] text-dim">min {y.minKg}</span>
              </div>
              <div className="mt-1">
                <ProgressBar value={y.weightKg} max={y.minKg * 2.5} tone={st === "out" ? "bad" : st === "low" ? "warn" : "ok"} height={5} />
              </div>
            </div>
          );
        },
      }),
      col.accessor("rack", { header: "Rack", cell: (i) => <span className="chip">{i.getValue()}</span> }),
      col.accessor("supplier", { header: "Supplier", cell: (i) => <span className="text-xs text-mut">{i.getValue()}</span> }),
      col.accessor((r) => yarnStatus(r), {
        id: "status",
        header: "Status",
        cell: (i) => <YarnStatusBadge status={i.getValue()} />,
      }),
      col.display({
        id: "actions",
        header: "",
        cell: (i) => (
          <div className="flex justify-end gap-1.5">
            <button className="btn btn-sm" onClick={() => setModal({ yarn: i.row.original, mode: "transfer" })} disabled={i.row.original.weightKg <= 0}>
              <ArrowUpFromLine size={12} /> Issue
            </button>
            <button className="btn btn-sm btn-ok" onClick={() => setModal({ yarn: i.row.original, mode: "receipt" })}>
              <ArrowDownToLine size={12} /> Receive
            </button>
          </div>
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

  return (
    <div className="space-y-4">
      {/* stats */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Total raw yarn stock" value={<AnimatedNumber value={totalKg} digits={1} />} unit="kg" tone="accent" icon={<Boxes size={16} />} sub={`across ${data.yarns.length} yarn SKUs · 6 fibre classes`} />
        <Stat label="Below safety minimum" value={<AnimatedNumber value={low.length} />} unit="batches" tone={low.length ? "warn" : "ok"} icon={<TriangleAlert size={16} />} sub={low.length ? low.slice(0, 2).map((y) => y.code).join(", ") + (low.length > 2 ? "…" : "") : "all batches healthy"} />
        <Stat label="Out of stock" value={<AnimatedNumber value={out.length} />} unit="batches" tone={out.length ? "bad" : "ok"} icon={<TriangleAlert size={16} />} sub={out.length ? out.map((y) => y.code).join(", ") : "no stockouts"} />
        <Stat label="Issued to floor (24h)" value={<AnimatedNumber value={data.yarnLogs.filter((l) => l.kind !== "receipt" && Date.now() - l.ts < 86_400_000).reduce((a, l) => a + l.kg, 0)} digits={1} />} unit="kg" tone="info" icon={<ArrowUpFromLine size={16} />} sub="transfers + auto consumption" />
      </div>

      {/* reorder alert banner */}
      {(low.length > 0 || out.length > 0) && (
        <div className="card flex flex-wrap items-center gap-3 border-warn/40 bg-warn/8 px-4 py-3">
          <TriangleAlert size={17} className="shrink-0 text-warn" />
          <div className="min-w-0 flex-1">
            <span className="font-display text-[12.5px] font-semibold uppercase tracking-wide text-warn">Reorder alert</span>
            <span className="ml-2 text-[12.5px] text-mut">
              {[...out.map((y) => `${y.code} ${y.colorName} (OUT)`), ...low.map((y) => `${y.code} ${y.colorName} (${fmt(y.weightKg, 0)}/${y.minKg} kg)`)].join(" · ")}
            </span>
          </div>
          <button className="btn btn-sm" onClick={() => setStatusFilter("low")}>View low stock</button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        {/* table */}
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <div className="relative min-w-[180px] flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
              <input className="input pl-9" placeholder="Search code, color, batch…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="select w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All fibres</option>
              {types.map((t) => <option key={t}>{t}</option>)}
            </select>
            <select className="select w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="ok">In safety zone</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
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
            {filtered.length === 0 && <EmptyState title="No yarn batches match" hint="Adjust the fibre, status or search filters." />}
          </div>
        </div>

        {/* movement ledger */}
        <div className="card flex min-h-0 flex-col">
          <div className="border-b border-line px-4 py-3">
            <h3 className="card-title">Yarn movement ledger</h3>
            <p className="mt-0.5 text-[11px] text-dim">Batch usage audit trail · auto + manual</p>
          </div>
          <div className="max-h-[520px] flex-1 overflow-y-auto">
            {data.yarnLogs.map((l) => {
              const y = data.yarns.find((y) => y.id === l.yarnId);
              const m = kindMeta[l.kind];
              return (
                <div key={l.id} className="flex items-start gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
                  <span className={cls("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border", {
                    ok: "border-ok/30 bg-ok/10 text-ok",
                    warn: "border-warn/30 bg-warn/10 text-warn",
                    bad: "border-bad/30 bg-bad/10 text-bad",
                    info: "border-info/30 bg-info/10 text-info",
                  }[m.tone])}>
                    {m.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-mono text-[11.5px] font-semibold text-ink">{y?.code ?? l.yarnId}</span>
                      <span className={cls("font-mono text-[12px] font-semibold", { ok: "text-ok", warn: "text-warn", bad: "text-bad", info: "text-info" }[m.tone])}>
                        {m.sign}{fmt(l.kg, 1)} kg
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-mut">{l.note}</p>
                    <p className="mt-0.5 text-[10px] text-dim">{m.label} · {timeAgo(l.ts)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {modal && <YarnModal yarn={modal.yarn} mode={modal.mode} onClose={() => setModal(null)} />}
    </div>
  );
}
