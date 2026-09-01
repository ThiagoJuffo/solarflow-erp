import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CalendarPlus, Loader2, X } from "lucide-react";

export default function ContinuarInstalacaoButton({ projeto, onDone }) {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState("");
  const [salvando, setSalvando] = useState(false);

  const handleConfirmar = async () => {
    if (!data) return;
    setSalvando(true);
    try {
      const iso = new Date(data + "T08:00:00").toISOString();
      await base44.functions.invoke('agendarContinuacaoInstalacao', {
        projeto_id: projeto.id,
        nova_data: iso
      });
      setAberto(false);
      setData("");
      onDone?.();
    } catch {
      // erro sobe naturalmente
    }
    setSalvando(false);
  };

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="text-xs bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
      >
        <CalendarPlus size={11} /> Continuar noutro dia
      </button>
    );
  }

  return (
    <div className="mt-1 p-2 rounded-lg bg-slate-800/50 border border-sky-500/20">
      <div className="flex items-center gap-2 mb-1.5">
        <CalendarPlus size={12} className="text-sky-400" />
        <span className="text-xs text-slate-300">Continuar instalação em:</span>
        <button onClick={() => setAberto(false)} className="ml-auto text-slate-500 hover:text-white">
          <X size={12} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={data}
          onChange={e => setData(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-sky-500"
        />
        <button
          onClick={handleConfirmar}
          disabled={!data || salvando}
          className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1"
        >
          {salvando ? <Loader2 size={11} className="animate-spin" /> : <CalendarPlus size={11} />}
          Agendar
        </button>
      </div>
    </div>
  );
}