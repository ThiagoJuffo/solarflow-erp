import { CheckCircle, Circle, Clock } from "lucide-react";

const ETAPAS = [
  { key: "pago_projeto_iniciado", label: "Projeto Iniciado" },
  { key: "kit_confirmado", label: "Kit Confirmado" },
  { key: "documentos_gerados", label: "Docs Gerados" },
  { key: "assinaturas_pendentes", label: "Assinaturas" },
  { key: "dossie_ok", label: "Dossiê OK" },
  { key: "protocolado_edp", label: "Protocolado EDP" },
  { key: "aprovado", label: "Aprovado EDP" },
  { key: "instalacao_agendada", label: "Instal. Agendada" },
  { key: "sistema_instalado", label: "Instalado" },
  { key: "protocolo_vistoria", label: "Protocolo Vistoria" },
  { key: "vistoria_aprovada", label: "Vistoria Aprovada" },
  { key: "concluido", label: "Concluído" },
];

const ORDER = ETAPAS.map(e => e.key);

export default function StatusTimeline({ status }) {
  const currentIdx = ORDER.indexOf(status);

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-0 min-w-max px-1">
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
                <div className={`w-10 h-px mb-4 ${i < currentIdx ? "bg-amber-500" : "bg-slate-800"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}