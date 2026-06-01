import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findLabHref, renderDashboard } from "./labs.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const assetsDir = path.join(publicDir, "assets");
const docsDir = path.join(projectRoot, "docs");
const labsDir = path.join(publicDir, "labs");

const PREFERRED_MAIN_PORT = Number(process.env.PORT || 3000);
const PREFERRED_ASSET_PORT = Number(process.env.ASSET_PORT || 3001);

function delayMiddleware(req, res, next) {
  const delay = Number(req.query.delay);
  if (!Number.isFinite(delay) || delay <= 0) {
    next();
    return;
  }

  const cappedDelay = Math.min(delay, 10000);
  res.setHeader("Server-Timing", `lab-delay;dur=${cappedDelay}`);
  setTimeout(next, cappedDelay);
}

function createMainApp(assetOrigin) {
  const app = express();

  app.disable("x-powered-by");
  app.locals.assetOrigin = assetOrigin;

  app.get("/", (req, res) => {
    res.type("html").send(renderDashboard());
  });

  app.get("/lab/:module/:variant", (req, res) => {
    const href = findLabHref(req.params.module, req.params.variant);
    if (!href) {
      res.status(404).type("html").send("<h1>Lab page not found</h1>");
      return;
    }

    res.redirect(302, href);
  });

  app.get("/metrics-helper.js", (req, res) => {
    res.sendFile(path.join(publicDir, "metrics-helper.js"));
  });

  app.use("/docs", express.static(docsDir, {
    extensions: ["md"],
    setHeaders(res) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
    }
  }));

  app.use("/labs", express.static(labsDir, {
    extensions: ["html"],
    setHeaders(res) {
      res.setHeader("Cache-Control", "no-store");
    }
  }));

  app.use("/assets", delayMiddleware, express.static(assetsDir, {
    etag: false,
    maxAge: 0,
    setHeaders(res) {
      res.setHeader("Cache-Control", "no-store");
    }
  }));

  return app;
}

function createAssetApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  });
  app.use("/assets", delayMiddleware, express.static(assetsDir, {
    etag: false,
    maxAge: 0,
    setHeaders(res) {
      res.setHeader("Cache-Control", "no-store");
    }
  }));

  return app;
}

function listenWithFallback(app, preferredPort, label, attempts = 20) {
  return new Promise((resolve, reject) => {
    function tryPort(port, remainingAttempts) {
      const server = app.listen(port);

      server.once("listening", () => {
        if (port !== preferredPort) {
          console.log(`${label}: preferred port ${preferredPort} was busy, using ${port}`);
        }
        resolve({ port, server });
      });

      server.once("error", (error) => {
        if (error.code === "EADDRINUSE" && remainingAttempts > 0) {
          tryPort(port + 1, remainingAttempts - 1);
          return;
        }

        reject(error);
      });
    }

    tryPort(preferredPort, attempts);
  });
}

const assetServer = await listenWithFallback(
  createAssetApp(),
  PREFERRED_ASSET_PORT,
  "Cross-origin asset server"
);
const assetOrigin = process.env.ASSET_ORIGIN || `http://localhost:${assetServer.port}`;
const mainServer = await listenWithFallback(
  createMainApp(assetOrigin),
  PREFERRED_MAIN_PORT,
  "Resource Loading Lab"
);

console.log(`Resource Loading Lab: http://localhost:${mainServer.port}`);
console.log(`Cross-origin asset server: ${assetOrigin}`);
