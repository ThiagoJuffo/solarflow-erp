import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { createCalendarEvent } from '../../shared/googleCalendar.ts';

// Cria uma continuação de instalação: um evento separado no Google Calendar
// em um dia não consecutivo, vinculado ao projeto original.
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
      return Response.json({ error: 'Data da continuação obrigatória' }, { status: 400 });
    }

    // Busca no escopo do usuário (respeita RLS) — verifica acesso antes de elevar privilégio
    const fresh = await base44.entities.Projeto.get(projetoId);
    if (!fresh) return Response.json({ error: 'Projeto não encontrado ou sem acesso' }, { status: 403 });

    // Precisa ter uma instalação original agendada
    if (!fresh.google_calendar_event_id && !fresh.data_instalacao) {
      return Response.json({ error: 'Projeto não possui instalação agendada' }, { status: 400 });
    }

    const startDateTime = new Date(novaData);
    if (isNaN(startDateTime.getTime())) {
      return Response.json({ error: 'Data inválida' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const summary = `Instalação ${fresh.nome_cliente} [${projetoId}] (Continuação)`;
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    const eventId = await createCalendarEvent(accessToken, {
      summary,
      startDateTime,
      endDateTime,
      colorId: '5',
      calendarId: 'primary'
    });

    const dataStr = startDateTime.toISOString().split('T')[0];
    const continuacoes = Array.isArray(fresh.continuacoes) ? [...fresh.continuacoes] : [];
    continuacoes.push({
      data: dataStr,
      google_calendar_event_id: eventId,
      concluida: false
    });

    await base44.asServiceRole.entities.Projeto.update(projetoId, {
      continuacoes,
      sync_origem: 'app'
    });

    return Response.json({ success: true, event_id: eventId, data: dataStr });
  } catch (error) {
    console.error('[agendarContinuacaoInstalacao]', error);
    return Response.json({ error: 'Erro interno ao agendar continuação' }, { status: 500 });
  }
}