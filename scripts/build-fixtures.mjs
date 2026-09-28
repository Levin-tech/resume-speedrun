// 打包本地测试页，供开发时手动试用和 Playwright 测试使用：
//   test/fixtures/       用真实的 Ant Design Vue 组件搭的通用网申表单
//   test/fixtures/moka/  照实测 Moka 页面结构复刻的 sd- 组件仿真页
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

for (const dir of ["test/fixtures", "test/fixtures/moka"]) {
  await build({
    entryPoints: [path.join(root, dir, "src/main.js")],
    outfile: path.join(root, dir, "dist/main.js"),
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
  console.log(`test fixture built -> ${dir}/dist/main.js`);
}
