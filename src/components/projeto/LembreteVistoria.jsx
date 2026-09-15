import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { AlertTriangle, X, ChevronRight } from "lucide-react";

// Conta dias úteis (seg-sex) entre a data de criação do protocolo e hoje
const diasUteisDesde = (dataCriacao) => {
  const inicio = new Date(dataCriacao);
  inicio.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (hoje <= inicio) return 0;
  let uteis = 0;
  const cur = new Date(inicio);
  cur.setDate(cur.getDate() + 1);
  while (cur <= hoje) {
    const dia = cur.getDay();
    if (dia !== 0 && dia !== 6) uteis++;
    cur.setDate(cur.getDate() + 1);
  }
  return uteis;
};

const STATUS_PENDENTES = ["vistoria_solicitada", "aguardando_vistoria"];

export default function LembreteVistoria() {
  const [pendentes, setPendentes] = useState([]);
  const [fechado, setFechado] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [protocolos, projetos] = await Promise.all([
          base44.entities.Protocolo.filter({ tipo: "VISTORIA" }),
          base44.entities.Projeto.list("-created_date", 500),
        ]);
        const projMap = new Map(projetos.map(p => [p.id, p]));
        const resultado = protocolos
          .map(proto => {
            const proj = projMap.get(proto.projeto_id);
            if (!proj) return null;
            if (!STATUS_PENDENTES.includes(proj.status)) return null;
            const dias = diasUteisDesde(proto.created_date);
            if (dias < 5) return null;
            return { projeto: proj, dias };
          })
          .filter(Boolean)
          .sort((a, b) => b.dias - a.dias);
        if (!cancelado) {
          setPendentes(resultado);
          setLoading(false);
        }
      } catch {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  if (loading || fechado || pendentes.length === 0) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 shadow-lg shadow-amber-500/5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
          <AlertTriangle size={18} className="text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-amber-300 font-semibold text-sm">
              Vistoria pendente há mais de 5 dias úteis
            </p>
            <button
              onClick={() => setFechado(true)}
              className="text-amber-400/70 hover:text-amber-300 transition-colors shrink-0"
              title="Dispensar"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-amber-200/70 text-xs mt-0.5 mb-3">
            Confira com o cliente se a vistoria já foi realizada e atualize o status do projeto.
          </p>
          <div className="space-y-1.5">
            {pendentes.map(({ projeto, dias }) => (
              <div
                key={projeto.id}
                className="flex items-center gap-2 bg-slate-900/60 border border-amber-500/15 rounded-lg px-3 py-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="text-white text-sm font-medium truncate flex-1">
                  {projeto.nome_cliente}
                </span>
                <span className="text-amber-300/80 text-xs whitespace-nowrap">
                  há {dias} dias úteis
                </span>
                <Link
                  to={createPageUrl(`ProjetoDetalhe?id=${projeto.id}`)}
                  className="flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-400 text-white font-medium px-2.5 py-1 rounded-md transition-all shrink-0"
                >
                  Abrir <ChevronRight size={11} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}