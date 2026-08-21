import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Link2, Loader2, Check, X } from "lucide-react";

export default function VincularProjetoButton({ eventId, projetos, onLinked }) {
  const [expandido, setExpandido] = useState(false);
  const [busca, setBusca] = useState("");
  const [vinculando, setVinculando] = useState(null);

  const filtrados = busca
    ? projetos
        .filter(p => (p.nome_cliente || "").toLowerCase().includes(busca.toLowerCase()))
        .slice(0, 5)
    : [];

  const handleVincular = async (proj) => {
    setVinculando(proj.id);
    try {
      await base44.entities.Projeto.update(proj.id, { google_calendar_event_id: eventId });
      onLinked?.();
    } catch {
      // erro sobe naturalmente
    }
    setVinculando(null);
  };

  if (!expandido) {
    return (
      <button
        onClick={() => setExpandido(true)}
        className="text-amber-400 hover:text-amber-300 text-xs flex items-center gap-1 mt-1 transition-colors"
      >
        <Link2 size={10} /> Vincular projeto
      </button>
    );
  }

  return (
    <div className="mt-1.5 space-y-1">
      <div className="relative">
        <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          autoFocus
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar projeto pelo nome..."
          className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-7 pr-7 py-1 text-xs focus:outline-none focus:border-amber-500 placeholder-slate-600"
        />
        <button
          onClick={() => { setExpandido(false); setBusca(""); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
        >
          <X size={11} />
        </button>
      </div>
      {filtrados.map(p => (
        <button
          key={p.id}
          onClick={() => handleVincular(p)}
          disabled={vinculando === p.id}
          className="w-full text-left bg-slate-800 hover:bg-slate-700 text-white text-xs px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-all"
        >
          <span className="truncate">{p.nome_cliente}</span>
          {vinculando === p.id ? <Loader2 size={11} className="animate-spin text-amber-400" /> : <Check size={11} className="text-amber-400" />}
        </button>
      ))}
      {busca && filtrados.length === 0 && (
        <p className="text-slate-500 text-xs px-2 py-1">Nenhum projeto encontrado.</p>
      )}
    </div>
  );
}