import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, Plus, CheckCircle, AlertTriangle, Clock, XCircle, Loader2 } from "lucide-react";

const STATUS_ICONS = {
  aberto: <Clock size={14} className="text-blue-400" />,
  pendente: <AlertTriangle size={14} className="text-amber-400" />,
  em_analise: <Clock size={14} className="text-violet-400" />,
  concluido: <CheckCircle size={14} className="text-emerald-400" />,
  indeferido: <XCircle size={14} className="text-red-400" />,
};

const STATUS_LABELS = {
  aberto: "Aberto",
  pendente: "Com Pendências",
  em_analise: "Em Análise",
  concluido: "Concluído",
  indeferido: "Indeferido",
};

export default function ProtocoloCard({ projetoId, protocolos = [], onUpdate }) {
  const [criando, setCriando] = useState(false);
  const [tipo, setTipo] = useState("PROJETO");
  const [numero, setNumero] = useState("");
  const [data, setData] = useState("");
  const [modalidade, setModalidade] = useState("convencional");
  const [saving, setSaving] = useState(false);

  const handleCriar = async () => {
    setSaving(true);
    const novo = await base44.entities.Protocolo.create({
      projeto_id: projetoId,
      tipo,
      numero_protocolo: numero,
      data_entrada: data,
      status: "aberto",
      modalidade
    });
    setSaving(false);
    setCriando(false);
    setNumero("");
    setModalidade("convencional");
    onUpdate && onUpdate(novo);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <FileText size={16} className="text-amber-400" /> Protocolos EDP
        </h3>
        <button
          onClick={() => setCriando(!criando)}
          className="flex items-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg transition-all"
        >
          <Plus size={12} /> Novo
        </button>
      </div>

      {criando && (
        <div className="bg-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex gap-2">
            {["PROJETO", "VISTORIA"].map(t => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${tipo === t ? "bg-amber-500 text-white" : "bg-slate-700 text-slate-400 hover:text-white"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {["convencional", "fast_track"].map(m => (
              <button
                key={m}
                onClick={() => setModalidade(m)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${modalidade === m ? (m === "fast_track" ? "bg-sky-500 text-white" : "bg-slate-500 text-white") : "bg-slate-700 text-slate-400 hover:text-white"}`}
              >
                {m === "fast_track" ? "Fast Track" : "Convencional"}
              </button>
            ))}
          </div>
          <input
            value={numero}
            onChange={e => setNumero(e.target.value)}
            placeholder="Número do protocolo"
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <input
            type="date"
            value={data}
            onChange={e => setData(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
          <div className="flex gap-2">
            <button onClick={() => setCriando(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-xl text-xs transition-all">Cancelar</button>
            <button
              onClick={handleCriar}
              disabled={saving || !numero}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
              Criar
            </button>
          </div>
        </div>
      )}

      {protocolos.length === 0 && !criando ? (
        <p className="text-slate-500 text-sm text-center py-4">Nenhum protocolo registrado</p>
      ) : (
        <div className="space-y-2">
          {protocolos.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${p.tipo === "PROJETO" ? "bg-blue-500/10" : "bg-violet-500/10"}`}>
                {STATUS_ICONS[p.status]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white text-sm font-medium">{p.tipo}</p>
                  {p.modalidade && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${p.modalidade === "fast_track" ? "bg-sky-500/15 text-sky-400" : "bg-slate-700 text-slate-400"}`}>
                      {p.modalidade === "fast_track" ? "Fast Track" : "Convencional"}
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-xs">Nº {p.numero_protocolo || "—"} · {p.data_entrada || "sem data"}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-lg ${p.status === "concluido" ? "bg-emerald-400/10 text-emerald-400" : p.status === "indeferido" ? "bg-red-400/10 text-red-400" : "bg-slate-700 text-slate-400"}`}>
                {STATUS_LABELS[p.status] || p.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}