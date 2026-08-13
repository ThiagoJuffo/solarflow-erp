import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Calendar, ChevronLeft, ChevronRight, Wrench, Sun,
  MapPin, Clock, Phone, Link2, AlertCircle, CalendarClock
} from "lucide-react";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MANUTENCAO_STATUS = {
  agendar: { label: "A Agendar", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  agendada: { label: "Agendada", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  concluida: { label: "Concluída", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  cancelada: { label: "Cancelada", color: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export default function Agenda() {
  const [manutencoes, setManutencoes] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [eventosGoogle, setEventosGoogle] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState("todos");

  useEffect(() => {
    Promise.all([
      base44.entities.Manutencao.list("-created_date", 500),
      base44.entities.Projeto.list("-created_date", 500),
      base44.functions.invoke('listarEventosCalendario', {}),
    ]).then(([mans, projs, calRes]) => {
      setManutencoes(mans);
      setProjetos(projs);
      setEventosGoogle(calRes?.data?.events || []);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  // Normaliza nome para comparação
  const norm = (s) => (s || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Busca projeto pelo nome do cliente (match aproximado)
  const findProjetoByName = (nome) => {
    if (!nome) return null;
    const alvo = norm(nome);
    return projetos.find(p => norm(p.nome_cliente) === alvo) || null;
  };

  // Monta lista de eventos
  const eventos = [];
  manutencoes.forEach(m => {
    if (m.data_agendamento && m.status !== "cancelada") {
      eventos.push({
        tipo: "manutencao",
        data: new Date(m.data_agendamento),
        titulo: m.nome_cliente,
        detalhes: m,
        projetoVinculado: findProjetoByName(m.nome_cliente),
      });
    }
  });
  projetos.forEach(p => {
    if (p.data_instalacao) {
      eventos.push({
        tipo: "instalacao",
        data: new Date(p.data_instalacao + "T12:00:00"),
        titulo: p.nome_cliente,
        detalhes: p,
        projetoVinculado: p,
      });
    }
  });
  eventosGoogle.forEach(g => {
    if (!g.start) return;
    const dataEvt = g.start.includes("T") ? new Date(g.start) : new Date(g.start + "T12:00:00");
    eventos.push({
      tipo: "google",
      data: dataEvt,
      titulo: g.summary || "Evento Google",
      detalhes: { endereco: g.location, descricao: g.description, telefone: null, status: null },
      projetoVinculado: findProjetoByName(g.summary),
    });
  });

  const eventosFiltrados = filtroTipo === "todos" ? eventos : eventos.filter(e => e.tipo === filtroTipo);

  // Calendário
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstDay.getDay();

  const days = [];
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = (date) => date && date.getTime() === today.getTime();

  const eventosDoDia = (date) => {
    if (!date) return [];
    return eventosFiltrados
      .filter(e => e.data.toDateString() === date.toDateString())
      .sort((a, b) => a.data - b.data);
  };

  const selectedDayEvents = selectedDay ? eventosDoDia(selectedDay) : [];

  // Próximos eventos (hoje em diante)
  const proximosEventos = eventosFiltrados
    .filter(e => new Date(e.data) >= today)
    .sort((a, b) => a.data - b.data)
    .slice(0, 8);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => { setCurrentDate(new Date()); setSelectedDay(new Date()); };

  const fmtData = (d) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const fmtHora = (d) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const fmtDataHora = (d) => d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const EventCard = ({ ev }) => {
    const isManut = ev.tipo === "manutencao";
    const isGoogle = ev.tipo === "google";
    const st = isManut ? MANUTENCAO_STATUS[ev.detalhes.status] : null;
    const bgClass = isManut ? "bg-amber-500/5 border-amber-500/20" : isGoogle ? "bg-violet-500/5 border-violet-500/20" : "bg-sky-500/5 border-sky-500/20";
    const iconBg = isManut ? "bg-amber-500/15" : isGoogle ? "bg-violet-500/15" : "bg-sky-500/15";
    const badgeClass = isManut ? st.color : isGoogle ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-sky-500/10 text-sky-400 border-sky-500/20";
    const badgeLabel = isManut ? st.label : isGoogle ? "Google Calendar" : "Instalação";
    return (
      <div className={`rounded-xl border p-3 ${bgClass}`}>
        <div className="flex items-start gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
            {isManut ? <Wrench size={13} className="text-amber-400" /> : isGoogle ? <CalendarClock size={13} className="text-violet-400" /> : <Sun size={13} className="text-sky-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white text-sm font-medium truncate">{ev.titulo}</p>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${badgeClass}`}>
                {badgeLabel}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <Clock size={10} /> {fmtDataHora(ev.data)}
              </span>
              {ev.detalhes.telefone && (
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <Phone size={10} /> {ev.detalhes.telefone}
                </span>
              )}
              {ev.detalhes.endereco && (
                <span className="text-slate-400 text-xs flex items-center gap-1 truncate max-w-[200px]">
                  <MapPin size={10} /> {ev.detalhes.endereco}
                </span>
              )}
            </div>
            {ev.detalhes.descricao && (
              <p className="text-slate-500 text-xs mt-1">{ev.detalhes.descricao}</p>
            )}
            {!ev.projetoVinculado && (isManut || isGoogle) && (
              <p className="text-orange-400/80 text-xs mt-1 flex items-center gap-1">
                <AlertCircle size={10} /> Sem projeto vinculado
              </p>
            )}
          </div>
          {ev.projetoVinculado && (
            <Link
              to={createPageUrl(`ProjetoDetalhe?id=${ev.projetoVinculado.id}`)}
              className="shrink-0 text-amber-400 hover:text-amber-300 transition-colors"
              title="Abrir projeto"
            >
              <Link2 size={14} />
            </Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="text-amber-400" size={22} /> Agenda
          </h1>
          <p className="text-slate-400 text-sm mt-1">Instalações e manutenções agendadas</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtro de tipo */}
          <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
            {[
              { key: "todos", label: "Tudo" },
              { key: "instalacao", label: "Instalações" },
              { key: "manutencao", label: "Manutenções" },
              { key: "google", label: "Google Calendar" },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFiltroTipo(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filtroTipo === f.key ? "bg-amber-500 text-white" : "text-slate-400 hover:text-white"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-96 bg-slate-900 rounded-2xl animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendário */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5">
            {/* Navegação do mês */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-lg">
                {MONTH_NAMES[month]} {year}
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={goToday} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all">
                  Hoje
                </button>
                <button onClick={nextMonth} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center text-slate-500 text-xs font-medium py-2">{d}</div>
              ))}
            </div>

            {/* Grid de dias */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((date, i) => {
                if (!date) return <div key={i} className="aspect-square" />;
                const evs = eventosDoDia(date);
                const hasManut = evs.some(e => e.tipo === "manutencao");
                const hasInst = evs.some(e => e.tipo === "instalacao");
                const hasGoogle = evs.some(e => e.tipo === "google");
                const isSel = selectedDay && date.toDateString() === selectedDay.toDateString();
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(date)}
                    className={`aspect-square rounded-lg border p-1 flex flex-col items-center justify-start transition-all relative
                      ${isSel ? "border-amber-500 bg-amber-500/10" : "border-slate-800 hover:border-slate-700 hover:bg-slate-800/50"}
                      ${isToday(date) ? "ring-1 ring-amber-500/40" : ""}`}
                  >
                    <span className={`text-xs font-medium mt-0.5 ${isToday(date) ? "text-amber-400" : "text-slate-300"}`}>
                      {date.getDate()}
                    </span>
                    {evs.length > 0 && (
                      <div className="flex gap-0.5 mt-auto mb-0.5">
                        {hasInst && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
                        {hasManut && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                        {hasGoogle && <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legenda */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-800">
              <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                <span className="w-2 h-2 rounded-full bg-sky-400" /> Instalação
              </span>
              <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Manutenção
              </span>
              <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                <span className="w-2 h-2 rounded-full bg-violet-400" /> Google Calendar
              </span>
            </div>
          </div>

          {/* Sidebar: dia selecionado + próximos */}
          <div className="space-y-4">
            {/* Dia selecionado */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-white font-semibold text-sm mb-3">
                {selectedDay ? selectedDay.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) : "Selecione um dia"}
              </h3>
              {selectedDayEvents.length === 0 ? (
                <p className="text-slate-500 text-xs">Nenhum evento neste dia.</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayEvents.map((ev, i) => <EventCard key={i} ev={ev} />)}
                </div>
              )}
            </div>

            {/* Próximos eventos */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <Clock size={14} className="text-amber-400" /> Próximos eventos
              </h3>
              {proximosEventos.length === 0 ? (
                <p className="text-slate-500 text-xs">Nenhum evento futuro.</p>
              ) : (
                <div className="space-y-2">
                  {proximosEventos.map((ev, i) => (
                    <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-slate-800 last:border-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${ev.tipo === "manutencao" ? "bg-amber-500/15" : ev.tipo === "google" ? "bg-violet-500/15" : "bg-sky-500/15"}`}>
                        {ev.tipo === "manutencao" ? <Wrench size={12} className="text-amber-400" /> : ev.tipo === "google" ? <CalendarClock size={12} className="text-violet-400" /> : <Sun size={12} className="text-sky-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{ev.titulo}</p>
                        <p className="text-slate-500 text-xs">{fmtData(ev.data)} · {fmtHora(ev.data)}</p>
                      </div>
                      {ev.projetoVinculado && (
                        <Link to={createPageUrl(`ProjetoDetalhe?id=${ev.projetoVinculado.id}`)} className="shrink-0 text-amber-400 hover:text-amber-300">
                          <Link2 size={12} />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}