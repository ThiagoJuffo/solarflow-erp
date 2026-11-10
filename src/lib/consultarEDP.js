export function consultarEDP(protocolo) {
  return new Promise((resolve, reject) => {
    if (!document.documentElement.dataset.edpExtensao) return reject(new Error("Extensão EDP não instalada neste navegador"));
    const id = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
    const origin = window.location.origin;
    const h = (ev) => {
      // Aceita apenas respostas da própria página (onde o content script da extensão atua)
      if (ev.source !== window || ev.origin !== origin) return;
      if (ev.data?.type === "EDP_RESULTADO" && ev.data.id === id) {
        window.removeEventListener("message", h);
        clearTimeout(t);
        const r = ev.data.resultado;
        if (!r || typeof r !== "object") return reject(new Error("Resposta inválida da extensão EDP"));
        resolve(r);
      }
    };
    window.addEventListener("message", h);
    window.postMessage({ type: "EDP_CONSULTA", id, protocolo }, origin);
    const t = setTimeout(() => { window.removeEventListener("message", h); reject(new Error("A extensão não respondeu. Verifique se você está logado no EDP Online e tente novamente (no app publicado, fora do preview).")); }, 20000);
  });
}