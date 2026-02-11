module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    // "google", <-- La comentamos o borramos
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  plugins: [
    "@typescript-eslint",
  ],
  rules: {
    "quotes": ["error", "double"],
    "indent": ["error", 2],
    "object-curly-spacing": ["error", "always"], // Para que te deje usar espacios { x: 1 }
    "@typescript-eslint/no-explicit-any": "warn", // Solo avisa si usas 'any'
    "@typescript-eslint/no-unused-vars": "warn", // Solo avisa si usas variables no utilizadas
  },
};