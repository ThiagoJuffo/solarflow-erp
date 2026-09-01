import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { XCircle, Loader2, AlertTriangle } from "lucide-react";

export default function CancelarAgendamentoButton({ tipo, projetoId, manutencaoId, onDone }) {
  const [mostrarDialogo, setMostrarDialogo] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const handleCancelar = async () => {
    setCancelando(true);
    try {
      const payload = tipo === 'manutencao'
        ? { tipo: 'manutencao', manutencao_id: manutencaoId }
        : { tipo: 'instalacao', projeto_id: projetoId };
      const res = await base44.functions.invoke('cancelarAgendamento', payload);
      if (res.data?.error) throw new Error(res.data.error);
      setMostrarDialogo(false);
      onDone?.();
    } catch (e) {
      alert("Erro ao cancelar agendamento: " + (e?.message || e));
    } finally {
      setCancelando(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setMostrarDialogo(true)}
        className="text-xs bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
      >
        <XCircle size={11} />
        Cancelar agendamento
      </button>

      {mostrarDialogo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Cancelar agendamento?</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  O evento será removido do Google Calendar e todos os dados de agendamento serão zerados. Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleCancelar}
                disabled={cancelando}
                className="w-full bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
              >
                {cancelando ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Sim, cancelar agendamento
              </button>
              <button
                onClick={() => setMostrarDialogo(false)}
                disabled={cancelando}
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