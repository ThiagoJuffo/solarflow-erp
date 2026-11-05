// Converte kWh digitado no padrão brasileiro ("4.017" ou "4.017,5") para número (4017 / 4017.5)
export function parseKwh(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).trim().replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}