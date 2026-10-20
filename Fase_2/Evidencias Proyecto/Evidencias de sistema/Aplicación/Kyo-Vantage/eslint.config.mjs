import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'build/**', 'supabase/functions/**'] },
  {
    files: ['**/*.mjs'],
    ...js.configs.recommended,
    languageOptions: {
      globals: Object.fromEntries([
        'process', 'console', 'Buffer', 'URL', 'URLSearchParams', 'fetch',
        'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
        'window', 'document', 'navigator', 'Headers', 'Request', 'Response',
      ].map(name => [name, 'readonly'])),
    },
    rules: { 'no-unused-vars': 'warn' },
  },
  ...tseslint.configs.recommended.map(config => ({ ...config, files: ['src/**/*.{ts,tsx}', 'vite.config.ts'] })),
  {
    files: ['src/**/*.{ts,tsx}', 'vite.config.ts'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
