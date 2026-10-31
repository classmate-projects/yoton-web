import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { noNativeFormControls } from "./eslint-rules/no-native-form-controls.js";

const yotonPlugin = {
  rules: {
    "no-native-form-controls": noNativeFormControls,
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { yoton: yotonPlugin },
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "yoton/no-native-form-controls": "error",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;