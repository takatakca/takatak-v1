export function canonicalSql(sql) {
  return String(sql ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/--[^\n]*/g, "")
    .replace(/COMMENT\s+ON\s+(?:SCHEMA|TABLE)\s+[\s\S]*?;/gi, "")
    .replace(/\s+/g, "")
    .replace(/"/g, "")
    .toLowerCase();
}

export function normalizeHistoricalVehicleAuthority(sql) {
  return String(sql ?? "")
    .replace(
      /\s*OR\s+COALESCE\(auth\.role\(\)\s*=\s*'service_role',\s*false\);/gi,
      ";",
    )
    .replace(
      /COALESCE\(\s*rentauto\.has_role\(\s*'admin'::rentauto\.app_role\s*\)\s*,\s*false\s*\)/gi,
      "rentauto.has_role('admin'::rentauto.app_role)",
    );
}
