import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle, Loader2, AlertTriangle } from "lucide-react";

export default function MarcarInstaladoButton({ projeto, onDone, continuacaoData }) {
  const [mostrarDialogo, setMostrarDialogo] = useState(false);
  const [marcando, setMarcando] = useState(false);

  const handleConcluir = async () => {
    setMarcando(true);
    try {
      const dataFinal = continuacaoData || projeto.data_instalacao || new Date().toISOString().slice(0, 10);
      const continuacoes = Array.isArray(projeto.continuacoes)
        ? projeto.continuacoes.map(c => ({ ...c, concluida: true }))
        : [];
      await base44.entities.Projeto.update(projeto.id, {
        sistema_instalado: true,
        status: "sistema_instalado",
        data_instalacao: dataFinal,
        continuacoes
      });
      setMostrarDialogo(false);
      onDone?.();
    } catch {
      // erro sobe naturalmente
    }
    setMarcando(false);
  };

  const handleApenasRegistrar = async () => {
    if (!continuacaoData) {
      // Dia original — apenas fecha o diálogo
      setMostrarDialogo(false);
      return;
    }
    setMarcando(true);
    try {
      const continuacoes = (Array.isArray(projeto.continuacoes) ? projeto.continuacoes : []).map(c =>
        c.data === continuacaoData ? { ...c, concluida: true } : c
      );
      await base44.entities.Projeto.update(projeto.id, { continuacoes });
      setMostrarDialogo(false);
      onDone?.();
    } catch {
      // erro sobe naturalmente
    }
    setMarcando(false);
  };

  return (
    <>
      <button
        onClick={() => setMostrarDialogo(true)}
        className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
      >
        <CheckCircle size={11} />
        Marcar como instalado
      </button>

      {mostrarDialogo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-amber-400" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Concluir instalação?</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  Esta é a última etapa da instalação de {projeto.nome_cliente}?
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleConcluir}
                disabled={marcando}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
              >
                {marcando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Sim, concluir instalação
              </button>
              <button
                onClick={handleApenasRegistrar}
                disabled={marcando}
                className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 py-2.5 rounded-xl transition-all text-sm"
              >
                Não, apenas registrar este dia
              </button>
              <button
                onClick={() => setMostrarDialogo(false)}
                disabled={marcando}
                className="w-full text-slate-500 hover:text-white py-1.5 text-xs transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}