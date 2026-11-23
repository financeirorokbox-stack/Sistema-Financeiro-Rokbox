const { test, expect } = require('@playwright/test');

// PROJEÇÃO DO PAINEL (23/11): o quadro "Saldo no fim do mês (projetado)" usa, no "a receber (a vencer)", EXATAMENTE
// o mesmo número do quadro "A vencer (boletos emitidos)" (crVencerBol) — não mais crVencer (todas as formas).
// Mês vigente e futuros. Teste: o nº da projeção = o nº do quadro de cima, mesmo quando as formas divergem.
const _hoje = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();

// 1 boleto EMITIDO a vencer (1000) + 1 PIX a vencer (500) → crVencer=1500, crVencerBol=1000. A projeção tem que usar 1000.
const FLATCR = [
  { numero: 'B1', vencimento: _hoje, data_liquidacao: null, atraso_real: 1000, valor_bruto: 1000, canal_pagamento: 'Boleto Itaú', empresa: 'Rokbox', a_emitir: false },
  { numero: 'P1', vencimento: _hoje, data_liquidacao: null, atraso_real: 500, valor_bruto: 500, canal_pagamento: 'PIX', empresa: 'Rokbox' }
];
const VALS = { flatCR: FLATCR, flatCP: [], crFechado: {}, cpFechado: {}, balanceteFechado: {}, saldoDiaCP: { [_hoje]: { 'Itaú - Rokbox': 5000 } } };

async function boot(page) {
  await page.addInitScript(() => { try { localStorage.setItem('rk_sb_sess', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 31536000000, email: 'financeirorokbox+admin@gmail.com', role: 'admin' })); localStorage.setItem('rk_role', 'admin'); localStorage.setItem('rk_gate_fin', '1'); } catch (e) {} });
  await page.route(/\/rest\/v1\/sistema_dados/i, route => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    const u = new URL(req.url()); const chave = (u.searchParams.get('chave') || '').replace(/^eq\./, '');
    const v = Object.prototype.hasOwnProperty.call(VALS, chave) ? VALS[chave] : null;
    const rows = v == null ? [] : [{ chave, valor: JSON.stringify(v), atualizado_em: _hoje + 'T12:00:00+00:00' }];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  });
  await page.route(/\/auth\/v1\//i, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 't', refresh_token: 'r', expires_in: 3600, user: { email: 'financeirorokbox+admin@gmail.com', app_metadata: { role: 'admin' } } }) }));
  await page.route(/\/rest\/v1\/(acessos|historico)/i, route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route(/supabase\.co\/(functions|storage)/i, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.goto('/financeiro.html');
  await page.waitForFunction(() => { try { const d = document.getElementById('saldo-final-det'); const v = document.getElementById('cr-vencer'); return d && v && d.textContent.includes('a vencer') && v.textContent.includes('R$'); } catch (e) { return false; } }, { timeout: 60000 });
}

test('Projeção usa o MESMO "a vencer" do quadro de cima (crVencerBol, não todas as formas)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const crVencerTopo = document.getElementById('cr-vencer').textContent.trim();     // "A vencer (boletos emitidos)"
    const det = document.getElementById('saldo-final-det').textContent;               // projeção
    const m = det.match(/a receber \(a vencer\)\s*(R\$[\s\d.,]+?)\s*[−-]/);
    return { crVencerTopo, projAVencer: m ? m[1].trim() : null, det };
  });
  // o quadro de cima mostra os boletos emitidos = R$ 1.000,00 (não 1.500,00)
  expect(r.crVencerTopo.replace(/\s+/g, ' '), 'quadro de cima = boletos emitidos (1.000,00)').toContain('1.000,00');
  expect(r.projAVencer, 'a projeção mostra o a-vencer').toBeTruthy();
  const norm = s => s.replace(/\s+/g, ' ').trim();
  expect(norm(r.projAVencer), 'o "a vencer" da projeção = o nº do quadro de cima').toBe(norm(r.crVencerTopo));
  expect(norm(r.projAVencer), 'NÃO é o valor de todas as formas (1.500,00)').not.toContain('1.500');
});
