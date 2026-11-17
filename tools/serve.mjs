import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.PORT || 18765);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};
const server = createServer(async (req, res) => {
  try {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      return res.end();
    }
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const target = resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (
      !target.startsWith(resolve(root) + sep) ||
      pathname.split("/").some((p) => p.startsWith("."))
    ) {
      res.writeHead(403);
      return res.end();
    }
    if (!(await stat(target)).isFile()) throw new Error("missing");
    const data = await readFile(target);
    res.writeHead(200, {
      "Content-Type": types[extname(target)] || "text/plain",
      "Content-Length": data.length,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`FrostEcho WebGPU: http://127.0.0.1:${port}/`),
);
