import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Scale, ChevronLeft, ChevronRight } from "lucide-react";

export default function ResumoFluxo({ receitas, despesas, saldo, mesAtual, onNavMes }) {
  const cards = [
    { label: "Receitas do mês", valor: receitas, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", sinal: "+" },
    { label: "Despesas do mês", valor: despesas, icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", sinal: "-" },
    { label: "Saldo do mês", valor: saldo, icon: Scale, color: saldo >= 0 ? "text-amber-400" : "text-red-400", bg: saldo >= 0 ? "bg-amber-500/10" : "bg-red-500/10", border: saldo >= 0 ? "border-amber-500/20" : "border-red-500/20", sinal: saldo >= 0 ? "+" : "" },
  ];

  return (
    <div className="space-y-3">
      {/* Navegação de mês */}
      <div className="flex items-center gap-3">
        <button onClick={() => onNavMes(-1)} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all">
          <ChevronLeft size={16} />
        </button>
        <span className="text-white font-semibold text-base capitalize min-w-[160px] text-center">
          {format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}
        </span>
        <button onClick={() => onNavMes(1)} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`${c.bg} border ${c.border} rounded-2xl p-5`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 ${c.bg} rounded-xl flex items-center justify-center`}>
                <c.icon size={18} className={c.color} />
              </div>
              <p className="text-slate-400 text-sm">{c.label}</p>
            </div>
            <p className={`text-2xl font-bold ${c.color}`}>
              {c.sinal}R$ {Math.abs(c.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}