// `npm run test:ui:live` - run the UI suite slowly with the live viewer on (cross-platform env setup)
const { spawn } = require('child_process');

const env = { ...process.env, LIVE_VIEW: 'true', SLOW_MO: process.env.SLOW_MO || '600' };
const port = env.LIVE_VIEW_PORT || '3200';
console.log(`\nLive view: open VS Code > Ctrl+Shift+P > "Simple Browser: Show" > http://localhost:${port}`);
console.log('Starting in 25 seconds so you can open it...\n');

setTimeout(() => {
  spawn('npx', ['cucumber-js', '-p', 'ui'], { stdio: 'inherit', env, shell: true }).on('exit', (code) => process.exit(code ?? 0));
}, 25000);
