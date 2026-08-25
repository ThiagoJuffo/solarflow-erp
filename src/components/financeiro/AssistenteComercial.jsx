import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Bot, CheckCircle2, ExternalLink, Loader2, MessageCircle, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

const moeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS = {
  pendente: "bg-amber-500/10 text-amber-300",
  aprovada: "bg-emerald-500/10 text-emerald-300",
  rejeitada: "bg-red-500/10 text-red-300",
};

const listarTodos = async (entidade, ordenacao) => {
  const todos = [];
  const limite = 5000;
  for (let pagina = 0; ; pagina += 1) {
    const lote = await entidade.list(ordenacao, limite, pagina * limite);
    todos.push(...lote);
    if (lote.length < limite) return todos;
  }
};

export default function AssistenteComercial({ canEdit, user, onLancamentoCriado }) {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");
  const whatsappUrl = useMemo(
    () => base44.agents.getWhatsAppConnectURL("comercial_ecomar"),
    []
  );

  const carregar = async () => {
    setLoading(true);
    try {
      const lista = await listarTodos(base44.entities.SolicitacaoLancamento, "-created_date");
      setSolicitacoes(lista);
      setErro("");
    } catch (error) {
      setErro(error?.message || "Não foi possível carregar as solicitações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const aprovar = async (solicitacao) => {
    if (!canEdit || !window.confirm(`Aprovar e criar o lançamento "${solicitacao.descricao}"?`)) return;
    setErro("");
    setProcessando(solicitacao.id);
    try {
      const atual = await base44.entities.SolicitacaoLancamento.get(solicitacao.id);
      if (atual.status !== "pendente" || atual.lancamento_id) {
        throw new Error("Esta solicitação já foi tratada. Atualize a lista.");
      }
      const existentes = await base44.entities.Lancamento.filter({
        solicitacao_lancamento_id: atual.id,
      }, "-created_date", 5);
      const lancamento = existentes.find((item) => item.status !== "cancelado") ||
        await base44.entities.Lancamento.create({
          tipo: atual.tipo,
          descricao: atual.descricao,
          valor: Number(atual.valor || 0),
          data_competencia: atual.data_vencimento,
          data_vencimento: atual.data_vencimento,
          categoria: atual.categoria || "outros",
          projeto_id: atual.projeto_id || "",
          centro_custo_id: atual.centro_custo_id || "",
          nome_cliente_fornecedor: atual.nome_cliente_fornecedor || "",
          numero_documento: atual.numero_documento || "",
          observacoes: [atual.observacoes, "Origem: Assistente Comercial ECOMAR / WhatsApp"].filter(Boolean).join("\n"),
          status: "pendente",
          valor_pago: 0,
          recorrente: false,
          conciliado: false,
          origem: "assistente",
          solicitacao_lancamento_id: atual.id,
        });
      const atualizada = await base44.entities.SolicitacaoLancamento.update(atual.id, {
        status: "aprovada",
        lancamento_id: lancamento.id,
        decidido_por: user?.email || user?.full_name || "Financeiro",
        decidido_em: new Date().toISOString(),
      });
      setSolicitacoes((lista) => lista.map((item) => item.id === atualizada.id ? atualizada : item));
      onLancamentoCriado?.(lancamento);
    } catch (error) {
      setErro(error?.message || "Não foi possível aprovar a solicitação.");
    } finally {
      setProcessando("");
    }
  };

  const rejeitar = async (solicitacao) => {
    if (!canEdit) return;
    const motivo = window.prompt("Motivo da rejeição (opcional):") ?? null;
    if (motivo === null) return;
    setErro("");
    setProcessando(solicitacao.id);
    try {
      const atual = await base44.entities.SolicitacaoLancamento.get(solicitacao.id);
      if (atual.status !== "pendente" || atual.lancamento_id) {
        throw new Error("Esta solicitação já foi tratada. Atualize a lista.");
      }
      const atualizada = await base44.entities.SolicitacaoLancamento.update(atual.id, {
        status: "rejeitada",
        motivo_rejeicao: motivo,
        decidido_por: user?.email || user?.full_name || "Financeiro",
        decidido_em: new Date().toISOString(),
      });
      setSolicitacoes((lista) => lista.map((item) => item.id === atualizada.id ? atualizada : item));
    } catch (error) {
      setErro(error?.message || "Não foi possível rejeitar a solicitação.");
    } finally {
      setProcessando("");
    }
  };

  const pendentes = solicitacoes.filter((item) => item.status === "pendente");

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <MessageCircle size={21} />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-white">Assistente Comercial ECOMAR</h2>
              <p className="mt-1 text-sm text-slate-400">
                Consulta dados do ERP e prepara solicitações financeiras para aprovação.
              </p>
              <a href={whatsappUrl} target="_blank" rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400">
                <ExternalLink size={15} /> Conectar ao WhatsApp
              </a>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck size={22} className="mt-0.5 shrink-0 text-blue-400" />
            <div>
              <h3 className="font-semibold text-white">Fluxo protegido</h3>
              <p className="mt-1 text-sm text-slate-400">
                O assistente não movimenta o caixa diretamente. Cada solicitação precisa da aprovação de Admin ou Financeiro.
              </p>
              <p className="mt-3 text-xs text-blue-300">
                O canal nativo é individual. Para atuação dentro de um grupo do WhatsApp pode ser necessário um provedor externo.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-5">
          <div>
            <div className="flex items-center gap-2">
              <Bot size={17} className="text-amber-400" />
              <h3 className="font-semibold text-white">Solicitações do assistente</h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">{pendentes.length} aguardando aprovação</p>
          </div>
          <button onClick={carregar} disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white disabled:opacity-50">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>

        {erro && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            <AlertCircle size={14} /> {erro}
          </div>
        )}

        <div className="divide-y divide-slate-800">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
              <Loader2 size={17} className="animate-spin" /> Carregando solicitações...
            </div>
          ) : solicitacoes.length ? solicitacoes.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-white">{item.descricao}</p>
                  <span className={`rounded-lg px-2 py-1 text-[11px] capitalize ${STATUS[item.status] || STATUS.pendente}`}>
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {item.tipo === "receita" ? "Receita" : "Despesa"} • {item.data_vencimento || "Sem vencimento"}
                  {item.solicitante_nome ? ` • Solicitado por ${item.solicitante_nome}` : ""}
                </p>
                {item.nome_cliente_fornecedor && <p className="mt-1 text-xs text-slate-400">{item.nome_cliente_fornecedor}</p>}
              </div>
              <p className={`font-bold ${item.tipo === "receita" ? "text-emerald-400" : "text-red-400"}`}>
                {moeda(item.valor)}
              </p>
              {canEdit && item.status === "pendente" && (
                <div className="flex gap-2">
                  <button onClick={() => aprovar(item)} disabled={Boolean(processando)}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50">
                    {processando === item.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Aprovar
                  </button>
                  <button onClick={() => rejeitar(item)} disabled={Boolean(processando)}
                    className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50">
                    <XCircle size={13} /> Rejeitar
                  </button>
                </div>
              )}
            </div>
          )) : (
            <div className="p-10 text-center text-sm text-slate-500">Nenhuma solicitação recebida.</div>
          )}
        </div>
      </section>
    </div>
  );
}
