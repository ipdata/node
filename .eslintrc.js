const path = require('path');

module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true
  },
  extends: [
    'airbnb-base',
    'plugin:@typescript-eslint/recommended',
    'prettier/@typescript-eslint',
    'plugin:prettier/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: path.resolve(__dirname, './tsconfig.json')
  },
  plugins: [
    '@typescript-eslint'
  ],
  rules: {
    'lines-between-class-members': 'off'
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.test.ts'],
      rules: {
        // Import
        'import/no-extraneous-dependencies': 'off'
      },
      env: {
        jest: true
      },
      parserOptions: {
        project: path.resolve(__dirname, './tsconfig.test.json')
      },
    }
  ],
  settings: {
    'import/resolver': {
      node: {
        extensions: [
          '.js',
          '.ts'
        ]
      }
    }
  }
};
