import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const port = 4173;
const frontendRoot = fileURLToPath(new URL(".", import.meta.url));

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

const server = createServer(async (request, response) => {
  const requestUrl = request.url ?? "/";
  const pathname = requestUrl === "/" ? "/index.html" : requestUrl;
  const filePath = normalize(join(frontendRoot, pathname));

  if (!filePath.startsWith(frontendRoot)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const contents = await readFile(filePath);
    const contentType = mimeTypes[extname(filePath)] ?? "text/plain; charset=utf-8";

    response.writeHead(200, { "Content-Type": contentType });
    response.end(contents);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`Governance Capital demo UI available at http://${host}:${port}`);
});
