import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createCalendarEvent } from '../../shared/googleCalendar.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const manId = body.event?.entity_id || body.data?.id;

    if (typeof manId !== 'string' || manId.trim() === '' || manId.length > 200) {
      return Response.json({ error: 'ID de manutenção inválido' }, { status: 400 });
    }

    // Busca no escopo do usuário (respeita RLS) — verifica acesso antes de elevar privilégio
    const fresh = await base44.entities.Manutencao.get(manId);
    if (!fresh) return Response.json({ error: 'Manutenção não encontrada ou sem acesso' }, { status: 403 });

    // Segurança: não reagenda se já tem evento vinculado
    if (fresh.google_calendar_event_id) {
      return Response.json({ skipped: true, reason: 'already scheduled' });
    }

    // 2 semanas a partir de agora
    const startDateTime = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    startDateTime.setHours(8, 0, 0, 0);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const eventId = await createCalendarEvent(accessToken, {
      summary: `Manutenção ${fresh.nome_cliente}`,
      startDateTime,
      endDateTime,
      colorId: '3',
      calendarId: 'primary'
    });

    await base44.asServiceRole.entities.Manutencao.update(manId, {
      google_calendar_event_id: eventId,
      data_agendamento: startDateTime.toISOString(),
      status: 'agendada'
    });

    return Response.json({ success: true, event_id: eventId });
  } catch (error) {
    console.error('[agendarManutencaoAutomatica]', error);
    return Response.json({ error: 'Erro interno ao agendar manutenção' }, { status: 500 });
  }
}