/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['**/dist/**', '**/coverage/**'],
  rules: {
    // CSS Modules classes are read from JS as styles.camelCase.
    'selector-class-pattern': [
      '^[a-z][a-zA-Z0-9]*$',
      { message: 'Use camelCase class names (CSS Modules)' },
    ],
    // Colors come from design tokens only (apps/web/src/styles/tokens.css).
    'color-no-hex': [
      true,
      { message: 'Use a color token (var(--color-*)) instead of a hex color' },
    ],
    'color-named': [
      'never',
      { message: 'Use a color token (var(--color-*)) instead of a named color' },
    ],
    'function-disallowed-list': [
      ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color'],
      { message: 'Use a color token (var(--color-*)) instead of a color function' },
    ],
  },
  overrides: [
    {
      // The token file is where raw values are defined.
      files: ['**/styles/tokens.css'],
      rules: { 'color-no-hex': null, 'function-disallowed-list': null },
    },
  ],
};
