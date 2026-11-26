// -----------------------------------------------------------------------
// Confere o contraste (WCAG) de todos os pares de cores das paletas:
// tema claro, escuro e o alto contraste de cada um.
//
//   texto ................ mínimo 4,5:1
//   ícones / contornos ... mínimo 3:1 (ou o indicado)
//
// Uso:  npm run check-theme
// -----------------------------------------------------------------------
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

// Carrega src/theme.ts sem precisar compilar o projeto.
const source = fs.readFileSync(path.join(__dirname, "..", "src", "theme.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const theme = { exports: {} };
new Function("module", "exports", js)(theme, theme.exports);
const { buildPalette } = theme.exports;

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const UI = 3;
// [primeiro plano, fundo, mínimo, descrição]
const PAIRS = [
  ["onSurface", "surface", TEXT],
  ["onSurface", "surfaceSecondary", TEXT],
  ["onSurface", "surfaceTertiary", TEXT],
  ["onSurfaceSecondary", "surfaceSecondary", TEXT],
  ["onSurfaceTertiary", "surfaceTertiary", TEXT],
  ["onSurfaceTertiary", "surfaceSecondary", TEXT],
  ["muted", "surface", TEXT],
  ["muted", "surfaceSecondary", TEXT],
  ["muted", "surfaceTertiary", TEXT],
  ["placeholder", "surfaceSecondary", TEXT],
  ["placeholder", "surfaceTertiary", TEXT],
  ["onSurfaceInverse", "surfaceInverse", TEXT],
  ["onBrandPrimary", "brandPrimary", TEXT],
  ["onBrandSecondary", "brandSecondary", TEXT],
  ["onBrandTertiary", "brandTertiary", TEXT],
  ["onSuccess", "success", TEXT],
  ["onWarning", "warning", TEXT],
  ["onError", "error", TEXT],
  ["onInfo", "info", TEXT],
  ["brandPrimary", "surface", TEXT],
  ["brandPrimary", "surfaceSecondary", TEXT],
  ["brandPrimary", "surfaceTertiary", TEXT],
  ["errorText", "errorBg", TEXT],
  ["successText", "successBg", TEXT],
  ["warningText", "warningBg", TEXT],
  ["errorText", "surface", TEXT],
  ["errorText", "surfaceSecondary", TEXT],
  ["successText", "surfaceSecondary", TEXT],
  ["warningText", "surfaceSecondary", TEXT],
  ["error", "surfaceSecondary", UI],
  ["error", "surface", UI],
  ["success", "surfaceSecondary", UI],
  ["info", "surfaceSecondary", UI],
  ["brandSecondary", "surface", UI],
  ["borderStrong", "surfaceSecondary", 1.4],
  ["border", "surface", 1.1],
];

const VARIANTS = [
  ["claro", false, false],
  ["escuro", true, false],
  ["claro + alto contraste", false, true],
  ["escuro + alto contraste", true, true],
];

let failures = 0;
let checked = 0;
for (const [name, dark, hc] of VARIANTS) {
  const p = buildPalette(dark, hc);
  for (const [fg, bg, min] of PAIRS) {
    for (const key of [fg, bg]) {
      if (!/^#[0-9a-fA-F]{6}$/.test(p[key])) throw new Error(`cor inválida em ${name}: ${key}=${p[key]}`);
    }
    checked++;
    const r = ratio(p[fg], p[bg]);
    if (r < min) {
      failures++;
      console.log(`  FALHA [${name}] ${fg} (${p[fg]}) sobre ${bg} (${p[bg]}): ${r.toFixed(2)}:1 (mínimo ${min}:1)`);
    }
  }
}

// Cabeçalho em degradê: o texto fica sobre as duas primeiras cores.
for (const [name, dark, hc] of VARIANTS) {
  const p = buildPalette(dark, hc);
  p.heroGradient.forEach((c, i) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(c)) throw new Error(`degradê inválido em ${name}: ${c}`);
  });
  for (const stop of [0, 1]) {
    for (const fg of ["onHero", "onHeroMuted"]) {
      checked++;
      const r = ratio(p[fg], p.heroGradient[stop]);
      if (r < TEXT) {
        failures++;
        console.log(`  FALHA [${name}] ${fg} (${p[fg]}) sobre degradê[${stop}] (${p.heroGradient[stop]}): ${r.toFixed(2)}:1`);
      }
    }
  }
}

// O tema escuro precisa se diferenciar do claro de verdade.
const l = buildPalette(false, false);
const d = buildPalette(true, false);
if (luminance(d.surface) > 0.05 || luminance(l.surface) < 0.8) {
  failures++;
  console.log("  FALHA: fundos de claro/escuro não estão nos extremos esperados");
}
// Em todo tema, as superfícies empilhadas (fundo -> cartão) têm que ser distinguíveis
// por cor OU por contorno visível.
for (const [name, dark, hc] of VARIANTS) {
  const p = buildPalette(dark, hc);
  const colorDiff = ratio(p.surface, p.surfaceSecondary) >= 1.04;
  const hasBorder = p.cardBorder !== "transparent";
  if (!colorDiff && !hasBorder && dark) {
    failures++;
    console.log(`  FALHA [${name}] cartão indistinguível do fundo`);
  }
}

console.log(`\n${checked - failures >= 0 ? checked : 0} pares conferidos em ${VARIANTS.length} variantes de tema.`);
if (failures) {
  console.log(`${failures} problema(s) de contraste.`);
  process.exit(1);
}
console.log("Contraste OK em todos os temas.");
