const { test, expect } = require('@playwright/test');

// PROJEÇÃO ENCADEADA (25/11): o saldo inicial de cada mês futuro = EXATAMENTE o saldo final projetado do mês
// anterior (nov→dez→jan), com as mesmas regras do vigente (a receber = boletos emitidos a-vencer no mês;
// a pagar = em aberto no mês). Meses fechados/vigente não mudam. Teste: fim nov = início dez; fim dez = início jan.
// Hoje = 2026-11-25 (ambiente). Boletos a-vencer: nov 1000, dez 2000, jan 3000; contas: nov 500, dez 800, jan 1200.
const SNAP = {
  saldoDiaCP: { '2026-11-25': { 'Itaú - RK': 10000 } },
  flatCR: [
    { numero: 'B-NOV', cliente: 'A', vencimento: '2026-11-28', data_liquidacao: null, atraso_real: 1000, valor_bruto: 1000, canal_pagamento: 'Boleto Itaú', empresa: 'Rokbox', a_emitir: false },
    { numero: 'B-DEZ', cliente: 'B', vencimento: '2026-12-10', data_liquidacao: null, atraso_real: 2000, valor_bruto: 2000, canal_pagamento: 'Boleto Itaú', empresa: 'Rokbox', a_emitir: false },
    { numero: 'B-JAN', cliente: 'C', vencimento: '2027-01-15', data_liquidacao: null, atraso_real: 3000, valor_bruto: 3000, canal_pagamento: 'Boleto Itaú', empresa: 'Rokbox', a_emitir: false }
  ],
  flatCP: [
    { fornecedor: 'F1', vencimento: '2026-11-27', data_liquidacao: null, pago: false, cancelado: false, valor: 500, empresa: 'Rokbox' },
    { fornecedor: 'F2', vencimento: '2026-12-12', data_liquidacao: null, pago: false, cancelado: false, valor: 800, empresa: 'Rokbox' },
    { fornecedor: 'F3', vencimento: '2027-01-20', data_liquidacao: null, pago: false, cancelado: false, valor: 1200, empresa: 'Rokbox' }
  ],
  crFechado: {}, cpFechado: {}, balanceteFechado: {}
};

async function boot(page) {
  await page.addInitScript(() => { try { localStorage.setItem('rk_sb_sess', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 31536000000, email: 'financeirorokbox+admin@gmail.com', role: 'admin' })); localStorage.setItem('rk_role', 'admin'); localStorage.setItem('rk_gate_fin', '1'); } catch (e) {} });
  await page.route(/\/rest\/v1\/sistema_dados/i, route => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    const u = new URL(req.url()); const chave = (u.searchParams.get('chave') || '').replace(/^eq\./, '');
    const v = Object.prototype.hasOwnProperty.call(SNAP, chave) ? SNAP[chave] : null;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v == null ? [] : [{ chave, valor: JSON.stringify(v), atualizado_em: '2026-11-25T12:00:00+00:00' }]) });
  });
  await page.route(/\/auth\/v1\//i, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 't', refresh_token: 'r', expires_in: 3600, user: { email: 'financeirorokbox+admin@gmail.com', app_metadata: { role: 'admin' } } }) }));
  await page.route(/\/rest\/v1\/(acessos|historico|conferencia)/i, route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route(/supabase\.co\/(functions|storage)/i, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.goto('/financeiro.html');
  await page.waitForFunction(() => { try { return typeof _FIN !== 'undefined' && _FIN && document.getElementById('saldo-final') && document.getElementById('saldo-final').textContent.includes('R$'); } catch (e) { return false; } }, { timeout: 60000 });
}

async function doMes(page, m) {
  return await page.evaluate(async (mes) => {
    try { mudarMes(mes); } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
    const det = document.getElementById('saldo-final-det').textContent;
    const fim = document.getElementById('saldo-final').textContent.replace(/\s+/g, ' ').trim();
    const mi = det.match(/início do mês\s*(R\$[\s\d.,]+?)\s*\+/);
    return { fim, inicio: mi ? mi[1].replace(/\s+/g, ' ').trim() : null, det };
  }, m);
}

test('Projeção encadeada: fim de nov = início de dez; fim de dez = início de jan', async ({ page }) => {
  await boot(page);
  const nov = await doMes(page, '2026-11');
  const dez = await doMes(page, '2026-12');
  const jan = await doMes(page, '2027-01');
  // valores esperados: fim nov = 10000+1000-500 = 10.500,00 ; fim dez = 10500+2000-800 = 11.700,00 ; fim jan = 11700+3000-1200 = 13.500,00
  expect(nov.fim, 'fim de novembro projetado').toContain('10.500,00');
  expect(dez.inicio, 'início de dezembro = fim de novembro').toBe(nov.fim);
  expect(dez.fim, 'fim de dezembro').toContain('11.700,00');
  expect(jan.inicio, 'início de janeiro = fim de dezembro').toBe(dez.fim);
  expect(jan.fim, 'fim de janeiro').toContain('13.500,00');
});
