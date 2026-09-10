import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Agendamento automático de instalação no SolarFlow (sem Google Calendar).
// Disparado por workflow quando equipamentos são confirmados.
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

    if (fresh.sync_origem === 'google') {
      return Response.json({ skipped: true, reason: 'sync_from_google' });
    }
    if (fresh.sistema_instalado || fresh.status === 'sistema_instalado' || fresh.status === 'concluido') {
      return Response.json({ skipped: true, reason: 'already_installed' });
    }
    if (!fresh.equipamentos_confirmados || !fresh.data_pagamento) {
      return Response.json({ skipped: true, reason: 'conditions not met' });
    }
    if (fresh.data_instalacao) {
      return Response.json({ skipped: true, reason: 'already scheduled' });
    }

    // 60 dias a partir da confirmação do kit
    const baseDate = fresh.equipamentos_confirmados_em ? new Date(fresh.equipamentos_confirmados_em) : new Date();
    const startDateTime = new Date(baseDate.getTime() + 60 * 24 * 60 * 60 * 1000);
    startDateTime.setHours(8, 0, 0, 0);

    const dataInstalacao = startDateTime.toISOString().split('T')[0];
    await base44.asServiceRole.entities.Projeto.update(projetoId, {
      data_instalacao: dataInstalacao,
      status: 'instalacao_agendada',
      sync_origem: 'app'
    });

    return Response.json({ success: true, data_instalacao: dataInstalacao });
  } catch (error) {
    console.error('[agendarInstalacaoAutomatica]', error);
    return Response.json({ error: 'Erro interno ao agendar instalação' }, { status: 500 });
  }
}