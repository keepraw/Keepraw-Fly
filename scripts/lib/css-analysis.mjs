import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import valueParser from "postcss-value-parser";

export function stylesheetFiles(root) {
  return [
    "apps/web/src/design-system.css",
    ...readdirSync(resolve(root, "apps/web/src/styles"))
      .filter((file) => file.endsWith(".css"))
      .sort()
      .map((file) => `apps/web/src/styles/${file}`),
  ];
}

export function context(node) {
  const parts = [];
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === "atrule")
      parts.unshift(`@${parent.name} ${parent.params}`);
  }
  return parts.join(" > ") || "base";
}

// Both the read-only selector audit and CI checker use the same CSS/value ASTs.
export function collectCustomProperties(ast, file) {
  const definitions = [],
    variables = [];
  ast.walkDecls((node) => {
    const location = {
      file,
      line: node.source.start.line,
      context: context(node),
      selector: node.parent.selector ?? "",
    };
    if (node.prop.startsWith("--")) {
      definitions.push({ name: node.prop, value: node.value, ...location });
    }
    valueParser(node.value).walk((value) => {
      if (value.type !== "function" || value.value !== "var") return;
      const args = value.nodes.filter(
        (arg) => !["space", "comment"].includes(arg.type),
      );
      if (args[0]?.type !== "word" || !args[0].value.startsWith("--")) return;
      variables.push({
        name: args[0].value,
        hasFallback: args[1]?.type === "div" && args[1].value === ",",
        property: node.prop,
        value: node.value,
        ...location,
      });
    });
  });
  return { definitions, variables };
}

export function parseStylesheet(root, file) {
  return postcss.parse(readFileSync(resolve(root, file), "utf8"), {
    from: file,
  });
}
