import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, manutencao_id, nome_cliente, data_agendamento, event_id } = await req.json();

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    // DELETE event
    if (action === 'delete' && event_id) {
      const del = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/projetos%40ecomareng.com/events/${event_id}`,
        { method: 'DELETE', headers }
      );
      if (del.status === 204 || del.status === 404) {
        return Response.json({ success: true });
      }
      const err = await del.text();
      return Response.json({ error: err }, { status: del.status });
    }

    // CREATE event
    if (action === 'create' && nome_cliente && data_agendamento) {
      const start = new Date(data_agendamento);
      const end = new Date(start.getTime() + 60 * 60 * 1000); // +1h

      const event = {
        summary: `Manutenção ${nome_cliente}`,
        colorId: '3', // grape/roxo no Google Calendar
        start: { dateTime: start.toISOString(), timeZone: 'America/Sao_Paulo' },
        end: { dateTime: end.toISOString(), timeZone: 'America/Sao_Paulo' }
      };

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/projetos%40ecomareng.com/events`,
        { method: 'POST', headers, body: JSON.stringify(event) }
      );
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data }, { status: res.status });
      return Response.json({ event_id: data.id });
    }

    return Response.json({ error: 'Invalid action or missing params' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});