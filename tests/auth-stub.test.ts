/**
 * Auth stub endpoint tests.
 *
 * Verifies that the desktop always-true auth layer behaves correctly —
 * login succeeds with any credentials, /api/auth/user always returns a
 * valid user, and logout responds cleanly.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { createServer, type Server } from "http";
import request from "supertest";
import { setupAuth, registerAuthRoutes } from "../server/auth";

let app: express.Express;
let server: Server;

beforeAll(() => {
  app = express();
  app.use(express.json());
  setupAuth(app);
  registerAuthRoutes(app);
  server = createServer(app);
});

afterAll(() => {
  server.close();
});

describe("Auth stub: GET /api/auth/user", () => {
  it("returns 200 with isAuthenticated: true", async () => {
    const res = await request(app).get("/api/auth/user");
    expect(res.status).toBe(200);
    expect(res.body.isAuthenticated).toBe(true);
  });

  it("returns user id, email, firstName, lastName", async () => {
    const res = await request(app).get("/api/auth/user");
    expect(res.body).toMatchObject({
      id: expect.any(String),
      email: expect.any(String),
      firstName: expect.any(String),
      lastName: expect.any(String),
    });
  });
});

describe("Auth stub: GET /api/auth/me", () => {
  it("returns same payload as /api/auth/user", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.isAuthenticated).toBe(true);
  });
});

describe("Auth stub: POST /api/login", () => {
  it("accepts any credentials and returns isAuthenticated: true", async () => {
    const res = await request(app).post("/api/login").send({ username: "anyone", password: "anything" });
    expect(res.status).toBe(200);
    expect(res.body.isAuthenticated).toBe(true);
  });

  it("accepts empty body", async () => {
    const res = await request(app).post("/api/login").send({});
    expect(res.status).toBe(200);
    expect(res.body.isAuthenticated).toBe(true);
  });
});

describe("Auth stub: GET /api/logout", () => {
  it("redirects to /", async () => {
    const res = await request(app).get("/api/logout");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
  });
});

describe("Auth stub: POST /api/logout", () => {
  it("returns ok: true", async () => {
    const res = await request(app).post("/api/logout");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
