// 用真实的 Ant Design Vue 组件打包本地测试页（test/fixtures），
// 供开发时手动试用和 Playwright 冒烟测试使用。
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

await build({
  entryPoints: [path.join(root, "test/fixtures/src/main.js")],
  outfile: path.join(root, "test/fixtures/dist/main.js"),
  bundle: true,
  format: "esm",
  target: "chrome110",
  sourcemap: true,
  define: {
    __VUE_OPTIONS_API__: "true",
    __VUE_PROD_DEVTOOLS__: "false",
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
  },
  logLevel: "info",
});

console.log("test fixture built -> test/fixtures/dist/main.js");
