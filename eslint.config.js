import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** Tenant-scoped Prisma models: these must always be reached through `forOrg()`. */
const TENANT_MODELS = ['customer', 'invitation', 'emailLog'];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'packages/shared/src/api-types.ts',
      'apps/api/openapi.json',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx,vue}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Only where erasing an import is safe — see the API override below.
    files: ['apps/web/**/*.{ts,vue}', 'packages/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },

  // --- API ---
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // NestJS relies on decorator metadata for DI; empty constructors are idiomatic.
      '@typescript-eslint/no-extraneous-class': 'off',

      // MUST stay off. A constructor parameter type looks type-only to TypeScript,
      // but `emitDecoratorMetadata` emits it as a *value* into design:paramtypes.
      // Rewriting `import { PrismaService }` to `import type` erases the reference,
      // DI resolves to Object and injection breaks at runtime — and for DTOs,
      // ZodValidationPipe reads that same metatype, so request validation would
      // silently stop running. Autofixing this rule here would be actively harmful.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    // The tenant-isolation guard rail. PrismaService itself is exempt below.
    files: ['apps/api/src/modules/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `MemberExpression[object.type='MemberExpression'][object.property.name='prisma'][property.name=/^(${TENANT_MODELS.join('|')})$/]`,
          message:
            'Tenant-scoped model accessed off the raw Prisma client. Use prisma.forOrg(organizationId).<model> so organizationId is enforced.',
        },
      ],
    },
  },
  {
    files: ['apps/api/src/common/prisma/**/*.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  // --- Web ---
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['apps/web/**/*.{ts,vue}'],
    languageOptions: {
      parser: vueParser,
      globals: { ...globals.browser },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },

  prettier,
);
