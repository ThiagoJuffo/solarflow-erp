import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createCalendarEvent } from '../../shared/googleCalendar.ts';

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

    // Busca no escopo do usuário (respeita RLS) — verifica acesso antes de elevar privilégio
    const fresh = await base44.entities.Projeto.get(projetoId);
    if (!fresh) return Response.json({ error: 'Projeto não encontrado ou sem acesso' }, { status: 403 });

    // Segurança: só prossegue se kit confirmado, pagamento existe e sem evento já criado
    if (!fresh.equipamentos_confirmados || !fresh.data_pagamento) {
      return Response.json({ skipped: true, reason: 'conditions not met' });
    }
    if (fresh.google_calendar_event_id) {
      return Response.json({ skipped: true, reason: 'already scheduled' });
    }

    // 60 dias a partir da confirmação do kit (ou agora, se não houver timestamp)
    const baseDate = fresh.equipamentos_confirmados_em ? new Date(fresh.equipamentos_confirmados_em) : new Date();
    const startDateTime = new Date(baseDate.getTime() + 60 * 24 * 60 * 60 * 1000);
    startDateTime.setHours(8, 0, 0, 0);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const eventId = await createCalendarEvent(accessToken, {
      summary: `Instalação ${fresh.nome_cliente}`,
      startDateTime,
      endDateTime,
      colorId: '5',
      calendarId: 'primary'
    });

    const dataInstalacao = startDateTime.toISOString().split('T')[0];
    await base44.asServiceRole.entities.Projeto.update(projetoId, {
      google_calendar_event_id: eventId,
      data_instalacao: dataInstalacao
    });

    return Response.json({ success: true, event_id: eventId, data_instalacao: dataInstalacao });
  } catch (error) {
    console.error('[agendarInstalacaoAutomatica]', error);
    return Response.json({ error: 'Erro interno ao agendar instalação' }, { status: 500 });
  }
}