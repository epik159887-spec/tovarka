import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['apps/frontend/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks },
    rules: { ...hooks.configs.recommended.rules },
  },
);
