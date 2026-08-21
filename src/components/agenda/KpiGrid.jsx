import { useState, useEffect, useRef } from "react";
import { GripVertical } from "lucide-react";

const STORAGE_KEY = "agenda_kpi_order";

const COLOR_STYLES = {
  emerald: { card: "bg-emerald-500/5 border-emerald-500/20", iconBg: "bg-emerald-500/15", iconColor: "text-emerald-400", label: "text-emerald-400" },
  amber: { card: "bg-amber-500/5 border-amber-500/20", iconBg: "bg-amber-500/15", iconColor: "text-amber-400", label: "text-amber-400" },
  cyan: { card: "bg-cyan-500/5 border-cyan-500/20", iconBg: "bg-cyan-500/15", iconColor: "text-cyan-400", label: "text-cyan-400" },
  red: { card: "bg-red-500/5 border-red-500/20", iconBg: "bg-red-500/15", iconColor: "text-red-400", label: "text-red-400" },
  rose: { card: "bg-rose-500/5 border-rose-500/20", iconBg: "bg-rose-500/15", iconColor: "text-rose-400", label: "text-rose-400" },
  sky: { card: "bg-sky-500/5 border-sky-500/20", iconBg: "bg-sky-500/15", iconColor: "text-sky-400", label: "text-sky-400" },
  violet: { card: "bg-violet-500/5 border-violet-500/20", iconBg: "bg-violet-500/15", iconColor: "text-violet-400", label: "text-violet-400" },
};

export default function KpiGrid({ cards }) {
  const [order, setOrder] = useState(() => {
    const ids = cards.map(c => c.id);
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved) && saved.length) {
        const merged = saved.filter(id => ids.includes(id));
        ids.forEach(id => { if (!merged.includes(id)) merged.push(id); });
        return merged;
      }
    } catch {}
    return ids;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  }, [order]);

  const dragIndex = useRef(null);
  const [overIndex, setOverIndex] = useState(null);

  const handleDragStart = (index) => (e) => {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
    // transparent ghost so the lib doesn't show a shifting preview
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragOver = (index) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overIndex !== index) setOverIndex(index);
  };

  const handleDragLeave = () => {};

  const handleDrop = (index) => (e) => {
    e.preventDefault();
    const from = dragIndex.current;
    setOverIndex(null);
    dragIndex.current = null;
    if (from === null || from === index) return;
    // pure swap: only the two exchange places, rest stay fixed
    setOrder(prev => {
      const next = Array.from(prev);
      [next[from], next[index]] = [next[index], next[from]];
      return next;
    });
  };

  const handleDragEnd = () => {
    setOverIndex(null);
    dragIndex.current = null;
  };

  const cardMap = Object.fromEntries(cards.map(c => [c.id, c]));
  const orderedCards = order.map(id => cardMap[id]).filter(Boolean);

  return (
    <div className="flex flex-wrap gap-4">
      {orderedCards.map((card, index) => {
        const s = COLOR_STYLES[card.color] || COLOR_STYLES.emerald;
        const isOver = overIndex === index && dragIndex.current !== null && dragIndex.current !== index;
        return (
          <div
            key={card.id}
            draggable
            onDragStart={handleDragStart(index)}
            onDragOver={handleDragOver(index)}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop(index)}
            onDragEnd={handleDragEnd}
            className={`w-full sm:w-[calc(50%-8px)] lg:w-[calc(25%-12px)] rounded-2xl border p-4 flex items-center gap-3 cursor-grab active:cursor-grabbing select-none transition-colors ${s.card} ${isOver ? "ring-2 ring-amber-400/60" : ""}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.iconBg}`}>
              <card.Icon size={18} className={s.iconColor} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`${s.label} text-[11px] font-medium uppercase tracking-wide`}>{card.label}</p>
              <p className="text-white text-2xl font-bold leading-tight">{card.value}</p>
            </div>
            <GripVertical size={14} className="text-slate-600 shrink-0" />
          </div>
        );
      })}
    </div>
  );
}