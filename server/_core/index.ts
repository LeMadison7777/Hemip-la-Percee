import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import net from "node:net";
import { registerAuthRoutes } from "../auth/routes";
import { registerSupabaseStorageRoutes } from "../storage/routes";
import { registerPublicMediaRoutes } from "../media/routes";
import { registerCommunityRoutes } from "../community/routes";
import { registerAdminAccountRoutes } from "../admin/account-routes";
import { registerAcademicRoutes } from "../academics/routes";
import { registerFinanceRoutes } from "../admin/finance-routes";
import { prisma } from "../prisma";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => server.close(() => resolve(true)));
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer(): Promise<void> {
  const app = express();
  app.set("trust proxy", 1);
  const server = createServer(app);

  app.get(["/healthz", "/api/health"], (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
  app.get("/readyz", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "not-ready" });
    }
  });

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  registerAuthRoutes(app);
  registerSupabaseStorageRoutes(app);
  registerPublicMediaRoutes(app);
  registerCommunityRoutes(app);
  registerAdminAccountRoutes(app);
  registerAcademicRoutes(app);
  registerFinanceRoutes(app);

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    await setupVite(app, server);
  }

  const preferredPort = Number.parseInt(process.env.PORT ?? "3000", 10);
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.warn(`Port ${preferredPort} is busy; using port ${port} instead.`);
  }

  server.listen(port, () => {
    console.log(`HEMIP server listening on http://localhost:${port}`);
  });
}

startServer().catch(error => {
  console.error("HEMIP server failed to start:", error);
  process.exitCode = 1;
});
