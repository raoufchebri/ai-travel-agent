import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // Allow using 'any' in places where external SDKs or dynamic data are involved
      "@typescript-eslint/no-explicit-any": "off",
      // Disable unused vars rule for this project; prefix with '_' when intentionally unused
      "@typescript-eslint/no-unused-vars": "off",
      // Disable exhaustive-deps warnings; this project manages deps manually in places
      "react-hooks/exhaustive-deps": "off",
      // Allow <img> where appropriate
      "@next/next/no-img-element": "off",
      // Do not enforce prefer-const
      "prefer-const": "off",
    },
  },
];

export default eslintConfig;
