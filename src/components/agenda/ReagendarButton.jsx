import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CalendarClock, Loader2, X } from "lucide-react";

export default function ReagendarButton({ tipo, projeto, manutencao, onDone }) {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState("");
  const [hora, setHora] = useState("08:00");
  const [salvando, setSalvando] = useState(false);

  // Pré-preenche com a data atual do agendamento
  const dataAtual = tipo === "manutencao"
    ? (manutencao?.data_agendamento ? new Date(manutencao.data_agendamento) : null)
    : (projeto?.data_instalacao ? new Date(projeto.data_instalacao + "T12:00:00") : null);

  const handleConfirmar = async () => {
    if (!data) return;
    setSalvando(true);
    try {
      const iso = new Date(`${data}T${hora}:00`).toISOString();
      if (tipo === "manutencao") {
        const res = await base44.functions.invoke("manutencaoCalendar", {
          action: "update",
          manutencao_id: manutencao.id,
          nome_cliente: manutencao.nome_cliente,
          data_agendamento: iso,
          event_id: manutencao.google_calendar_event_id,
        });
        if (res.data?.error) throw new Error(res.data.error);
      } else {
        const res = await base44.functions.invoke("reagendarInstalacao", {
          projeto_id: projeto.id,
          nova_data: iso,
        });
        if (res.data?.error) throw new Error(res.data.error);
      }
      setAberto(false);
      setData("");
      onDone?.();
    } catch (e) {
      alert("Erro ao reagendar: " + (e?.message || e));
    } finally {
      setSalvando(false);
    }
  };

  const fmtDataAtual = dataAtual
    ? dataAtual.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";

  if (!aberto) {
    return (
      <button
        onClick={() => {
          if (dataAtual) {
            const yyyy = dataAtual.getFullYear();
            const mm = String(dataAtual.getMonth() + 1).padStart(2, "0");
            const dd = String(dataAtual.getDate()).padStart(2, "0");
            setData(`${yyyy}-${mm}-${dd}`);
            if (tipo === "manutencao" && dataAtual) {
              setHora(String(dataAtual.getHours()).padStart(2, "0"));
            }
          }
          setAberto(true);
        }}
        className="text-xs bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
      >
        <CalendarClock size={11} /> Reagendar
      </button>
    );
  }

  return (
    <div className="mt-1 p-2 rounded-lg bg-slate-800/50 border border-amber-500/20">
      <div className="flex items-center gap-2 mb-1.5">
        <CalendarClock size={12} className="text-amber-400" />
        <span className="text-xs text-slate-300">Reagendar para:</span>
        <span className="text-xs text-slate-500 ml-auto">Atual: {fmtDataAtual}</span>
        <button onClick={() => setAberto(false)} className="text-slate-500 hover:text-white">
          <X size={12} />
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-500"
        />
        {tipo === "manutencao" && (
          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-500"
          />
        )}
        <button
          onClick={handleConfirmar}
          disabled={!data || salvando}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1"
        >
          {salvando ? <Loader2 size={11} className="animate-spin" /> : <CalendarClock size={11} />}
          Confirmar
        </button>
      </div>
    </div>
  );
}