import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const args = { dir: null, host: "127.0.0.1", port: 3000 };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === "--dir") {
      args.dir = val;
      i++;
    } else if (key === "--host") {
      args.host = val;
      i++;
    } else if (key === "--port") {
      args.port = Number(val);
      i++;
    }
  }
  return args;
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".ico") return "image/x-icon";
  if (ext === ".woff") return "font/woff";
  if (ext === ".woff2") return "font/woff2";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

function isSubPath(root, candidate) {
  const rel = path.relative(root, candidate);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

async function fileExists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

const { dir, host, port } = parseArgs(process.argv);
if (!dir) {
  console.error("Missing --dir <buildDir>");
  process.exit(1);
}

const root = path.resolve(dir);
const indexPath = path.join(root, "index.html");

if (!(await fileExists(indexPath))) {
  console.error(`index.html not found at ${indexPath}`);
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const reqPath = decodeURIComponent(url.pathname);

    // SPA fallback: if the file doesn't exist, serve index.html.
    const maybeFile = path.resolve(root, "." + reqPath);
    const targetPath = isSubPath(root, maybeFile) ? maybeFile : indexPath;

    let filePath = targetPath;
    if (reqPath === "/") {
      filePath = indexPath;
    } else if (!(await fileExists(targetPath))) {
      filePath = indexPath;
    }

    const body = await fs.readFile(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType(filePath));
    res.setHeader("Cache-Control", "no-cache");
    res.end(body);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Internal server error");
    console.error(e);
  }
});

server.listen(port, host, () => {
  console.log(`Web listening on http://${host}:${port} (serving ${root})`);
});

