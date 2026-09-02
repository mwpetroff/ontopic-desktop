function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Builds a "client_title_date" base filename (no extension) shared by every export
 * format (PDF/JSON/Excel), so related exports of the same session sit together in a
 * folder and sort chronologically. Omits the client segment when the session has none. */
export function buildExportFilename(session: { title: string; clientName?: string | null; createdAt: string | Date }): string {
  const parts = [
    session.clientName ? slugify(session.clientName) : null,
    slugify(session.title),
    new Date(session.createdAt).toISOString().slice(0, 10),
  ].filter((part): part is string => !!part);
  return parts.join("_");
}
