import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "src/generated/**"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // API tests run on Node and use its built-in fetch.
    files: ["test/**/*.mjs"],
    languageOptions: {
      globals: { fetch: "readonly", console: "readonly" },
    },
  },
);
