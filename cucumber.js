const common = {
  require: ['features/support/**/*.js', 'features/step_definitions/**/*.js'],
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
  strict: { ...common, paths: ['features/validating-posts/**/*.feature'], format: fmt('validating-posts') },
  deviations: { ...common, tags: '@known-deviation', paths: ['features/jsonplaceholder/**/*.feature'], format: fmt('known-deviations') },
  selfhealing: { ...common, paths: ['features/self-healing/**/*.feature'], format: fmt('self-healing') },
};
