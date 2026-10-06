export const CORES = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#a855f7", "#ec4899", "#06b6d4", "#84cc16"];

export const ORIENTACOES = { N: 0, NE: 45, L: 90, SE: 135, S: 180, SO: 225, O: 270, NO: 315 };

export function medidas(path) {
  const sph = window.google?.maps?.geometry?.spherical;
  if (!sph || path.length < 3) return { lados: [], areaProj: 0 };
  const lados = path.map((p, i) => sph.computeLength([p, path[(i + 1) % path.length]]));
  return { lados, areaProj: sph.computeArea(path) };
}

export function areaReal(areaProj, inclinacao) {
  const rad = (parseFloat(inclinacao) || 0) * Math.PI / 180;
  return areaProj / Math.cos(rad);
}