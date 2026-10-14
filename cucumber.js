const common = {
  require: ['features/support/**/*.js', 'features/step_definitions/**/*.js'],
  tags: 'not @broken', // @broken = intentionally brittle locators for the self-healing exercise
  publishQuiet: true,
};
const fmt = (name) => [
  'progress-bar',
  `html:reports/cucumber/${name}.html`,
  `json:reports/cucumber/${name}.json`,
];

module.exports = {
  default: { ...common, paths: ['features/**/*.feature'], format: fmt('all') },
  ui: { ...common, paths: ['features/ui/**/*.feature'], format: fmt('ui') },
  api: { ...common, paths: ['features/api/**/*.feature'], format: fmt('api') },
  broken: { ...common, tags: '@broken', paths: ['features/ui/**/*.feature'], format: fmt('broken') },
};
