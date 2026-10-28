export function consultarEDP(protocolo) {
  return new Promise((resolve, reject) => {
    if (!document.documentElement.dataset.edpExtensao) return reject(new Error("Extensão EDP não instalada neste navegador"));
    const id = Math.random().toString(36).slice(2);
    const h = (ev) => {
      if (ev.data?.type === "EDP_RESULTADO" && ev.data.id === id) {
        window.removeEventListener("message", h);
        clearTimeout(t);
        resolve(ev.data.resultado);
      }
    };
    window.addEventListener("message", h);
    window.postMessage({ type: "EDP_CONSULTA", id, protocolo }, "*");
    const t = setTimeout(() => { window.removeEventListener("message", h); reject(new Error("Tempo esgotado")); }, 60000);
  });
}