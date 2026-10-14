// Optional live viewer (LIVE_VIEW=true): streams the Playwright page to http://localhost:<port> via Chrome's native
// screencast (MJPEG), with a live step checklist. Built to be watched in VS Code's Simple Browser.
const http = require('http');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Live test view</title><style>
:root{--bg:#0f1419;--panel:#171d25;--line:#2a3340;--txt:#e6edf3;--mut:#8b98a8;--ok:#3fb950;--bad:#f85149;--run:#58a6ff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:14px/1.45 system-ui,Segoe UI,sans-serif}
header{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid var(--line);background:var(--panel)}
header h1{font-size:15px;margin:0}.pill{margin-left:auto;font-size:12px;padding:3px 10px;border-radius:99px;background:#243042;color:var(--run)}
.pill.done{color:var(--ok)}.pill.fail{color:var(--bad)}
main{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;padding:16px;align-items:start}
@media(max-width:900px){main{grid-template-columns:1fr}}
.browser{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--panel)}
.bar{display:flex;align-items:center;gap:6px;padding:8px 12px;border-bottom:1px solid var(--line)}
.dot{width:10px;height:10px;border-radius:50%;background:#3a4656}.url{margin-left:8px;flex:1;background:var(--bg);border-radius:6px;padding:3px 10px;color:var(--mut);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.screen{background:#fff;aspect-ratio:1366/900;display:flex;align-items:center;justify-content:center;color:#667}.screen img{width:100%;height:100%;display:block}
.side{border:1px solid var(--line);border-radius:10px;background:var(--panel);padding:14px 16px}
.side h2{font-size:13px;margin:0 0 4px}.sc{color:var(--mut);font-size:12px;margin-bottom:10px}
ul{list-style:none;margin:0;padding:0}li{display:flex;gap:10px;padding:7px 0;border-top:1px solid var(--line);font-size:13px;color:var(--mut)}
li .i{width:16px;text-align:center;flex:none}li.run{color:var(--txt)}li.run .i{color:var(--run)}li.ok .i{color:var(--ok)}li.bad{color:var(--bad)}li.bad .i{color:var(--bad)}
.spin{display:inline-block;animation:r 1s linear infinite}@keyframes r{to{transform:rotate(360deg)}}
.stats{display:flex;gap:14px;margin-top:12px;padding-top:10px;border-top:1px solid var(--line);font-size:12px;color:var(--mut)}
</style></head><body>
<header><h1>Streamhub QA &middot; Live test view</h1><span class="pill" id="pill">connecting</span></header>
<main><div class="browser"><div class="bar"><i class="dot"></i><i class="dot"></i><i class="dot"></i><div class="url" id="url">about:blank</div></div>
<div class="screen" id="screen"><span>Waiting for the browser...</span></div></div>
<aside class="side"><h2 id="sc">Waiting...</h2><div class="sc" id="msg"></div><ul id="steps"></ul>
<div class="stats"><span id="sdone">Scenarios: 0</span><span id="spass"></span></div></aside></main>
<script>
const $=id=>document.getElementById(id);let shown=false;
function mount(){if(shown)return;shown=true;$('screen').innerHTML='<img src="/stream" alt="live browser">'}
async function tick(){try{const s=await (await fetch('/status')).json();
 $('sc').textContent=s.scenario;$('msg').textContent=s.message||'';$('url').textContent=s.url||'';
 $('steps').innerHTML=s.steps.map(x=>'<li class="'+x.state+'"><span class="i">'+(x.state=='ok'?'&#10003;':x.state=='bad'?'&#10007;':x.state=='run'?'<span class="spin">&#9696;</span>':'&middot;')+'</span><span>'+x.text.replace(/</g,'&lt;')+'</span></li>').join('');
 $('sdone').textContent='Scenarios: '+s.finished;$('spass').textContent=s.failed?('Failed: '+s.failed):'';
 const p=$('pill');p.textContent=s.over?(s.failed?'finished with failures':'all passed'):(s.steps.length?'running':'waiting');p.className='pill '+(s.over?(s.failed?'fail':'done'):'');
 if(s.streaming)mount();}catch(e){}}
setInterval(tick,300);tick();
</script></body></html>`;

function startLiveView(port) {
  const clients = new Set();
  let last = null;
  const status = { scenario: 'Waiting for the first scenario...', message: '', url: '', steps: [], finished: 0, failed: 0, over: false, streaming: false };
  let cdp = null;

  const broadcast = (jpg) => {
    last = jpg;
    for (const c of clients) writeFrame(c, jpg);
  };
  const writeFrame = (res, jpg) => {
    res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpg.length}\r\n\r\n`);
    res.write(jpg);
    res.write('\r\n');
  };

  const server = http.createServer((req, res) => {
    if (req.url === '/status') {
      res.setHeader('content-type', 'application/json');
      res.setHeader('cache-control', 'no-store');
      return res.end(JSON.stringify(status));
    }
    if (req.url.startsWith('/stream')) {
      res.writeHead(200, { 'content-type': 'multipart/x-mixed-replace; boundary=frame', 'cache-control': 'no-cache', connection: 'close' });
      clients.add(res);
      if (last) writeFrame(res, last);
      return req.on('close', () => clients.delete(res));
    }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(PAGE);
  });
  server.listen(port);

  return {
    message: (scenario, message) => Object.assign(status, { scenario, message }),
    async attach(page, scenarioName) {
      Object.assign(status, { scenario: scenarioName, message: '', steps: [], url: '' });
      cdp = await page.context().newCDPSession(page);
      cdp.on('Page.screencastFrame', ({ data, sessionId }) => {
        broadcast(Buffer.from(data, 'base64'));
        cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
      });
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 1366, maxHeight: 900 });
      status.streaming = true;
      page.on('framenavigated', (f) => f === page.mainFrame() && (status.url = f.url()));
    },
    async detach(failed) {
      status.finished += 1;
      if (failed) status.failed += 1;
      if (cdp) await cdp.send('Page.stopScreencast').catch(() => {});
      cdp = null;
    },
    stepStart: (text) => status.steps.push({ text, state: 'run' }),
    stepEnd(ok) {
      const s = status.steps[status.steps.length - 1];
      if (s) s.state = ok ? 'ok' : 'bad';
    },
    finish() {
      status.over = true;
    },
    close: () => new Promise((resolve) => {
      for (const c of clients) c.end();
      server.close(resolve);
    }),
  };
}

module.exports = { startLiveView };
