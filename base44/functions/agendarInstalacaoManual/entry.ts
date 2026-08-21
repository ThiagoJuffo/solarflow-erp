import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createCalendarEvent } from '../../shared/googleCalendar.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const projetoId = body.projeto_id;
    const dataAgendamento = body.data_agendamento;
    const quantidadeDias = Math.max(1, Math.min(30, Number(body.quantidade_dias) || 1));

    if (typeof projetoId !== 'string' || projetoId.trim() === '' || projetoId.length > 200) {
      return Response.json({ error: 'ID de projeto inválido' }, { status: 400 });
    }
    if (!dataAgendamento) {
      return Response.json({ error: 'Data de agendamento obrigatória' }, { status: 400 });
    }

    // Busca no escopo do usuário (respeita RLS) — verifica acesso antes de elevar privilégio
    const fresh = await base44.entities.Projeto.get(projetoId);
    if (!fresh) return Response.json({ error: 'Projeto não encontrado ou sem acesso' }, { status: 403 });

    // Não cria outro evento se já existe um vinculado
    if (fresh.google_calendar_event_id) {
      return Response.json({ skipped: true, reason: 'already scheduled' });
    }

    const startDateTime = new Date(dataAgendamento);
    if (isNaN(startDateTime.getTime())) {
      return Response.json({ error: 'Data de agendamento inválida' }, { status: 400 });
    }
    const endDateTime = new Date(startDateTime.getTime() + quantidadeDias * 24 * 60 * 60 * 1000);

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const eventId = await createCalendarEvent(accessToken, {
      summary: `Instalação ${fresh.nome_cliente} [${projetoId}]`,
      startDateTime,
      endDateTime,
      colorId: '5',
      calendarId: 'primary'
    });

    const dataInstalacao = startDateTime.toISOString().split('T')[0];
    await base44.asServiceRole.entities.Projeto.update(projetoId, {
      google_calendar_event_id: eventId,
      data_instalacao: dataInstalacao,
    });

    return Response.json({ success: true, event_id: eventId, data_instalacao: dataInstalacao });
  } catch (error) {
    console.error('[agendarInstalacaoManual]', error);
    return Response.json({ error: 'Erro interno ao agendar instalação' }, { status: 500 });
  }
}