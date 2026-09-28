// 极简静态文件服务器，只给 Playwright 冒烟测试用，把
// test/fixtures/ 当网站根目录托管在 http://127.0.0.1:4173。
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  "test/fixtures"
);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
};

const server = createServer(async (req, res) => {
  let reqPath = decodeURIComponent(req.url.split("?")[0]);
  if (reqPath.endsWith("/")) reqPath += "index.html";
  const filePath = path.join(root, reqPath);

  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
    res.end(data);
  } catch (error) {
    res.writeHead(500);
    res.end(String(error));
  }
});

server.listen(4173, "127.0.0.1", () => {
  console.log("test fixture server: http://127.0.0.1:4173");
});
