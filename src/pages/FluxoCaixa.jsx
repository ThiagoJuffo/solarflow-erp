import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  addMonths, addWeeks, addYears, endOfMonth, format, isPast, isToday, parseISO, startOfMonth
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Bot, CalendarDays,
  CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign,
  Download, Edit3, FileBarChart, Filter, GitCompareArrows, Landmark,
  Layers3, Plus, ReceiptText, Search, TrendingDown, TrendingUp, WalletCards, X
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import LancamentoModal from "../components/financeiro/LancamentoModal";
import ContaFinanceiraModal from "../components/financeiro/ContaFinanceiraModal";
import CentrosCusto from "../components/financeiro/CentrosCusto";
import ConciliacaoBancaria from "../components/financeiro/ConciliacaoBancaria";
import BaixaFinanceiraModal from "../components/financeiro/BaixaFinanceiraModal";
import AssistenteComercial from "../components/financeiro/AssistenteComercial";
import DreProjeto from "../components/financeiro/DreProjeto";

const ABAS = [
  { id: "visao-geral", label: "Visão geral", icon: BarChart3 },
  { id: "lancamentos", label: "Lançamentos", icon: ReceiptText },
  { id: "contas", label: "Contas", icon: Landmark },
  { id: "centros", label: "Centros de custo", icon: Layers3 },
  { id: "conciliacao", label: "Conciliação", icon: GitCompareArrows },
  { id: "dre-projeto", label: "DRE por projeto", icon: WalletCards },
  { id: "assistente", label: "Assistente IA", icon: Bot },
  { id: "relatorios", label: "Relatórios", icon: FileBarChart },
];

const CATEGORIA_LABELS = {
  venda_projeto: "Venda de projeto",
  comissao: "Comissão",
  kit_equipamentos: "Kit / Equipamentos",
  mao_de_obra: "Mão de obra",
  despesa_operacional: "Operacional",
  despesa_marketing: "Marketing",
  despesa_financeira: "Financeira",
  imposto: "Impostos",
  pro_labore: "Pró-labore",
  distribuicao_lucro: "Distribuição de lucro",
  capex: "CAPEX",
  outros: "Outros",
};

const STATUS_CONFIG = {
  pendente: { label: "Pendente", classes: "border-amber-400/20 bg-amber-400/10 text-amber-300" },
  parcial: { label: "Parcial", classes: "border-blue-400/20 bg-blue-400/10 text-blue-300" },
  pago: { label: "Liquidado", classes: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" },
  atrasado: { label: "Atrasado", classes: "border-red-400/20 bg-red-400/10 text-red-300" },
  cancelado: { label: "Cancelado", classes: "border-slate-600 bg-slate-800 text-slate-400" },
};

const CORES_GRAFICO = ["#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6", "#10b981", "#ec4899", "#64748b"];

const moeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusCalculado = (lancamento) => {
  if (
    lancamento.status === "pendente" &&
    lancamento.data_vencimento &&
    isPast(parseISO(lancamento.data_vencimento)) &&
    !isToday(parseISO(lancamento.data_vencimento))
  ) return "atrasado";
  return lancamento.status || "pendente";
};

const dentroDoMes = (data, mes) => {
  if (!data) return false;
  const parsed = parseISO(data);
  return parsed >= startOfMonth(mes) && parsed <= endOfMonth(mes);
};

const CardIndicador = ({ titulo, valor, detalhe, icon: Icon, cor = "amber" }) => {
  const estilos = {
    amber: "border-amber-500/20 bg-amber-500/5 text-amber-400",
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
    red: "border-red-500/20 bg-red-500/5 text-red-400",
    blue: "border-blue-500/20 bg-blue-500/5 text-blue-400",
  };
  return (
    <div className={`rounded-2xl border p-5 ${estilos[cor]}`}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{titulo}</p>
          <p className="mt-2 text-2xl font-bold text-white">{valor}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${estilos[cor]}`}>
          <Icon size={19} />
        </div>
      </div>
      <p className="text-xs text-slate-500">{detalhe}</p>
    </div>
  );
};

export default function FluxoCaixa() {
  const [lancamentos, setLancamentos] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [contas, setContas] = useState([]);
  const [centros, setCentros] = useState([]);
  const [custosProjeto, setCustosProjeto] = useState([]);
  const [preProjetos, setPreProjetos] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState("visao-geral");
  const [mesAtual, setMesAtual] = useState(new Date());
  const [modalLancamento, setModalLancamento] = useState(false);
  const [modalConta, setModalConta] = useState(false);
  const [lancamentoBaixa, setLancamentoBaixa] = useState(null);
  const [editandoLancamento, setEditandoLancamento] = useState(null);
  const [editandoConta, setEditandoConta] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  useEffect(() => {
    Promise.all([
      base44.entities.Lancamento.list("-data_vencimento", 500),
      base44.entities.Projeto.list("-created_date", 250),
      base44.entities.ContaFinanceira.list("-created_date", 100),
      base44.entities.CentroCusto.list("nome", 5000),
      base44.entities.CustoProjeto.list("-data", 1000),
      base44.entities.PreProjeto.list("-created_date", 500),
      base44.auth.me(),
    ]).then(([listaLancamentos, listaProjetos, listaContas, listaCentros, listaCustos, listaPreProjetos, usuario]) => {
      setLancamentos(listaLancamentos);
      setProjetos(listaProjetos);
      setContas(listaContas);
      setCentros(listaCentros);
      setCustosProjeto(listaCustos);
      setPreProjetos(listaPreProjetos);
      setUser(usuario);
    }).finally(() => setLoading(false));
  }, []);

  const canEdit = user?.role === "admin" || user?.role === "financeiro";
  const ativos = useMemo(
    () => lancamentos.map((item) => ({ ...item, status_calculado: statusCalculado(item) }))
      .filter((item) => item.status_calculado !== "cancelado"),
    [lancamentos]
  );
  const lancamentosMes = useMemo(
    () => ativos.filter((item) => dentroDoMes(item.data_vencimento, mesAtual)),
    [ativos, mesAtual]
  );

  const resumo = useMemo(() => {
    const receitasPrevistas = lancamentosMes.filter((l) => l.tipo === "receita")
      .reduce((total, l) => total + Number(l.valor || 0), 0);
    const despesasPrevistas = lancamentosMes.filter((l) => l.tipo === "despesa")
      .reduce((total, l) => total + Number(l.valor || 0), 0);
    const valorRealizado = (l) => Number(l.valor_pago || (l.status_calculado === "pago" ? l.valor : 0));
    const receitasRealizadas = lancamentosMes.filter((l) => l.tipo === "receita")
      .reduce((total, l) => total + valorRealizado(l), 0);
    const despesasRealizadas = lancamentosMes.filter((l) => l.tipo === "despesa")
      .reduce((total, l) => total + valorRealizado(l), 0);
    const atrasados = ativos.filter((l) => l.status_calculado === "atrasado");
    return {
      receitasPrevistas,
      despesasPrevistas,
      receitasRealizadas,
      despesasRealizadas,
      saldoPrevisto: receitasPrevistas - despesasPrevistas,
      saldoRealizado: receitasRealizadas - despesasRealizadas,
      atrasados,
      valorAtrasado: atrasados.reduce((total, l) => total + Number(l.valor || 0), 0),
    };
  }, [ativos, lancamentosMes]);

  const dadosMensais = useMemo(() =>
    Array.from({ length: 6 }, (_, indice) => addMonths(mesAtual, indice - 2)).map((mes) => {
      const itens = ativos.filter((item) => dentroDoMes(item.data_vencimento, mes));
      return {
        mes: format(mes, "MMM/yy", { locale: ptBR }),
        receitas: itens.filter((i) => i.tipo === "receita").reduce((s, i) => s + Number(i.valor || 0), 0),
        despesas: itens.filter((i) => i.tipo === "despesa").reduce((s, i) => s + Number(i.valor || 0), 0),
      };
    }), [ativos, mesAtual]);

  const despesasPorCategoria = useMemo(() => {
    const mapa = {};
    lancamentosMes.filter((l) => l.tipo === "despesa").forEach((l) => {
      mapa[l.categoria || "outros"] = (mapa[l.categoria || "outros"] || 0) + Number(l.valor || 0);
    });
    return Object.entries(mapa).map(([categoria, valor]) => ({
      name: CATEGORIA_LABELS[categoria] || categoria,
      value: valor,
    })).sort((a, b) => b.value - a.value);
  }, [lancamentosMes]);

  const contasComSaldo = useMemo(() => contas.map((conta) => {
    const movimentos = ativos.filter((l) =>
      l.conta_financeira_id === conta.id && ["pago", "parcial"].includes(l.status_calculado)
    );
    const saldoMovimentos = movimentos.reduce((total, l) => {
      const realizado = Number(l.valor_pago || (l.status_calculado === "pago" ? l.valor : 0));
      return total + (l.tipo === "receita" ? realizado : -realizado);
    }, 0);
    return { ...conta, saldo_atual: Number(conta.saldo_inicial || 0) + saldoMovimentos };
  }), [ativos, contas]);

  const filtrados = useMemo(() => lancamentosMes.filter((l) => {
    const termo = busca.toLowerCase();
    const correspondeBusca = !termo || [
      l.descricao, l.nome_cliente_fornecedor, l.numero_documento,
      CATEGORIA_LABELS[l.categoria]
    ].some((valor) => String(valor || "").toLowerCase().includes(termo));
    const correspondeTipo = filtroTipo === "todos" || l.tipo === filtroTipo;
    const correspondeStatus = filtroStatus === "todos" || l.status_calculado === filtroStatus;
    return correspondeBusca && correspondeTipo && correspondeStatus;
  }).sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento)),
  [lancamentosMes, busca, filtroTipo, filtroStatus]);

  const navMes = (delta) => setMesAtual((atual) => addMonths(atual, delta));

  const salvarLancamento = async (dados) => {
    if (editandoLancamento) {
      const atualizado = await base44.entities.Lancamento.update(editandoLancamento.id, dados);
      setLancamentos((lista) => lista.map((l) => l.id === atualizado.id ? atualizado : l));
    } else {
      const totalParcelas = Math.max(Number(dados.total_parcelas || 1), 1);
      const repeticoes = dados.recorrente
        ? Math.max(Number(dados.quantidade_recorrencias || 1), 1)
        : totalParcelas;
      const valorBase = Number(dados.valor || 0);
      const valorParcela = totalParcelas > 1 ? Math.floor((valorBase / totalParcelas) * 100) / 100 : valorBase;
      const inicio = parseISO(dados.data_vencimento);
      const avancar = (data, indice) => {
        if (!dados.recorrente || dados.frequencia_recorrencia === "mensal") return addMonths(data, indice);
        if (dados.frequencia_recorrencia === "semanal") return addWeeks(data, indice);
        if (dados.frequencia_recorrencia === "trimestral") return addMonths(data, indice * 3);
        return addYears(data, indice);
      };
      let saldoLiquidado = Number(dados.valor_pago || 0);
      const registros = Array.from({ length: repeticoes }, (_, indice) => {
        const valorRegistro = totalParcelas > 1 && indice === totalParcelas - 1
          ? Math.round((valorBase - valorParcela * (totalParcelas - 1)) * 100) / 100
          : valorParcela;
        const valorPagoRegistro = Math.min(saldoLiquidado, valorRegistro);
        saldoLiquidado = Math.max(saldoLiquidado - valorPagoRegistro, 0);
        const possuiLiquidacao = dados.status === "pago" || dados.status === "parcial";
        const statusRegistro = possuiLiquidacao
          ? valorPagoRegistro >= valorRegistro - 0.01
            ? "pago"
            : valorPagoRegistro > 0
              ? "parcial"
              : "pendente"
          : dados.status;
        return {
          ...dados,
          descricao: repeticoes > 1 ? `${dados.descricao} (${indice + 1}/${repeticoes})` : dados.descricao,
          valor: valorRegistro,
          data_vencimento: format(avancar(inicio, indice), "yyyy-MM-dd"),
          parcela_atual: totalParcelas > 1 ? indice + 1 : 1,
          total_parcelas: totalParcelas,
          status: statusRegistro,
          valor_pago: valorPagoRegistro,
          data_pagamento: valorPagoRegistro > 0 ? dados.data_pagamento : "",
          conciliado: valorPagoRegistro > 0 ? Boolean(dados.conciliado) : false,
        };
      });
      const novos = [];
      for (const registro of registros) novos.push(await base44.entities.Lancamento.create(registro));
      setLancamentos((lista) => [...novos, ...lista]);
    }
    setModalLancamento(false);
    setEditandoLancamento(null);
  };

  const salvarConta = async (dados) => {
    if (editandoConta) {
      const atualizada = await base44.entities.ContaFinanceira.update(editandoConta.id, dados);
      setContas((lista) => lista.map((c) => c.id === atualizada.id ? atualizada : c));
    } else {
      const nova = await base44.entities.ContaFinanceira.create(dados);
      setContas((lista) => [nova, ...lista]);
    }
    setModalConta(false);
    setEditandoConta(null);
  };

  const salvarCentro = async (dados, centroEditando) => {
    if (centroEditando) {
      const atualizado = await base44.entities.CentroCusto.update(centroEditando.id, dados);
      setCentros((lista) => lista.map((c) => c.id === atualizado.id ? atualizado : c));
    } else {
      const novo = await base44.entities.CentroCusto.create(dados);
      setCentros((lista) => [novo, ...lista]);
    }
  };

  const alternarCentro = async (centro) => {
    const atualizado = await base44.entities.CentroCusto.update(centro.id, { ativo: centro.ativo === false });
    setCentros((lista) => lista.map((c) => c.id === atualizado.id ? atualizado : c));
  };

  const registrarLancamentoAtualizado = (atualizado) =>
    setLancamentos((lista) => lista.map((l) => l.id === atualizado.id ? atualizado : l));

  const registrarLancamentosCriados = (novos) =>
    setLancamentos((lista) => [...novos, ...lista]);

  const baixarLancamento = (lancamento) => setLancamentoBaixa(lancamento);

  const salvarBaixa = async (dados) => {
    const baixa = await base44.entities.BaixaFinanceira.create({
      lancamento_id: lancamentoBaixa.id,
      conta_financeira_id: dados.conta_financeira_id || "",
      valor: Number(dados.valor),
      data: dados.data,
      forma_pagamento: dados.forma_pagamento || undefined,
      comprovante_uri: dados.comprovante_uri || "",
      observacoes: dados.observacoes || "",
    });
    const valorPago = Math.min(
      Number(lancamentoBaixa.valor || 0),
      Number(lancamentoBaixa.valor_pago || 0) + Number(baixa.valor || 0)
    );
    const liquidado = valorPago >= Number(lancamentoBaixa.valor || 0) - 0.01;
    const anexos = [...(lancamentoBaixa.anexos || [])];
    if (dados.comprovante_uri) anexos.push({
      nome: dados.comprovante_nome || "Comprovante",
      tipo: "comprovante",
      file_uri: dados.comprovante_uri,
      data_upload: new Date().toISOString(),
    });
    const atualizado = await base44.entities.Lancamento.update(lancamentoBaixa.id, {
      valor_pago: valorPago,
      status: liquidado ? "pago" : "parcial",
      data_pagamento: liquidado ? dados.data : "",
      conta_financeira_id: dados.conta_financeira_id || lancamentoBaixa.conta_financeira_id || "",
      forma_pagamento: dados.forma_pagamento || lancamentoBaixa.forma_pagamento || undefined,
      anexos,
    });
    setLancamentos((lista) => lista.map((l) => l.id === atualizado.id ? atualizado : l));
    setLancamentoBaixa(null);
  };

  const excluirLancamento = async (lancamento) => {
    if (!window.confirm(`Remover o lançamento "${lancamento.descricao}"?`)) return;
    await base44.entities.Lancamento.delete(lancamento.id);
    setLancamentos((lista) => lista.filter((l) => l.id !== lancamento.id));
  };

  const alternarConta = async (conta) => {
    const atualizada = await base44.entities.ContaFinanceira.update(conta.id, { ativa: conta.ativa === false });
    setContas((lista) => lista.map((c) => c.id === atualizada.id ? atualizada : c));
  };

  const exportarCsv = () => {
    const colunas = ["Tipo", "Descrição", "Categoria", "Cliente/Fornecedor", "Vencimento", "Liquidação", "Status", "Valor"];
    const linhas = filtrados.map((l) => [
      l.tipo, l.descricao, CATEGORIA_LABELS[l.categoria] || l.categoria,
      l.nome_cliente_fornecedor || "", l.data_vencimento || "", l.data_pagamento || "",
      l.status_calculado, Number(l.valor || 0).toFixed(2).replace(".", ",")
    ]);
    const csv = [colunas, ...linhas].map((linha) =>
      linha.map((campo) => `"${String(campo).replaceAll('"', '""')}"`).join(";")
    ).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `financeiro-${format(mesAtual, "yyyy-MM")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderLancamento = (lancamento, compacto = false) => {
    const status = STATUS_CONFIG[lancamento.status_calculado] || STATUS_CONFIG.pendente;
    const projeto = projetos.find((p) => p.id === lancamento.projeto_id);
    return (
      <div key={lancamento.id}
        className={`flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 transition-colors hover:border-slate-700 ${compacto ? "px-4 py-3" : "px-5 py-4"}`}>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          lancamento.tipo === "receita" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
        }`}>
          {lancamento.tipo === "receita" ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-white">{lancamento.descricao}</p>
            <span className={`rounded-lg border px-2 py-0.5 text-[11px] ${status.classes}`}>
              {lancamento.status_calculado === "pago" && lancamento.tipo === "receita" ? "Recebido" : status.label}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>{CATEGORIA_LABELS[lancamento.categoria] || "Sem categoria"}</span>
            {projeto && <span className="text-amber-400/70">{projeto.nome_cliente}</span>}
            {lancamento.nome_cliente_fornecedor && <span>{lancamento.nome_cliente_fornecedor}</span>}
            <span className="flex items-center gap-1"><CalendarDays size={11} /> {format(parseISO(lancamento.data_vencimento), "dd/MM/yyyy")}</span>
            {Number(lancamento.total_parcelas || 1) > 1 && (
              <span>{lancamento.parcela_atual || 1}/{lancamento.total_parcelas}</span>
            )}
            {Number(lancamento.valor_pago || 0) > 0 && lancamento.status_calculado !== "pago" && (
              <span className="text-blue-400">Baixado {moeda(lancamento.valor_pago)}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-bold ${lancamento.tipo === "receita" ? "text-emerald-400" : "text-red-400"}`}>
            {lancamento.tipo === "receita" ? "+" : "−"} {moeda(lancamento.valor)}
          </p>
          {lancamento.forma_pagamento && <p className="mt-0.5 text-[11px] capitalize text-slate-600">{lancamento.forma_pagamento.replaceAll("_", " ")}</p>}
        </div>
        {canEdit && !compacto && (
          <div className="flex shrink-0 gap-1">
            {lancamento.status_calculado !== "pago" && (
              <button onClick={() => baixarLancamento(lancamento)} title="Dar baixa"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400 transition-colors hover:bg-emerald-500/20 hover:text-emerald-400">
                <CheckCircle2 size={14} />
              </button>
            )}
            <button onClick={() => { setEditandoLancamento(lancamento); setModalLancamento(true); }} title="Editar"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400 transition-colors hover:bg-amber-500/20 hover:text-amber-400">
              <Edit3 size={14} />
            </button>
            <button onClick={() => excluirLancamento(lancamento)} title="Remover"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400 transition-colors hover:bg-red-500/20 hover:text-red-400">
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-5 p-6 md:p-8">
        <div className="h-20 animate-pulse rounded-2xl bg-slate-900" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-900" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
            <CircleDollarSign size={15} /> Gestão financeira
          </div>
          <h1 className="text-2xl font-bold text-white md:text-3xl">Financeiro</h1>
          <p className="mt-1 text-sm text-slate-400">Caixa, contas a pagar e receber em um só lugar.</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditandoLancamento(null); setModalLancamento(true); }}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-400">
            <Plus size={16} /> Novo lançamento
          </button>
        )}
      </header>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 p-1.5">
        <div className="flex min-w-max gap-1">
          {ABAS.map((item) => (
            <button key={item.id} onClick={() => setAba(item.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                aba === item.id ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}>
              <item.icon size={15} /> {item.label}
            </button>
          ))}
        </div>
      </div>

      {aba === "visao-geral" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navMes(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:text-white">
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[165px] text-center font-semibold capitalize text-white">
              {format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>
            <button onClick={() => navMes(1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:text-white">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <CardIndicador titulo="Receitas previstas" valor={moeda(resumo.receitasPrevistas)}
              detalhe={`${moeda(resumo.receitasRealizadas)} já recebidos`} icon={TrendingUp} cor="emerald" />
            <CardIndicador titulo="Despesas previstas" valor={moeda(resumo.despesasPrevistas)}
              detalhe={`${moeda(resumo.despesasRealizadas)} já pagos`} icon={TrendingDown} cor="red" />
            <CardIndicador titulo="Saldo previsto" valor={moeda(resumo.saldoPrevisto)}
              detalhe={`Saldo realizado: ${moeda(resumo.saldoRealizado)}`} icon={WalletCards} cor={resumo.saldoPrevisto >= 0 ? "amber" : "red"} />
            <CardIndicador titulo="Em atraso" valor={moeda(resumo.valorAtrasado)}
              detalhe={`${resumo.atrasados.length} lançamento(s) vencido(s)`} icon={AlertTriangle} cor={resumo.atrasados.length ? "red" : "blue"} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-5">
                <h2 className="font-semibold text-white">Evolução do caixa</h2>
                <p className="text-xs text-slate-500">Receitas e despesas previstas por mês</p>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosMensais} barGap={6}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mes" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip cursor={{ fill: "#1e293b66" }} contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 12 }}
                      formatter={(value) => moeda(value)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar name="Receitas" dataKey="receitas" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar name="Despesas" dataKey="despesas" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="font-semibold text-white">Despesas por categoria</h2>
              <p className="text-xs text-slate-500">Composição do mês selecionado</p>
              {despesasPorCategoria.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={despesasPorCategoria} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                        {despesasPorCategoria.map((_, index) => <Cell key={index} fill={CORES_GRAFICO[index % CORES_GRAFICO.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 12 }}
                        formatter={(value) => moeda(value)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-72 items-center justify-center text-sm text-slate-500">Sem despesas neste mês</div>
              )}
            </section>
          </div>

          <section className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="font-semibold text-white">Prioridades</h2>
                <p className="text-xs text-slate-500">Lançamentos vencidos que exigem atenção</p>
              </div>
              <button onClick={() => { setAba("lancamentos"); setFiltroStatus("atrasado"); }}
                className="text-xs font-medium text-amber-400 hover:text-amber-300">Ver todos</button>
            </div>
            {resumo.atrasados.length ? resumo.atrasados.slice(0, 5).map((l) => renderLancamento(l, true)) : (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <CheckCircle2 className="text-emerald-400" size={20} />
                <p className="text-sm text-emerald-200">Nenhum lançamento em atraso.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {aba === "lancamentos" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => navMes(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:text-white">
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-[155px] text-center text-sm font-semibold capitalize text-white">
                {format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}
              </span>
              <button onClick={() => navMes(1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:text-white">
                <ChevronRight size={16} />
              </button>
            </div>
            <button onClick={exportarCsv} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white">
              <Download size={14} /> Exportar CSV
            </button>
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 lg:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar descrição, documento ou cliente..."
                className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-amber-500" />
            </div>
            <div className="flex flex-wrap gap-1">
              {["todos", "receita", "despesa"].map((tipo) => (
                <button key={tipo} onClick={() => setFiltroTipo(tipo)}
                  className={`rounded-lg px-3 py-2 text-xs font-medium ${
                    filtroTipo === tipo ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}>
                  {tipo === "todos" ? "Todos" : tipo === "receita" ? "A receber" : "A pagar"}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {["todos", "pendente", "parcial", "pago", "atrasado"].map((status) => (
                <button key={status} onClick={() => setFiltroStatus(status)}
                  className={`rounded-lg px-3 py-2 text-xs font-medium ${
                    filtroStatus === status ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}>
                  {status === "todos" ? "Todos status" : STATUS_CONFIG[status].label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Filter size={13} /> {filtrados.length} lançamento(s) • Resultado previsto: {moeda(resumo.saldoPrevisto)}
          </div>

          <div className="space-y-2">
            {filtrados.length ? filtrados.map((l) => renderLancamento(l)) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center">
                <ReceiptText size={32} className="mx-auto mb-3 text-slate-700" />
                <p className="text-sm text-slate-400">Nenhum lançamento encontrado.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {aba === "contas" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Contas financeiras</h2>
              <p className="text-sm text-slate-500">Bancos, investimentos e caixa físico.</p>
            </div>
            {canEdit && (
              <button onClick={() => { setEditandoConta(null); setModalConta(true); }}
                className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-400">
                <Plus size={16} /> Nova conta
              </button>
            )}
          </div>

          {contasComSaldo.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {contasComSaldo.map((conta) => (
                <div key={conta.id} className={`rounded-2xl border bg-slate-900 p-5 ${conta.ativa === false ? "border-slate-800 opacity-60" : "border-slate-700"}`}>
                  <div className="mb-6 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${conta.cor || "#f59e0b"}22` }}>
                        <Landmark size={20} style={{ color: conta.cor || "#f59e0b" }} />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{conta.nome}</p>
                        <p className="text-xs capitalize text-slate-500">{String(conta.tipo || "").replaceAll("_", " ")}</p>
                      </div>
                    </div>
                    <span className={`rounded-lg px-2 py-1 text-[11px] ${conta.ativa === false ? "bg-slate-800 text-slate-500" : "bg-emerald-500/10 text-emerald-400"}`}>
                      {conta.ativa === false ? "Inativa" : "Ativa"}
                    </span>
                  </div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Saldo atual</p>
                  <p className={`mt-1 text-2xl font-bold ${conta.saldo_atual >= 0 ? "text-white" : "text-red-400"}`}>{moeda(conta.saldo_atual)}</p>
                  {(conta.banco || conta.numero_conta) && (
                    <p className="mt-3 text-xs text-slate-500">{[conta.banco, conta.agencia && `Ag. ${conta.agencia}`, conta.numero_conta && `Cc. ${conta.numero_conta}`].filter(Boolean).join(" • ")}</p>
                  )}
                  {canEdit && (
                    <div className="mt-5 flex gap-2 border-t border-slate-800 pt-4">
                      <button onClick={() => { setEditandoConta(conta); setModalConta(true); }}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-800 py-2 text-xs font-medium text-slate-300 hover:text-white">
                        <Edit3 size={13} /> Editar
                      </button>
                      <button onClick={() => alternarConta(conta)}
                        className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white">
                        {conta.ativa === false ? "Ativar" : "Inativar"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-12 text-center">
              <Landmark size={34} className="mx-auto mb-3 text-slate-700" />
              <p className="font-medium text-white">Nenhuma conta cadastrada</p>
              <p className="mt-1 text-sm text-slate-500">Cadastre o banco ou caixa utilizado pela empresa.</p>
            </div>
          )}
        </div>
      )}

      {aba === "centros" && (
        <CentrosCusto
          centros={centros}
          projetos={projetos}
          lancamentos={lancamentos}
          canEdit={canEdit}
          onSalvar={salvarCentro}
          onAlternar={alternarCentro}
        />
      )}

      {aba === "conciliacao" && (
        <ConciliacaoBancaria
          contas={contas}
          centros={centros}
          lancamentos={lancamentos}
          canEdit={canEdit}
          onLancamentoAtualizado={registrarLancamentoAtualizado}
          onLancamentosCriados={registrarLancamentosCriados}
        />
      )}

      {aba === "dre-projeto" && (
        <DreProjeto
          projetos={projetos}
          lancamentos={lancamentos}
          custos={custosProjeto}
          preProjetos={preProjetos}
        />
      )}

      {aba === "assistente" && (
        <AssistenteComercial
          canEdit={canEdit}
          user={user}
          onLancamentoCriado={(novo) => setLancamentos((lista) => [novo, ...lista])}
        />
      )}

      {aba === "relatorios" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Relatórios financeiros</h2>
              <p className="text-sm text-slate-500">Análise consolidada e exportação para conferência.</p>
            </div>
            <button onClick={exportarCsv}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-400">
              <Download size={15} /> Exportar mês
            </button>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="font-semibold text-white">Resultado mensal</h3>
              <p className="text-xs text-slate-500">Comparativo dos últimos meses e projeção</p>
              <div className="mt-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosMensais}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mes" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 12 }}
                      formatter={(value) => moeda(value)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar name="Receitas" dataKey="receitas" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar name="Despesas" dataKey="despesas" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="font-semibold text-white">Resumo de {format(mesAtual, "MMMM", { locale: ptBR })}</h3>
              <div className="mt-5 space-y-3">
                {[
                  ["Receita prevista", resumo.receitasPrevistas, "text-emerald-400"],
                  ["Receita realizada", resumo.receitasRealizadas, "text-emerald-300"],
                  ["Despesa prevista", resumo.despesasPrevistas, "text-red-400"],
                  ["Despesa realizada", resumo.despesasRealizadas, "text-red-300"],
                  ["Resultado previsto", resumo.saldoPrevisto, resumo.saldoPrevisto >= 0 ? "text-amber-400" : "text-red-400"],
                  ["Resultado realizado", resumo.saldoRealizado, resumo.saldoRealizado >= 0 ? "text-white" : "text-red-400"],
                ].map(([label, value, color]) => (
                  <div key={label} className="flex items-center justify-between rounded-xl bg-slate-800/70 px-4 py-3">
                    <span className="text-sm text-slate-400">{label}</span>
                    <span className={`text-sm font-semibold ${color}`}>{moeda(value)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="font-semibold text-white">Ranking de despesas</h3>
            <p className="text-xs text-slate-500">Categorias com maior impacto no período</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {despesasPorCategoria.length ? despesasPorCategoria.map((item, index) => (
                <div key={item.name} className="flex items-center gap-3 rounded-xl bg-slate-800/60 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: CORES_GRAFICO[index % CORES_GRAFICO.length] }}>
                    {index + 1}
                  </div>
                  <span className="flex-1 text-sm text-slate-300">{item.name}</span>
                  <span className="text-sm font-semibold text-white">{moeda(item.value)}</span>
                </div>
              )) : <p className="text-sm text-slate-500">Sem despesas no período.</p>}
            </div>
          </section>
        </div>
      )}

      {modalLancamento && (
        <LancamentoModal
          lancamento={editandoLancamento}
          projetos={projetos}
          contas={contas}
          centros={centros}
          onSalvar={salvarLancamento}
          onFechar={() => { setModalLancamento(false); setEditandoLancamento(null); }}
        />
      )}
      {modalConta && (
        <ContaFinanceiraModal
          conta={editandoConta}
          onSalvar={salvarConta}
          onFechar={() => { setModalConta(false); setEditandoConta(null); }}
        />
      )}
      {lancamentoBaixa && (
        <BaixaFinanceiraModal
          lancamento={lancamentoBaixa}
          contas={contas}
          onSalvar={salvarBaixa}
          onFechar={() => setLancamentoBaixa(null)}
        />
      )}
    </div>
  );
}
