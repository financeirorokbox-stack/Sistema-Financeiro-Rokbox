// Servidor estático só pro teste: serve a RAIZ do repo (placar.html, financeiro.html,
// index.html, pecas-vendidas.js, nf-regras.js...). Não serve a pasta .data (dados reais).
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PORT = +process.argv[2] || 8799;
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  // bloqueia qualquer acesso à cópia de dados
  if (p.indexOf('/tests/.data') === 0 || p.indexOf('/.data') === 0) { res.writeHead(403); return res.end('forbidden'); }
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log('static-server on ' + PORT + ' root=' + ROOT));
