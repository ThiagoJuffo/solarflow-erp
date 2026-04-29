import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { endereco } = await req.json();
    if (!endereco) return Response.json({ error: 'Endereço não informado' }, { status: 400 });

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    const encoded = encodeURIComponent(endereco);
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}`
    );
    const geoData = await geoRes.json();

    if (geoData.status !== 'OK' || !geoData.results?.length) {
      return Response.json({ error: 'Endereço não encontrado no Google Maps' }, { status: 404 });
    }

    const { lat, lng } = geoData.results[0].geometry.location;
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

    return Response.json({ url: mapsUrl, lat, lng });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});