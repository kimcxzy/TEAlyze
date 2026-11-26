// -----------------------------------------------------------------------
// Verificador estático de cores (roda sem navegador, sem emulador).
//
// Garante que NENHUMA tela escape do tema escuro:
//   1. cor fixa no código (#fff, rgba(...), "white"...) fora de src/theme.ts;
//   2. <Text> sem cor definida (no escuro ficaria preto sobre fundo escuro);
//   3. <TextInput> sem cor de texto ou sem placeholderTextColor;
//   4. <Ionicons>, <ActivityIndicator>, <Switch>, <RefreshControl> sem cor;
//   5. uso do antigo `colors` global (importado de src/theme).
//
// Exceção consciente: comente a linha com   // theme-ok: motivo
//
// Uso:  npm run check-colors
// -----------------------------------------------------------------------
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const ROOT = path.join(__dirname, "..");
const SKIP = new Set(["src/theme.ts", "app/+html.tsx"]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(full);
  }
  return out;
}

const files = [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "src"))].filter(
  (f) => !SKIP.has(path.relative(ROOT, f).replace(/\\/g, "/"))
);

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|^(white|black|red|green|blue|gray|grey|yellow|orange|purple|pink)$/i;
const problems = [];
const warnings = [];

function report(list, file, node, sf, msg) {
  const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  list.push(`${path.relative(ROOT, file)}:${line + 1}  ${msg}`);
}

const tagName = (el) => (el.tagName ? el.tagName.getText() : "");
const attr = (el, name) =>
  el.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText() === name);

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lines = text.split("\n");
  const okOnLine = (node) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    return /theme-ok/.test(lines[line] || "") || /theme-ok/.test(lines[line - 1] || "");
  };

  // --- mapa de estilos: chave -> tem `color`? (dentro de makeStyles / StyleSheet.create) ---
  const styleHasColor = new Map();
  (function collect(node) {
    if (
      ts.isCallExpression(node) &&
      /StyleSheet\.create$/.test(node.expression.getText()) &&
      node.arguments[0] &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      for (const p of node.arguments[0].properties) {
        if (!ts.isPropertyAssignment(p) || !ts.isObjectLiteralExpression(p.initializer)) continue;
        const has = p.initializer.properties.some((q) => q.name && q.name.getText() === "color");
        styleHasColor.set(p.name.getText().replace(/['"]/g, ""), has);
      }
    }
    ts.forEachChild(node, collect);
  })(sf);

  // Estilo "garante cor"? true | false | null (não dá para saber)
  function styleGivesColor(expr) {
    if (!expr) return false;
    if (ts.isJsxExpression(expr)) return styleGivesColor(expr.expression);
    if (ts.isObjectLiteralExpression(expr)) {
      if (expr.properties.some((q) => q.name && q.name.getText() === "color")) return true;
      return false;
    }
    if (ts.isPropertyAccessExpression(expr) && expr.expression.getText() === "styles") {
      const k = expr.name.getText();
      return styleHasColor.has(k) ? styleHasColor.get(k) : null;
    }
    if (ts.isElementAccessExpression(expr) && expr.expression.getText() === "styles") return null;
    if (ts.isArrayLiteralExpression(expr)) {
      let unknown = false;
      for (const el of expr.elements) {
        const r = styleGivesColor(el);
        if (r === true) return true;
        if (r === null) unknown = true;
      }
      return unknown ? null : false;
    }
    if (ts.isParenthesizedExpression(expr)) return styleGivesColor(expr.expression);
    if (ts.isConditionalExpression(expr)) {
      const a = styleGivesColor(expr.whenTrue);
      const b = styleGivesColor(expr.whenFalse);
      if (a === true && b === true) return true;
      if (a === null || b === null) return null;
      return false;
    }
    if (ts.isBinaryExpression(expr)) return false; // `cond && {...}` não é base garantida
    return null;
  }

  function visit(node, insideText) {
    // 1) cores literais
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && COLOR_LITERAL.test(node.text.trim())) {
      // ignora imports/paths e chaves de objeto
      const parent = node.parent;
      const isImport = ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent);
      if (!isImport && !okOnLine(node)) report(problems, file, node, sf, `cor fixa no código: "${node.text}"`);
    }
    if (ts.isTemplateExpression(node)) {
      const parts = [node.head, ...node.templateSpans.map((sp) => sp.literal)];
      const bad = parts.find((part) => /rgba?\(|#[0-9a-fA-F]{3,8}\b/.test(part.text));
      if (bad && !okOnLine(bad) && !okOnLine(node)) {
        report(problems, file, bad, sf, `cor fixa no código: \`...${bad.text.slice(0, 40)}...\``);
      }
    }

    // 5) import do `colors` global
    if (ts.isImportDeclaration(node) && node.moduleSpecifier.getText().includes("@/src/theme")) {
      const nb = node.importClause && node.importClause.namedBindings;
      if (nb && ts.isNamedImports(nb) && nb.elements.some((e) => e.name.getText() === "colors")) {
        report(problems, file, node, sf, "importa `colors` do tema (use useThemedColors())");
      }
    }

    // 2-4) elementos JSX
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const el = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = tagName(el);
      const ok = okOnLine(node);

      if (tag === "Text" && !insideText && !ok) {
        const st = attr(el, "style");
        const r = st ? styleGivesColor(st.initializer) : false;
        if (r === false) report(problems, file, node, sf, "<Text> sem cor no estilo (ficaria preto no escuro)");
        else if (r === null) report(warnings, file, node, sf, "<Text> com estilo que não deu para verificar");
      }
      if (tag === "TextInput" && !ok) {
        const st = attr(el, "style");
        if (styleGivesColor(st && st.initializer) === false) report(problems, file, node, sf, "<TextInput> sem cor de texto");
        if (!attr(el, "placeholderTextColor") && attr(el, "placeholder"))
          report(problems, file, node, sf, "<TextInput> sem placeholderTextColor");
      }
      if (["Ionicons", "MaterialIcons", "MaterialCommunityIcons", "Feather"].includes(tag) && !attr(el, "color") && !ok)
        report(problems, file, node, sf, `<${tag}> sem prop color`);
      if (tag === "ActivityIndicator" && !attr(el, "color") && !ok)
        report(problems, file, node, sf, "<ActivityIndicator> sem prop color");
      if (tag === "Switch" && !(attr(el, "trackColor") && attr(el, "thumbColor")) && !ok)
        report(problems, file, node, sf, "<Switch> sem trackColor/thumbColor");
      if (tag === "RefreshControl" && !attr(el, "tintColor") && !ok)
        report(problems, file, node, sf, "<RefreshControl> sem tintColor");

      const nowInside = insideText || tag === "Text";
      if (ts.isJsxElement(node)) {
        visit(node.openingElement, nowInside);
        node.children.forEach((c) => visit(c, nowInside));
      } else {
        visit(node.attributes, nowInside);
      }
      return;
    }
    ts.forEachChild(node, (c) => visit(c, insideText));
  }
  visit(sf, false);
}

console.log(`${files.length} arquivos verificados.`);
if (warnings.length) {
  console.log(`\nAvisos (${warnings.length}) — revise a mão:`);
  warnings.forEach((w) => console.log("  ~ " + w));
}
if (problems.length) {
  console.log(`\nProblemas (${problems.length}):`);
  problems.forEach((p) => console.log("  ✗ " + p));
  process.exit(1);
}
console.log("\nNenhuma cor fixa e nenhum elemento sem cor de tema. OK.");
