export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['engine', 'dynamic-form', 'ci', 'deps', 'repo']],
    'scope-empty': [1, 'never'],
    'body-max-line-length': [0, 'always', Infinity],
    'footer-max-line-length': [0, 'always', Infinity],
  },
};
