import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

let loadPromise = null;

function loadMaps() {
  if (window.google?.maps?.geometry && window.google?.maps?.places) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = base44.functions.invoke("getMapsKey", {}).then(res => new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${res.data.key}&libraries=places,geometry&language=pt-BR`;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    }));
  }
  return loadPromise;
}

export default function useGoogleMaps() {
  const [ready, setReady] = useState(!!window.google?.maps?.geometry);
  useEffect(() => { loadMaps().then(() => setReady(true)); }, []);
  return ready;
}