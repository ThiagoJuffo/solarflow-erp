import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    // Dados das entidades via service role (acesso público, sem usuário logado)
    const [manutencoes, projetos, ucs, preProjetos] = await Promise.all([
      base44.asServiceRole.entities.Manutencao.list('-created_date', 500),
      base44.asServiceRole.entities.Projeto.list('-created_date', 500),
      base44.asServiceRole.entities.UC.list('-created_date', 500),
      base44.asServiceRole.entities.PreProjeto.list('-created_date', 500),
    ]);

    // Eventos do Google Calendar via conector compartilhado (conta do builder)
    let eventosGoogle = [];
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };
      const timeMin = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
      const timeMax = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
      const calendarIds = ['primary', 'c_pqve749ida09u4nnpb1ts1ivkg@group.calendar.google.com'];
      const allEvents = [];
      for (const calIdRaw of calendarIds) {
        const calId = encodeURIComponent(calIdRaw);
        const url = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=250&singleEvents=true&orderBy=startTime`;
        const res = await fetch(url, { headers });
        if (!res.ok) continue;
        const data = await res.json();
        (data.items || []).forEach((e) => {
          allEvents.push({
            id: e.id,
            summary: e.summary || '',
            start: e.start?.dateTime || e.start?.date,
            end: e.end?.dateTime || e.end?.date,
            location: e.location || '',
            description: e.description || '',
          });
        });
      }
      const vistos = new Set();
      eventosGoogle = allEvents.filter((e) => {
        if (vistos.has(e.id)) return false;
        vistos.add(e.id);
        return true;
      });
    } catch (e) {
      // Se o Google Calendar falhar, retorna apenas os dados internos
      eventosGoogle = [];
    }

    // Resposta pública mínima: só os campos que a agenda pública exibe/usa para vincular eventos
    return Response.json({
      manutencoes: manutencoes.map((m) => ({
        id: m.id, nome_cliente: m.nome_cliente, data_agendamento: m.data_agendamento, status: m.status,
      })),
      projetos: projetos.map((p) => ({
        id: p.id, nome_cliente: p.nome_cliente, status: p.status, sistema_instalado: p.sistema_instalado,
        data_instalacao: p.data_instalacao, pre_projeto_id: p.pre_projeto_id,
        google_calendar_event_id: p.google_calendar_event_id, google_calendar_event_ids: p.google_calendar_event_ids,
      })),
      ucs: ucs.map((u) => ({ projeto_id: u.projeto_id, cidade: u.cidade })),
      preProjetos: preProjetos.map((pp) => ({ id: pp.id, projeto_id: pp.projeto_id, modulo_quantidade: pp.modulo_quantidade })),
      eventosGoogle: eventosGoogle.map((e) => ({ id: e.id, summary: e.summary, start: e.start, end: e.end })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}