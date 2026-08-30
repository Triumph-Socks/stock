import React, { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Legend,
} from "recharts";
import { ScrollText, TrendingUp, Factory, Boxes, FlagTriangleRight } from "lucide-react";
import { useStore } from "../lib/store";
import { AnimatedNumber, Badge, cls, fmt, Stat, timeAgo } from "../components/ui";

const tooltipStyle = {
  background: "var(--panel2)",
  border: "1px solid var(--line2)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--ink)",
  fontFamily: "'IBM Plex Mono', monospace",
} as const;

export default function Analytics() {
  const { data } = useStore();

  const totalYarnKg = data.yarns.reduce((a, y) => a + y.weightKg, 0);
  const running = data.machines.filter((m) => m.status === "running").length;
  const utilization = data.machines.length ? (running / data.machines.length) * 100 : 0;
  const totalPairs = data.sockStyles.reduce((a, s) => a + s.pairsOnHand, 0);
  const totalDz = data.sockStyles.reduce((a, s) => a + s.dozensOnHand, 0);
  const today = data.dailyStats[data.dailyStats.length - 1];
  const scrapRate = today && today.pairs > 0 ? (today.scrapPairs / today.pairs) * 100 : 0;

  const series = useMemo(
    () =>
      data.dailyStats.slice(-14).map((d) => ({
        day: new Date(d.id + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        "Yarn consumed (kg)": d.yarnKg,
        "Pairs produced": d.pairs,
        "Scrap %": d.pairs > 0 ? +((d.scrapPairs / d.pairs) * 100).toFixed(2) : 0,
      })),
    [data.dailyStats],
  );

  const yieldKgPer1k = useMemo(() => {
    const last7 = data.dailyStats.slice(-7);
    const pairs = last7.reduce((a, d) => a + d.pairs, 0);
    const kg = last7.reduce((a, d) => a + d.yarnKg, 0);
    return pairs > 0 ? (kg / pairs) * 1000 : 0;
  }, [data.dailyStats]);

  const machineMix = useMemo(() => {
    const idle = data.machines.filter((m) => m.status === "idle").length;
    const down = data.machines.filter((m) => m.status === "maintenance").length;
    return [
      { name: "Running", value: running, color: "var(--ok)" },
      { name: "Idle", value: idle, color: "var(--warn)" },
      { name: "Down", value: down, color: "var(--bad)" },
    ].filter((d) => d.value > 0);
  }, [data.machines, running]);

  const byFibre = useMemo(() => {
    const map = new Map<string, number>();
    for (const y of data.yarns) map.set(y.type, (map.get(y.type) || 0) + y.weightKg);
    return [...map.entries()].map(([type, kg]) => ({ type, kg: +kg.toFixed(0) })).sort((a, b) => b.kg - a.kg);
  }, [data.yarns]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Total raw yarn stock" value={<AnimatedNumber value={totalYarnKg} digits={0} />} unit="kg" tone="accent" icon={<Boxes size={16} />} sub={`yield ${yieldKgPer1k.toFixed(0)} kg / 1,000 pairs (7d)`} />
        <Stat label="Machine capacity utilization" value={<AnimatedNumber value={utilization} digits={0} />} unit="%" tone={utilization > 55 ? "ok" : "warn"} icon={<Factory size={16} />} sub={`${running} of ${data.machines.length} machines knitting`} />
        <Stat label="Finished goods stock" value={<AnimatedNumber value={totalPairs} />} unit="pairs" tone="info" icon={<TrendingUp size={16} />} sub={`≈ ${fmt(totalDz)} dozen saleable`} />
        <Stat label="Daily scrap rate" value={<AnimatedNumber value={scrapRate} digits={2} />} unit="%" tone={scrapRate > 3 ? "bad" : scrapRate > 2 ? "warn" : "ok"} icon={<FlagTriangleRight size={16} />} sub={`${today?.scrapPairs ?? 0} defective pairs today`} />
      </div>

      {/* consumption vs production */}
      <div className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="card-title">Production vs yarn consumption — 14 days</h3>
            <p className="mt-0.5 text-[11px] text-dim">Bars: kg consumed on the floor · Line: pairs booked into warehouse</p>
          </div>
          <Badge tone="accent">material yield {yieldKgPer1k.toFixed(1)} kg/1k pairs</Badge>
        </div>
        <div className="mt-3 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "var(--dim)", fontSize: 10.5, fontFamily: "'IBM Plex Mono', monospace" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} interval="preserveStartEnd" />
              <YAxis yAxisId="kg" tick={{ fill: "var(--dim)", fontSize: 10.5, fontFamily: "'IBM Plex Mono', monospace" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="pairs" orientation="right" tick={{ fill: "var(--dim)", fontSize: 10.5, fontFamily: "'IBM Plex Mono', monospace" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--raise)", opacity: 0.5 }} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "'IBM Plex Sans', sans-serif" }} />
              <Bar yAxisId="kg" dataKey="Yarn consumed (kg)" fill="var(--accent)" opacity={0.8} radius={[3, 3, 0, 0]} maxBarSize={22} />
              <Line yAxisId="pairs" dataKey="Pairs produced" stroke="var(--ok)" strokeWidth={2.4} dot={{ r: 2.5, fill: "var(--ok)" }} activeDot={{ r: 4.5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* scrap trend */}
        <div className="card p-4">
          <h3 className="card-title">Scrap rate trend</h3>
          <p className="mt-0.5 text-[11px] text-dim">% of output rejected at QC</p>
          <div className="mt-3 h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="scrapFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--bad)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--bad)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "var(--dim)", fontSize: 9.5, fontFamily: "'IBM Plex Mono', monospace" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "var(--dim)", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={tooltipStyle} />
                <Area dataKey="Scrap %" stroke="var(--bad)" strokeWidth={2} fill="url(#scrapFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* machine mix donut */}
        <div className="card p-4">
          <h3 className="card-title">Fleet status mix</h3>
          <p className="mt-0.5 text-[11px] text-dim">{data.machines.length} knitting machines</p>
          <div className="mt-1 h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={machineMix} dataKey="value" nameKey="name" innerRadius={52} outerRadius={74} paddingAngle={3} strokeWidth={0}>
                  {machineMix.map((m) => <Cell key={m.name} fill={m.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* fibre stock */}
        <div className="card p-4">
          <h3 className="card-title">Yarn stock by fibre</h3>
          <p className="mt-0.5 text-[11px] text-dim">kg on hand in raw store</p>
          <div className="mt-1 h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byFibre} layout="vertical" margin={{ top: 0, right: 12, left: -6, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 6" horizontal={false} />
                <XAxis type="number" tick={{ fill: "var(--dim)", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="type" width={70} tick={{ fill: "var(--mut)", fontSize: 10.5, fontFamily: "'IBM Plex Mono', monospace" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--raise)", opacity: 0.5 }} />
                <Bar dataKey="kg" name="kg" fill="var(--info)" radius={[0, 3, 3, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* audit trail */}
      <div className="card">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h3 className="card-title">Data consistency audit trail</h3>
            <p className="mt-0.5 text-[11px] text-dim">Every stock movement is ledgered to IndexedDB — survives floor tablet dropouts</p>
          </div>
          <span className="chip"><ScrollText size={12} /> {data.auditLogs.length} entries</span>
        </div>
        <div className="grid gap-x-6 md:grid-cols-2">
          {data.auditLogs.map((l) => (
            <div key={l.id} className="flex items-start gap-3 border-b border-line px-4 py-2.5 last:border-b-0 md:[&:nth-last-child(2)]:border-b-0">
              <Badge tone={l.action.includes("DOWN") || l.action.includes("SCRAP") ? "bad" : l.action.includes("DISPATCH") || l.action.includes("ALLOC") ? "info" : l.action.includes("COMPLETE") || l.action.includes("RECEIV") ? "ok" : "accent"}>
                {l.action.replace(/_/g, " ")}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] text-ink">{l.detail}</p>
                <p className="mt-0.5 font-mono text-[10.5px] text-dim">{l.actor} · {timeAgo(l.ts)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
