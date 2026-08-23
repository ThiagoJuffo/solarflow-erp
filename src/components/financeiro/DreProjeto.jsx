import { useMemo, useState } from "react";
import {
  ArrowDownRight, ArrowUpRight, Download, FileBarChart2,
  Search, Target, TrendingDown, TrendingUp
} from "lucide-react";

const CATEGORIAS = {
  venda_projeto: "Venda de projeto",
  comissao: "Comissão",
  kit_equipamentos: "Kit / Equipamentos",
  mao_de_obra: "Mão de obra",
  despesa_operacional: "Operacional",
  despesa_marketing: "Marketing",
  despesa_financeira: "Financeira",
  imposto: "Impostos e deduções",
  pro_labore: "Pró-labore",
  distribuicao_lucro: "Distribuição de lucro",
  capex: "CAPEX",
  frete: "Frete",
  comissao_vendedor: "Comissão de vendedor",
  art_taxas: "ART e taxas",
  materiais_extras: "Materiais extras",
  deslocamento: "Deslocamento",
  hospedagem: "Hospedagem",
  outros: "Outros",
};

const DIRETAS_LANCAMENTO = new Set(["kit_equipamentos", "mao_de_obra", "comissao"]);
const DIRETAS_CUSTO = new Set([
  "kit_equipamentos", "frete", "mao_de_obra", "comissao_vendedor",
  "art_taxas", "materiais_extras", "deslocamento", "hospedagem"
]);

const moeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const percentual = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";

const numeroFinanceiro = (valor) => {
  if (typeof valor === "number") return valor;
  const texto = String(valor || "").trim().replace(/[^0-9,.-]/g, "");
  if (!texto) return 0;
  const normalizado = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
  return Number(normalizado) || 0;
};

const realizadoDoLancamento = (item) =>
  Number(item.valor_pago || (item.status === "pago" ? item.valor : 0));

const dataNoPeriodo = (data, inicio, fim) => {
  if (!data) return !inicio && !fim;
  if (inicio && data < inicio) return false;
  if (fim && data > fim) return false;
  return true;
};

const somar = (lista, seletor) =>
  lista.reduce((total, item) => total + Number(seletor(item) || 0), 0);

function calcularDre(projeto, lancamentos, custos, preProjetos, inicio, fim) {
  const itens = lancamentos.filter((item) =>
    item.projeto_id === projeto.id &&
    item.status !== "cancelado" &&
    dataNoPeriodo(item.data_competencia || item.data_vencimento, inicio, fim)
  );
  const custosProjeto = custos.filter((item) =>
    item.projeto_id === projeto.id && dataNoPeriodo(item.data, inicio, fim)
  );
  const receitas = itens.filter((item) => item.tipo === "receita");
  const impostos = itens.filter((item) => item.tipo === "despesa" && item.categoria === "imposto");
  const diretos = itens.filter((item) => item.tipo === "despesa" && DIRETAS_LANCAMENTO.has(item.categoria));
  const operacionais = itens.filter((item) =>
    item.tipo === "despesa" &&
    item.categoria !== "imposto" &&
    !DIRETAS_LANCAMENTO.has(item.categoria)
  );
  const custosDiretos = custosProjeto.filter((item) => DIRETAS_CUSTO.has(item.categoria));
  const custosOperacionais = custosProjeto.filter((item) => !DIRETAS_CUSTO.has(item.categoria));

  const receitaPrevista = somar(receitas, (item) => item.valor);
  const receitaRealizada = somar(receitas, realizadoDoLancamento);
  const deducoesPrevistas = somar(impostos, (item) => item.valor);
  const deducoesRealizadas = somar(impostos, realizadoDoLancamento);
  const diretosCadastrados = somar(custosDiretos, (item) => item.valor);
  const operacionaisCadastrados = somar(custosOperacionais, (item) => item.valor);
  const custosDiretosPrevistos = somar(diretos, (item) => item.valor) + diretosCadastrados;
  const custosDiretosRealizados = somar(diretos, realizadoDoLancamento) + diretosCadastrados;
  const despesasOperacionaisPrevistas = somar(operacionais, (item) => item.valor) + operacionaisCadastrados;
  const despesasOperacionaisRealizadas = somar(operacionais, realizadoDoLancamento) + operacionaisCadastrados;

  const receitaLiquidaPrevista = receitaPrevista - deducoesPrevistas;
  const receitaLiquidaRealizada = receitaRealizada - deducoesRealizadas;
  const lucroBrutoPrevisto = receitaLiquidaPrevista - custosDiretosPrevistos;
  const lucroBrutoRealizado = receitaLiquidaRealizada - custosDiretosRealizados;
  const resultadoPrevisto = lucroBrutoPrevisto - despesasOperacionaisPrevistas;
  const resultadoRealizado = lucroBrutoRealizado - despesasOperacionaisRealizadas;
  const preProjeto = preProjetos.find((item) => item.id === projeto.pre_projeto_id);

  return {
    projeto,
    itens,
    custosProjeto,
    valorContrato: numeroFinanceiro(preProjeto?.valor_projeto),
    receitaPrevista,
    receitaRealizada,
    deducoesPrevistas,
    deducoesRealizadas,
    receitaLiquidaPrevista,
    receitaLiquidaRealizada,
    custosDiretosPrevistos,
    custosDiretosRealizados,
    lucroBrutoPrevisto,
    lucroBrutoRealizado,
    despesasOperacionaisPrevistas,
    despesasOperacionaisRealizadas,
    resultadoPrevisto,
    resultadoRealizado,
    margemPrevista: receitaPrevista ? (resultadoPrevisto / receitaPrevista) * 100 : 0,
    margemRealizada: receitaRealizada ? (resultadoRealizado / receitaRealizada) * 100 : 0,
  };
}

const LinhaDre = ({ label, previsto, realizado, destaque = false, recuo = false }) => (
  <tr className={destaque ? "border-t border-slate-700 bg-slate-800/60" : "border-t border-slate-800"}>
    <td className={`px-4 py-3 text-sm ${destaque ? "font-semibold text-white" : "text-slate-400"} ${recuo ? "pl-8" : ""}`}>
      {label}
    </td>
    <td className={`px-4 py-3 text-right text-sm ${destaque ? "font-semibold text-white" : "text-slate-300"}`}>
      {moeda(previsto)}
    </td>
    <td className={`px-4 py-3 text-right text-sm ${destaque ? "font-semibold text-white" : "text-slate-300"}`}>
      {moeda(realizado)}
    </td>
  </tr>
);

export default function DreProjeto({
  projetos = [], lancamentos = [], custos = [], preProjetos = []
}) {
  const [projetoSelecionado, setProjetoSelecionado] = useState("");
  const [busca, setBusca] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");

  const dres = useMemo(() =>
    projetos.map((projeto) => calcularDre(
      projeto, lancamentos, custos, preProjetos, inicio, fim
    )).sort((a, b) => b.resultadoRealizado - a.resultadoRealizado),
  [projetos, lancamentos, custos, preProjetos, inicio, fim]);

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return dres.filter((dre) =>
      !termo || [dre.projeto.nome_cliente, dre.projeto.uc_geradora, dre.projeto.status]
        .some((valor) => String(valor || "").toLowerCase().includes(termo))
    );
  }, [dres, busca]);

  const selecionado = dres.find((dre) => dre.projeto.id === projetoSelecionado);
  const consolidado = useMemo(() => filtrados.reduce((total, dre) => ({
    receitaPrevista: total.receitaPrevista + dre.receitaPrevista,
    receitaRealizada: total.receitaRealizada + dre.receitaRealizada,
    resultadoPrevisto: total.resultadoPrevisto + dre.resultadoPrevisto,
    resultadoRealizado: total.resultadoRealizado + dre.resultadoRealizado,
  }), { receitaPrevista: 0, receitaRealizada: 0, resultadoPrevisto: 0, resultadoRealizado: 0 }), [filtrados]);

  const margemConsolidada = consolidado.receitaRealizada
    ? (consolidado.resultadoRealizado / consolidado.receitaRealizada) * 100
    : 0;

  const exportar = () => {
    const lista = selecionado ? [selecionado] : filtrados;
    const cabecalho = [
      "Projeto", "Receita prevista", "Receita realizada", "Deduções previstas",
      "Deduções realizadas", "Custos diretos previstos", "Custos diretos realizados",
      "Despesas operacionais previstas", "Despesas operacionais realizadas",
      "Resultado previsto", "Resultado realizado", "Margem realizada"
    ];
    const linhas = lista.map((dre) => [
      dre.projeto.nome_cliente || "",
      dre.receitaPrevista, dre.receitaRealizada, dre.deducoesPrevistas, dre.deducoesRealizadas,
      dre.custosDiretosPrevistos, dre.custosDiretosRealizados,
      dre.despesasOperacionaisPrevistas, dre.despesasOperacionaisRealizadas,
      dre.resultadoPrevisto, dre.resultadoRealizado, dre.margemRealizada.toFixed(2)
    ]);
    const csv = [cabecalho, ...linhas].map((linha) =>
      linha.map((campo) => `"${String(campo).replaceAll('"', '""')}"`).join(";")
    ).join("\n");
    const link = document.createElement("a");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    link.href = url;
    link.download = selecionado ? `dre-${selecionado.projeto.nome_cliente || "projeto"}.csv` : "dre-por-projeto.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const detalhamento = selecionado ? [
    ...selecionado.itens.map((item) => ({
      id: `l-${item.id}`,
      data: item.data_competencia || item.data_vencimento,
      descricao: item.descricao,
      categoria: CATEGORIAS[item.categoria] || item.categoria,
      tipo: item.tipo,
      previsto: Number(item.valor || 0),
      realizado: realizadoDoLancamento(item),
      origem: "Financeiro",
    })),
    ...selecionado.custosProjeto.map((item) => ({
      id: `c-${item.id}`,
      data: item.data,
      descricao: item.descricao || CATEGORIAS[item.categoria] || "Custo do projeto",
      categoria: CATEGORIAS[item.categoria] || item.categoria,
      tipo: "despesa",
      previsto: Number(item.valor || 0),
      realizado: Number(item.valor || 0),
      origem: "Custo do projeto",
    })),
  ].sort((a, b) => String(b.data || "").localeCompare(String(a.data || ""))) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">DRE por projeto</h2>
          <p className="text-sm text-slate-500">
            Resultado, custos e margem de cada projeto com visão prevista e realizada.
          </p>
        </div>
        <button onClick={exportar} disabled={!filtrados.length}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-50">
          <Download size={15} /> Exportar DRE
        </button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-[1fr_170px_170px]">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-3 text-slate-500" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar projeto ou cliente..."
            className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase text-slate-500">Competência inicial</label>
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase text-slate-500">Competência final</label>
          <input type="date" value={fim} onChange={(e) => setFim(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Receita realizada", moeda(consolidado.receitaRealizada), TrendingUp, "text-emerald-400"],
          ["Resultado realizado", moeda(consolidado.resultadoRealizado), consolidado.resultadoRealizado >= 0 ? ArrowUpRight : ArrowDownRight, consolidado.resultadoRealizado >= 0 ? "text-emerald-400" : "text-red-400"],
          ["Margem realizada", percentual(margemConsolidada), Target, margemConsolidada >= 0 ? "text-amber-400" : "text-red-400"],
          ["Projetos analisados", filtrados.length, FileBarChart2, "text-blue-400"],
        ].map(([label, valor, Icon, cor]) => (
          <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
              <Icon size={17} className={cor} />
            </div>
            <p className={`mt-2 text-xl font-bold ${cor}`}>{valor}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 p-5">
          <h3 className="font-semibold text-white">Resultado por projeto</h3>
          <p className="text-xs text-slate-500">Clique em um projeto para abrir o demonstrativo completo.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead className="bg-slate-950/60 text-left text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Projeto / cliente</th>
                <th className="px-4 py-3 text-right">Contrato</th>
                <th className="px-4 py-3 text-right">Receita realizada</th>
                <th className="px-4 py-3 text-right">Custos realizados</th>
                <th className="px-4 py-3 text-right">Resultado</th>
                <th className="px-4 py-3 text-right">Margem</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length ? filtrados.map((dre) => {
                const custosRealizados = dre.deducoesRealizadas + dre.custosDiretosRealizados + dre.despesasOperacionaisRealizadas;
                return (
                  <tr key={dre.projeto.id} onClick={() => setProjetoSelecionado(dre.projeto.id)}
                    className={`cursor-pointer border-t border-slate-800 text-sm hover:bg-slate-800/60 ${projetoSelecionado === dre.projeto.id ? "bg-amber-500/5" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{dre.projeto.nome_cliente || "Projeto sem nome"}</p>
                      <p className="text-xs text-slate-500">{dre.projeto.uc_geradora || String(dre.projeto.status || "").replaceAll("_", " ")}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{dre.valorContrato ? moeda(dre.valorContrato) : "—"}</td>
                    <td className="px-4 py-3 text-right text-emerald-400">{moeda(dre.receitaRealizada)}</td>
                    <td className="px-4 py-3 text-right text-red-400">{moeda(custosRealizados)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${dre.resultadoRealizado >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {moeda(dre.resultadoRealizado)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${dre.margemRealizada >= 0 ? "text-amber-400" : "text-red-400"}`}>
                      {percentual(dre.margemRealizada)}
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">Nenhum projeto encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selecionado && (
        <section className="space-y-5 rounded-2xl border border-amber-500/20 bg-slate-900 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-amber-400">Demonstrativo do projeto</p>
              <h3 className="mt-1 text-xl font-bold text-white">{selecionado.projeto.nome_cliente}</h3>
              <p className="text-xs text-slate-500">
                {selecionado.valorContrato ? `Valor contratado: ${moeda(selecionado.valorContrato)} • ` : ""}
                {selecionado.itens.length} lançamento(s) e {selecionado.custosProjeto.length} custo(s) vinculados
              </p>
            </div>
            <button onClick={() => setProjetoSelecionado("")}
              className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-400 hover:text-white">
              Fechar demonstrativo
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full">
              <thead className="bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">DRE</th>
                  <th className="px-4 py-3 text-right">Previsto</th>
                  <th className="px-4 py-3 text-right">Realizado</th>
                </tr>
              </thead>
              <tbody>
                <LinhaDre label="Receita bruta" previsto={selecionado.receitaPrevista} realizado={selecionado.receitaRealizada} destaque />
                <LinhaDre label="(−) Impostos e deduções" previsto={-selecionado.deducoesPrevistas} realizado={-selecionado.deducoesRealizadas} recuo />
                <LinhaDre label="Receita líquida" previsto={selecionado.receitaLiquidaPrevista} realizado={selecionado.receitaLiquidaRealizada} destaque />
                <LinhaDre label="(−) Custos diretos" previsto={-selecionado.custosDiretosPrevistos} realizado={-selecionado.custosDiretosRealizados} recuo />
                <LinhaDre label="Lucro bruto" previsto={selecionado.lucroBrutoPrevisto} realizado={selecionado.lucroBrutoRealizado} destaque />
                <LinhaDre label="(−) Despesas operacionais" previsto={-selecionado.despesasOperacionaisPrevistas} realizado={-selecionado.despesasOperacionaisRealizadas} recuo />
                <LinhaDre label="Resultado do projeto" previsto={selecionado.resultadoPrevisto} realizado={selecionado.resultadoRealizado} destaque />
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className={`rounded-xl p-4 ${selecionado.resultadoRealizado >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
              <div className="flex items-center gap-2">
                {selecionado.resultadoRealizado >= 0 ? <TrendingUp size={17} className="text-emerald-400" /> : <TrendingDown size={17} className="text-red-400" />}
                <span className="text-xs uppercase text-slate-500">Resultado realizado</span>
              </div>
              <p className={`mt-2 text-2xl font-bold ${selecionado.resultadoRealizado >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {moeda(selecionado.resultadoRealizado)}
              </p>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-4">
              <div className="flex items-center gap-2">
                <Target size={17} className="text-amber-400" />
                <span className="text-xs uppercase text-slate-500">Margem realizada</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-amber-400">{percentual(selecionado.margemRealizada)}</p>
            </div>
          </div>

          <div>
            <h4 className="mb-3 font-semibold text-white">Composição do resultado</h4>
            <div className="space-y-2">
              {detalhamento.length ? detalhamento.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-800/60 px-4 py-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.tipo === "receita" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                    {item.tipo === "receita" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{item.descricao}</p>
                    <p className="text-xs text-slate-500">{item.categoria} • {item.origem} {item.data ? `• ${item.data.split("-").reverse().join("/")}` : ""}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-slate-400">Prev. {moeda(item.previsto)}</p>
                    <p className="font-semibold text-white">Real. {moeda(item.realizado)}</p>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
                  Ainda não há receitas ou custos vinculados a este projeto.
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
