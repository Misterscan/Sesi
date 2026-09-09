/**
 * Convert lexer-captured leading comments into user-facing documentation.
 * Comment delimiters are normally removed by the lexer, but this also accepts
 * raw comment text so runtime consumers have one normalization path.
 */
export function normalizeDocumentation(comments?: string[]): string | undefined {
  if (!comments || comments.length === 0) return undefined;

  const normalized = comments
    .map(comment => normalizeComment(comment))
    .filter(comment => comment.length > 0)
    .join('\n')
    .trim();

  return normalized || undefined;
}

function normalizeComment(comment: string): string {
  let text = String(comment).replace(/\r\n?/g, '\n').trim();
  text = text.replace(/^\/\*+/, '').replace(/\*\/$/, '').trim();

  let lines = text.split('\n');
  const usesDocLinePrefix = lines.every(line => line.trim() === '' || /^\s*\//.test(line));
  lines = lines.map(line => {
    let value = line;
    if (usesDocLinePrefix) value = value.replace(/^\s*\/\s?/, '');
    value = value.replace(/^\s*\*\s?/, '');
    return value.replace(/\s+$/, '');
  });

  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();

  const nonEmptyLines = lines
    .map((line, index) => ({ index, indent: line.match(/^\s*/)?.[0].length ?? 0 }))
    .filter(({ index }) => lines[index].trim() !== '');
  const firstContentLine = nonEmptyLines[0];
  const remainingIndents = nonEmptyLines.slice(1).map(({ indent }) => indent);
  if (firstContentLine?.indent === 0 && remainingIndents.length > 0) {
    const continuationIndent = Math.min(...remainingIndents);
    if (continuationIndent > 0) {
      lines = lines.map((line, index) => index === firstContentLine.index
        ? line
        : line.slice(Math.min(continuationIndent, line.length)));
    }
  } else {
    const commonIndent = nonEmptyLines.length > 0
      ? Math.min(...nonEmptyLines.map(({ indent }) => indent))
      : 0;
    if (commonIndent > 0) lines = lines.map(line => line.slice(Math.min(commonIndent, line.length)));
  }

  return lines.join('\n').trim();
}

export function documentationSummary(documentation?: string): string | undefined {
  if (!documentation) return undefined;
  const firstLine = documentation
    .split('\n')
    .map(line => line.trim())
    .find(line => line.length > 0);
  return firstLine || undefined;
}
