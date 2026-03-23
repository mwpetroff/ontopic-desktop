/**
 * Auth stub for standalone desktop mode.
 *
 * Auth is always considered valid — the login page is kept in the UI for
 * future real authentication (e.g. OAuth, enterprise SSO), but for now
 * every request is automatically authenticated as the local user.
 */
import type { Express, RequestHandler } from "express";
import session from "express-session";
import MemoryStore from "memorystore";

const MemStore = MemoryStore(session);

const LOCAL_USER = {
  id: "local",
  email: "local@ontopic.app",
  firstName: "Local",
  lastName: "User",
};

export function setupAuth(app: Express) {
  app.use(
    session({
      secret: "ontopic-desktop-secret",
      resave: false,
      saveUninitialized: false,
      store: new MemStore({ checkPeriod: 86400000 }),
      cookie: { httpOnly: true, secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 },
    })
  );
}

export function registerAuthRoutes(app: Express) {
  // useAuth hook calls /api/auth/user — always return local user.
  app.get("/api/auth/user", (_req, res) => {
    res.json({ ...LOCAL_USER, isAuthenticated: true });
  });

  // Alias for completeness.
  app.get("/api/auth/me", (_req, res) => {
    res.json({ ...LOCAL_USER, isAuthenticated: true });
  });

  // Login — GET redirects to app root (desktop: always authenticated).
  app.get("/api/login", (_req, res) => {
    res.redirect("/");
  });

  // Login — accept any credentials and return success.
  app.post("/api/login", (_req, res) => {
    res.json({ ...LOCAL_USER, isAuthenticated: true });
  });

  // Logout — use-auth redirects to GET /api/logout.
  app.get("/api/logout", (_req, res) => {
    res.redirect("/");
  });

  app.post("/api/logout", (_req, res) => {
    res.json({ ok: true });
  });
}

// Middleware that always passes — used to protect API routes.
export const isAuthenticated: RequestHandler = (_req, _res, next) => next();
