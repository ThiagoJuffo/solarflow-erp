import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { deleteCalendarEvent } from '../../shared/googleCalendar.ts';

// Cancela um agendamento (instalação ou manutenção), removendo todos os eventos
// do Google Calendar e zerando os campos de agendamento para não afetar KPIs.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const tipo = body.tipo; // 'instalacao' | 'manutencao'

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

      // Coleta todos os IDs de eventos do Google Calendar (principal + multi-dia + continuações)
      const eventIds = new Set();
      if (fresh.google_calendar_event_id) eventIds.add(fresh.google_calendar_event_id);
      if (Array.isArray(fresh.google_calendar_event_ids)) {
        fresh.google_calendar_event_ids.forEach(id => { if (id) eventIds.add(id); });
      }
      if (Array.isArray(fresh.continuacoes)) {
        fresh.continuacoes.forEach(c => { if (c.google_calendar_event_id) eventIds.add(c.google_calendar_event_id); });
      }

      // Exclui todos os eventos do calendário (best-effort)
      let deleted = 0;
      if (eventIds.size > 0) {
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
        for (const eventId of eventIds) {
          try {
            await deleteCalendarEvent(accessToken, { eventId, calendarId: 'primary' });
            deleted++;
          } catch (e) {
            console.warn('[cancelarAgendamento] Falha ao excluir evento', eventId, e?.message);
          }
        }
      }

      // Zera todos os campos de agendamento
      const updateData = {
        data_instalacao: null,
        google_calendar_event_id: null,
        google_calendar_event_ids: [],
        continuacoes: [],
        reagendamentos: [],
        evento_orfao_google: false,
        sync_origem: 'app'
      };

      // Se o projeto estava em fase de instalação agendada, volta para aprovado
      if (fresh.status === 'instalacao_agendada') {
        updateData.status = 'aprovado';
      }

      await base44.asServiceRole.entities.Projeto.update(projetoId, updateData);

      return Response.json({ success: true, deletedEvents: deleted, totalEvents: eventIds.size });
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

      // Exclui o evento do calendário de manutenção
      let deleted = 0;
      if (fresh.google_calendar_event_id) {
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
        try {
          await deleteCalendarEvent(accessToken, { eventId: fresh.google_calendar_event_id, calendarId: 'atendimento@ecomareng.com' });
          deleted++;
        } catch (e) {
          console.warn('[cancelarAgendamento] Falha ao excluir evento de manutenção', e?.message);
        }
      }

      // Zera os campos de agendamento e marca como cancelada
      await base44.asServiceRole.entities.Manutencao.update(manutencaoId, {
        data_agendamento: null,
        google_calendar_event_id: null,
        status: 'cancelada',
        evento_orfao_google: false,
        sync_origem: 'app'
      });

      return Response.json({ success: true, deletedEvents: deleted });
    }

    return Response.json({ error: 'tipo inválido (use "instalacao" ou "manutencao")' }, { status: 400 });
  } catch (error) {
    console.error('[cancelarAgendamento]', error);
    return Response.json({ error: 'Erro interno ao cancelar agendamento: ' + (error?.message || 'desconhecido') }, { status: 500 });
  }
}