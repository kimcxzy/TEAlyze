// -----------------------------------------------------------------------
// Testa a escolha das fontes do mapa web (src/components/professionals-map/tile-sources.ts)
// com respostas simuladas — não usa internet nem navegador.
//
// Uso:  npm run check-map
// -----------------------------------------------------------------------
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "components", "professionals-map", "tile-sources.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function("module", "exports", js)(mod, mod.exports);
const { buildTileSources, withoutKey, keyedTilesWork } = mod.exports;

const KEY = "cb1_4wzc_1_fa32b05d3497a81fdcf3b84e";
const results = [];
async function check(name, fn) {
  try { await fn(); results.push(`  ok   ${name}`); } catch (e) { results.push(`  FAIL ${name}: ${e.message}`); process.exitCode = 1; }
}
const ids = (list) => list.map((s) => s.id).join(" > ");
const bytes = (...n) => new Uint8Array(n).buffer;
const reply = (ok, buf) => ({ ok, arrayBuffer: async () => buf });

(async () => {
  // ---- escolha das fontes
  await check("claro sem chave: só OpenStreetMap", () => assert.strictEqual(ids(buildTileSources({ isDark: false })), "osm"));
  await check("claro com chave: continua OpenStreetMap (CARTO só no escuro)", () => assert.strictEqual(ids(buildTileSources({ isDark: false, apiKey: KEY })), "osm"));
  await check("escuro SEM chave: nunca usa a CARTO (evita o carimbo) — OSM escurecido", () => {
    const l = buildTileSources({ isDark: true });
    assert.strictEqual(ids(l), "osm-dark");
    assert.strictEqual(l[0].invert, true);
    assert.ok(!l.some((s) => /cartocdn/.test(s.url)));
  });
  await check("escuro COM chave: CARTO com ?key= e depois OSM escurecido", () => {
    const l = buildTileSources({ isDark: true, apiKey: KEY });
    assert.strictEqual(ids(l), "carto-dark > osm-dark");
    assert.strictEqual(l[0].url, `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${KEY}`);
    assert.strictEqual(l[0].probe, true);
    assert.ok(!l[0].invert);
  });
  await check("não usa mais o endereço antigo sem chave ({s}.basemaps.../dark_all/)", () => {
    const all = [false, true].flatMap((d) => buildTileSources({ isDark: d, apiKey: KEY }));
    assert.ok(!all.some((s) => /\{s\}\.basemaps\.cartocdn\.com\/dark_all/.test(s.url)));
  });
  await check("provedor próprio: {key}/{apikey}/{api_key} viram a chave (codificada)", () => {
    for (const ph of ["{key}", "{apikey}", "{api_key}", "{KEY}"]) {
      const l = buildTileSources({ isDark: false, customUrl: `https://x.test/{z}/{x}/{y}.png?k=${ph}`, apiKey: "a b/c" });
      assert.strictEqual(l[0].url, "https://x.test/{z}/{x}/{y}.png?k=a%20b%2Fc", ph);
    }
  });
  await check("provedor próprio no escuro: custom (escurecido) > CARTO > OSM escurecido", () => {
    assert.strictEqual(ids(buildTileSources({ isDark: true, customUrl: "https://x.test/{z}/{x}/{y}.png?key={key}", apiKey: KEY })), "custom > carto-dark > osm-dark");
  });

  // ---- remoção da chave
  await check("withoutKey remove só o parâmetro key", () => {
    assert.strictEqual(withoutKey("https://h/{z}/{x}/{y}.png?key=abc"), "https://h/{z}/{x}/{y}.png");
    assert.strictEqual(withoutKey("https://h/t.png?a=1&key=abc&b=2"), "https://h/t.png?a=1&b=2");
    assert.strictEqual(withoutKey("https://h/t.png?key=abc&b=2"), "https://h/t.png?b=2");
    assert.strictEqual(withoutKey("https://h/t.png"), "https://h/t.png");
  });

  // ---- conferência da chave (o caso do seu print)
  const src = buildTileSources({ isDark: true, apiKey: KEY })[0];
  const WATERMARK = bytes(1, 2, 3, 4), REAL = bytes(9, 8, 7, 6, 5);
  await check("chave aceita: bloco com chave difere do carimbo -> usa a CARTO", async () => {
    const calls = [];
    const f = async (u) => { calls.push(u); return u.includes("key=") ? reply(true, REAL) : reply(true, WATERMARK); };
    assert.strictEqual(await keyedTilesWork(src, f), true);
    assert.ok(calls[0].includes(`key=${KEY}`) && calls[0].includes("/3/2/3.png"), calls[0]);
    assert.ok(!calls[1].includes("key="), calls[1]);
  });
  await check("chave IGNORADA (bloco idêntico ao carimbo) -> não usa a CARTO", async () => {
    assert.strictEqual(await keyedTilesWork(src, async () => reply(true, WATERMARK)), false);
  });
  await check("servidor recusa a chave (403/401) -> não usa a CARTO", async () => {
    assert.strictEqual(await keyedTilesWork(src, async () => reply(false, bytes())), false);
  });
  await check("sem chave nem responde, com chave responde -> usa a CARTO", async () => {
    assert.strictEqual(await keyedTilesWork(src, async (u) => (u.includes("key=") ? reply(true, REAL) : reply(false, bytes()))), true);
  });
  await check("não deu para verificar (rede/CORS) -> segue com a CARTO e deixa o fallback por erro agir", async () => {
    assert.strictEqual(await keyedTilesWork(src, async () => { throw new TypeError("Failed to fetch"); }), true);
  });
  await check("tempo esgotado é tratado como 'não deu para verificar'", async () => {
    const slow = (u, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(new Error("aborted"))));
    assert.strictEqual(await keyedTilesWork(src, slow, 50), true);
  });

  console.log("Teste das fontes do mapa web (respostas simuladas):\n");
  results.forEach((l) => console.log(l));
  const bad = results.filter((l) => l.includes("FAIL")).length;
  console.log(`\n${results.length - bad}/${results.length} verificações passaram.\n`);
})();
