import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/dist-server/**",
      "**/*.generated.ts",
      "apps/web/src/data/workeasyComponents.generated.ts",
      // 内置组件源代码（运行在 iframe 中），不参与主项目的 lint
      "packages/components-builtin/*/source/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // 浏览器环境
        window: "readonly",
        document: "readonly",
        fetch: "readonly",
        console: "readonly",
        // Node 环境
        process: "readonly"
      }
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      // React Hooks 强制依赖检查
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // 允许未使用变量以下划线开头（hook 解构常见场景）
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
    }
  },
  {
    // 测试文件放宽
    files: ["**/*.test.{ts,tsx}", "**/test/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  {
    // 配置/脚本文件
    files: ["**/*.config.{js,ts,mjs}", "scripts/**/*.{js,mjs}"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly"
      }
    }
  }
);
