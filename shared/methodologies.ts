// Shared between server (prompt building, `server/constants.ts`) and client
// (`src/pages/dashboard.tsx`) so the display label for a methodology only
// needs to be defined once. Stage definitions (with AI-prompt descriptions)
// stay server-only in `server/constants.ts`.
export const METHODOLOGY_LABELS: Record<string, string> = {
  meddic: "MEDDIC",
  spin: "SPIN Selling",
  challenger: "Challenger Sale",
};
