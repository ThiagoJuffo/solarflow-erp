import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { latitude, longitude, address } = await req.json();
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');

    let lat = latitude;
    let lng = longitude;

    // Se passado endereço, geocodifica primeiro
    if (address && (!lat || !lng)) {
      const geoRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      );
      const geoData = await geoRes.json();
      if (geoData.status !== 'OK' || !geoData.results?.length) {
        return Response.json({ error: 'Endereço não encontrado' }, { status: 404 });
      }
      lat = geoData.results[0].geometry.location.lat;
      lng = geoData.results[0].geometry.location.lng;
    }

    if (!lat || !lng) {
      return Response.json({ error: 'Coordenadas ou endereço obrigatórios' }, { status: 400 });
    }

    // Chama Google Solar API - Building Insights
    const solarRes = await fetch(
      `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=LOW&key=${apiKey}`
    );

    if (!solarRes.ok) {
      const err = await solarRes.json();
      // Solar API pode não ter dados para toda área — retornar mensagem amigável
      return Response.json({
        error: 'Google Solar API sem dados para este endereço',
        details: err.error?.message || 'Área sem cobertura da Solar API',
        lat, lng
      }, { status: 404 });
    }

    const data = await solarRes.json();

    // Extrair informações úteis
    const si = data.solarPotential;
    const roofSegments = si?.roofSegmentStats?.map(seg => ({
      pitchDegrees: seg.pitchDegrees,
      azimuthDegrees: seg.azimuthDegrees,
      stats: {
        areaMeters2: seg.stats?.areaMeters2,
        sunshineQuantiles: seg.stats?.sunshineQuantiles,
      },
      center: seg.center,
      boundingBox: seg.boundingBox,
    })) || [];

    // Melhor configuração de painéis recomendada pela Google
    const configs = si?.solarPanelConfigs || [];
    const bestConfig = configs.length > 0 ? configs[configs.length - 1] : null; // última = mais painéis
    const midConfig = configs.length > 0 ? configs[Math.floor(configs.length / 2)] : null;

    return Response.json({
      lat, lng,
      buildingArea: si?.wholeRoofStats?.areaMeters2 || null,
      maxPanelCount: si?.maxArrayPanelsCount || null,
      maxSunshineHours: si?.maxSunshineHoursPerYear || null,
      panelCapacityWatts: si?.panelCapacityWatts || 400,
      panelHeightMeters: si?.panelHeightMeters || 1.65,
      panelWidthMeters: si?.panelWidthMeters || 1.0,
      roofSegments,
      bestConfig,    // configuração com mais painéis
      midConfig,     // configuração intermediária
      allConfigsCount: configs.length,
      address: data.name || address,
      staticMapUrl: `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=20&size=600x460&maptype=satellite&key=${apiKey}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});