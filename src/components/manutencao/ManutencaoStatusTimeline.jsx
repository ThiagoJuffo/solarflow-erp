import { CheckCircle, Circle } from "lucide-react";

const ETAPAS = [
  { key: "agendar", label: "A Agendar" },
  { key: "agendada", label: "Agendada" },
  { key: "concluida", label: "Concluída" },
];

const ORDER = ETAPAS.map(e => e.key);

export default function ManutencaoStatusTimeline({ status }) {
  // Se cancelada, não mostra o fluxo normal
  if (status === "cancelada") {
    return (
      <div className="flex items-center gap-2 px-1 py-2">
        <div className="w-7 h-7 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
          <Circle size={14} className="text-red-400" />
        </div>
        <span className="text-red-400 font-semibold text-xs">Cancelada</span>
      </div>
    );
  }

  const currentIdx = ORDER.indexOf(status);

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-0 min-w-max px-1 py-2">
        {ETAPAS.map((etapa, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={etapa.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${done ? "bg-amber-500" : active ? "bg-amber-500/20 border-2 border-amber-500" : "bg-slate-800 border border-slate-700"}`}>
                  {done ? <CheckCircle size={14} className="text-white" /> : active ? <Circle size={14} className="text-amber-400" /> : <div className="w-2 h-2 rounded-full bg-slate-600" />}
                </div>
                <span className={`text-xs whitespace-nowrap ${active ? "text-amber-400 font-semibold" : done ? "text-slate-300" : "text-slate-600"}`}>
                  {etapa.label}
                </span>
              </div>
              {i < ETAPAS.length - 1 && (
                <div className={`w-16 h-px mb-4 ${i < currentIdx ? "bg-amber-500" : "bg-slate-800"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}