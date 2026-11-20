import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT || 4317);
const base = "/carpool-mauritius-c-costshare";
const root = join(process.cwd(), "out");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    const path = decodeURIComponent(url.pathname);
    if (path === "/") {
      response.writeHead(302, { Location: `${base}/` });
      response.end();
      return;
    }
    if (!path.startsWith(base)) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("This preview serves the Pages base path only.");
      return;
    }
    let relative = path.slice(base.length) || "/";
    if (relative.endsWith("/")) relative += "index.html";
    const file = normalize(join(root, relative));
    if (!file.startsWith(root)) {
      response.writeHead(403);
      response.end();
      return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
      response.end(body);
    } catch {
      const fallback = await readFile(join(root, "index.html"));
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(fallback);
    }
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain" });
    response.end(String(error));
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Static demo: http://127.0.0.1:${port}${base}/`);
});
