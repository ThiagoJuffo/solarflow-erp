import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../../shared/googleCalendar.ts';

// Gerencia agendamentos de manutenção no SolarFlow (fonte da verdade) e espelha no Google Calendar.
// Self-contained: atualiza a entidade Manutencao em todas as ações.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, manutencao_id, data_agendamento } = await req.json();

    if (!manutencao_id) return Response.json({ error: 'manutencao_id obrigatório' }, { status: 400 });

    // DELETE: limpa data + exclui evento Google + cancela
    if (action === 'delete') {
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
        data_agendamento: null, google_calendar_event_id: null,
        status: 'cancelada', sync_origem: 'app'
      });
      return Response.json({ success: true });
    }

    // UPDATE: atualiza data no SolarFlow + Google Calendar
    if (action === 'update' && data_agendamento) {
      const start = new Date(data_agendamento);
      if (isNaN(start.getTime())) return Response.json({ error: 'Data inválida' }, { status: 400 });

      await base44.asServiceRole.entities.Manutencao.update(manutencao_id, {
        data_agendamento: start.toISOString(), status: 'agendada', sync_origem: 'app'
      });

      const fresh = await base44.entities.Manutencao.get(manutencao_id);
      if (fresh?.google_calendar_event_id) {
        try {
          const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
          const end = new Date(start.getTime() + 60 * 60 * 1000);
          await updateCalendarEvent(accessToken, {
            eventId: fresh.google_calendar_event_id,
            summary: `Manutenção ${fresh.nome_cliente} [${manutencao_id}]`,
            startDateTime: start, endDateTime: end, calendarId: 'atendimento@ecomareng.com'
          });
        } catch (e) {
          console.warn('[manutencaoCalendar] Falha ao atualizar Google Calendar:', e?.message);
        }
      }
      return Response.json({ success: true });
    }

    // CREATE: define data no SolarFlow + cria evento no Google Calendar
    if (action === 'create' && data_agendamento) {
      const start = new Date(data_agendamento);
      if (isNaN(start.getTime())) return Response.json({ error: 'Data inválida' }, { status: 400 });

      const fresh = await base44.entities.Manutencao.get(manutencao_id);
      if (!fresh) return Response.json({ error: 'Manutenção não encontrada' }, { status: 404 });
      if (fresh.data_agendamento) return Response.json({ skipped: true, reason: 'already scheduled' });

      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const eventId = await createCalendarEvent(accessToken, {
        summary: `Manutenção ${fresh.nome_cliente} [${manutencao_id}]`,
        startDateTime: start, endDateTime: end, colorId: '3', calendarId: 'atendimento@ecomareng.com'
      });

      await base44.asServiceRole.entities.Manutencao.update(manutencao_id, {
        google_calendar_event_id: eventId,
        data_agendamento: start.toISOString(), status: 'agendada', sync_origem: 'app'
      });
      return Response.json({ success: true, event_id: eventId });
    }

    return Response.json({ error: 'Invalid action or missing params' }, { status: 400 });
  } catch (error) {
    console.error('[manutencaoCalendar]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}