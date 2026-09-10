import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { updateCalendarEvent, deleteCalendarEvent } from '../../shared/googleCalendar.ts';

// Gerencia agendamentos de manutenção no SolarFlow.
// Para manutenções legacy com evento no Google Calendar, também atualiza/exclui
// o evento (best-effort).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, manutencao_id, data_agendamento } = await req.json();

    // DELETE: limpa data e exclui evento Google se existir
    if (action === 'delete' && manutencao_id) {
      const fresh = await base44.entities.Manutencao.get(manutencao_id);
      if (!fresh) return Response.json({ error: 'Manutenção não encontrada' }, { status: 404 });
      if (fresh.google_calendar_event_id) {
        try {
          const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
          await deleteCalendarEvent(accessToken, { eventId: fresh.google_calendar_event_id, calendarId: 'atendimento@ecomareng.com' });
        } catch (e) {
          console.warn('[manutencaoCalendar] Falha ao excluir evento Google:', e?.message);
        }
      }
      await base44.asServiceRole.entities.Manutencao.update(manutencao_id, {
        data_agendamento: null,
        google_calendar_event_id: null,
        status: 'cancelada',
        sync_origem: 'app'
      });
      return Response.json({ success: true });
    }

    // UPDATE: atualiza data no SolarFlow + Google Calendar se legacy
    if (action === 'update' && manutencao_id && data_agendamento) {
      const start = new Date(data_agendamento);
      if (isNaN(start.getTime())) return Response.json({ error: 'Data inválida' }, { status: 400 });

      await base44.asServiceRole.entities.Manutencao.update(manutencao_id, {
        data_agendamento: start.toISOString(),
        status: 'agendada',
        sync_origem: 'app'
      });

      // Legacy: atualiza evento no Google Calendar se existir
      const fresh = await base44.entities.Manutencao.get(manutencao_id);
      if (fresh?.google_calendar_event_id) {
        try {
          const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
          const end = new Date(start.getTime() + 60 * 60 * 1000);
          await updateCalendarEvent(accessToken, {
            eventId: fresh.google_calendar_event_id,
            summary: `Manutenção ${fresh.nome_cliente} [${manutencao_id}]`,
            startDateTime: start, endDateTime: end,
            calendarId: 'atendimento@ecomareng.com'
          });
        } catch (e) {
          console.warn('[manutencaoCalendar] Falha ao atualizar Google Calendar (legacy):', e?.message);
        }
      }
      return Response.json({ success: true });
    }

    // CREATE: apenas define data no SolarFlow (sem Google Calendar)
    if (action === 'create' && manutencao_id && data_agendamento) {
      const start = new Date(data_agendamento);
      if (isNaN(start.getTime())) return Response.json({ error: 'Data inválida' }, { status: 400 });
      await base44.asServiceRole.entities.Manutencao.update(manutencao_id, {
        data_agendamento: start.toISOString(),
        status: 'agendada',
        sync_origem: 'app'
      });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action or missing params' }, { status: 400 });
  } catch (error) {
    console.error('[manutencaoCalendar]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}