import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardCheck, MapPin, PackageCheck, Truck, CalendarClock, Lock, CheckCircle2 } from "lucide-react";
import { useStore } from "../lib/store";
import type { Order, OrderStatus } from "../lib/db";
import { AnimatedNumber, Badge, cls, dueLabel, EmptyState, fmt, OrderStatusBadge, Stat, timeAgo } from "../components/ui";

type Filter = "all" | OrderStatus;

function OrderCard({ order, index }: { order: Order; index: number }) {
  const { data, allocateOrder, dispatchOrder } = useStore();
  const [busy, setBusy] = useState(false);
  const totalDz = order.items.reduce((a, i) => a + i.dozens, 0);
  const overdue = order.dueTs < Date.now() && order.status !== "dispatched";

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.35), duration: 0.3 }}
      className={cls("card overflow-hidden", overdue && "border-bad/40")}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-mono text-[14px] font-bold text-ink">{order.code}</h3>
            <OrderStatusBadge status={order.status} />
            {overdue && <Badge tone="bad" pulse>Overdue</Badge>}
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-mut">
            <span className="font-medium text-ink">{order.customer}</span>
            <span className="inline-flex items-center gap-0.5 text-dim"><MapPin size={11} /> {order.city}</span>
          </p>
        </div>
        <div className="text-right">
          <div className={cls("flex items-center justify-end gap-1.5 font-display text-[11px] font-semibold uppercase tracking-wider", overdue ? "text-bad" : "text-mut")}>
            <CalendarClock size={13} /> {dueLabel(order.dueTs)}
          </div>
          <div className="mt-1 font-mono text-[11px] text-dim">raised {timeAgo(order.createdTs)}</div>
        </div>
      </div>

      {/* items = pick list */}
      <div>
        {order.items.map((item) => {
          const s = data.sockStyles.find((st) => st.id === item.styleId);
          if (!s) return null;
          const free = s.dozensOnHand - s.dozensReserved;
          const short = order.status === "open" && free < item.dozens;
          return (
            <div key={item.styleId} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
              <span className="h-5 w-5 shrink-0 rounded-[4px] border border-line2" style={{ background: s.colorHex }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[12px] font-semibold text-ink">{s.styleCode}</span>
                  <span className="truncate text-[11px] text-dim">{s.name} · {s.color}</span>
                </div>
                <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-panel2 px-1.5 py-0.5 font-mono text-[10px] text-mut">
                  <MapPin size={10} /> Rack {s.rack} · pick aisle {s.rack[0]}
                </span>
              </div>
              <div className="text-right">
                <div className="font-mono text-[13px] font-semibold text-ink">{item.dozens} dz</div>
                {order.status === "open" && (
                  <div className={cls("font-mono text-[10px]", short ? "font-semibold text-bad" : "text-ok")}>
                    {short ? `short ${item.dozens - free} dz` : `free ${free} dz`}
                  </div>
                )}
                {order.status === "allocated" && (
                  <div className="inline-flex items-center gap-1 font-mono text-[10px] text-info"><Lock size={10} /> reserved</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 bg-panel2/60 px-4 py-3">
        <span className="font-mono text-[12px] text-mut">
          <span className="font-semibold text-ink">{totalDz} dozen</span> · {fmt(totalDz * 12)} pairs
        </span>
        {order.status === "open" && (
          <button
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={async () => { setBusy(true); await allocateOrder(order.id); setBusy(false); }}
          >
            <ClipboardCheck size={13} /> Reserve stock
          </button>
        )}
        {order.status === "allocated" && (
          <button
            className="btn btn-ok btn-sm"
            disabled={busy}
            onClick={async () => { setBusy(true); await dispatchOrder(order.id); setBusy(false); }}
          >
            <Truck size={13} /> Generate challan & dispatch
          </button>
        )}
        {order.status === "dispatched" && (
          <span className="inline-flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-wider text-dim">
            <CheckCircle2 size={13} className="text-ok" /> Delivered off-dock
          </span>
        )}
      </div>
    </motion.article>
  );
}

export default function Dispatch() {
  const { data } = useStore();
  const [filter, setFilter] = useState<Filter>("all");

  const open = data.orders.filter((o) => o.status === "open");
  const allocated = data.orders.filter((o) => o.status === "allocated");
  const dispatched = data.orders.filter((o) => o.status === "dispatched");
  const openDz = open.reduce((a, o) => a + o.items.reduce((x, i) => x + i.dozens, 0), 0);
  const allocDz = allocated.reduce((a, o) => a + o.items.reduce((x, i) => x + i.dozens, 0), 0);

  const visible = useMemo(
    () => (filter === "all" ? data.orders : data.orders.filter((o) => o.status === filter)),
    [data.orders, filter],
  );

  const filters: { id: Filter; label: string; n: number }[] = [
    { id: "all", label: "All orders", n: data.orders.length },
    { id: "open", label: "Open", n: open.length },
    { id: "allocated", label: "Allocated", n: allocated.length },
    { id: "dispatched", label: "Dispatched", n: dispatched.length },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Open orders" value={<AnimatedNumber value={open.length} />} unit="orders" tone="accent" icon={<ClipboardCheck size={16} />} sub={`${fmt(openDz)} dozen awaiting reservation`} />
        <Stat label="Allocated · ready to ship" value={<AnimatedNumber value={allocated.length} />} unit="orders" tone="info" icon={<Lock size={16} />} sub={`${fmt(allocDz)} dozen reserved on racks`} />
        <Stat label="Dispatched (history)" value={<AnimatedNumber value={dispatched.length} />} unit="challans" tone="ok" icon={<PackageCheck size={16} />} sub="stock deducted at invoicing" />
        <Stat label="Overdue deliveries" value={<AnimatedNumber value={data.orders.filter((o) => o.dueTs < Date.now() && o.status !== "dispatched").length} />} unit="orders" tone={data.orders.some((o) => o.dueTs < Date.now() && o.status !== "dispatched") ? "bad" : "ok"} icon={<Truck size={16} />} sub="dock scheduling priority" />
      </div>

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
            {f.label} <span className="font-semibold">{f.n}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        {visible.map((o, i) => <OrderCard key={o.id} order={o} index={i} />)}
      </div>
      {visible.length === 0 && (
        <div className="card">
          <EmptyState title="No orders in this stage" hint="Wholesale orders move Open → Allocated → Dispatched." />
        </div>
      )}
    </div>
  );
}
