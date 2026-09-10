import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

export default function ExcluirAgendamentoButton({ tipo, projetoId, manutencaoId, onDone }) {
  const [mostrarDialogo, setMostrarDialogo] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const handleExcluir = async () => {
    setExcluindo(true);
    try {
      const payload = tipo === "manutencao"
        ? { tipo: "manutencao", manutencao_id: manutencaoId }
        : { tipo: "instalacao", projeto_id: projetoId };
      const res = await base44.functions.invoke("excluirAgendamentoSolarFlow", payload);
      if (res.data?.error) throw new Error(res.data.error);
      setMostrarDialogo(false);
      onDone?.();
    } catch (e) {
      alert("Erro ao excluir agendamento: " + (e?.message || e));
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setMostrarDialogo(true)}
        className="text-xs bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
      >
        <Trash2 size={11} />
        Excluir agendamento
      </button>

      {mostrarDialogo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Excluir agendamento?</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  O agendamento será removido da agenda do SolarFlow. Os dados de instalação serão zerados. Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleExcluir}
                disabled={excluindo}
                className="w-full bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
              >
                {excluindo ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Sim, excluir agendamento
              </button>
              <button
                onClick={() => setMostrarDialogo(false)}
                disabled={excluindo}
                className="w-full text-slate-500 hover:text-white py-1.5 text-xs transition-all"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}