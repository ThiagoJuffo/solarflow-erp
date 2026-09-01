import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Calendar, ChevronLeft, ChevronRight, Wrench, Sun,
  MapPin, Clock, Phone, Link2, AlertCircle, CalendarClock,
  TrendingUp, Layers, BarChart2, RefreshCw, Scale, Target, CheckCircle
} from "lucide-react";
import VincularProjetoButton from "../components/agenda/VincularProjetoButton";
import NovoAgendamentoModal from "../components/agenda/NovoAgendamentoModal";
import MarcarInstaladoButton from "../components/agenda/MarcarInstaladoButton";
import ContinuarInstalacaoButton from "../components/agenda/ContinuarInstalacaoButton";
import KpiGrid from "../components/agenda/KpiGrid";
import { Plus } from "lucide-react";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MANUTENCAO_STATUS = {
  agendar: { label: "A Agendar", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  agendada: { label: "Agendada", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  concluida: { label: "Concluída", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  cancelada: { label: "Cancelada", color: "bg-red-500/10 text-red-400 border-red-500/20" },
};

const INSTALACAO_STATUS = {
  agendada: { label: "Agendada", bg: "bg-sky-500/5 border-sky-500/20", iconBg: "bg-sky-500/15", iconColor: "text-sky-400", badge: "bg-sky-500/10 text-sky-400 border-sky-500/20", chip: "bg-sky-500/15 text-sky-300", dot: "bg-sky-400" },
  instalada: { label: "Instalada", bg: "bg-emerald-500/5 border-emerald-500/20", iconBg: "bg-emerald-500/15", iconColor: "text-emerald-400", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", chip: "bg-emerald-500/15 text-emerald-300", dot: "bg-emerald-400" },
  atrasada: { label: "Atrasada", bg: "bg-red-500/5 border-red-500/20", iconBg: "bg-red-500/15", iconColor: "text-red-400", badge: "bg-red-500/10 text-red-400 border-red-500/20", chip: "bg-red-500/15 text-red-300", dot: "bg-red-400" },
};

export default function Agenda() {
  const [manutencoes, setManutencoes] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [ucs, setUCs] = useState([]);
  const [preProjetos, setPreProjetos] = useState([]);
  const [eventosGoogle, setEventosGoogle] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [showNovoAgendamento, setShowNovoAgendamento] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      base44.entities.Manutencao.list("-created_date", 500),
      base44.entities.Projeto.list("-created_date", 500),
      base44.entities.UC.list("-created_date", 500),
      base44.entities.PreProjeto.list("-created_date", 500),
      base44.functions.invoke('listarEventosCalendario', {}),
    ]).then(([mans, projs, ucList, ppList, calRes]) => {
      setManutencoes(mans);
      setProjetos(projs);
      setUCs(ucList);
      setPreProjetos(ppList);
      setEventosGoogle(calRes?.data?.events || []);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  };

  useEffect(() => { loadData(); }, []);

  // Normaliza nome para comparação
  const norm = (s) => (s || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Busca projeto pelo nome do cliente (match aproximado)
  const findProjetoByName = (nome) => {
    if (!nome) return null;
    const alvo = norm(nome);
    return projetos.find(p => norm(p.nome_cliente) === alvo) || null;
  };

  // Extrai ID entre colchetes do título do evento (ex: "Nome [abc123]")
  const parseIdFromTitle = (title) => {
    const match = (title || "").match(/\[([^\]]+)\]/);
    return match ? match[1] : null;
  };

  // Busca projeto pelo ID
  const findProjetoById = (projId) => projetos.find(p => p.id === projId) || null;

  // Busca projeto pelo google_calendar_event_id (individual ou array multi-dia)
  const findProjetoByEventId = (eventId) => projetos.find(p =>
    p.google_calendar_event_id === eventId ||
    (Array.isArray(p.google_calendar_event_ids) && p.google_calendar_event_ids.includes(eventId))
  ) || null;

  // Busca UC pelo projeto_id
  const findUCByProjeto = (projId) => ucs.find(u => u.projeto_id === projId) || null;

  // Busca PreProjeto pelo projeto
  const findPreProjetoByProjeto = (proj) => {
    if (!proj) return null;
    return preProjetos.find(pp => pp.id === proj.pre_projeto_id || pp.projeto_id === proj.id) || null;
  };

  // Retorna cidade, nº de placas e dias agendados do projeto
  const getProjetoInfo = (proj) => {
    if (!proj) return null;
    const uc = findUCByProjeto(proj.id);
    const pp = findPreProjetoByProjeto(proj);
    const diasPrincipais = Array.isArray(proj.google_calendar_event_ids) && proj.google_calendar_event_ids.length > 0
      ? proj.google_calendar_event_ids.length
      : 1;
    const diasContinuacao = Array.isArray(proj.continuacoes) ? proj.continuacoes.length : 0;
    return {
      cidade: uc?.cidade || "",
      placas: pp?.modulo_quantidade || "",
      diasAgendados: diasPrincipais + diasContinuacao,
    };
  };

  // Determina o status da instalação (agendada / instalada / atrasada)
  const getInstalacaoStatus = (ev) => {
    const proj = ev.projetoVinculado;
    if (!proj) return "agendada";
    if (proj.sistema_instalado || proj.status === "sistema_instalado") return "instalada";
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (ev.data < hoje) return "atrasada";
    return "agendada";
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
  // Status que indicam que a instalação já aconteceu (não conta como atrasada)
  const STATUS_POS_INSTALACAO = ["sistema_instalado", "vistoria_solicitada", "aguardando_vistoria", "vistoria_aprovada", "monitoramento_cadastrado", "concluido"];
  // Data de instalação válida (descarta valores como "0001-01-01")
  const isDataValida = (d) => d && !isNaN(d.getTime()) && d.getFullYear() > 2000;

  projetos.forEach(p => {
    // Ignora instalações já vinculadas ao Google Calendar (aparecerão via eventosGoogle)
    if (p.data_instalacao && !p.google_calendar_event_id) {
      const d = new Date(p.data_instalacao + "T12:00:00");
      if (!isDataValida(d)) return;
      eventos.push({
        tipo: "instalacao",
        data: d,
        titulo: p.nome_cliente,
        detalhes: p,
        projetoVinculado: p,
      });
    }
  });
  // Continuações de instalação (dias não consecutivos) — eventos separados vinculados ao projeto original
  projetos.forEach(p => {
    if (!Array.isArray(p.continuacoes)) return;
    p.continuacoes.forEach(cont => {
      if (!cont.data) return;
      const d = new Date(cont.data + "T12:00:00");
      if (!isDataValida(d)) return;
      eventos.push({
        tipo: "instalacao",
        isContinuacao: true,
        continuacaoData: cont.data,
        data: d,
        titulo: p.nome_cliente,
        detalhes: p,
        projetoVinculado: p,
      });
    });
  });
  // Verifica se um evento do Google é uma continuação (para evitar duplicação)
  const isContinuationGoogleEvent = (eventId) => projetos.some(p =>
    Array.isArray(p.continuacoes) && p.continuacoes.some(c => c.google_calendar_event_id === eventId)
  );
  eventosGoogle.forEach(g => {
    if (!g.start) return;
    if (isContinuationGoogleEvent(g.id)) return; // tratado como continuação separada acima
    const dataEvt = g.start.includes("T") ? new Date(g.start) : new Date(g.start + "T12:00:00");
    const projId = parseIdFromTitle(g.summary);
    const projetoVinculado = projId ? findProjetoById(projId) : (findProjetoByEventId(g.id) || findProjetoByName(g.summary));
    eventos.push({
      tipo: "google",
      data: dataEvt,
      titulo: g.summary || "Evento Google",
      detalhes: { endereco: g.location, descricao: g.description, telefone: null, status: null, eventId: g.id },
      projetoVinculado,
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

  // KPIs
  const isInstalacao = (ev) => ev.tipo === "instalacao" || (ev.tipo === "google" && ev.projetoVinculado);
  const instalacoesHoje = (() => {
    const seen = new Set();
    eventos.forEach(ev => {
      if (!isInstalacao(ev) || ev.data.toDateString() !== today.toDateString()) return;
      const key = ev.projetoVinculado?.id || ev.detalhes?.eventId || (ev.titulo + ev.data.toISOString());
      seen.add(key);
    });
    return seen.size;
  })();

  const instalacoesAtrasadas = (() => {
    const seen = new Set();
    let count = 0;
    eventos.forEach(ev => {
      if (!isInstalacao(ev) || !isDataValida(ev.data) || !(ev.data < today)) return;
      const proj = ev.projetoVinculado;
      if (proj && (proj.sistema_instalado || STATUS_POS_INSTALACAO.includes(proj.status))) return;
      const key = proj?.id || ev.detalhes?.eventId || (ev.titulo + ev.data.toISOString());
      if (seen.has(key)) return;
      seen.add(key);
      count++;
    });
    return count;
  })();

  const now = new Date();
  const mesAtual = now.getMonth();
  const anoAtual = now.getFullYear();
  const mesKey = `${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}`;
  const instalacoesConcluidasMes = projetos.filter(p => {
    if (!p.sistema_instalado) return false;
    const dataRef = p.data_instalacao || p.updated_date;
    if (!dataRef) return false;
    return String(dataRef).slice(0, 7) === mesKey;
  }).length;

  const manutencoesAgendar = manutencoes.filter(m => m.status === "agendar").length;

  const manutencoesConcluidasMes = manutencoes.filter(m => {
    if (m.status !== "concluida" || !m.data_agendamento) return false;
    return String(m.data_agendamento).slice(0, 7) === mesKey;
  }).length;

  // Semana atual (domingo a sábado)
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeekFull = new Date(startOfWeek);
  endOfWeekFull.setDate(startOfWeek.getDate() + 6);
  endOfWeekFull.setHours(23, 59, 59, 999);

  const instalacoesSemana = (() => {
    const seen = new Set();
    eventos.forEach(ev => {
      if (!isInstalacao(ev) || ev.data < startOfWeek || ev.data > endOfWeekFull) return;
      const key = ev.projetoVinculado?.id || ev.detalhes?.eventId || (ev.titulo + ev.data.toISOString());
      seen.add(key);
    });
    return seen.size;
  })();

  // Próximos 7 dias
  const fimProximos7 = new Date(today);
  fimProximos7.setDate(today.getDate() + 7);
  fimProximos7.setHours(23, 59, 59, 999);
  const instalacoesProximos7 = eventos.filter(ev =>
    isInstalacao(ev) && ev.data >= today && ev.data <= fimProximos7
  ).length;

  // Taxa de conclusão (% de agendadas que viraram instalado)
  const instalacoesComData = projetos.filter(p => p.data_instalacao);
  const instalacoesConcluidasTotal = projetos.filter(p => p.sistema_instalado || p.status === "sistema_instalado").length;
  const taxaConclusao = instalacoesComData.length > 0
    ? Math.round((instalacoesConcluidasTotal / instalacoesComData.length) * 100)
    : 0;

  // Eventos totais do dia (instalações + manutenções)
  const eventosTotaisDia = eventos.filter(ev => ev.data.toDateString() === today.toDateString()).length;

  // Carga por dia - dia mais carregado da semana
  const cargaPorDia = {};
  eventos.filter(ev => isInstalacao(ev) && ev.data >= startOfWeek && ev.data <= endOfWeekFull).forEach(ev => {
    const key = ev.data.toDateString();
    cargaPorDia[key] = (cargaPorDia[key] || 0) + 1;
  });
  let diaMaisCarregadoLabel = "—";
  let diaMaisCarregadoCount = 0;
  Object.entries(cargaPorDia).forEach(([key, count]) => {
    if (count > diaMaisCarregadoCount) {
      diaMaisCarregadoCount = count;
      diaMaisCarregadoLabel = new Date(key).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
    }
  });

  // Tempo médio de espera (proxy: dias entre created_date e data_instalacao)
  const instaladosComData = projetos.filter(p =>
    (p.sistema_instalado || p.status === "sistema_instalado") && p.data_instalacao && p.created_date
  );
  let tempoMedioEspera = 0;
  if (instaladosComData.length > 0) {
    const totalDias = instaladosComData.reduce((sum, p) => {
      const criacao = new Date(p.created_date);
      const inst = new Date(p.data_instalacao + "T12:00:00");
      return sum + Math.max(0, Math.round((inst - criacao) / 86400000));
    }, 0);
    tempoMedioEspera = Math.round(totalDias / instaladosComData.length);
  }

  // Reagendamentos no mês
  const reagendamentosMes = projetos.reduce((sum, p) => {
    if (!Array.isArray(p.reagendamentos)) return sum;
    return sum + p.reagendamentos.filter(r => {
      if (!r.data) return false;
      const d = new Date(r.data);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    }).length;
  }, 0);

  // Relação manutenção/instalação (mês)
  const manutencoesMes = manutencoes.filter(m => {
    if (!m.data_agendamento) return false;
    const d = new Date(m.data_agendamento);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  }).length;
  const instalacoesMes = eventos.filter(ev =>
    isInstalacao(ev) && ev.data.getMonth() === mesAtual && ev.data.getFullYear() === anoAtual
  ).length;
  const relacaoManutInst = instalacoesMes > 0 ? (manutencoesMes / instalacoesMes).toFixed(1) + ":1" : "—";

  // Instalações no mês (deduplicado por projeto)
  const instalacoesMesUnicas = (() => {
    const seen = new Set();
    let count = 0;
    eventos.forEach(ev => {
      if (!isInstalacao(ev)) return;
      if (ev.data.getMonth() !== mesAtual || ev.data.getFullYear() !== anoAtual) return;
      const key = ev.projetoVinculado?.id || ev.detalhes?.eventId || (ev.titulo + ev.data.toISOString());
      if (seen.has(key)) return;
      seen.add(key);
      count++;
    });
    return count;
  })();

  // Módulos (placas) agendados na semana (deduplicado por projeto)
  const modulosAgendadosSemana = (() => {
    const seen = new Set();
    let total = 0;
    eventos.forEach(ev => {
      if (!isInstalacao(ev)) return;
      if (ev.data < startOfWeek || ev.data > endOfWeekFull) return;
      const proj = ev.projetoVinculado;
      if (!proj || seen.has(proj.id)) return;
      seen.add(proj.id);
      const pp = findPreProjetoByProjeto(proj);
      total += pp?.modulo_quantidade || 0;
    });
    return total;
  })();

  // Módulos (placas) agendados no mês (deduplicado por projeto)
  const modulosAgendadosMes = (() => {
    const seen = new Set();
    let total = 0;
    eventos.forEach(ev => {
      if (!isInstalacao(ev)) return;
      if (ev.data.getMonth() !== mesAtual || ev.data.getFullYear() !== anoAtual) return;
      const proj = ev.projetoVinculado;
      if (!proj || seen.has(proj.id)) return;
      seen.add(proj.id);
      const pp = findPreProjetoByProjeto(proj);
      total += pp?.modulo_quantidade || 0;
    });
    return total;
  })();

  // Módulos instalados por dia (média de placas por dia com instalação executada)
  const modulosInstaladosPorDia = (() => {
    let count = 0;
    let total = 0;
    projetos.forEach(p => {
      if (!p.sistema_instalado && p.status !== "sistema_instalado") return;
      if (!p.data_instalacao) return;
      const d = new Date(p.data_instalacao + "T12:00:00");
      if (!isDataValida(d)) return;
      count++;
      const pp = findPreProjetoByProjeto(p);
      total += pp?.modulo_quantidade || 0;
    });
    return count > 0 ? Math.round(total / count) : 0;
  })();

  const kpiCards = [
    { id: "modulos_semana", label: "Módulos agendados (semana)", value: modulosAgendadosSemana, color: "cyan", Icon: Layers },
    { id: "modulos_mes", label: "Módulos agendados (mês)", value: modulosAgendadosMes, color: "cyan", Icon: Layers },
    { id: "modulos_dia", label: "Módulos instalados/dia", value: modulosInstaladosPorDia, color: "cyan", Icon: Layers },
    { id: "concluidas", label: "Instalações concluídas (mês)", value: instalacoesConcluidasMes, color: "emerald", Icon: Sun },
    { id: "manut_agendar", label: "Manut. a agendar", value: manutencoesAgendar, color: "amber", Icon: Wrench },
  { id: "manut_concluidas_mes", label: "Manut. concluídas (mês)", value: manutencoesConcluidasMes, color: "emerald", Icon: CheckCircle },
    { id: "taxa_conclusao", label: "Taxa de conclusão de instalações", value: `${taxaConclusao}%`, color: "violet", Icon: Target },
    { id: "atrasadas", label: "Atrasadas", value: instalacoesAtrasadas, color: "red", Icon: AlertCircle },
    { id: "reagendamentos", label: "Reagendamentos (mês)", value: reagendamentosMes, color: "rose", Icon: RefreshCw },
    { id: "inst_hoje", label: "Instalações hoje", value: instalacoesHoje, color: "sky", Icon: Sun },
    { id: "inst_semana", label: "Instalações na semana", value: instalacoesSemana, color: "sky", Icon: Sun },
    { id: "inst_mes", label: "Instalações no mês", value: instalacoesMesUnicas, color: "sky", Icon: Sun },
  ];

  // Próximos eventos (apenas da semana atual)
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);

  const proximosEventos = eventosFiltrados
    .filter(e => e.data >= today && e.data <= endOfWeek)
    .sort((a, b) => a.data - b.data);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => { setCurrentDate(new Date()); setSelectedDay(new Date()); };

  const [dragOverDay, setDragOverDay] = useState(null);

  const canDragEv = (ev) => ev.tipo !== "manutencao" && !ev.isContinuacao && !!ev.projetoVinculado?.google_calendar_event_id;

  const handleDrop = async (e, targetDate) => {
    e.preventDefault();
    setDragOverDay(null);
    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
      if (!dragData.projetoId) return;
      const origEv = eventos.find(ev => ev.projetoVinculado?.id === dragData.projetoId);
      const newDate = new Date(targetDate);
      if (origEv?.data) {
        newDate.setHours(origEv.data.getHours(), origEv.data.getMinutes(), 0, 0);
      } else {
        newDate.setHours(8, 0, 0, 0);
      }
      await base44.functions.invoke('reagendarInstalacao', {
        projeto_id: dragData.projetoId,
        nova_data: newDate.toISOString(),
      });
      loadData();
    } catch {
      alert('Erro ao reagendar instalação.');
    }
  };

  const fmtData = (d) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const fmtHora = (d) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const fmtDataHora = (d) => d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const EventCard = ({ ev }) => {
    const isManut = ev.tipo === "manutencao";
    const isGoogle = ev.tipo === "google";
    const st = isManut ? MANUTENCAO_STATUS[ev.detalhes.status] : null;
    const isInstalacao = !isManut && (ev.tipo === "instalacao" || (isGoogle && ev.projetoVinculado));
    const instStatus = isInstalacao ? INSTALACAO_STATUS[getInstalacaoStatus(ev)] : null;
    const bgClass = isManut ? "bg-amber-500/5 border-amber-500/20" : isInstalacao ? instStatus.bg : "bg-violet-500/5 border-violet-500/20";
    const iconBg = isManut ? "bg-amber-500/15" : isInstalacao ? instStatus.iconBg : "bg-violet-500/15";
    const badgeClass = isManut ? st.color : isInstalacao ? instStatus.badge : "bg-violet-500/10 text-violet-400 border-violet-500/20";
    const badgeLabel = isManut ? st.label : isInstalacao ? instStatus.label : "Google Calendar";
    return (
      <div className={`rounded-xl border p-3 ${bgClass}`}>
        <div className="flex items-start gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
            {isManut ? <Wrench size={13} className="text-amber-400" /> : isInstalacao ? <Sun size={13} className={instStatus.iconColor} /> : <CalendarClock size={13} className="text-violet-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white text-sm font-medium truncate">{ev.titulo}</p>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${badgeClass}`}>
                {badgeLabel}
              </span>
              {ev.isContinuacao && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-sky-500/10 text-sky-400 border-sky-500/20 flex items-center gap-1">
                  <CalendarClock size={9} /> Continuação
                </span>
              )}
              {(ev.projetoVinculado?.evento_orfao_google || (isManut && ev.detalhes?.evento_orfao_google)) && (
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-orange-500/10 text-orange-400 border-orange-500/20 flex items-center gap-1"
                  title="Evento foi excluído no Google Calendar — o registro está órfão"
                >
                  <AlertCircle size={9} /> Órfão
                </span>
              )}
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
            {ev.projetoVinculado && (() => {
              const info = getProjetoInfo(ev.projetoVinculado);
              if (!info) return null;
              return (
                <div className="flex items-center gap-3 mt-1">
                  {info.cidade && (
                    <span className="text-slate-400 text-xs flex items-center gap-1">
                      <MapPin size={10} /> {info.cidade}
                    </span>
                  )}
                  {info.placas && (
                    <span className="text-slate-400 text-xs flex items-center gap-1">
                      <Sun size={10} /> {info.placas} placas
                    </span>
                  )}
                  {info.diasAgendados > 1 && (
                    <span className="text-slate-400 text-xs flex items-center gap-1">
                      <CalendarClock size={10} /> {info.diasAgendados} dias agendados
                    </span>
                  )}
                </div>
              );
            })()}
            {ev.projetoVinculado && (isGoogle || ev.tipo === "instalacao") && !ev.projetoVinculado.sistema_instalado && ev.projetoVinculado.status !== "sistema_instalado" && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <MarcarInstaladoButton projeto={ev.projetoVinculado} onDone={loadData} continuacaoData={ev.continuacaoData} />
                {!ev.isContinuacao && (
                  <ContinuarInstalacaoButton projeto={ev.projetoVinculado} onDone={loadData} />
                )}
              </div>
            )}
            {!ev.projetoVinculado && isGoogle && (
              <VincularProjetoButton
                eventId={ev.detalhes.eventId}
                projetos={projetos}
                onLinked={loadData}
              />
            )}
            {!ev.projetoVinculado && isManut && (
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
        <button
          onClick={() => setShowNovoAgendamento(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-amber-500/20"
        >
          <Plus size={16} /> Novo agendamento
        </button>
      </div>

      {showNovoAgendamento && (
        <NovoAgendamentoModal
          projetos={projetos}
          ucs={ucs}
          preProjetos={preProjetos}
          onClose={() => setShowNovoAgendamento(false)}
          onCreated={loadData}
        />
      )}

      {/* KPIs arrastáveis */}
      <KpiGrid cards={kpiCards} />

      {loading ? (
        <div className="h-96 bg-slate-900 rounded-2xl animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* Calendário */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
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
                if (!date) return <div key={i} className="min-h-[64px]" />;
                const evs = eventosDoDia(date);
                const hasManut = evs.some(e => e.tipo === "manutencao");
                const hasInst = evs.some(e => e.tipo === "instalacao");
                const hasGoogle = evs.some(e => e.tipo === "google");
                const isSel = selectedDay && date.toDateString() === selectedDay.toDateString();
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(date)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverDay(date); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverDay(null); }}
                    onDrop={(e) => handleDrop(e, date)}
                    className={`min-h-[64px] rounded-lg border p-1 flex flex-col items-stretch justify-start transition-all relative text-left
                      ${isSel ? "border-amber-500 bg-amber-500/10" : "border-slate-800 hover:border-slate-700 hover:bg-slate-800/50"}
                      ${isToday(date) ? "ring-1 ring-amber-500/40" : ""}
                      ${dragOverDay && date && dragOverDay.toDateString() === date.toDateString() ? "ring-2 ring-amber-500 bg-amber-500/15" : ""}`}
                  >
                    <span className={`text-xs font-medium mb-1 ${isToday(date) ? "text-amber-400" : "text-slate-300"}`}>
                      {date.getDate()}
                    </span>
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      {evs.slice(0, 2).map((ev, idx) => {
                        const isManut = ev.tipo === "manutencao";
                        const isGoogle = ev.tipo === "google";
                        const isInst = !isManut && (ev.tipo === "instalacao" || (isGoogle && ev.projetoVinculado));
                        const chip = isManut ? "bg-amber-500/15 text-amber-300" : isInst ? INSTALACAO_STATUS[getInstalacaoStatus(ev)].chip : "bg-violet-500/15 text-violet-300";
                        const draggable = canDragEv(ev);
                        return (
                          <span
                            key={idx}
                            draggable={draggable}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', JSON.stringify({ tipo: ev.tipo, projetoId: ev.projetoVinculado?.id }));
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            className={`text-[9px] leading-tight px-1 py-0.5 rounded truncate ${chip} ${draggable ? "cursor-grab hover:ring-1 hover:ring-amber-500/50" : ""}`}
                            title={ev.titulo}
                          >
                            {ev.titulo}
                          </span>
                        );
                      })}
                      {evs.length > 2 && (
                        <span className="text-[9px] text-slate-500 px-1">+{evs.length - 2} mais</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Legenda */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-800 flex-wrap">
              <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                <span className="w-2 h-2 rounded-full bg-sky-400" /> Instalação Agendada
              </span>
              <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Instalada
              </span>
              <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                <span className="w-2 h-2 rounded-full bg-red-400" /> Atrasada
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  {proximosEventos.map((ev, i) => {
                    const isManut = ev.tipo === "manutencao";
                    const isGoogle = ev.tipo === "google";
                    const isInst = !isManut && (ev.tipo === "instalacao" || (isGoogle && ev.projetoVinculado));
                    const instCfg = isInst ? INSTALACAO_STATUS[getInstalacaoStatus(ev)] : null;
                    return (
                    <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-slate-800 last:border-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isManut ? "bg-amber-500/15" : isInst ? instCfg.iconBg : "bg-violet-500/15"}`}>
                        {isManut ? <Wrench size={12} className="text-amber-400" /> : isInst ? <Sun size={12} className={instCfg.iconColor} /> : <CalendarClock size={12} className="text-violet-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-white text-xs font-medium truncate">{ev.titulo}</p>
                          {(ev.projetoVinculado?.evento_orfao_google || (isManut && ev.detalhes?.evento_orfao_google)) && (
                            <AlertCircle size={10} className="text-orange-400 shrink-0" title="Evento excluído no Google Calendar" />
                          )}
                        </div>
                        <p className="text-slate-500 text-xs">{fmtData(ev.data)} · {fmtHora(ev.data)}</p>
                      </div>
                      {ev.projetoVinculado && (
                        <Link to={createPageUrl(`ProjetoDetalhe?id=${ev.projetoVinculado.id}`)} className="shrink-0 text-amber-400 hover:text-amber-300">
                          <Link2 size={12} />
                        </Link>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}