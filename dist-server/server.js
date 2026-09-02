// Zero-dependency LAN download server for the unsigned Scanner IPA.
// Serves any *.ipa sitting next to this file. Run:  node dist-server/server.js
// Then browse from the iPhone to  http://<this-machine-LAN-IP>:8010
//
// Port 8010 so it can run alongside the Till APK server (port 8000).

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = __dirname;
const PORT = 8010;

function ipas() {
  return fs
    .readdirSync(DIR)
    .filter((f) => f.toLowerCase().endsWith('.ipa'))
    .map((f) => ({ f, size: fs.statSync(path.join(DIR, f)).size }))
    .sort((a, b) => b.size - a.size);
}

function lanIps() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

function page() {
  const rows = ipas()
    .map(
      ({ f, size }) =>
        `<a href="/${encodeURIComponent(f)}">${f}<span>${(size / 1048576).toFixed(1)} MB</span></a>`,
    )
    .join('');
  return `<!doctype html><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>Scanner — install</title>
<style>
  body{font-family:-apple-system,system-ui,sans-serif;font-size:18px;line-height:1.6;
       padding:24px;max-width:620px;margin:auto;color:#111;background:#fafafa}
  h2{margin:.2em 0}
  a.dl{display:block;padding:16px;background:#1f6feb;color:#fff;text-decoration:none;
       border-radius:12px;margin:12px 0;font-weight:600}
  a.dl span{float:right;font-weight:400;opacity:.85}
  ol{background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:16px 16px 16px 34px}
  code{background:#eee;padding:1px 5px;border-radius:4px}
  .muted{color:#666;font-size:15px}
</style>
<h2>Scanner</h2>
<p class=muted>Unsigned build. Download the file, then sign &amp; install it with your sideloading tool.</p>
${rows || '<p><b>No .ipa here yet.</b> Run <code>npm run serve:pull</code> to fetch the latest build.</p>'}
<ol>
  <li>Tap the blue button to download the <code>.ipa</code> (goes to the Files app).</li>
  <li><b>SideStore / AltStore:</b> open the app → <i>My Apps</i> → <b>+</b> → pick the downloaded <code>.ipa</code>.</li>
  <li><b>TrollStore</b> (if you use it): open the <code>.ipa</code> from Files → <i>Share</i> → <b>TrollStore</b> → Install.</li>
  <li><b>Sideloadly</b> (from a computer): drag the <code>.ipa</code> in, enter your Apple ID, Start.</li>
</ol>
<p class=muted>Free Apple ID installs last 7 days, then re-install. JS changes still come through OTA in the meantime.</p>`;
}

http
  .createServer((req, res) => {
    const name = decodeURIComponent((req.url || '/').slice(1).split('?')[0]);

    if (!name || name === 'index.html') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      return res.end(page());
    }

    const safe = path.basename(name);
    const full = path.join(DIR, safe);
    if (!safe.toLowerCase().endsWith('.ipa') || !fs.existsSync(full)) {
      res.statusCode = 404;
      return res.end('not found');
    }

    res.setHeader('content-type', 'application/octet-stream');
    res.setHeader('content-disposition', `attachment; filename="${safe}"`);
    res.setHeader('content-length', fs.statSync(full).size);
    fs.createReadStream(full).pipe(res);
  })
  .listen(PORT, '0.0.0.0', () => {
    const urls = lanIps().map((ip) => `  http://${ip}:${PORT}`);
    console.log(`Scanner IPA server on port ${PORT}`);
    console.log(urls.length ? `Open on the iPhone:\n${urls.join('\n')}` : `  http://localhost:${PORT}`);
    const found = ipas();
    console.log(found.length ? `Serving: ${found.map((x) => x.f).join(', ')}` : 'No .ipa present — run: npm run serve:pull');
  });
