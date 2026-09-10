import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createCalendarEvent } from '../../shared/googleCalendar.ts';

// Agendamento automático de manutenção no SolarFlow + espelho no Google Calendar.
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

    const fresh = await base44.entities.Manutencao.get(manId);
    if (!fresh) return Response.json({ error: 'Manutenção não encontrada ou sem acesso' }, { status: 403 });

    if (fresh.sync_origem === 'google') return Response.json({ skipped: true, reason: 'sync_from_google' });
    // SolarFlow é a fonte da verdade: verifica data_agendamento
    if (fresh.data_agendamento) return Response.json({ skipped: true, reason: 'already scheduled' });

    const startDateTime = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    startDateTime.setHours(8, 0, 0, 0);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    // Cria evento no Google Calendar (espelho)
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const eventId = await createCalendarEvent(accessToken, {
      summary: `Manutenção ${fresh.nome_cliente} [${manId}]`,
      startDateTime, endDateTime, colorId: '3', calendarId: 'atendimento@ecomareng.com'
    });

    await base44.asServiceRole.entities.Manutencao.update(manId, {
      google_calendar_event_id: eventId,
      data_agendamento: startDateTime.toISOString(),
      status: 'agendada',
      sync_origem: 'app'
    });

    return Response.json({ success: true, event_id: eventId });
  } catch (error) {
    console.error('[agendarManutencaoAutomatica]', error);
    return Response.json({ error: 'Erro interno ao agendar manutenção' }, { status: 500 });
  }
}