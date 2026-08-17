import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ManutencaoStatusTimeline from "../components/manutencao/ManutencaoStatusTimeline";
import {
  Wrench, ChevronLeft, Calendar, DollarSign, MapPin, Package,
  CheckCircle, X, Clock, Loader2, Copy, Check, RefreshCw, Trash2, Phone, ExternalLink,
  Zap, AlertTriangle
} from "lucide-react";

const STATUS_LABELS = {
  agendar: "A Agendar",
  agendada: "Agendada",
  concluida: "Concluída",
  cancelada: "Cancelada"
};

const STATUS_COLORS = {
  agendar: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  agendada: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  concluida: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  cancelada: "bg-red-500/10 text-red-400 border-red-500/20"
};

const STATUS_FLOW = ["agendar", "agendada", "concluida"];

const fmt = (v) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "—";

export default function ManutencaoDetalhe() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  const [manutencao, setManutencao] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Agendar
  const [showAgendarModal, setShowAgendarModal] = useState(false);
  const [dataAgendamento, setDataAgendamento] = useState("");
  const [horaAgendamento, setHoraAgendamento] = useState("08:00");
  const [agendando, setAgendando] = useState(false);
  const [erroAgendar, setErroAgendar] = useState("");

  // Reagendar
  const [showReagendarModal, setShowReagendarModal] = useState(false);
  const [novaData, setNovaData] = useState("");
  const [novaHora, setNovaHora] = useState("08:00");
  const [reagendando, setReagendando] = useState(false);

  // Status
  const [salvandoStatus, setSalvandoStatus] = useState(false);

  // Cancelar modal
  const [showCancelarModal, setShowCancelarModal] = useState(false);
  const [showExcluirModal, setShowExcluirModal] = useState(false);

  // Copiar msg
  const [copiado, setCopiado] = useState(false);
  const [copiadoMaps, setCopiadoMaps] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      base44.entities.Manutencao.filter({ id }),
      base44.auth.me()
    ]).then(([mans, u]) => {
      setManutencao(mans[0] || null);
      setUser(u);
      setLoading(false);
    });
  }, [id]);

  const update = async (data) => {
    const updated = await base44.entities.Manutencao.update(id, data);
    setManutencao(updated);
    return updated;
  };

  const montarDataHora = (data, hora) => {
    // data: "YYYY-MM-DD", hora: "HH:MM" → Date local
    return new Date(`${data}T${hora || "08:00"}:00`);
  };

  const handleAgendar = async () => {
    if (!dataAgendamento) return;
    setAgendando(true);
    setErroAgendar("");
    try {
      const dataHora = montarDataHora(dataAgendamento, horaAgendamento);
      // Criar evento no Google Calendar
      const res = await base44.functions.invoke('manutencaoCalendar', {
        action: 'create',
        nome_cliente: manutencao.nome_cliente,
        data_agendamento: dataHora.toISOString()
      });
      if (res.data?.error) throw new Error(res.data.error);
      const event_id = res.data?.event_id || null;
      await update({ status: "agendada", data_agendamento: dataHora.toISOString(), google_calendar_event_id: event_id });
      setShowAgendarModal(false);
      setDataAgendamento("");
      setHoraAgendamento("08:00");
    } catch (err) {
      setErroAgendar("Erro ao agendar no Google Calendar. Tente novamente.");
    }
    setAgendando(false);
  };

  const handleReagendar = async () => {
    if (!novaData) return;
    setReagendando(true);
    try {
      const dataHora = montarDataHora(novaData, novaHora);
      // Deletar evento antigo se existir
      if (manutencao.google_calendar_event_id) {
        await base44.functions.invoke('manutencaoCalendar', {
          action: 'delete',
          event_id: manutencao.google_calendar_event_id
        });
      }
      // Criar novo evento
      const res = await base44.functions.invoke('manutencaoCalendar', {
        action: 'create',
        nome_cliente: manutencao.nome_cliente,
        data_agendamento: dataHora.toISOString()
      });
      if (res.data?.error) throw new Error(res.data.error);
      const event_id = res.data?.event_id || null;
      await update({ status: "agendada", data_agendamento: dataHora.toISOString(), google_calendar_event_id: event_id });
      setShowReagendarModal(false);
      setNovaData("");
      setNovaHora("08:00");
    } catch (err) {
      alert("Erro ao reagendar. Tente novamente.");
    }
    setReagendando(false);
  };

  const handleConcluir = async () => {
    setSalvandoStatus(true);
    await update({ status: "concluida" });
    setSalvandoStatus(false);
  };

  const handleCancelar = async () => {
    setSalvandoStatus(true);
    setShowCancelarModal(false);
    if (manutencao.google_calendar_event_id) {
      await base44.functions.invoke('manutencaoCalendar', {
        action: 'delete',
        event_id: manutencao.google_calendar_event_id
      });
    }
    await update({ status: "cancelada", google_calendar_event_id: null });
    setSalvandoStatus(false);
  };

  const handleReativar = async () => {
    setSalvandoStatus(true);
    await update({ status: "agendar" });
    setSalvandoStatus(false);
  };

  // Avançar para próxima etapa do fluxo
  const avancarStatus = async () => {
    const idx = STATUS_FLOW.indexOf(manutencao.status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;
    const proximo = STATUS_FLOW[idx + 1];
    // De "agendar" → "agendada" exige data: abre o modal
    if (manutencao.status === "agendar" && proximo === "agendada") {
      setShowAgendarModal(true);
      return;
    }
    setSalvandoStatus(true);
    await update({ status: proximo });
    setSalvandoStatus(false);
  };

  // Voltar para etapa anterior do fluxo
  const voltarStatus = async () => {
    const idx = STATUS_FLOW.indexOf(manutencao.status);
    if (idx <= 0) return;
    const anterior = STATUS_FLOW[idx - 1];
    setSalvandoStatus(true);
    // Se voltar de "agendada" para "agendar", remove o evento do calendário
    if (manutencao.status === "agendada" && anterior === "agendar" && manutencao.google_calendar_event_id) {
      try {
        await base44.functions.invoke('manutencaoCalendar', {
          action: 'delete',
          event_id: manutencao.google_calendar_event_id
        });
        await update({ status: anterior, google_calendar_event_id: null, data_agendamento: null });
      } catch {
        await update({ status: anterior });
      }
    } else {
      await update({ status: anterior });
    }
    setSalvandoStatus(false);
  };

  const handleExcluir = async () => {
    setShowExcluirModal(false);
    if (manutencao.google_calendar_event_id) {
      await base44.functions.invoke('manutencaoCalendar', {
        action: 'delete',
        event_id: manutencao.google_calendar_event_id
      });
    }
    await base44.entities.Manutencao.delete(id);
    window.location.href = createPageUrl("Manutencoes");
  };

  const mensagemWhatsApp = manutencao
    ? `MANUTENÇÃO\nNome: ${manutencao.nome_cliente}\nEndereço: ${manutencao.endereco || "—"}\nKit: ${manutencao.kit || "—"}${manutencao.google_maps_url ? `\nLocalização: ${manutencao.google_maps_url}` : ""}`
    : "";

  const copiarMaps = () => {
    navigator.clipboard.writeText(manutencao.google_maps_url);
    setCopiadoMaps(true);
    setTimeout(() => setCopiadoMaps(false), 2000);
  };

  const copiarMensagem = () => {
    navigator.clipboard.writeText(mensagemWhatsApp);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full py-20">
      <Loader2 className="text-amber-400 animate-spin" size={32} />
    </div>
  );

  if (!manutencao) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <p className="text-slate-400">Manutenção não encontrada</p>
      <Link to={createPageUrl("Manutencoes")} className="text-amber-400 hover:underline">← Voltar</Link>
    </div>
  );

  const canAgendar = user?.role === "admin" || user?.role === "financeiro";

  const inFlow = STATUS_FLOW.includes(manutencao.status);

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      {/* Header com navegação de etapas */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl("Manutencoes")} className="text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-lg truncate">{manutencao.nome_cliente}</h1>
            <p className="text-slate-400 text-xs">Manutenção</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${STATUS_COLORS[manutencao.status]}`}>
            {STATUS_LABELS[manutencao.status]}
          </span>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Botões de navegação de etapas (fluxo normal) */}
            {inFlow && canAgendar && (
              <>
                {STATUS_FLOW.indexOf(manutencao.status) > 0 && (
                  <button
                    onClick={voltarStatus}
                    disabled={salvandoStatus}
                    className="text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                  >
                    {salvandoStatus ? <Loader2 size={12} className="animate-spin" /> : <ChevronLeft size={12} />} Etapa anterior
                  </button>
                )}
                {STATUS_FLOW.indexOf(manutencao.status) < STATUS_FLOW.length - 1 && (
                  <button
                    onClick={avancarStatus}
                    disabled={salvandoStatus}
                    className="text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                  >
                    {salvandoStatus ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} Próxima etapa
                  </button>
                )}
              </>
            )}
            {/* Reagendar (disponível quando agendada) */}
            {manutencao.status === "agendada" && canAgendar && (
              <button onClick={() => setShowReagendarModal(true)}
                className="text-xs bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1">
                <RefreshCw size={12} /> Reagendar
              </button>
            )}
            {/* Cancelar */}
            {(manutencao.status === "agendada" || manutencao.status === "agendar") && (
              <button onClick={() => setShowCancelarModal(true)} disabled={salvandoStatus}
                className="text-xs bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1">
                {salvandoStatus ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Cancelar
              </button>
            )}
            {/* Reativar */}
            {manutencao.status === "cancelada" && (
              <button onClick={handleReativar} disabled={salvandoStatus}
                className="text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1">
                {salvandoStatus ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Reativar
              </button>
            )}
            {/* Excluir (disponível quando concluída) */}
            {manutencao.status === "concluida" && (
              <button onClick={() => setShowExcluirModal(true)}
                className="text-xs bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1">
                <Trash2 size={12} /> Excluir
              </button>
            )}
          </div>
        </div>

        {/* Timeline de etapas */}
        <ManutencaoStatusTimeline status={manutencao.status} />

        {!canAgendar && manutencao.status === "agendar" && (
          <p className="text-slate-500 text-xs flex items-center gap-1.5">
            <AlertTriangle size={11} /> O agendamento deve ser feito pelo perfil Financeiro ou Admin.
          </p>
        )}
      </div>

      {/* Dados */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-white font-semibold flex items-center gap-2 text-sm">
          <Wrench size={14} className="text-amber-400" /> Informações da Manutenção
        </h2>
        <div className="grid grid-cols-1 gap-3">
          {manutencao.telefone && (
            <DataRow icon={<Phone size={13} className="text-amber-400 shrink-0" />} label="Telefone" value={manutencao.telefone} />
          )}
          <DataRow icon={<Package size={13} className="text-amber-400 shrink-0" />} label="Kit" value={manutencao.kit || "—"} />
          <DataRow icon={<MapPin size={13} className="text-amber-400 shrink-0" />} label="Endereço" value={manutencao.endereco || "—"} />
          <DataRow icon={<DollarSign size={13} className="text-amber-400 shrink-0" />} label="Valor" value={manutencao.valor ? fmt(manutencao.valor) : "—"} />
          <DataRow icon={<Clock size={13} className="text-amber-400 shrink-0" />} label="Condição de Pagamento" value={manutencao.condicao_pagamento || "—"} />
          <DataRow
            icon={<Calendar size={13} className="text-amber-400 shrink-0" />}
            label="Data Agendada"
            value={manutencao.data_agendamento
              ? new Date(manutencao.data_agendamento).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
              : "Sem data"}
          />
        </div>

        {/* Localização Google Maps */}
        {manutencao.google_maps_url && (
          <div className="mt-3 bg-slate-800/50 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin size={13} className="text-amber-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-slate-400 text-xs mb-0.5">Localização</p>
                <a href={manutencao.google_maps_url} target="_blank" rel="noreferrer"
                  className="text-amber-400 hover:text-amber-300 text-xs truncate flex items-center gap-1 transition-colors">
                  <ExternalLink size={11} /> Ver no Google Maps
                </a>
              </div>
            </div>
            <button
              onClick={copiarMaps}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${copiadoMaps ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-700 hover:bg-slate-600 text-slate-300"}`}
            >
              {copiadoMaps ? <Check size={12} /> : <Copy size={12} />}
              {copiadoMaps ? "Copiado!" : "Copiar link"}
            </button>
          </div>
        )}
      </div>

      {/* Mensagem WhatsApp */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 className="text-white font-semibold text-sm flex items-center gap-2">
          📋 Mensagem para Grupo
        </h2>
        <pre className="bg-slate-800 rounded-xl p-4 text-slate-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">
          {mensagemWhatsApp}
        </pre>
        <button
          onClick={copiarMensagem}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${copiado ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"}`}
        >
          {copiado ? <Check size={14} /> : <Copy size={14} />}
          {copiado ? "Copiado!" : "Copiar mensagem"}
        </button>
      </div>

      {/* Modal Agendar */}
      {showAgendarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold">Agendar Manutenção</h3>
              <button onClick={() => { setShowAgendarModal(false); setErroAgendar(""); }} className="text-slate-500 hover:text-white"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Data *</label>
                <input type="date" value={dataAgendamento} onChange={e => setDataAgendamento(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Horário *</label>
                <input type="time" value={horaAgendamento} onChange={e => setHoraAgendamento(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
              </div>
            </div>
            <p className="text-slate-500 text-xs">Será criado um evento no Google Calendar automaticamente.</p>
            {erroAgendar && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle size={13} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-400 text-xs">{erroAgendar}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setShowAgendarModal(false); setErroAgendar(""); }} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={handleAgendar} disabled={agendando || !dataAgendamento}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                {agendando ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
                {agendando ? "Agendando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Excluir */}
      {showExcluirModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-red-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <Trash2 size={16} className="text-red-400" />
                </div>
                <h3 className="text-white font-bold">Excluir Manutenção</h3>
              </div>
              <button onClick={() => setShowExcluirModal(false)} className="text-slate-500 hover:text-white"><X size={16} /></button>
            </div>
            <p className="text-slate-300 text-sm">Deseja excluir permanentemente esta manutenção?</p>
            <p className="text-red-400/70 text-xs font-medium">⚠️ Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowExcluirModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-sm font-medium transition-all">Voltar</button>
              <button onClick={handleExcluir}
                className="flex-1 bg-red-500 hover:bg-red-400 text-white py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
                <Trash2 size={14} /> Excluir permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelar */}
      {showCancelarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-red-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <X size={16} className="text-red-400" />
                </div>
                <h3 className="text-white font-bold">Cancelar Manutenção</h3>
              </div>
              <button onClick={() => setShowCancelarModal(false)} className="text-slate-500 hover:text-white"><X size={16} /></button>
            </div>
            <p className="text-slate-300 text-sm">Tem certeza que deseja cancelar esta manutenção?</p>
            <p className="text-slate-500 text-xs">
              {manutencao.google_calendar_event_id
                ? "O evento no Google Calendar também será removido."
                : "Esta ação irá marcar a manutenção como cancelada."}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowCancelarModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-sm font-medium transition-all">Voltar</button>
              <button onClick={handleCancelar} disabled={salvandoStatus}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
                {salvandoStatus ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reagendar */}
      {showReagendarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold">Reagendar Manutenção</h3>
              <button onClick={() => setShowReagendarModal(false)} className="text-slate-500 hover:text-white"><X size={16} /></button>
            </div>
            <p className="text-slate-400 text-sm">O evento atual no Google Calendar será removido e um novo será criado na data escolhida.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Nova Data *</label>
                <input type="date" value={novaData} onChange={e => setNovaData(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Horário *</label>
                <input type="time" value={novaHora} onChange={e => setNovaHora(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowReagendarModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={handleReagendar} disabled={reagendando || !novaData}
                className="flex-1 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                {reagendando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {reagendando ? "Reagendando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DataRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 bg-slate-800/50 rounded-xl px-4 py-3">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-slate-400 text-xs mb-0.5">{label}</p>
        <p className="text-white text-sm">{value}</p>
      </div>
    </div>
  );
}