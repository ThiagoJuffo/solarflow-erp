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

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const summary = `Instalação ${fresh.nome_cliente} [${projetoId}]`;

    // Cria um evento por dia quando a instalação dura mais de 1 dia
    const eventIds = [];
    for (let i = 0; i < quantidadeDias; i++) {
      const dayStart = new Date(startDateTime.getTime() + i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 60 * 60 * 1000);
      const daySummary = quantidadeDias > 1 ? `${summary} (Dia ${i + 1}/${quantidadeDias})` : summary;
      const eventId = await createCalendarEvent(accessToken, {
        summary: daySummary,
        startDateTime: dayStart,
        endDateTime: dayEnd,
        colorId: '5',
        calendarId: 'primary'
      });
      eventIds.push(eventId);
    }

    const dataInstalacao = startDateTime.toISOString().split('T')[0];
    const updateData = {
      google_calendar_event_id: eventIds[0],
      data_instalacao: dataInstalacao,
    };
    if (quantidadeDias > 1) {
      updateData.google_calendar_event_ids = eventIds;
    }
    // Avança o status para "instalacao_agendada" se o projeto ainda está em fase anterior
    const PRE_INSTALACAO = ['pago_projeto_iniciado','kit_confirmado','documentos_gerados','assinaturas_pendentes','assinaturas_concluidas','dossie_ok','protocolado_edp','aguardando_aprovacao','aprovado'];
    if (PRE_INSTALACAO.includes(fresh.status)) {
      updateData.status = 'instalacao_agendada';
    }
    await base44.asServiceRole.entities.Projeto.update(projetoId, updateData);

    return Response.json({ success: true, event_id: eventIds[0], event_ids: eventIds, data_instalacao: dataInstalacao });
  } catch (error) {
    console.error('[agendarInstalacaoManual]', error);
    return Response.json({ error: 'Erro interno ao agendar instalação' }, { status: 500 });
  }
}