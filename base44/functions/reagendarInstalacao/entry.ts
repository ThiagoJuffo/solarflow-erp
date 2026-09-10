import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { updateCalendarEvent } from '../../shared/googleCalendar.ts';

// Reagenda uma instalação no SolarFlow (fonte da verdade) e atualiza o espelho no Google Calendar.
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

    // SolarFlow é a fonte da verdade: verifica data_instalacao
    if (!fresh.data_instalacao) {
      return Response.json({ error: 'Projeto sem instalação agendada' }, { status: 400 });
    }

    const newStart = new Date(novaData);
    if (isNaN(newStart.getTime())) {
      return Response.json({ error: 'Data inválida' }, { status: 400 });
    }

    // Atualiza eventos no Google Calendar (espelho) — best-effort
    const eventIds = Array.isArray(fresh.google_calendar_event_ids) && fresh.google_calendar_event_ids.length
      ? fresh.google_calendar_event_ids
      : (fresh.google_calendar_event_id ? [fresh.google_calendar_event_id] : []);

    if (eventIds.length > 0) {
      try {
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
        const calendarIds = ['primary', 'c_pqve749ida09u4nnpb1ts1ivkg@group.calendar.google.com'];
        for (let i = 0; i < eventIds.length; i++) {
          const dayStart = new Date(newStart.getTime() + i * 24 * 60 * 60 * 1000);
          const dayEnd = new Date(dayStart.getTime() + 60 * 60 * 1000);
          const daySummary = eventIds.length > 1
            ? `Instalação ${fresh.nome_cliente} [${projetoId}] (Dia ${i + 1}/${eventIds.length})`
            : `Instalação ${fresh.nome_cliente} [${projetoId}]`;
          for (const calId of calendarIds) {
            try {
              await updateCalendarEvent(accessToken, {
                eventId: eventIds[i], summary: daySummary,
                startDateTime: dayStart, endDateTime: dayEnd, calendarId: calId
              });
              break;
            } catch (err) {
              if (String(err.message || err).includes('HTTP 404')) break;
            }
          }
        }
      } catch (e) {
        console.warn('[reagendarInstalacao] Falha ao atualizar Google Calendar:', e?.message);
      }
    }

    // Atualiza continuações no Google Calendar (shift pelo mesmo delta)
    if (Array.isArray(fresh.continuacoes) && fresh.continuacoes.length > 0) {
      const oldStart = new Date(fresh.data_instalacao + 'T12:00:00');
      const deltaDays = Math.round((newStart.getTime() - oldStart.getTime()) / (24 * 60 * 60 * 1000));
      try {
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
        for (const cont of fresh.continuacoes) {
          if (!cont.google_calendar_event_id) continue;
          const oldContDate = new Date(cont.data + 'T12:00:00');
          const newContDate = new Date(oldContDate.getTime() + deltaDays * 24 * 60 * 60 * 1000);
          const newContEnd = new Date(newContDate.getTime() + 60 * 60 * 1000);
          try {
            await updateCalendarEvent(accessToken, {
              eventId: cont.google_calendar_event_id,
              summary: `Instalação ${fresh.nome_cliente} [${projetoId}] (Continuação)`,
              startDateTime: newContDate, endDateTime: newContEnd, calendarId: 'primary'
            });
          } catch (e) {
            console.warn('[reagendarInstalacao] Falha ao atualizar continuação:', e?.message);
          }
        }
      } catch (e) {
        console.warn('[reagendarInstalacao] Falha ao conectar Google Calendar:', e?.message);
      }
    }

    const dataInstalacao = newStart.toISOString().split('T')[0];
    const historico = Array.isArray(fresh.reagendamentos) ? fresh.reagendamentos : [];
    historico.push({ data: new Date().toISOString() });

    const updateData = {
      data_instalacao: dataInstalacao,
      reagendamentos: historico,
      sync_origem: 'app'
    };

    // Shift continuações no SolarFlow pelo mesmo delta
    if (Array.isArray(fresh.continuacoes) && fresh.continuacoes.length > 0) {
      const oldStart = new Date(fresh.data_instalacao + 'T12:00:00');
      const deltaDays = Math.round((newStart.getTime() - oldStart.getTime()) / (24 * 60 * 60 * 1000));
      updateData.continuacoes = fresh.continuacoes.map(c => {
        const oldDate = new Date(c.data + 'T12:00:00');
        const newDate = new Date(oldDate.getTime() + deltaDays * 24 * 60 * 60 * 1000);
        return { ...c, data: newDate.toISOString().split('T')[0] };
      });
    }

    await base44.asServiceRole.entities.Projeto.update(projetoId, updateData);
    return Response.json({ success: true, data_instalacao: dataInstalacao });
  } catch (error) {
    console.error('[reagendarInstalacao]', error);
    return Response.json({ error: 'Erro interno ao reagendar instalação' }, { status: 500 });
  }
}