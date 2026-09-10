import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createCalendarEvent } from '../../shared/googleCalendar.ts';

// Agendamento automático de instalação no SolarFlow + espelho no Google Calendar.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const projetoId = body.event?.entity_id || body.data?.id;

    if (typeof projetoId !== 'string' || projetoId.trim() === '' || projetoId.length > 200) {
      return Response.json({ error: 'ID de projeto inválido' }, { status: 400 });
    }

    const fresh = await base44.entities.Projeto.get(projetoId);
    if (!fresh) return Response.json({ error: 'Projeto não encontrado ou sem acesso' }, { status: 403 });

    if (fresh.sync_origem === 'google') return Response.json({ skipped: true, reason: 'sync_from_google' });
    if (fresh.sistema_instalado || fresh.status === 'sistema_instalado' || fresh.status === 'concluido') {
      return Response.json({ skipped: true, reason: 'already_installed' });
    }
    if (!fresh.equipamentos_confirmados || !fresh.data_pagamento) {
      return Response.json({ skipped: true, reason: 'conditions not met' });
    }
    // SolarFlow é a fonte da verdade: verifica data_instalacao
    if (fresh.data_instalacao) return Response.json({ skipped: true, reason: 'already scheduled' });

    const baseDate = fresh.equipamentos_confirmados_em ? new Date(fresh.equipamentos_confirmados_em) : new Date();
    const startDateTime = new Date(baseDate.getTime() + 60 * 24 * 60 * 60 * 1000);
    startDateTime.setHours(8, 0, 0, 0);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    // Cria evento no Google Calendar (espelho)
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const eventId = await createCalendarEvent(accessToken, {
      summary: `Instalação ${fresh.nome_cliente} [${projetoId}]`,
      startDateTime, endDateTime, colorId: '5', calendarId: 'primary'
    });

    const dataInstalacao = startDateTime.toISOString().split('T')[0];
    await base44.asServiceRole.entities.Projeto.update(projetoId, {
      google_calendar_event_id: eventId,
      data_instalacao: dataInstalacao,
      status: 'instalacao_agendada',
      sync_origem: 'app'
    });

    return Response.json({ success: true, event_id: eventId, data_instalacao: dataInstalacao });
  } catch (error) {
    console.error('[agendarInstalacaoAutomatica]', error);
    return Response.json({ error: 'Erro interno ao agendar instalação' }, { status: 500 });
  }
}