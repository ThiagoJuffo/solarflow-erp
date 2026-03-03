import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, DollarSign, Users, Award, Calendar, ChevronLeft, ChevronRight } from "lucide-react";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const FORMA_LABELS = {
  a_vista: "À Vista",
  financiamento: "Financiamento",
  consorcio: "Consórcio",
  parcelado_cartao: "Cartão",
  boleto_parcelado: "Boleto"
};

const COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ef4444"];

function parseMoeda(valor) {
  if (!valor) return 0;
  const limpo = String(valor).replace(/[^\d,.-]/g, "").replace(",", ".");
  return parseFloat(limpo) || 0;
}

export default function DashboardVendas() {
  const [user, setUser] = useState(null);
  const [preProjetos, setPreProjetos] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth());
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());

  const navegarMes = (dir) => {
    setMesSelecionado(m => {
      let novoMes = m + dir;
      if (novoMes < 0) { setAnoSelecionado(a => a - 1); return 11; }
      if (novoMes > 11) { setAnoSelecionado(a => a + 1); return 0; }
      return novoMes;
    });
  };

  useEffect(() => {
    Promise.all([
      base44.auth.me(),
      base44.entities.PreProjeto.list("-created_date", 500),
      base44.entities.Vendedor.list()
    ]).then(([u, pp, v]) => {
      setUser(u);
      setPreProjetos(pp);
      setVendedores(v);
      setLoading(false);
    });
  }, []);

  if (!loading && user?.role !== "admin" && user?.role !== "financeiro") {
    return (
      <div className="p-8 text-center text-slate-400">
        Acesso restrito a administradores e financeiro.
      </div>
    );
  }

  // Filtrar pelo ano selecionado
  const doProjeto = preProjetos.filter(pp => {
    const ano = new Date(pp.created_date).getFullYear();
    return ano === anoSelecionado;
  });

  // Dados por mês
  const dadosMensais = MESES.map((mes, idx) => {
    const doMes = doProjeto.filter(pp => new Date(pp.created_date).getMonth() === idx);
    const totalValor = doMes.reduce((acc, pp) => acc + parseMoeda(pp.valor_projeto), 0);
    return {
      mes,
      fechamentos: doMes.length,
      valor: totalValor,
    };
  });

  // Totais do ano
  const totalAno = doProjeto.length;
  const valorTotalAno = doProjeto.reduce((acc, pp) => acc + parseMoeda(pp.valor_projeto), 0);

  // Mes atual
  const mesAtual = new Date().getMonth();
  const doMesAtual = doProjeto.filter(pp => new Date(pp.created_date).getMonth() === mesAtual);
  const valorMesAtual = doMesAtual.reduce((acc, pp) => acc + parseMoeda(pp.valor_projeto), 0);

  // Ranking vendedores no ano
  const rankingVendedores = vendedores.map(v => {
    const vendas = doProjeto.filter(pp => pp.vendedor_id === v.id);
    const valor = vendas.reduce((acc, pp) => acc + parseMoeda(pp.valor_projeto), 0);
    return { nome: v.nome, fechamentos: vendas.length, valor };
  }).filter(v => v.fechamentos > 0).sort((a, b) => b.fechamentos - a.fechamentos);

  // Formas de pagamento
  const formasPagamento = Object.entries(
    doProjeto.reduce((acc, pp) => {
      const key = pp.forma_pagamento || "outros";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).map(([key, value]) => ({ name: FORMA_LABELS[key] || key, value }));

  const formatMoeda = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-32 bg-slate-900 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="text-amber-400" size={22} /> Dashboard de Vendas
          </h1>
          <p className="text-slate-400 text-sm mt-1">Resultados de fechamento — acesso restrito</p>
        </div>
        {/* Seletor de ano */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
          <button onClick={() => setAnoSelecionado(a => a - 1)} className="text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-white font-semibold text-sm w-12 text-center">{anoSelecionado}</span>
          <button onClick={() => setAnoSelecionado(a => a + 1)} className="text-slate-400 hover:text-white transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Fechamentos no Ano", value: totalAno, icon: Calendar, color: "amber" },
          { label: "Volume Total no Ano", value: formatMoeda(valorTotalAno), icon: DollarSign, color: "emerald" },
          { label: `Fechamentos em ${MESES[mesAtual]}`, value: doMesAtual.length, icon: Users, color: "blue" },
          { label: `Volume em ${MESES[mesAtual]}`, value: formatMoeda(valorMesAtual), icon: Award, color: "violet" },
        ].map((card, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-${card.color}-500/10`}>
              <card.icon size={16} className={`text-${card.color}-400`} />
            </div>
            <p className="text-2xl font-bold text-white">{card.value}</p>
            <p className="text-slate-400 text-xs mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Gráfico mensal */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-5">Fechamentos por Mês — {anoSelecionado}</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={dadosMensais} barSize={24}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="mes" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px" }}
              labelStyle={{ color: "#f59e0b", fontWeight: 600 }}
              formatter={(v, name) => [v, name === "fechamentos" ? "Fechamentos" : "Valor"]}
            />
            <Bar dataKey="fechamentos" fill="#f59e0b" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Ranking vendedores */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Award size={16} className="text-amber-400" /> Ranking Vendedores — {anoSelecionado}</h3>
          {rankingVendedores.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">Nenhum dado disponível</p>
          ) : (
            <div className="space-y-3">
              {rankingVendedores.map((v, i) => (
                <div key={v.nome} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-slate-400 text-white" : i === 2 ? "bg-amber-700 text-white" : "bg-slate-800 text-slate-400"}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{v.nome}</p>
                    <p className="text-slate-500 text-xs">{formatMoeda(v.valor)}</p>
                  </div>
                  <span className="text-amber-400 font-bold text-sm shrink-0">{v.fechamentos} vendas</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formas de pagamento */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><DollarSign size={16} className="text-amber-400" /> Formas de Pagamento — {anoSelecionado}</h3>
          {formasPagamento.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">Nenhum dado disponível</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={formasPagamento} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {formasPagamento.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px" }}
                />
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: "#94a3b8", fontSize: 12 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabela mensal detalhada */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 overflow-x-auto">
        <h3 className="text-white font-semibold mb-4">Detalhamento Mensal</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs uppercase tracking-wide border-b border-slate-800">
              <th className="text-left py-2 pb-3">Mês</th>
              <th className="text-right py-2 pb-3">Fechamentos</th>
              <th className="text-right py-2 pb-3">Volume</th>
              <th className="text-right py-2 pb-3">Ticket Médio</th>
            </tr>
          </thead>
          <tbody>
            {dadosMensais.map((row, i) => (
              <tr key={i} className={`border-b border-slate-800/50 ${i === mesAtual && anoSelecionado === new Date().getFullYear() ? "text-amber-300" : "text-white"}`}>
                <td className="py-2.5">{row.mes}</td>
                <td className="text-right">{row.fechamentos}</td>
                <td className="text-right">{formatMoeda(row.valor)}</td>
                <td className="text-right text-slate-400">{row.fechamentos > 0 ? formatMoeda(row.valor / row.fechamentos) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-amber-400 font-semibold border-t border-slate-700">
              <td className="pt-3">Total</td>
              <td className="text-right pt-3">{totalAno}</td>
              <td className="text-right pt-3">{formatMoeda(valorTotalAno)}</td>
              <td className="text-right pt-3 text-slate-400">{totalAno > 0 ? formatMoeda(valorTotalAno / totalAno) : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}