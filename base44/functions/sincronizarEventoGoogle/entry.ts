import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  CALENDAR_IDS,
  loadSyncableRecords,
  processGoogleEvent,
} from '../../shared/syncCalendario.ts';

// Handler do webhook do Google Calendar — sincronização incremental via syncToken
// Chamado pela plataforma (não pelo Google diretamente) quando o Google notifica mudanças
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const state = body?.data?._provider_meta?.['x-goog-resource-state'];
    if (state === 'sync') return Response.json({ status: 'sync_ack' });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Carrega registros uma vez para processar todos os eventos
    const { projetos, manutencoes, ucs } = await loadSyncableRecords(base44);

    // Processa cada calendário com seu próprio syncToken
    for (const calIdRaw of CALENDAR_IDS) {
      const calId = encodeURIComponent(calIdRaw);

      // Busca syncToken deste calendário
      const syncStates = await base44.asServiceRole.entities.SyncState.list('-updated_date', 50);
      const syncRecord = syncStates.find(s => s.calendar_id === calIdRaw);

      let url = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?maxResults=100&singleEvents=true`;
      if (syncRecord?.sync_token) {
        url += `&syncToken=${syncRecord.sync_token}`;
      } else {
        url += '&timeMin=' + new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      }

      let res = await fetch(url, { headers: authHeader });
      if (res.status === 410) {
        // syncToken expirado — sync completo
        url = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?maxResults=100&singleEvents=true&timeMin=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}`;
        res = await fetch(url, { headers: authHeader });
      }
      if (!res.ok) continue;

      // Drena todas as páginas
      const allItems = [];
      let pageData = await res.json();
      let newSyncToken = null;
      while (true) {
        allItems.push(...(pageData.items || []));
        if (pageData.nextSyncToken) newSyncToken = pageData.nextSyncToken;
        if (!pageData.nextPageToken) break;
        const nextRes = await fetch(
          url + `&pageToken=${pageData.nextPageToken}`,
          { headers: authHeader }
        );
        if (!nextRes.ok) break;
        pageData = await nextRes.json();
      }

      // Processa cada evento alterado
      for (const event of allItems) {
        try {
          await processGoogleEvent(base44, event, projetos, manutencoes, ucs);
        } catch (err) {
          console.error('[sincronizarEventoGoogle] erro ao processar evento', event.id, err);
        }
      }

      // Salva o novo syncToken
      if (newSyncToken) {
        if (syncRecord) {
          await base44.asServiceRole.entities.SyncState.update(syncRecord.id, { sync_token: newSyncToken });
        } else {
          await base44.asServiceRole.entities.SyncState.create({
            calendar_id: calIdRaw,
            sync_token: newSyncToken,
          });
        }
      }
    }

    return Response.json({ status: 'processed' });
  } catch (error) {
    console.error('[sincronizarEventoGoogle]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}