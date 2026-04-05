type OutputFormat = "table" | "json" | "yaml";

export function formatOutput(
  data: Record<string, unknown>[],
  format: OutputFormat,
  columns?: { key: string; header: string }[],
): string {
  switch (format) {
    case "json":
      return JSON.stringify(data, null, 2);
    case "yaml":
      return toYaml(data);
    case "table":
    default:
      return toTable(data, columns);
  }
}

function toTable(
  data: Record<string, unknown>[],
  columns?: { key: string; header: string }[],
): string {
  if (data.length === 0) return "No resources found.";

  const cols =
    columns ??
    Object.keys(data[0]).map((k) => ({ key: k, header: k.toUpperCase() }));

  const widths = cols.map((col) =>
    Math.max(
      col.header.length,
      ...data.map((row) => String(row[col.key] ?? "").length),
    ),
  );

  const header = cols.map((c, i) => c.header.padEnd(widths[i])).join("  ");
  const rows = data.map((row) =>
    cols.map((c, i) => String(row[c.key] ?? "").padEnd(widths[i])).join("  "),
  );

  return [header, ...rows].join("\n");
}

function toYaml(data: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (Array.isArray(data)) {
    return data.map((item) => `${pad}- ${toYaml(item, indent + 1).trimStart()}`).join("\n");
  }
  if (data !== null && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(([k, v]) => {
        if (typeof v === "object" && v !== null) {
          return `${pad}${k}:\n${toYaml(v, indent + 1)}`;
        }
        return `${pad}${k}: ${v}`;
      })
      .join("\n");
  }
  return `${pad}${data}`;
}
