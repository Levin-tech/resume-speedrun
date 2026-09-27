// 用 esbuild 把 src/ 打包进 dist/，dist/ 可以直接在
// chrome://extensions -> 加载已解压的扩展程序 里加载。
import { build, context } from "esbuild";
import { mkdirSync, copyFileSync, cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, "src");
const dist = path.join(root, "dist");
const watch = process.argv.includes("--watch");

const iconsExist = existsSync(path.join(root, "public/icons/icon128.png"));
if (!iconsExist) {
  await import("./make-icons.mjs");
}

const entryPoints = {
  "background/background": path.join(src, "background/background.js"),
  "content/content": path.join(src, "content/content.js"),
  "popup/popup": path.join(src, "popup/popup.js"),
  "options/options": path.join(src, "options/options.js"),
};

function copyStaticFiles() {
  mkdirSync(dist, { recursive: true });
  copyFileSync(path.join(src, "manifest.json"), path.join(dist, "manifest.json"));

  for (const dir of ["popup", "options", "content"]) {
    mkdirSync(path.join(dist, dir), { recursive: true });
  }
  copyFileSync(
    path.join(src, "popup/popup.html"),
    path.join(dist, "popup/popup.html")
  );
  copyFileSync(
    path.join(src, "popup/popup.css"),
    path.join(dist, "popup/popup.css")
  );
  copyFileSync(
    path.join(src, "options/options.html"),
    path.join(dist, "options/options.html")
  );
  copyFileSync(
    path.join(src, "options/options.css"),
    path.join(dist, "options/options.css")
  );
  copyFileSync(
    path.join(src, "content/content.css"),
    path.join(dist, "content/content.css")
  );

  const iconsDir = path.join(root, "public/icons");
  if (existsSync(iconsDir)) {
    cpSync(iconsDir, path.join(dist, "icons"), { recursive: true });
  }
}

const esbuildOptions = {
  entryPoints,
  outdir: dist,
  bundle: true,
  format: "esm",
  target: "chrome110",
  sourcemap: true,
  logLevel: "info",
};

copyStaticFiles();

if (watch) {
  const ctx = await context(esbuildOptions);
  await ctx.watch();
  console.log("esbuild watching for changes...");
} else {
  await build(esbuildOptions);
  console.log(`build complete -> ${path.relative(root, dist)}/`);
}
