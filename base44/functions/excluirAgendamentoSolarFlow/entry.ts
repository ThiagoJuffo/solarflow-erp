import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { deleteCalendarEvent } from '../../shared/googleCalendar.ts';

// Exclui um agendamento do SolarFlow e remove eventos do Google Calendar
// se existirem (legacy). Zera todos os campos de agendamento.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const tipo = body.tipo;

    if (tipo === 'instalacao') {
      const projetoId = body.projeto_id;
      if (typeof projetoId !== 'string' || projetoId.trim() === '') {
        return Response.json({ error: 'projeto_id obrigatório' }, { status: 400 });
      }

      let fresh;
      try {
        fresh = await base44.entities.Projeto.get(projetoId);
      } catch {
        return Response.json({ error: 'Projeto não encontrado ou sem acesso' }, { status: 403 });
      }
      if (!fresh) return Response.json({ error: 'Projeto não encontrado ou sem acesso' }, { status: 403 });

      // Legacy: exclui eventos do Google Calendar se existirem
      const eventIds = new Set();
      if (fresh.google_calendar_event_id) eventIds.add(fresh.google_calendar_event_id);
      if (Array.isArray(fresh.google_calendar_event_ids)) {
        fresh.google_calendar_event_ids.forEach(id => { if (id) eventIds.add(id); });
      }
      if (Array.isArray(fresh.continuacoes)) {
        fresh.continuacoes.forEach(c => { if (c.google_calendar_event_id) eventIds.add(c.google_calendar_event_id); });
      }
      if (eventIds.size > 0) {
        try {
          const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
          for (const eventId of eventIds) {
            try {
              await deleteCalendarEvent(accessToken, { eventId, calendarId: 'primary' });
            } catch (e) {
              console.warn('[excluirAgendamentoSolarFlow] Falha ao excluir evento', eventId, e?.message);
            }
          }
        } catch (e) {
          console.warn('[excluirAgendamentoSolarFlow] Falha ao conectar Google Calendar:', e?.message);
        }
      }

      const updateData = {
        data_instalacao: null,
        google_calendar_event_id: null,
        google_calendar_event_ids: [],
        continuacoes: [],
        reagendamentos: [],
        evento_orfao_google: false,
        sync_origem: 'app'
      };
      if (fresh.status === 'instalacao_agendada') {
        updateData.status = 'aprovado';
      }

      await base44.asServiceRole.entities.Projeto.update(projetoId, updateData);
      return Response.json({ success: true });
    }

    if (tipo === 'manutencao') {
      const manutencaoId = body.manutencao_id;
      if (typeof manutencaoId !== 'string' || manutencaoId.trim() === '') {
        return Response.json({ error: 'manutencao_id obrigatório' }, { status: 400 });
      }

      let fresh;
      try {
        fresh = await base44.entities.Manutencao.get(manutencaoId);
      } catch {
        return Response.json({ error: 'Manutenção não encontrada ou sem acesso' }, { status: 403 });
      }
      if (!fresh) return Response.json({ error: 'Manutenção não encontrada ou sem acesso' }, { status: 403 });

      // Legacy: exclui evento do Google Calendar se existir
      if (fresh.google_calendar_event_id) {
        try {
          const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
          await deleteCalendarEvent(accessToken, { eventId: fresh.google_calendar_event_id, calendarId: 'atendimento@ecomareng.com' });
        } catch (e) {
          console.warn('[excluirAgendamentoSolarFlow] Falha ao excluir evento de manutenção:', e?.message);
        }
      }

      await base44.asServiceRole.entities.Manutencao.update(manutencaoId, {
        data_agendamento: null,
        google_calendar_event_id: null,
        status: 'cancelada',
        evento_orfao_google: false,
        sync_origem: 'app'
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: 'tipo inválido (use "instalacao" ou "manutencao")' }, { status: 400 });
  } catch (error) {
    console.error('[excluirAgendamentoSolarFlow]', error);
    return Response.json({ error: 'Erro interno ao excluir agendamento: ' + (error?.message || 'desconhecido') }, { status: 500 });
  }
}