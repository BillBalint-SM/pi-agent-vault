import tseslint from "typescript-eslint";

const typedFiles = ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"];

export default tseslint.config(
  {
    ignores: ["node_modules/**", "coverage/**", ".tmp/**", "data/**", "outputs/**", "dist/**"],
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: typedFiles,
  })),
  {
    files: typedFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
    },
  },
);
