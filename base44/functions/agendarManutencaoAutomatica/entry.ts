import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Agendamento automático de manutenção no SolarFlow (sem Google Calendar).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const manId = body.event?.entity_id || body.data?.id;

    if (typeof manId !== 'string' || manId.trim() === '' || manId.length > 200) {
      return Response.json({ error: 'ID de manutenção inválido' }, { status: 400 });
    }

    const fresh = await base44.entities.Manutencao.get(manId);
    if (!fresh) return Response.json({ error: 'Manutenção não encontrada ou sem acesso' }, { status: 403 });

    if (fresh.sync_origem === 'google') {
      return Response.json({ skipped: true, reason: 'sync_from_google' });
    }
    if (fresh.data_agendamento) {
      return Response.json({ skipped: true, reason: 'already scheduled' });
    }

    // 2 semanas a partir de agora
    const startDateTime = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    startDateTime.setHours(8, 0, 0, 0);

    await base44.asServiceRole.entities.Manutencao.update(manId, {
      data_agendamento: startDateTime.toISOString(),
      status: 'agendada',
      sync_origem: 'app'
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('[agendarManutencaoAutomatica]', error);
    return Response.json({ error: 'Erro interno ao agendar manutenção' }, { status: 500 });
  }
}