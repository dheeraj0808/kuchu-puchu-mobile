// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Guide §13 rule 2: no PII, tokens, OTPs or messages in logs. Logging goes
    // through Sentry with scrubbing (later phase), never console.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/__tests__/**"],
    rules: { "no-console": "error" },
  },
]);
