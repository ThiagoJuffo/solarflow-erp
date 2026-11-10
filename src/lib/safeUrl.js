// Só permite links http(s) vindos de dados salvos; qualquer outro esquema (javascript:, data:) vira undefined.
export default function safeUrl(url) {
  if (typeof url !== "string") return undefined;
  const u = url.trim();
  return /^https?:\/\//i.test(u) ? u : undefined;
}