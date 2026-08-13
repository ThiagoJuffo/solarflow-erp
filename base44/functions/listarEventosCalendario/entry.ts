import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    const calendarId = encodeURIComponent('atendimento@ecomareng.com');
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

    const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=250&singleEvents=true&orderBy=startTime`;

    const res = await fetch(url, { headers });
    const data = await res.json();

    if (!res.ok) return Response.json({ error: data }, { status: res.status });

    const events = (data.items || []).map(e => ({
      id: e.id,
      summary: e.summary || '',
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      location: e.location || '',
      description: e.description || '',
      colorId: e.colorId || '',
    }));

    return Response.json({ events, calendar: 'atendimento@ecomareng.com' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}