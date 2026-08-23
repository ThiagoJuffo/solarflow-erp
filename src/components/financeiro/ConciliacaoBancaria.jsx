import { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { format, parseISO } from "date-fns";
import {
  AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle2, FileLock2,
  Landmark, Link2, Loader2, Plus, RefreshCw, ShieldCheck,
  Sparkles, Split, UploadCloud, X
} from "lucide-react";

const moeda = (valor) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const campoClass = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500";

const diferencaDias = (a, b) => {
  if (!a || !b) return 999;
  return Math.abs((parseISO(a).getTime() - parseISO(b).getTime()) / 86400000);
};

const sugerirLancamento = (movimento, lancamentos) => {
  const tipoLancamento = movimento.tipo === "credito" ? "receita" : "despesa";
  const candidatos = lancamentos.filter((l) =>
    l.tipo === tipoLancamento &&
    l.status !== "cancelado" &&
    l.conciliado !== true &&
    Math.abs(Number(l.valor || 0) - Number(movimento.valor || 0)) <= 0.01 &&
    diferencaDias(l.data_pagamento || l.data_vencimento, movimento.data) <= 3
  );

  return candidatos.map((lancamento) => {
    const dias = diferencaDias(lancamento.data_pagamento || lancamento.data_vencimento, movimento.data);
    let score = 40 + (dias === 0 ? 55 : dias === 1 ? 45 : 35);
    const textoMovimento = String(movimento.descricao || "").toLowerCase();
    const textoLancamento = String(lancamento.descricao || "").toLowerCase();
    const palavras = textoLancamento.split(/\s+/).filter((p) => p.length > 3);
    if (palavras.some((p) => textoMovimento.includes(p))) score += 5;
    return { lancamento, score: Math.min(score, 100), dias };
  }).sort((a, b) => b.score - a.score)[0] || null;
};

function RateioModal({ movimento, centros, contaId, onConcluir, onFechar }) {
  const [linhas, setLinhas] = useState([
    { centro_custo_id: "", valor: "", descricao: "" },
    { centro_custo_id: "", valor: "", descricao: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const total = linhas.reduce((s, item) => s + Number(item.valor || 0), 0);
  const diferenca = Number(movimento.valor || 0) - total;
  const valido = Math.abs(diferenca) < 0.01 && linhas.every((item) => item.centro_custo_id && Number(item.valor) > 0);

  const alterar = (indice, campo, valor) =>
    setLinhas((atuais) => atuais.map((item, i) => i === indice ? { ...item, [campo]: valor } : item));

  const adicionar = () => setLinhas((atuais) => [...atuais, { centro_custo_id: "", valor: "", descricao: "" }]);
  const remover = (indice) => setLinhas((atuais) => atuais.filter((_, i) => i !== indice));

  const concluir = async () => {
    if (!valido) return;
    setSaving(true);
    try {
      await onConcluir(movimento, linhas, contaId);
    } finally {
      setSaving(false);
    }
  };

  const centrosOrdenados = useMemo(() => {
    const principais = centros.filter((c) => !c.centro_pai_id && c.ativo !== false);
    return principais.flatMap((pai) => [
      { ...pai, label: pai.nome },
      ...centros.filter((c) => c.centro_pai_id === pai.id && c.ativo !== false)
        .map((filho) => ({ ...filho, label: `↳ ${filho.nome}` }))
    ]);
  }, [centros]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h3 className="font-bold text-white">Ratear movimento</h3>
            <p className="text-xs text-slate-500">Distribua uma única entrada ou saída em vários centros e subcentros.</p>
          </div>
          <button onClick={onFechar} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="space-y-5 p-6">
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div>
              <p className="text-sm font-medium text-white">{movimento.descricao}</p>
              <p className="mt-1 text-xs text-slate-500">{format(parseISO(movimento.data), "dd/MM/yyyy")}</p>
            </div>
            <p className={`text-lg font-bold ${movimento.tipo === "credito" ? "text-emerald-400" : "text-red-400"}`}>
              {moeda(movimento.valor)}
            </p>
          </div>

          <div className="space-y-3">
            {linhas.map((linha, indice) => (
              <div key={indice} className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 sm:grid-cols-[1.25fr_0.65fr_1fr_auto]">
                <select value={linha.centro_custo_id} onChange={(e) => alterar(indice, "centro_custo_id", e.target.value)} className={campoClass}>
                  <option value="">Centro / subcentro...</option>
                  {centrosOrdenados.map((centro) => <option key={centro.id} value={centro.id}>{centro.label}</option>)}
                </select>
                <input type="number" min="0.01" step="0.01" value={linha.valor}
                  onChange={(e) => alterar(indice, "valor", e.target.value)} placeholder="Valor" className={campoClass} />
                <input value={linha.descricao} onChange={(e) => alterar(indice, "descricao", e.target.value)}
                  placeholder="Descrição opcional" className={campoClass} />
                <button onClick={() => remover(indice)} disabled={linhas.length <= 2}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-red-400 disabled:opacity-30">
                  <X size={14} />
                </button>
              </div>
            ))}
            <button onClick={adicionar} className="flex items-center gap-2 text-xs font-medium text-amber-400 hover:text-amber-300">
              <Plus size={14} /> Adicionar divisão
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-[11px] uppercase text-slate-500">Movimento</p>
              <p className="mt-1 font-semibold text-white">{moeda(movimento.valor)}</p>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-[11px] uppercase text-slate-500">Rateado</p>
              <p className="mt-1 font-semibold text-white">{moeda(total)}</p>
            </div>
            <div className={`rounded-xl p-3 ${Math.abs(diferenca) < 0.01 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
              <p className="text-[11px] uppercase text-slate-500">Diferença</p>
              <p className={`mt-1 font-semibold ${Math.abs(diferenca) < 0.01 ? "text-emerald-400" : "text-red-400"}`}>{moeda(diferenca)}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={onFechar} className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700">
              Cancelar
            </button>
            <button onClick={concluir} disabled={!valido || saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Split size={14} />}
              {saving ? "Conciliando..." : "Confirmar rateio"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConciliacaoBancaria({
  contas, centros, lancamentos, canEdit, onLancamentoAtualizado, onLancamentosCriados
}) {
  const inputRef = useRef(null);
  const [contaId, setContaId] = useState("");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const [movimentos, setMovimentos] = useState([]);
  const [importacoes, setImportacoes] = useState([]);
  const [rateando, setRateando] = useState(null);

  const carregarHistorico = async () => {
    const [listaImportacoes, listaMovimentos] = await Promise.all([
      base44.entities.ImportacaoExtrato.list("-created_date", 20),
      base44.entities.MovimentoExtrato.list("-data", 500),
    ]);
    setImportacoes(listaImportacoes);
    setMovimentos(listaMovimentos);
  };

  useEffect(() => { carregarHistorico(); }, []);

  const processarExtrato = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!contaId) {
      setErro("Selecione a conta financeira antes de enviar o extrato.");
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setErro("Envie um arquivo PDF do extrato bancário.");
      return;
    }

    setErro("");
    setProcessando(true);
    let importacao;
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      importacao = await base44.entities.ImportacaoExtrato.create({
        conta_financeira_id: contaId,
        nome_arquivo: file.name,
        arquivo_uri: file_uri,
        status: "processando",
      });
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 3600 });
      const resultado = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: signed_url,
        json_schema: {
          type: "object",
          properties: {
            banco: { type: "string" },
            periodo_inicio: { type: "string", format: "date" },
            periodo_fim: { type: "string", format: "date" },
            movimentos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  data: { type: "string", format: "date" },
                  descricao: { type: "string" },
                  documento: { type: "string" },
                  tipo: { type: "string", enum: ["credito", "debito"] },
                  valor: { type: "number" },
                  saldo: { type: "number" }
                },
                required: ["data", "descricao", "tipo", "valor"]
              }
            }
          },
          required: ["movimentos"]
        }
      });

      const dados = resultado?.output || resultado;
      if (resultado?.status && resultado.status !== "success") throw new Error("Não foi possível interpretar o PDF.");
      const extraidos = Array.isArray(dados?.movimentos) ? dados.movimentos : [];
      if (!extraidos.length) throw new Error("Nenhum movimento foi encontrado no extrato.");

      const preparados = extraidos.map((item) => {
        const valorOriginal = Number(item.valor || 0);
        const tipo = item.tipo || (valorOriginal < 0 ? "debito" : "credito");
        const movimento = {
          importacao_id: importacao.id,
          conta_financeira_id: contaId,
          data: item.data,
          descricao: item.descricao || "Movimento bancário",
          documento: item.documento || "",
          tipo,
          valor: Math.abs(valorOriginal),
          saldo: item.saldo === undefined ? undefined : Number(item.saldo),
        };
        const sugestao = sugerirLancamento(movimento, lancamentos);
        return {
          ...movimento,
          status_conciliacao: sugestao ? "sugerido" : "pendente",
          lancamento_id: sugestao?.lancamento.id || "",
          score_match: sugestao?.score || 0,
          justificativa_match: sugestao
            ? `Mesmo valor e data com diferença de ${sugestao.dias} dia(s)`
            : "Nenhum lançamento compatível encontrado",
        };
      });

      const criados = await base44.entities.MovimentoExtrato.bulkCreate(preparados);
      const totalCreditos = preparados.filter((m) => m.tipo === "credito").reduce((s, m) => s + m.valor, 0);
      const totalDebitos = preparados.filter((m) => m.tipo === "debito").reduce((s, m) => s + m.valor, 0);
      const importacaoAtualizada = await base44.entities.ImportacaoExtrato.update(importacao.id, {
        banco: dados.banco || "",
        periodo_inicio: dados.periodo_inicio || "",
        periodo_fim: dados.periodo_fim || "",
        status: "processado",
        total_movimentos: preparados.length,
        total_creditos: totalCreditos,
        total_debitos: totalDebitos,
      });
      setImportacoes((lista) => [importacaoAtualizada, ...lista.filter((i) => i.id !== importacao.id)]);
      setMovimentos((lista) => [...criados, ...lista]);
    } catch (error) {
      const mensagem = error?.message || "Falha ao processar o extrato.";
      setErro(mensagem);
      if (importacao?.id) {
        await base44.entities.ImportacaoExtrato.update(importacao.id, { status: "erro", mensagem_erro: mensagem });
      }
    } finally {
      setProcessando(false);
    }
  };

  const confirmarSugestao = async (movimento) => {
    const lancamento = lancamentos.find((l) => l.id === movimento.lancamento_id);
    if (!lancamento) return;
    const atualizado = await base44.entities.Lancamento.update(lancamento.id, {
      status: "pago",
      data_pagamento: movimento.data,
      conta_financeira_id: movimento.conta_financeira_id,
      conciliado: true,
    });
    const movimentoAtualizado = await base44.entities.MovimentoExtrato.update(movimento.id, {
      status_conciliacao: "conciliado",
      score_match: 100,
    });
    setMovimentos((lista) => lista.map((m) => m.id === movimento.id ? movimentoAtualizado : m));
    onLancamentoAtualizado(atualizado);
  };

  const criarLancamento = async (movimento) => {
    const novo = await base44.entities.Lancamento.create({
      tipo: movimento.tipo === "credito" ? "receita" : "despesa",
      categoria: "outros",
      descricao: movimento.descricao,
      valor: movimento.valor,
      data_competencia: movimento.data,
      data_vencimento: movimento.data,
      data_pagamento: movimento.data,
      status: "pago",
      conta_financeira_id: movimento.conta_financeira_id,
      numero_documento: movimento.documento || "",
      conciliado: true,
      centro_custo: "outros",
    });
    const movimentoAtualizado = await base44.entities.MovimentoExtrato.update(movimento.id, {
      status_conciliacao: "conciliado",
      lancamento_id: novo.id,
      score_match: 100,
      justificativa_match: "Lançamento criado a partir do extrato",
    });
    setMovimentos((lista) => lista.map((m) => m.id === movimento.id ? movimentoAtualizado : m));
    onLancamentosCriados([novo]);
  };

  const concluirRateio = async (movimento, linhas) => {
    const novosLancamentos = [];
    for (const linha of linhas) {
      const centro = centros.find((item) => item.id === linha.centro_custo_id);
      const novo = await base44.entities.Lancamento.create({
        tipo: movimento.tipo === "credito" ? "receita" : "despesa",
        categoria: "outros",
        descricao: linha.descricao || `${movimento.descricao} — ${centro?.nome || "Rateio"}`,
        valor: Number(linha.valor),
        data_competencia: movimento.data,
        data_vencimento: movimento.data,
        data_pagamento: movimento.data,
        status: "pago",
        conta_financeira_id: movimento.conta_financeira_id,
        centro_custo_id: centro?.id || "",
        projeto_id: centro?.projeto_id || "",
        numero_documento: movimento.documento || "",
        conciliado: true,
      });
      novosLancamentos.push(novo);
      await base44.entities.RateioConciliacao.create({
        movimento_extrato_id: movimento.id,
        lancamento_id: novo.id,
        centro_custo_id: centro?.id || "",
        projeto_id: centro?.projeto_id || "",
        valor: Number(linha.valor),
        percentual: Number(((Number(linha.valor) / Number(movimento.valor)) * 100).toFixed(4)),
        descricao: linha.descricao || "",
      });
    }
    const movimentoAtualizado = await base44.entities.MovimentoExtrato.update(movimento.id, {
      status_conciliacao: "conciliado",
      lancamento_id: "",
      score_match: 100,
      justificativa_match: `Rateado em ${linhas.length} centros/subcentros`,
    });
    setMovimentos((lista) => lista.map((m) => m.id === movimento.id ? movimentoAtualizado : m));
    onLancamentosCriados(novosLancamentos);
    setRateando(null);
  };

  const ignorar = async (movimento) => {
    const atualizado = await base44.entities.MovimentoExtrato.update(movimento.id, { status_conciliacao: "ignorado" });
    setMovimentos((lista) => lista.map((m) => m.id === atualizado.id ? atualizado : m));
  };

  const pendentes = movimentos.filter((m) => ["pendente", "sugerido"].includes(m.status_conciliacao));
  const conciliados = movimentos.filter((m) => m.status_conciliacao === "conciliado");
  const sugestoes = pendentes.filter((m) => m.status_conciliacao === "sugerido");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Conciliação bancária</h2>
        <p className="text-sm text-slate-500">Importe o extrato em PDF, revise as sugestões e confirme os vínculos.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              <UploadCloud size={21} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">Importar extrato PDF</h3>
              <p className="mt-1 text-xs text-slate-500">O arquivo é armazenado de forma privada e usado apenas para extrair os movimentos.</p>
            </div>
            <FileLock2 size={18} className="text-emerald-400" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <select value={contaId} onChange={(e) => setContaId(e.target.value)} className={campoClass}>
              <option value="">Selecione a conta do extrato...</option>
              {contas.filter((c) => c.ativa !== false).map((conta) => (
                <option key={conta.id} value={conta.id}>{conta.nome}</option>
              ))}
            </select>
            <button onClick={() => inputRef.current?.click()} disabled={!canEdit || processando}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-50">
              {processando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {processando ? "Lendo extrato..." : "Selecionar PDF"}
            </button>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={processarExtrato} />
          </div>

          {erro && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <AlertCircle size={14} /> {erro}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
              <Landmark size={21} />
            </div>
            <div>
              <h3 className="font-semibold text-white">Santander / Open Finance</h3>
              <p className="text-xs text-slate-500">Integração automática contínua</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            O catálogo atual do Base44 não possui conector Santander nativo. A conexão é possível por API do banco ou provedor Open Finance.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs text-slate-400">
            <ShieldCheck size={14} className="text-amber-400" /> Aguardando definição do provedor e credenciais empresariais.
          </div>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Pendentes</p>
          <p className="mt-2 text-2xl font-bold text-white">{pendentes.length}</p>
        </div>
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Sugestões automáticas</p>
          <p className="mt-2 text-2xl font-bold text-blue-400">{sugestoes.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Conciliados</p>
          <p className="mt-2 text-2xl font-bold text-emerald-400">{conciliados.length}</p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h3 className="font-semibold text-white">Movimentos para revisar</h3>
            <p className="text-xs text-slate-500">O rateio permite dividir uma entrada única entre vários centros e subcentros.</p>
          </div>
          <button onClick={carregarHistorico} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white">
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>

        {pendentes.length ? pendentes.map((movimento) => {
          const lancamento = lancamentos.find((l) => l.id === movimento.lancamento_id);
          return (
            <div key={movimento.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  movimento.tipo === "credito" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                }`}>
                  {movimento.tipo === "credito" ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{movimento.descricao}</p>
                  <p className="mt-1 text-xs text-slate-500">{format(parseISO(movimento.data), "dd/MM/yyyy")} {movimento.documento && `• ${movimento.documento}`}</p>
                </div>
                <p className={`font-bold ${movimento.tipo === "credito" ? "text-emerald-400" : "text-red-400"}`}>{moeda(movimento.valor)}</p>
              </div>

              {lancamento && (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                  <Sparkles size={15} className="text-blue-400" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-blue-200">Sugestão: {lancamento.descricao}</p>
                    <p className="text-[11px] text-slate-500">{movimento.justificativa_match} • Confiança {movimento.score_match}%</p>
                  </div>
                  {canEdit && (
                    <button onClick={() => confirmarSugestao(movimento)}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-400">
                      <Link2 size={13} /> Conciliar
                    </button>
                  )}
                </div>
              )}

              {canEdit && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
                  {!lancamento && (
                    <button onClick={() => criarLancamento(movimento)}
                      className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20">
                      <Plus size={13} /> Criar lançamento
                    </button>
                  )}
                  <button onClick={() => setRateando(movimento)}
                    className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500/20">
                    <Split size={13} /> Ratear entre centros
                  </button>
                  <button onClick={() => ignorar(movimento)}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white">
                    Ignorar
                  </button>
                </div>
              )}
            </div>
          );
        }) : (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
            <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-400" />
            <p className="text-sm text-emerald-200">Nenhum movimento pendente de revisão.</p>
          </div>
        )}
      </section>

      {importacoes.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="font-semibold text-white">Histórico de importações</h3>
          <div className="mt-4 space-y-2">
            {importacoes.slice(0, 6).map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl bg-slate-800/60 px-4 py-3">
                <FileLock2 size={15} className="text-slate-500" />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-300">{item.nome_arquivo}</span>
                <span className="text-xs text-slate-500">{item.total_movimentos || 0} movimentos</span>
                <span className={`rounded-lg px-2 py-1 text-[11px] ${
                  item.status === "erro" ? "bg-red-500/10 text-red-400" : item.status === "processando" ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"
                }`}>{item.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {rateando && (
        <RateioModal movimento={rateando} centros={centros} contaId={rateando.conta_financeira_id}
          onConcluir={concluirRateio} onFechar={() => setRateando(null)} />
      )}
    </div>
  );
}
