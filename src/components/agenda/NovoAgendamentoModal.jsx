import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Loader2, X, Calendar, Sun, MapPin, Link2, Wrench, Phone } from "lucide-react";

export default function NovoAgendamentoModal({ projetos, ucs, preProjetos, manutencoes, onClose, onCreated }) {
  const [tipo, setTipo] = useState("instalacao");
  const [busca, setBusca] = useState("");
  const [projetoSel, setProjetoSel] = useState(null);
  const [manutSel, setManutSel] = useState(null);
  const [data, setData] = useState("");
  const [hora, setHora] = useState("08:00");
  const [qtdDias, setQtdDias] = useState(1);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");

  const trocarTipo = (novo) => {
    setTipo(novo);
    setBusca("");
    setProjetoSel(null);
    setManutSel(null);
    setErro("");
  };

  // Projetos filtrados (apenas sem instalação agendada)
  const projetosFiltrados = busca
    ? projetos.filter(p => (p.nome_cliente || "").toLowerCase().includes(busca.toLowerCase())).slice(0, 6)
    : [];

  // Manutenções pendentes de agendamento (status "agendar") — mostra todas ao clicar, filtra ao digitar
  const manutencoesPendentes = manutencoes.filter(m => m.status === "agendar");
  const manutencoesFiltradas = (busca
    ? manutencoesPendentes.filter(m => (m.nome_cliente || "").toLowerCase().includes(busca.toLowerCase()))
    : manutencoesPendentes
  ).slice(0, 6);

  const ucDoProjeto = projetoSel ? ucs.find(u => u.projeto_id === projetoSel.id) : null;
  const ppDoProjeto = projetoSel
    ? preProjetos.find(pp => pp.id === projetoSel.pre_projeto_id || pp.projeto_id === projetoSel.id)
    : null;

  const handleCriarInstalacao = async () => {
    if (!projetoSel || !data) return;
    setCriando(true);
    setErro("");
    try {
      const dataHora = new Date(`${data}T${hora || "08:00"}:00`);
      const res = await base44.functions.invoke('agendarInstalacaoManual', {
        projeto_id: projetoSel.id,
        data_agendamento: dataHora.toISOString(),
        quantidade_dias: qtdDias,
      });
      if (res.data?.error) throw new Error(res.data.error);
      if (res.data?.skipped) {
        setErro("Este projeto já tem uma instalação agendada.");
      } else {
        onCreated?.();
        onClose?.();
      }
    } catch {
      setErro("Erro ao agendar instalação. Tente novamente.");
    }
    setCriando(false);
  };

  const handleCriarManutencao = async () => {
    if (!manutSel || !data) return;
    setCriando(true);
    setErro("");
    try {
      const dataHora = new Date(`${data}T${hora || "08:00"}:00`);
      const res = await base44.functions.invoke('manutencaoCalendar', {
        action: 'create',
        manutencao_id: manutSel.id,
        data_agendamento: dataHora.toISOString(),
      });
      if (res.data?.error) throw new Error(res.data.error);
      if (res.data?.skipped) {
        setErro("Esta manutenção já está agendada.");
      } else {
        onCreated?.();
        onClose?.();
      }
    } catch {
      setErro("Erro ao agendar manutenção. Tente novamente.");
    }
    setCriando(false);
  };

  const handleCriar = tipo === "instalacao" ? handleCriarInstalacao : handleCriarManutencao;
  const temSelecao = tipo === "instalacao" ? !!projetoSel : !!manutSel;
  const jaAgendado = tipo === "instalacao" ? projetoSel?.data_instalacao : manutSel?.data_agendamento;
  const labelBotao = tipo === "instalacao" ? "Agendar instalação" : "Agendar manutenção";

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

        {/* Toggle de tipo */}
        <div className="grid grid-cols-2 gap-2 mb-4 bg-slate-800/50 p-1 rounded-xl">
          <button
            onClick={() => trocarTipo("instalacao")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${tipo === "instalacao" ? "bg-amber-500 text-white" : "text-slate-400 hover:text-white"}`}
          >
            <Sun size={13} /> Instalação
          </button>
          <button
            onClick={() => trocarTipo("manutencao")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${tipo === "manutencao" ? "bg-amber-500 text-white" : "text-slate-400 hover:text-white"}`}
          >
            <Wrench size={13} /> Manutenção
          </button>
        </div>

        {/* Seleção */}
        {!temSelecao ? (
          <div className="space-y-3">
            <label className="text-slate-400 text-xs font-medium block">
              {tipo === "instalacao" ? "Vincular a um projeto" : "Vincular a uma manutenção"}
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                autoFocus
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder={tipo === "instalacao" ? "Buscar projeto pelo nome do cliente..." : "Buscar manutenção pelo nome do cliente..."}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 placeholder-slate-600"
              />
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {tipo === "instalacao" ? (
                projetosFiltrados.map(p => {
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
                        {p.data_instalacao && (
                          <span className="text-amber-400/70 text-xs flex items-center gap-1">
                            <Calendar size={10} /> Já agendado
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                manutencoesFiltradas.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setManutSel(m)}
                    className="w-full text-left bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/40 text-white rounded-xl px-3 py-2.5 text-sm transition-all"
                  >
                    <p className="font-medium truncate">{m.nome_cliente}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {m.endereco && (
                        <span className="text-slate-400 text-xs flex items-center gap-1">
                          <MapPin size={10} /> {m.endereco}
                        </span>
                      )}
                      {m.telefone && (
                        <span className="text-slate-400 text-xs flex items-center gap-1">
                          <Phone size={10} /> {m.telefone}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
              {busca && (tipo === "instalacao" ? projetosFiltrados : manutencoesFiltradas).length === 0 && (
                <p className="text-slate-500 text-sm text-center py-4">
                  {tipo === "instalacao" ? "Nenhum projeto encontrado." : "Nenhuma manutenção pendente de agendamento encontrada."}
                </p>
              )}
              {!busca && tipo === "instalacao" && (
                <p className="text-slate-500 text-xs text-center py-4">
                  Digite para buscar um projeto.
                </p>
              )}
              {!busca && tipo === "manutencao" && manutencoesPendentes.length === 0 && (
                <p className="text-slate-500 text-xs text-center py-4">
                  Nenhuma manutenção pendente de agendamento.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Selecionado */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {tipo === "manutencao" && <Wrench size={12} className="text-amber-400 shrink-0" />}
                    <p className="text-white font-medium text-sm truncate">
                      {tipo === "instalacao" ? projetoSel.nome_cliente : manutSel.nome_cliente}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {tipo === "instalacao" ? (
                      <>
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
                      </>
                    ) : (
                      <>
                        {manutSel.endereco && (
                          <span className="text-slate-400 text-xs flex items-center gap-1">
                            <MapPin size={10} /> {manutSel.endereco}
                          </span>
                        )}
                        {manutSel.telefone && (
                          <span className="text-slate-400 text-xs flex items-center gap-1">
                            <Phone size={10} /> {manutSel.telefone}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => tipo === "instalacao" ? setProjetoSel(null) : setManutSel(null)}
                  className="text-slate-500 hover:text-white text-xs shrink-0 ml-2"
                >
                  Trocar
                </button>
              </div>
            </div>

            {/* Data e hora */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Data de início</label>
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

            {/* Quantidade de dias — apenas instalação */}
            {tipo === "instalacao" && (
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Quantidade de dias</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={qtdDias}
                  onChange={e => setQtdDias(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                />
                {qtdDias > 1 && (
                  <p className="text-slate-500 text-xs mt-1.5">
                    Instalação prevista de {data ? new Date(data + "T00:00:00").toLocaleDateString("pt-BR") : "—"} até{" "}
                    {data ? new Date(new Date(data + "T00:00:00").getTime() + (qtdDias - 1) * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR") : "—"}.
                  </p>
                )}
              </div>
            )}

            {jaAgendado && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 flex items-start gap-2">
                <Calendar size={12} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-amber-300 text-xs">
                  {tipo === "instalacao" ? "Este projeto já possui uma instalação agendada." : "Esta manutenção já está agendada."}
                </p>
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
                {labelBotao}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}