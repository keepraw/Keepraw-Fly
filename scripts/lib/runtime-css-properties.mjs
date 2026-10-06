import ts from "typescript";

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  if (ts.isComputedPropertyName(node) && ts.isStringLiteral(node.expression))
    return node.expression.text;
  return undefined;
}

// Recognize real style object assignments, never comments, type-only keys or
// arbitrary strings. This proves a definition name exists, not DOM inheritance.
export function collectRuntimeProperties(text, file) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  if (source.parseDiagnostics.length)
    throw new Error(`Cannot parse runtime CSS source: ${file}`);
  const cssTypes = new Set();
  const reactNamespaces = new Set();
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      statement.moduleSpecifier.text !== "react"
    )
      continue;
    const clause = statement.importClause;
    if (clause?.name) reactNamespaces.add(clause.name.text);
    const bindings = clause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings))
      reactNamespaces.add(bindings.name.text);
    if (bindings && ts.isNamedImports(bindings)) {
      for (const specifier of bindings.elements) {
        if ((specifier.propertyName ?? specifier.name).text === "CSSProperties")
          cssTypes.add(specifier.name.text);
      }
    }
  }
  function isCssType(type) {
    if (!type) return false;
    if (ts.isIntersectionTypeNode(type)) return type.types.some(isCssType);
    if (!ts.isTypeReferenceNode(type)) return false;
    const name = type.typeName;
    return ts.isIdentifier(name)
      ? cssTypes.has(name.text)
      : ts.isQualifiedName(name) &&
          ts.isIdentifier(name.left) &&
          reactNamespaces.has(name.left.text) &&
          name.right.text === "CSSProperties";
  }
  function isStyleObject(node) {
    let expression = node;
    let parent = node.parent;
    while (
      parent &&
      (ts.isParenthesizedExpression(parent) ||
        ts.isAsExpression(parent) ||
        ts.isTypeAssertionExpression(parent) ||
        ts.isSatisfiesExpression(parent))
    ) {
      if ("type" in parent && isCssType(parent.type)) return true;
      expression = parent;
      parent = parent.parent;
    }
    if (
      parent &&
      ts.isVariableDeclaration(parent) &&
      parent.initializer === expression &&
      isCssType(parent.type)
    )
      return true;
    return (
      parent &&
      ts.isJsxExpression(parent) &&
      parent.expression === expression &&
      ts.isJsxAttribute(parent.parent) &&
      parent.parent.name.text === "style"
    );
  }
  const definitions = [];
  function visit(node) {
    if (ts.isObjectLiteralExpression(node) && isStyleObject(node)) {
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const name = propertyName(property.name);
        if (!name?.startsWith("--")) continue;
        definitions.push({
          name,
          file,
          line:
            source.getLineAndCharacterOfPosition(property.getStart(source))
              .line + 1,
          value: property.initializer.getText(source),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return definitions;
}
