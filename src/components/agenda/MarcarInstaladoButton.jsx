import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle, Loader2 } from "lucide-react";

export default function MarcarInstaladoButton({ projeto, onDone }) {
  const [marcando, setMarcando] = useState(false);

  const handleMarcar = async () => {
    setMarcando(true);
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      await base44.entities.Projeto.update(projeto.id, {
        sistema_instalado: true,
        status: "sistema_instalado",
        data_instalacao: projeto.data_instalacao || hoje,
      });
      onDone?.();
    } catch {
      // erro sobe naturalmente
    }
    setMarcando(false);
  };

  return (
    <button
      onClick={handleMarcar}
      disabled={marcando}
      className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
    >
      {marcando ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
      Marcar como instalado
    </button>
  );
}