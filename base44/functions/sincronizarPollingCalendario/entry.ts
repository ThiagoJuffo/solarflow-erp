import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  CALENDAR_IDS,
  loadSyncableRecords,
  findProjetoByEventId,
  findManutencaoByEventId,
  applyGoogleEventToRecord,
  markRecordAsOrphan,
  unmarkOrphan,
  extractDateFromEventStart,
} from '../../shared/syncCalendario.ts';

// Polling de segurança — executa a cada 15 min via automação agendada
// Compara todos os eventos do Google com os registros do banco e corrige divergências
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Janela ampliada: 6 meses atrás até 6 meses à frente
    const timeMin = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

    // Busca todos os eventos de todos os calendários
    const googleEventMap = new Map(); // eventId -> event
    for (const calIdRaw of CALENDAR_IDS) {
      const calId = encodeURIComponent(calIdRaw);
      const url = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=250&singleEvents=true&orderBy=startTime`;
      const res = await fetch(url, { headers: authHeader });
      if (!res.ok) continue;
      const data = await res.json();
      for (const e of (data.items || [])) {
        googleEventMap.set(e.id, e);
      }
    }

    // Carrega registros do banco
    const { projetos, manutencoes, ucs } = await loadSyncableRecords(base44);

    let updated = 0;
    let orphansMarked = 0;
    let orphansCleared = 0;

    // Reconcilia projetos
    for (const proj of projetos) {
      const eventIds = Array.isArray(proj.google_calendar_event_ids) && proj.google_calendar_event_ids.length
        ? proj.google_calendar_event_ids
        : (proj.google_calendar_event_id ? [proj.google_calendar_event_id] : []);

      if (eventIds.length === 0) continue;

      // Verifica se pelo menos o primeiro evento existe no Google
      const primaryEvent = googleEventMap.get(eventIds[0]);
      if (primaryEvent) {
        // Evento existe — aplica last-write-wins e desmarca órfão se estava marcado
        if (proj.evento_orfao_google) {
          await unmarkOrphan(base44, 'projeto', proj);
          orphansCleared++;
        }
        const result = await applyGoogleEventToRecord(base44, 'projeto', proj, primaryEvent, ucs);
        if (result.updated) updated++;
      } else {
        // Evento não encontrado no Google — marca como órfão
        if (!proj.evento_orfao_google) {
          await markRecordAsOrphan(base44, 'projeto', proj);
          orphansMarked++;
        }
      }
    }

    // Reconcilia continuaçãoes de instalação (eventos separados vinculados ao projeto)
    for (const proj of projetos) {
      if (!Array.isArray(proj.continuacoes) || proj.continuacoes.length === 0) continue;
      const continuacoesRestantes = [];
      let alterouContinuacoes = false;
      for (const cont of proj.continuacoes) {
        const contEvent = googleEventMap.get(cont.google_calendar_event_id);
        if (!contEvent) {
          // Continuação excluída no Google — remove do array (não marca projeto como órfão)
          alterouContinuacoes = true;
          continue;
        }
        const googleUpdated = new Date(contEvent.updated);
        const recordUpdated = new Date(proj.updated_date);
        if (googleUpdated > recordUpdated) {
          const dateStr = extractDateFromEventStart(contEvent);
          if (dateStr && dateStr !== cont.data) {
            continuacoesRestantes.push({ ...cont, data: dateStr });
            alterouContinuacoes = true;
            continue;
          }
        }
        continuacoesRestantes.push(cont);
      }
      if (alterouContinuacoes) {
        await base44.asServiceRole.entities.Projeto.update(proj.id, {
          continuacoes: continuacoesRestantes,
          sync_origem: 'google'
        });
        updated++;
      }
    }

    // Reconcilia manutenções
    for (const man of manutencoes) {
      if (!man.google_calendar_event_id) continue;

      const event = googleEventMap.get(man.google_calendar_event_id);
      if (event) {
        if (man.evento_orfao_google) {
          await unmarkOrphan(base44, 'manutencao', man);
          orphansCleared++;
        }
        const result = await applyGoogleEventToRecord(base44, 'manutencao', man, event, ucs);
        if (result.updated) updated++;
      } else {
        if (!man.evento_orfao_google) {
          await markRecordAsOrphan(base44, 'manutencao', man);
          orphansMarked++;
        }
      }
    }

    return Response.json({
      status: 'processed',
      google_events: googleEventMap.size,
      updated,
      orphans_marked: orphansMarked,
      orphans_cleared: orphansCleared,
    });
  } catch (error) {
    console.error('[sincronizarPollingCalendario]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}