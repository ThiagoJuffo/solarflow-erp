import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Loader2, X, Calendar, Sun, MapPin, Link2 } from "lucide-react";

export default function NovoAgendamentoModal({ projetos, ucs, preProjetos, onClose, onCreated }) {
  const [busca, setBusca] = useState("");
  const [projetoSel, setProjetoSel] = useState(null);
  const [data, setData] = useState("");
  const [hora, setHora] = useState("08:00");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");

  const filtrados = busca
    ? projetos.filter(p => (p.nome_cliente || "").toLowerCase().includes(busca.toLowerCase())).slice(0, 6)
    : [];

  const ucDoProjeto = projetoSel ? ucs.find(u => u.projeto_id === projetoSel.id) : null;
  const ppDoProjeto = projetoSel
    ? preProjetos.find(pp => pp.id === projetoSel.pre_projeto_id || pp.projeto_id === projetoSel.id)
    : null;

  const handleCriar = async () => {
    if (!projetoSel || !data) return;
    setCriando(true);
    setErro("");
    try {
      const dataHora = new Date(`${data}T${hora || "08:00"}:00`);
      const res = await base44.functions.invoke('agendarInstalacaoManual', {
        projeto_id: projetoSel.id,
        data_agendamento: dataHora.toISOString(),
      });
      if (res.data?.error) throw new Error(res.data.error);
      if (res.data?.skipped) {
        setErro("Este projeto já tem uma instalação agendada.");
      } else {
        onCreated?.();
        onClose?.();
      }
    } catch {
      setErro("Erro ao agendar no Google Calendar. Tente novamente.");
    }
    setCriando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <Calendar size={16} className="text-amber-400" /> Novo Agendamento
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Seleção de projeto */}
        {!projetoSel ? (
          <div className="space-y-3">
            <label className="text-slate-400 text-xs font-medium block">Vincular a um projeto</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                autoFocus
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar projeto pelo nome do cliente..."
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 placeholder-slate-600"
              />
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {filtrados.map(p => {
                const uc = ucs.find(u => u.projeto_id === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => setProjetoSel(p)}
                    className="w-full text-left bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/40 text-white rounded-xl px-3 py-2.5 text-sm transition-all"
                  >
                    <p className="font-medium truncate">{p.nome_cliente}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {uc?.cidade && (
                        <span className="text-slate-400 text-xs flex items-center gap-1">
                          <MapPin size={10} /> {uc.cidade}
                        </span>
                      )}
                      {p.google_calendar_event_id && (
                        <span className="text-amber-400/70 text-xs flex items-center gap-1">
                          <Calendar size={10} /> Já agendado
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {busca && filtrados.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-4">Nenhum projeto encontrado.</p>
              )}
              {!busca && (
                <p className="text-slate-500 text-xs text-center py-4">Digite para buscar um projeto.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Projeto selecionado */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{projetoSel.nome_cliente}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {ucDoProjeto?.cidade && (
                      <span className="text-slate-400 text-xs flex items-center gap-1">
                        <MapPin size={10} /> {ucDoProjeto.cidade}
                      </span>
                    )}
                    {ppDoProjeto?.modulo_quantidade && (
                      <span className="text-slate-400 text-xs flex items-center gap-1">
                        <Sun size={10} /> {ppDoProjeto.modulo_quantidade} placas
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setProjetoSel(null)}
                  className="text-slate-500 hover:text-white text-xs shrink-0 ml-2"
                >
                  Trocar
                </button>
              </div>
            </div>

            {/* Data e hora */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Data da instalação</label>
                <input
                  type="date"
                  value={data}
                  onChange={e => setData(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Hora</label>
                <input
                  type="time"
                  value={hora}
                  onChange={e => setHora(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {projetoSel.google_calendar_event_id && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 flex items-start gap-2">
                <Calendar size={12} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-amber-300 text-xs">Este projeto já possui um agendamento. Um novo evento será criado apenas se o vínculo for removido primeiro.</p>
              </div>
            )}

            {erro && (
              <p className="text-red-400 text-xs">{erro}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-sm font-medium transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleCriar}
                disabled={!data || criando}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                {criando ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                Agendar instalação
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}