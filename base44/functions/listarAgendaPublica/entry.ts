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

    return Response.json({
      manutencoes,
      projetos,
      ucs,
      preProjetos,
      eventosGoogle,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}