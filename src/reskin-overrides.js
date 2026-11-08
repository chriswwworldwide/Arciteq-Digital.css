export function overrideReplacement(template, tokens = {}) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(tokens, key)
      ? String(tokens[key]).replace(/\$/g, () => "$$")
      : match,
  );
}
