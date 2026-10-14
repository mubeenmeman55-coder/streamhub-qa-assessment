// Optional live viewer: streams the Playwright page as MJPEG to http://localhost:<port> so a test run can be watched
// inside VS Code's Simple Browser. Enabled with LIVE_VIEW=true (see `npm run test:ui:live`). No effect otherwise.
const http = require('http');

const PAGE = `<!doctype html><meta charset="utf-8"><title>Live test view</title>
<style>body{margin:0;font:15px system-ui;background:#111;color:#eee}#s{padding:10px 14px;background:#222;border-bottom:1px solid #444}
#f{font-size:12px;color:#9ab}img{width:100%;display:block}</style>
<div id="s">Waiting for a scenario...</div><img src="/stream" alt="live browser">
<script>setInterval(async()=>{try{const t=await (await fetch('/status')).json();document.getElementById('s').innerHTML=
'<b>'+t.scenario+'</b><div id="f">'+t.step+'</div>'}catch(e){}},400)</script>`;

function startLiveView(port, getPage) {
  const clients = new Set();
  const status = { scenario: 'Waiting for a scenario...', step: '' };

  const server = http.createServer((req, res) => {
    if (req.url === '/status') {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify(status));
    }
    if (req.url === '/stream') {
      res.writeHead(200, { 'content-type': 'multipart/x-mixed-replace; boundary=frame', 'cache-control': 'no-cache', connection: 'close' });
      clients.add(res);
      return req.on('close', () => clients.delete(res));
    }
    res.setHeader('content-type', 'text/html');
    res.end(PAGE);
  });
  server.listen(port);

  let busy = false;
  const timer = setInterval(async () => {
    const page = getPage();
    if (!page || !clients.size || busy) return;
    busy = true;
    try {
      const jpg = await page.screenshot({ type: 'jpeg', quality: 60 });
      for (const c of clients) {
        c.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpg.length}\r\n\r\n`);
        c.write(jpg);
        c.write('\r\n');
      }
    } catch {
      /* page closed between frames */
    } finally {
      busy = false;
    }
  }, 200);

  return {
    setStatus: (scenario, step = '') => Object.assign(status, { scenario, step }),
    close: () => new Promise((resolve) => {
      clearInterval(timer);
      for (const c of clients) c.end();
      server.close(resolve);
    }),
  };
}

module.exports = { startLiveView };
