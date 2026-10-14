const common = {
  require: ['features/support/**/*.js', 'features/step_definitions/**/*.js'],
  tags: 'not @broken and not @known-gap', // @known-gap = documents a deviation of a third-party API, run on demand // @broken = intentionally brittle locators for the self-healing exercise
  publishQuiet: true,
};
const fmt = (name) => [
  'progress-bar',
  `html:reports/cucumber/${name}.html`,
  `json:reports/cucumber/${name}.json`,
];

module.exports = {
  default: { ...common, paths: ['features/**/*.feature'], format: fmt('all') },
  api: { ...common, paths: ['features/api/**/*.feature'], format: fmt('api') },
  webapp: { ...common, paths: ['features/webapp/**/*.feature'], format: fmt('webapp') },
  jsonplaceholder: { ...common, paths: ['features/jsonplaceholder/**/*.feature'], format: fmt('jsonplaceholder') },
  gap: { ...common, tags: '@known-gap', paths: ['features/jsonplaceholder/**/*.feature'], format: fmt('known-gap') },
  broken: { ...common, tags: '@broken', paths: ['features/self-healing/**/*.feature'], format: fmt('broken') },
};
