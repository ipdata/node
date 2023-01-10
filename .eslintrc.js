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
    'plugin:prettier/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: path.resolve(__dirname, './tsconfig.json')
  },
  plugins: [
    '@typescript-eslint'
  ],
  rules: {
    'lines-between-class-members': 'off',
    "import/extensions": [
      "error",
      "ignorePackages",
      {
        "js": "never",
        "jsx": "never",
        "ts": "never",
        "tsx": "never"
      }
   ]
  },
  overrides: [
    {
      extends: [
        'plugin:jest/recommended',
        'plugin:jest/style'
      ],
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
    'import/parsers': {
      "@typescript-eslint/parser": [".ts", ".tsx"]
    },
    'import/resolver': {
      typescript: true,
      node: true
    }
  }
};
