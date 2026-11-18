const { test, expect } = require('@playwright/test');
const fs = require('fs'); const path = require('path');
const BASE = JSON.parse(fs.readFileSync(path.join(__dirname, '.data', 'snapshot.json'), 'utf8'));
const _d = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const hoje = _d(0), ontem = _d(-1);

// Regressão 18/11: o "Saldo em banco" do Painel deve ler o saldoDiaCP (digitado no Contas a Pagar), NUNCA o extrato
// (saldoInicialDia). Último valor por banco até hoje, com a data; não digitou hoje → mostra o último, com a data.
const SNAP = JSON.parse(JSON.stringify(BASE));
SNAP.saldoInicialDia = { [hoje]: { 'Itaú - ZZ': 99999.99, 'Bradesco - ZZ': 88888.88 } }; // EXTRATO — não pode aparecer
SNAP.saldoDiaCP = { [ontem]: { 'Itaú - ZZ': 111.11, 'Bradesco - ZZ': 555.55 }, [hoje]: { 'Itaú - ZZ': 12345.67 } };

async function installPainel(page) {
  await page.addInitScript(() => { try { localStorage.setItem('rk_sb_sess', JSON.stringify({ access_token:'t', refresh_token:'r', expires_at: Date.now()+31536000000, email:'teste@rokbox', role:'admin' })); localStorage.setItem('rk_role','admin'); } catch(e){} });
  await page.route(/\/rest\/v1\/sistema_dados/i, route => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fulfill({ status:200, contentType:'application/json', body:'[]' });
    const u = new URL(req.url()); const chave = u.searchParams.get('chave') || '';
    let keys = [], m;
    if ((m = /^in\.\((.*)\)$/.exec(chave))) keys = m[1].split(',').map(s => s.replace(/^"|"$/g,'').trim());
    else if ((m = /^eq\.(.*)$/.exec(chave))) keys = [chave.slice(3)];
    const rows = keys.filter(k => SNAP[k] !== undefined).map(k => ({ chave:k, valor: JSON.stringify(SNAP[k]), atualizado_em:'2026-11-18T12:00:00+00:00' }));
    return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(rows) });
  });
  await page.route(/\/auth\/v1\//i, route => route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ access_token:'t', refresh_token:'r', expires_in:3600, user:{ email:'teste@rokbox', user_metadata:{ role:'admin' } } }) }));
  await page.route(/supabase\.co\/(functions|storage)/i, route => route.fulfill({ status:200, contentType:'application/json', body:'{}' }));
}

test('Painel Saldo em banco = saldoDiaCP (digitado), nunca o extrato', async ({ page }) => {
  await installPainel(page);
  await page.goto('/financeiro.html');
  await page.waitForFunction(() => { try { return typeof _FIN !== 'undefined' && _FIN && document.getElementById('banks') && document.getElementById('banks').innerHTML.includes('TOTAL'); } catch(e){ return false; } }, { timeout: 60000 });
  const txt = await page.evaluate(() => document.getElementById('banks').innerText);

  expect(txt, 'Itaú mostra o digitado de hoje (12.345,67)').toContain('12.345,67');
  expect(txt, 'Bradesco mostra o último digitado (555,55), pois não digitou hoje').toContain('555,55');
  expect(txt.includes('99.999,99'), 'NÃO mostra o extrato (saldoInicialDia)').toBe(false);
  expect(txt.includes('88.888,88'), 'NÃO mostra o extrato (saldoInicialDia)').toBe(false);
  // total = soma do digitado (12.345,67 + 555,55 = 12.901,22)
  expect(txt.replace(/\s+/g, ' '), 'TOTAL soma o digitado').toContain('12.901,22');
});
