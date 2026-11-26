import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { DEFAULT_CENTER, type ProfessionalsMapProps } from "./types";
import { buildTileSources, keyedTilesWork } from "./tile-sources";

const CUSTOM_TILES_URL = (process.env.EXPO_PUBLIC_MAP_TILES_URL || "").trim();
const MAP_API_KEY = (process.env.EXPO_PUBLIC_MAP_API_KEY || "").trim();
const CUSTOM_ATTRIBUTION = (process.env.EXPO_PUBLIC_MAP_ATTRIBUTION || "").trim();

function pinHtml(initial: string, bg: string, fg: string, ring: string, selected: boolean) {
  const size = selected ? 42 : 34;
  // Texto vem do nome do profissional: precisa ser escapado antes de virar HTML.
  const safe = initial.replace(/[&<>"']/g, "");
  return (
    `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:${fg};` +
    `border:3px solid ${ring};display:flex;align-items:center;justify-content:center;` +
    `font:700 ${selected ? 17 : 14}px system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35)">${safe}</div>` // theme-ok: sombra do pino (preta nos dois temas)
  );
}

export function ProfessionalsMap({ professionals, selectedId, onSelect, isDark, colors, testID }: ProfessionalsMapProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // 1) cria o mapa uma única vez
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { zoomControl: true }).setView(
      [DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude],
      13
    );
    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);

    // O contêiner pode ganhar tamanho depois do primeiro desenho (layout flex).
    const resize = () => map.invalidateSize();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(elRef.current);
    const timer = setTimeout(resize, 150);

    return () => {
      clearTimeout(timer);
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      markersRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  // Controles do Leaflet (zoom e créditos) acompanham o tema do app.
  useEffect(() => {
    const id = "tealyze-leaflet-theme";
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = `
      .leaflet-bar a, .leaflet-bar a:hover { background-color: ${colors.surfaceSecondary}; color: ${colors.onSurface}; border-bottom-color: ${colors.border}; }
      .leaflet-bar { border: 1px solid ${colors.borderStrong}; box-shadow: none; }
      .leaflet-bar a.leaflet-disabled { background-color: ${colors.surfaceTertiary}; color: ${colors.muted}; }
      .leaflet-control-attribution { background: ${colors.surfaceSecondary}CC !important; color: ${colors.muted} !important; }
      .leaflet-control-attribution a { color: ${colors.brandPrimary} !important; }
      .tealyze-pin { background: transparent; border: none; }
      .tealyze-invert .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.92); }
    `;
  }, [colors]);

  // 2) camada de mapa: troca quando o tema muda e cai para a próxima fonte se esta falhar
  useEffect(() => {
    const map = mapRef.current;
    const container = elRef.current;
    if (!map || !container) return;
    const sources = buildTileSources({
      isDark,
      customUrl: CUSTOM_TILES_URL,
      apiKey: MAP_API_KEY,
      customAttribution: CUSTOM_ATTRIBUTION,
    });
    let cancelled = false;
    let index = 0;
    let errors = 0;
    let loads = 0;

    const apply = () => {
      tileRef.current?.remove();
      const cfg = sources[index];
      container.classList.toggle("tealyze-invert", !!cfg.invert);
      const layer = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        subdomains: cfg.subdomains,
        maxZoom: 19,
      }).addTo(map);
      layer.on("tileload", () => {
        loads += 1;
      });
      layer.on("tileerror", () => {
        if (tileRef.current !== layer) return; // erro de uma camada que já saiu
        errors += 1;
        // Nenhum bloco carregou e vários falharam: serviço fora do ar, chave recusada...
        if (loads === 0 && errors >= 4 && index < sources.length - 1) {
          index += 1;
          errors = 0;
          loads = 0;
          apply();
        }
      });
      tileRef.current = layer;
    };

    (async () => {
      // A CARTO responde 200 com o carimbo "API KEY REQUIRED" quando a chave não vale:
      // confere antes de mostrar, para o aviso nunca aparecer no mapa.
      while (index < sources.length - 1 && sources[index].probe && !(await keyedTilesWork(sources[index]))) {
        index += 1;
      }
      if (!cancelled) apply();
    })();

    return () => {
      cancelled = true;
      tileRef.current?.remove();
      tileRef.current = null;
      container.classList.remove("tealyze-invert");
    };
  }, [isDark]);

  // 3) marcadores (refeitos quando a lista, a seleção ou as cores mudam)
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const points: L.LatLngExpression[] = [];
    professionals.forEach((p) => {
      const selected = p.id === selectedId;
      const size = selected ? 42 : 34;
      const icon = L.divIcon({
        className: "tealyze-pin",
        html: pinHtml(
          (p.name || "?").charAt(0).toUpperCase(),
          selected ? colors.success : colors.brandPrimary,
          selected ? colors.onSuccess : colors.onBrandPrimary,
          colors.surfaceSecondary,
          selected
        ),
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const marker = L.marker([p.latitude, p.longitude], {
        icon,
        title: p.name,
        alt: p.name,
        keyboard: true,
        zIndexOffset: selected ? 1000 : 0,
      });
      marker.on("click", () => onSelectRef.current(p.id));
      marker.addTo(layer);
      points.push([p.latitude, p.longitude]);
    });

    // Enquadra todos os profissionais na primeira vez que a lista chega.
    if (!fittedRef.current && points.length) {
      fittedRef.current = true;
      if (points.length === 1) map.setView(points[0], 14);
      else map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15 });
    }
  }, [professionals, selectedId, colors]);

  // 4) ao escolher um profissional (lista de cartões), o mapa vai até ele
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const p = professionals.find((x) => x.id === selectedId);
    if (p) map.panTo([p.latitude, p.longitude], { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div
      ref={elRef}
      data-testid={testID}
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, background: colors.surfaceTertiary }}
    />
  );
}

export default ProfessionalsMap;
