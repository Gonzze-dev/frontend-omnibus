// @ts-check
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

// Template linting focused on accessibility (WCAG 2.2 AA). The TypeScript
// side only runs the processor that extracts inline templates.
module.exports = tseslint.config(
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    processor: angular.processInlineTemplates,
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      // Tables in this app are ARIA tables built with lists, not <table>
      '@angular-eslint/template/table-scope': 'error',
    },
  },
  { ignores: ['dist/', 'node_modules/', '.angular/'] },
);
