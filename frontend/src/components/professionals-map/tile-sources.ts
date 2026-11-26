/**
 * Fontes de mapa do navegador (lógica pura, sem DOM — testada por
 * `npm run check-map`).
 *
 * Contexto: a CARTO passou a exigir chave nos mapas "Dark Matter"/"Positron".
 * Sem chave ela NÃO devolve erro: responde 200 com um bloco carimbado
 * "API KEY REQUIRED". Por isso não basta reagir a erro de carregamento — o app
 * confere (`keyedTilesWork`) se a chave realmente foi aceita antes de usar a CARTO.
 */

export type TileSource = {
  id: string;
  url: string;
  attribution: string;
  subdomains: string;
  /** Escurece mapas claros (tema escuro sem um mapa escuro disponível). */
  invert?: boolean;
  /** Precisa conferir se a chave foi aceita (a CARTO devolve 200 com carimbo). */
  probe?: boolean;
};

const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const CARTO_ATTR = `${OSM_ATTR} &copy; <a href="https://carto.com/attributions">CARTO</a>`;

export const OSM: TileSource = {
  id: "osm",
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: OSM_ATTR,
  subdomains: "abc",
};

/** Mapa escuro da CARTO — a chave vai em ?key= (chave grátis: carto.com/basemaps/apikey). */
export const CARTO_DARK_URL = "https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png";

export type SourceOptions = {
  isDark: boolean;
  /** Endereço de blocos de outro provedor ({key}, {apikey} ou {api_key} viram a chave). */
  customUrl?: string;
  apiKey?: string;
  customAttribution?: string;
};

/** Fontes em ordem de preferência; se uma falhar, a próxima assume. */
export function buildTileSources({ isDark, customUrl = "", apiKey = "", customAttribution = "" }: SourceOptions): TileSource[] {
  const list: TileSource[] = [];
  const key = encodeURIComponent(apiKey);

  if (customUrl) {
    list.push({
      id: "custom",
      url: customUrl.replace(/\{(key|apikey|api_key)\}/gi, key),
      attribution: customAttribution || OSM_ATTR,
      subdomains: "abc",
      invert: isDark,
    });
  }

  // Sem chave a CARTO só devolve o carimbo "API KEY REQUIRED": nem tenta.
  if (isDark && apiKey) {
    list.push({
      id: "carto-dark",
      url: `${CARTO_DARK_URL}?key=${key}`,
      attribution: CARTO_ATTR,
      subdomains: "abc",
      probe: true,
    });
  }

  // Último recurso, sem chave: OpenStreetMap (escurecido no tema escuro).
  list.push(isDark ? { ...OSM, id: "osm-dark", invert: true } : OSM);
  return list;
}

/** Mesma URL sem o parâmetro key. */
export function withoutKey(url: string): string {
  return url
    .replace(/([?&])key=[^&]*&?/i, "$1")
    .replace(/[?&]$/, "");
}

const fillTile = (url: string) =>
  url.replace("{z}", "3").replace("{x}", "2").replace("{y}", "3").replace("{s}", "a").replace("{r}", "");

function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  arrayBuffer: () => Promise<ArrayBuffer>;
}>;

/**
 * A chave foi aceita? Compara o mesmo bloco pedido COM e SEM a chave: se vierem
 * idênticos, a chave foi ignorada (os dois são o carimbo "API KEY REQUIRED").
 * Se não der para verificar (rede, CORS, tempo esgotado), assume que está certo
 * e deixa o carregamento normal (com fallback por erro) decidir.
 */
export async function keyedTilesWork(
  source: TileSource,
  fetchFn: FetchLike = (u, i) => fetch(u, i) as any,
  timeoutMs = 5000
): Promise<boolean> {
  const get = async (url: string) => {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const res = await fetchFn(url, controller ? { signal: controller.signal } : undefined);
      if (!res.ok) return { ok: false as const };
      return { ok: true as const, bytes: new Uint8Array(await res.arrayBuffer()) };
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  try {
    const keyed = await get(fillTile(source.url));
    if (!keyed.ok) return false; // com a chave o servidor recusou
    const bare = await get(fillTile(withoutKey(source.url)));
    if (!bare.ok) return true; // sem chave nem responde: a chave basta
    return !sameBytes(keyed.bytes, bare.bytes);
  } catch {
    return true; // não deu para verificar
  }
}
