import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { updateCalendarEvent } from '../../shared/googleCalendar.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const projetoId = body.projeto_id;
    const novaData = body.nova_data;

    if (typeof projetoId !== 'string' || projetoId.trim() === '' || projetoId.length > 200) {
      return Response.json({ error: 'ID de projeto inválido' }, { status: 400 });
    }
    if (!novaData) {
      return Response.json({ error: 'Nova data obrigatória' }, { status: 400 });
    }

    const fresh = await base44.entities.Projeto.get(projetoId);
    if (!fresh) return Response.json({ error: 'Projeto não encontrado ou sem acesso' }, { status: 403 });

    const eventIds = Array.isArray(fresh.google_calendar_event_ids) && fresh.google_calendar_event_ids.length
      ? fresh.google_calendar_event_ids
      : (fresh.google_calendar_event_id ? [fresh.google_calendar_event_id] : []);

    if (eventIds.length === 0) {
      return Response.json({ error: 'Projeto sem evento no Google Calendar' }, { status: 400 });
    }

    const newStart = new Date(novaData);
    if (isNaN(newStart.getTime())) {
      return Response.json({ error: 'Data inválida' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    // Tenta o calendário primário e o compartilhado (evento pode estar em qualquer um)
    const calendarIds = ['primary', 'c_pqve749ida09u4nnpb1ts1ivkg@group.calendar.google.com'];

    const updateWithFallback = async (eventId, summary, dayStart, dayEnd) => {
      let lastErr;
      for (const calId of calendarIds) {
        for (const allDay of [false, true]) {
          try {
            return await updateCalendarEvent(accessToken, {
              eventId, summary, startDateTime: dayStart, endDateTime: dayEnd, calendarId: calId, allDay,
            });
          } catch (err) {
            lastErr = err;
            const msg = String(err.message || err);
            // Tenta próximo calendário apenas em 404; tenta all-day em "Invalid start time"
            if (msg.includes('HTTP 404')) break;
            if (msg.includes('Invalid start time')) continue;
            throw err;
          }
        }
      }
      throw lastErr;
    };

    for (let i = 0; i < eventIds.length; i++) {
      const dayStart = new Date(newStart.getTime() + i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 60 * 60 * 1000);
      const daySummary = eventIds.length > 1
        ? `Instalação ${fresh.nome_cliente} [${projetoId}] (Dia ${i + 1}/${eventIds.length})`
        : `Instalação ${fresh.nome_cliente} [${projetoId}]`;
      await updateWithFallback(eventIds[i], daySummary, dayStart, dayEnd);
    }

    const dataInstalacao = newStart.toISOString().split('T')[0];
    const historico = Array.isArray(fresh.reagendamentos) ? fresh.reagendamentos : [];
    historico.push({ data: new Date().toISOString() });
    await base44.asServiceRole.entities.Projeto.update(projetoId, { data_instalacao: dataInstalacao, reagendamentos: historico });

    return Response.json({ success: true, data_instalacao: dataInstalacao });
  } catch (error) {
    console.error('[reagendarInstalacao]', error);
    return Response.json({ error: 'Erro interno ao reagendar instalação' }, { status: 500 });
  }
}