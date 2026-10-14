// `npm run test:ui:live` - run the EMI app suite slowly with the live viewer on (cross-platform env setup).
// The viewer starts immediately and the first scenario waits LIVE_VIEW_WAIT_MS (default 20s) for you to open it.
const { spawn } = require('child_process');

const env = { ...process.env, LIVE_VIEW: 'true', SLOW_MO: process.env.SLOW_MO || '150' };
const port = env.LIVE_VIEW_PORT || '3200';
console.log(`
Live view: VS Code > Ctrl+Shift+P > "Simple Browser: Show" > http://localhost:${port}
`);
spawn('npx', ['cucumber-js', '-p', 'webapp'], { stdio: 'inherit', env, shell: true }).on('exit', (code) => process.exit(code ?? 0));
