import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    // Janela ampliada: 6 meses atrás até 6 meses à frente
    const timeMin = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

    // Calendário compartilhado pela proprietária (Gabriela) com a conta projetos@ecomareng.com
    // Calendário compartilhado pela proprietária (Gabriela) + primário da conta
    const calendarIds = ['gabriela@ecomareng.com', 'primary'];
    const allEvents = [];

    for (const calIdRaw of calendarIds) {
      const calId = encodeURIComponent(calIdRaw);
      const url = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=250&singleEvents=true&orderBy=startTime`;
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const data = await res.json();
      (data.items || []).forEach(e => {
        allEvents.push({
          id: e.id,
          summary: e.summary || '',
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
          location: e.location || '',
          description: e.description || '',
          colorId: e.colorId || '',
          calendar_id: calIdRaw,
        });
      });
    }

    // Deduplica por ID (mesmo evento pode aparecer em múltiplos calendários)
    const vistos = new Set();
    const eventos = allEvents.filter(e => {
      if (vistos.has(e.id)) return false;
      vistos.add(e.id);
      return true;
    });

    return Response.json({ events: eventos });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}