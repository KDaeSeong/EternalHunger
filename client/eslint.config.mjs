import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 생성 중간 산출물 미리보기 파일은 실제 앱 소스에서 제외
    "src/app/simulation/page_transformed_preview.js",
  ]),
]);

export default eslintConfig;
