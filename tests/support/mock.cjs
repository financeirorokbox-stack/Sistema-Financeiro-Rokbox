// Mock do Supabase: as páginas reais bootam normalmente, mas TODO acesso ao banco é
// interceptado e respondido com a cópia local (tests/.data/snapshot.json). Escrita vira
// no-op: o teste NUNCA grava no banco real.
const fs = require('fs');
const path = require('path');

let _snap = null;
function snapshot() {
  if (!_snap) _snap = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.data', 'snapshot.json'), 'utf8'));
  return _snap;
}

async function installMock(page) {
  const snap = snapshot();

  // sessão falsa (o Gestão exige token pra buscar dados)
  await page.addInitScript(() => {
    try {
      localStorage.setItem('rk_sb_sess', JSON.stringify({
        access_token: 'test-token', refresh_token: 'test-refresh',
        expires_at: Date.now() + 1000 * 60 * 60 * 24 * 365, email: 'teste@rokbox', role: 'admin'
      }));
      localStorage.setItem('rk_role', 'admin');
    } catch (e) {}
  });

  // REST: GET devolve do snapshot; qualquer escrita é no-op
  await page.route(/\/rest\/v1\/sistema_dados/i, route => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    const u = new URL(req.url());
    const chave = u.searchParams.get('chave') || '';
    let keys = [], m;
    if ((m = /^in\.\((.*)\)$/.exec(chave))) keys = m[1].split(',').map(s => s.replace(/^"|"$/g, '').trim());
    else if ((m = /^eq\.(.*)$/.exec(chave))) keys = [chave.slice(3)];
    const rows = keys
      .filter(k => snap[k] !== undefined)
      .map(k => ({ chave: k, valor: JSON.stringify(snap[k]), atualizado_em: '2026-11-05T12:00:00+00:00' }));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  });

  // auth/refresh: sessão falsa
  await page.route(/\/auth\/v1\//i, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ access_token: 'test-token', refresh_token: 'test-refresh', expires_in: 3600, user: { email: 'teste@rokbox', user_metadata: { role: 'admin' } } })
  }));

  // qualquer outra chamada externa (Bling, Gmail, etc.) não deve sair na rede do teste
  await page.route(/supabase\.co\/(functions|storage)/i, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
}

// Coletor de erros de console/página, pra afirmar "console limpo".
function trackErrors(page) {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  return errors;
}

module.exports = { installMock, snapshot, trackErrors };
