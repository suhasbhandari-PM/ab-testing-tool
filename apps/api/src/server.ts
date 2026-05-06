import * as fs from "fs";
import * as https from "https";
import * as http from "http";
import * as path from "path";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { URL } from "url";
import { deliveryRoute } from "./routes/delivery";
import { eventsRoute } from "./routes/events";
import { healthRoute } from "./routes/health";
import { resultsDetailRoute, resultsListRoute } from "./routes/results";
import { experimentSnapshotUploadRoute, snapshotFileRoute } from "./routes/snapshots";
import {
  experimentsListRoute,
  experimentsGetRoute,
  experimentsCreateRoute,
  experimentsUpdateRoute,
  experimentsDeleteRoute
} from "./routes/experiments";

const REPO_ROOT = path.join(__dirname, "..", "..", "..", "..");

// ── API key auth ────────────────────────────────────────────────────────────
// Set API_KEY env var to enable auth. If unset, all requests are allowed
// (convenient for local dev — no key needed).
const API_KEY = process.env.API_KEY?.trim() || null;

function isAuthorized(req: IncomingMessage): boolean {
  if (!API_KEY) return true; // auth disabled locally
  const header = req.headers["x-api-key"];
  return header === API_KEY;
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-API-Key");
  res.end(JSON.stringify(body));
}

function sendFile(res: ServerResponse, filePath: string): void {
  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath);
  const mimeTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8"
  };
  res.setHeader("Content-Type", mimeTypes[ext] ?? "application/octet-stream");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.statusCode = 200;
  fs.createReadStream(filePath).pipe(res);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks).toString("utf-8").trim();
  if (!rawBody) return {};
  return JSON.parse(rawBody);
}

function stripSecurityMetaTags(html: string): string {
  return html
    .replace(/<meta[^>]+http-equiv\s*=\s*["']content-security-policy["'][^>]*>\s*/gi, "")
    .replace(/<meta[^>]+http-equiv\s*=\s*["']content-security-policy-report-only["'][^>]*>\s*/gi, "");
}

function getRequestProtocol(req: IncomingMessage): "http:" | "https:" {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const value = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  return value?.split(",")[0].trim() === "https" ? "https:" : "http:";
}

function buildProxyBootScript(selfOrigin: string): string {
  const sdkSrc = `${selfOrigin}/dist/sdk-editor.iife.js`;
  return `<script>(() => {
    const sdkSrc = ${JSON.stringify(sdkSrc)};
    const post = (msg) => {
      try {
        window.parent.postMessage(msg, "*");
      } catch (_) {
      }
    };
    const boot = (stage, detail) => post({ type: "EDITOR_BOOT", stage, detail });
    const fail = (phase, message, stack) => post({ type: "EDITOR_ERROR", phase, message, stack });
    boot("proxy-html", location.href);
    const script = document.createElement("script");
    script.src = sdkSrc;
    script.async = true;
    script.onload = () => boot("sdk-loaded", sdkSrc);
    script.onerror = () => fail("init", "Failed to load editor SDK bundle", sdkSrc);
    boot("sdk-injecting", sdkSrc);
    (document.head || document.body || document.documentElement).appendChild(script);
  })();</script>`;
}

const server = createServer(async (req, res) => {
  const method = req.method ?? "GET";

  if (method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-API-Key");
    res.statusCode = 204;
    res.end();
    return;
  }

  const host = req.headers.host ?? "localhost";
  const parsedUrl = new URL(req.url ?? "/", `http://${host}`);
  const pathname = parsedUrl.pathname;

  // Health
  if (method === "GET" && pathname === "/health") {
    const { statusCode, body } = healthRoute();
    sendJson(res, statusCode, body);
    return;
  }

  // Delivery
  if (method === "GET" && pathname === "/v1/delivery") {
    const { statusCode, body } = await deliveryRoute({
      projectId: parsedUrl.searchParams.get("projectId") ?? undefined,
      pageUrl: parsedUrl.searchParams.get("pageUrl") ?? undefined
    });
    sendJson(res, statusCode, body);
    return;
  }

  // Events
  if (method === "POST" && pathname === "/v1/events") {
    try {
      const payload = await readJsonBody(req);
      const { statusCode, body } = eventsRoute(payload);
      sendJson(res, statusCode, body);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return;
  }

  // Experiments CRUD — all routes require API key
  if (
    pathname === "/v1/experiments" ||
    pathname.match(/^\/v1\/experiments\/[^/]+$/) ||
    pathname.match(/^\/v1\/experiments\/[^/]+\/snapshots$/) ||
    pathname === "/v1/results" ||
    pathname.match(/^\/v1\/results\/[^/]+$/)
  ) {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { error: "Unauthorized — provide a valid X-API-Key header" });
      return;
    }
  }

  if (pathname === "/v1/experiments") {
    if (method === "GET") {
      const { statusCode, body } = await experimentsListRoute();
      sendJson(res, statusCode, body);
      return;
    }
    if (method === "POST") {
      try {
        const payload = await readJsonBody(req);
        const { statusCode, body } = await experimentsCreateRoute(payload);
        sendJson(res, statusCode, body);
      } catch {
        sendJson(res, 400, { error: "Invalid JSON body" });
      }
      return;
    }
  }

  const expMatch = pathname.match(/^\/v1\/experiments\/([^/]+)$/);
  if (expMatch) {
    const id = expMatch[1];
    if (method === "GET") {
      const { statusCode, body } = await experimentsGetRoute(id);
      sendJson(res, statusCode, body);
      return;
    }
    if (method === "PUT") {
      try {
        const payload = await readJsonBody(req);
        const { statusCode, body } = await experimentsUpdateRoute(id, payload);
        sendJson(res, statusCode, body);
      } catch {
        sendJson(res, 400, { error: "Invalid JSON body" });
      }
      return;
    }
    if (method === "DELETE") {
      const { statusCode, body } = await experimentsDeleteRoute(id);
      sendJson(res, statusCode, body);
      return;
    }
  }

  const snapshotUploadMatch = pathname.match(/^\/v1\/experiments\/([^/]+)\/snapshots$/);
  if (snapshotUploadMatch && method === "POST") {
    try {
      const payload = await readJsonBody(req);
      const { statusCode, body } = await experimentSnapshotUploadRoute(snapshotUploadMatch[1], payload);
      sendJson(res, statusCode, body);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return;
  }

  if (pathname === "/v1/results" && method === "GET") {
    const { statusCode, body } = await resultsListRoute();
    sendJson(res, statusCode, body);
    return;
  }

  const resultsMatch = pathname.match(/^\/v1\/results\/([^/]+)$/);
  if (resultsMatch && method === "GET") {
    const { statusCode, body } = await resultsDetailRoute(resultsMatch[1]);
    sendJson(res, statusCode, body);
    return;
  }

  const snapshotFileMatch = pathname.match(/^\/v1\/snapshots\/([^/]+)$/);
  if (snapshotFileMatch && method === "GET") {
    let fileName = snapshotFileMatch[1];
    try {
      fileName = decodeURIComponent(fileName);
    } catch {
      sendJson(res, 400, { error: "Invalid snapshot filename encoding" });
      return;
    }
    snapshotFileRoute(fileName, res);
    return;
  }

  // Static: dashboard — redirect bare /dashboard to /dashboard/ so relative imports resolve correctly
  if (method === "GET" && pathname === "/dashboard") {
    res.statusCode = 301;
    res.setHeader("Location", "/dashboard/");
    res.end();
    return;
  }
  if (method === "GET" && pathname === "/dashboard/") {
    sendFile(res, path.join(REPO_ROOT, "apps", "dashboard", "index.html"));
    return;
  }
  if (method === "GET" && pathname.startsWith("/dashboard/")) {
    const rel = pathname.slice("/dashboard/".length);
    sendFile(res, path.join(REPO_ROOT, "apps", "dashboard", rel));
    return;
  }

  // Static: demo page
  if (method === "GET" && pathname === "/demo") {
    res.statusCode = 301;
    res.setHeader("Location", "/demo/");
    res.end();
    return;
  }
  if (method === "GET" && pathname === "/demo/") {
    sendFile(res, path.join(REPO_ROOT, "demo", "index.html"));
    return;
  }
  if (method === "GET" && pathname.startsWith("/demo/")) {
    const rel = pathname.slice("/demo/".length);
    sendFile(res, path.join(REPO_ROOT, "demo", rel));
    return;
  }

  // Static: compiled dist (serves SDK scripts)
  if (method === "GET" && pathname.startsWith("/dist/")) {
    const rel = pathname.slice("/dist/".length);
    sendFile(res, path.join(REPO_ROOT, "dist", rel));
    return;
  }

  // Proxy: fetches a remote URL server-side, injects editor SDK, serves same-origin
  if (method === "GET" && pathname === "/proxy") {
    const targetUrl = parsedUrl.searchParams.get("url");
    if (!targetUrl) {
      sendJson(res, 400, { error: "Missing url param" });
      return;
    }
    try {
      const parsed = new URL(targetUrl);
      const transport = parsed.protocol === "https:" ? https : http;
      const html = await new Promise<string>((resolve, reject) => {
        const reqOptions = {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; AB-Editor-Proxy/1.0)",
            "Accept": "text/html,application/xhtml+xml"
          }
        };
        const proxyReq = transport.request(reqOptions, (proxyRes) => {
          // Follow redirects (up to 3)
          if ((proxyRes.statusCode === 301 || proxyRes.statusCode === 302) && proxyRes.headers.location) {
            const loc = proxyRes.headers.location;
            const redirectUrl = loc.startsWith("http") ? loc : new URL(loc, targetUrl).toString();
            res.statusCode = 302;
            res.setHeader("Location", `/proxy?url=${encodeURIComponent(redirectUrl)}`);
            res.end();
            return;
          }
          const chunks: Buffer[] = [];
          proxyRes.on("data", (c: Buffer) => chunks.push(c));
          proxyRes.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
          proxyRes.on("error", reject);
        });
        proxyReq.on("error", reject);
        proxyReq.end();
      });

      // Inject <base href> so relative URLs resolve against the target origin.
      // Strip CSP meta tags from the target HTML so the preview bootstrap can
      // still run even when the origin locks down scripts in its own markup.
      // Then inject the editor SDK from our own origin so the target page's
      // base URL does not redirect the bundle request.
      const sanitized = stripSecurityMetaTags(html);
      const baseHref = `<base href="${parsed.origin}${parsed.pathname}">`;
      const selfOrigin = `${getRequestProtocol(req)}//${host}`;
      const bootScript = buildProxyBootScript(selfOrigin);
      let injected = sanitized;
      if (/<head[\s>]/i.test(injected)) {
        injected = injected.replace(/(<head[^>]*>)/i, `$1${baseHref}`);
      } else {
        injected = baseHref + injected;
      }
      if (/<\/body>/i.test(injected)) {
        injected = injected.replace(/<\/body>/i, `${bootScript}</body>`);
      } else {
        injected = injected + bootScript;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(injected);
    } catch (err) {
      sendJson(res, 502, { error: "Proxy fetch failed", detail: String(err) });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

const port = Number(process.env.PORT ?? 4000);

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`AB testing API listening on http://localhost:${port}`);
});
