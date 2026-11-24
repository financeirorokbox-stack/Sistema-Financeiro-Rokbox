const { test, expect } = require('@playwright/test');
const { installMock } = require('./support/mock.cjs');

// CONFERÊNCIA DE SEGURANÇA (23/11, item b): robô do banco roda 8h/18h, compara contagens com a anterior e confere
// meses fechados contra as fotos. AMARELO = redução explicada por ação manual (historico); VERMELHO = sem
// explicação ou mês fechado mudou. Faixa no topo (só admin) no Gestão e no Painel + botão "Conferir agora" + lista.
const H = h => new Date(Date.now() - h * 3600000).toISOString();
const ROWS = [
  { id: 3, criado_em: H(1), origem: 'auto', status: 'vermelho', resumo: 'ATENÇÃO: redução sem explicação ou mês fechado alterado', alertas: [
    { chave: 'debitoLinks', antes: 1125, depois: 1119, delta: -6, cor: 'amarelo', explicado: true, quem: 'financeirorokbox+admin@gmail.com', quando: H(2), acao: 'desvínculo manual' },
    { chave: 'repasseLinks', antes: 335, depois: 329, delta: -6, cor: 'vermelho', explicado: false }
  ] },
  { id: 2, criado_em: H(13), origem: 'manual', status: 'ok', resumo: 'Tudo certo', alertas: [] },
  { id: 1, criado_em: H(25), origem: 'auto', status: 'amarelo', resumo: 'Reduções explicadas', alertas: [{ chave: 'extratoBancario', antes: 2031, depois: 2030, delta: -1, cor: 'amarelo', explicado: true, quem: 'x', quando: H(26), acao: 'exclusão/lixeira do extrato' }] }
];

// ── PAINEL (financeiro.html) ──
async function bootPainel(page, captura) {
  await page.addInitScript(() => { try { localStorage.setItem('rk_sb_sess', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 31536000000, email: 'financeirorokbox+admin@gmail.com', role: 'admin' })); localStorage.setItem('rk_role', 'admin'); localStorage.setItem('rk_gate_fin', '1'); } catch (e) {} });
  await page.route(/\/rest\/v1\/conferencia/i, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROWS) }));
  await page.route(/\/rest\/v1\/rpc\/rodar_conferencia/i, route => { if (captura) captura.push(route.request().method()); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', alertas: [], resumo: 'Tudo certo' }) }); });
  await page.route(/\/rest\/v1\/(sistema_dados|acessos|historico)/i, route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route(/\/auth\/v1\//i, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 't', refresh_token: 'r', expires_in: 3600, user: { email: 'financeirorokbox+admin@gmail.com', app_metadata: { role: 'admin' } } }) }));
  await page.route(/supabase\.co\/(functions|storage)/i, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.goto('/financeiro.html');
  await page.waitForFunction(() => { try { return typeof renderConferencia === 'function'; } catch (e) { return false; } }, { timeout: 60000 });
}

test('Painel: aba Conferência mostra status, alertas (amarelo/vermelho) e a lista', async ({ page }) => {
  await bootPainel(page);
  const r = await page.evaluate(async () => {
    try { document.getElementById('gate').style.display = 'none'; document.getElementById('app').classList.remove('hidden'); aplicarRole(); } catch (e) {}
    setAba('conferencia'); await new Promise(res => setTimeout(res, 500));
    const el = document.getElementById('conferencia-conteudo');
    return { txt: el.innerText, html: el.innerHTML, temBtn: /Conferir agora/.test(el.innerHTML), linhas: el.querySelectorAll('tbody tr').length };
  });
  expect(r.txt, 'mostra o status atual (Atenção/vermelho)').toMatch(/Atenção/i);
  expect(r.txt, 'alerta explicado com quem/ação (amarelo)').toMatch(/explicado/i);
  expect(r.txt, 'alerta sem explicação (vermelho)').toMatch(/sem ação manual/i);
  expect(r.temBtn, 'tem o botão Conferir agora').toBe(true);
  expect(r.linhas, 'lista das últimas conferências').toBeGreaterThanOrEqual(3);
});

test('Painel: faixa no topo quando a última conferência tem alerta', async ({ page }) => {
  await bootPainel(page);
  const r = await page.evaluate(async () => {
    try { document.getElementById('gate').style.display = 'none'; document.getElementById('app').classList.remove('hidden'); aplicarRole(); } catch (e) {}
    await _confBoot(); await new Promise(res => setTimeout(res, 150));
    const f = document.getElementById('conf-faixa');
    return { tem: !!f, txt: f ? f.innerText : '' };
  });
  expect(r.tem, 'faixa de conferência apareceu').toBe(true);
  expect(r.txt, 'faixa mostra o resumo').toMatch(/Confer[êe]ncia/i);
});

test('Painel: "Conferir agora" dispara a RPC rodar_conferencia', async ({ page }) => {
  const captura = [];
  await bootPainel(page, captura);
  await page.evaluate(async () => {
    try { document.getElementById('gate').style.display = 'none'; document.getElementById('app').classList.remove('hidden'); aplicarRole(); } catch (e) {}
    await _confAgora();
  });
  await page.waitForTimeout(200);
  expect(captura.filter(m => m === 'POST').length, 'chamou a RPC (POST)').toBeGreaterThan(0);
});

// ── GESTÃO (index.html) ──
test('Gestão: faixa + botão de conferência (admin) e modal com os alertas', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('rk_sb_sess', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 31536000000, email: 'financeirorokbox+admin@gmail.com', role: 'admin' })); } catch (e) {} });
  await installMock(page);
  await page.route(/\/rest\/v1\/conferencia/i, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROWS) }));
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return typeof _confBootG === 'function' && _sbSess; } catch (e) { return false; } }, { timeout: 45000 });
  const r = await page.evaluate(async () => {
    await _confBootG(); await new Promise(res => setTimeout(res, 150));
    const faixa = document.getElementById('conf-faixa-g');
    const btn = document.getElementById('btn-conferencia');
    await _confModalG(); await new Promise(res => setTimeout(res, 150));
    const modal = document.getElementById('conf-modal');
    return { temFaixa: !!faixa, btnVisivel: btn ? btn.style.display !== 'none' : false, temModal: !!modal, modalTxt: modal ? modal.innerText : '' };
  });
  expect(r.temFaixa, 'faixa de conferência no topo do Gestão').toBe(true);
  expect(r.btnVisivel, 'botão Conferência visível p/ admin').toBe(true);
  expect(r.temModal, 'modal abre').toBe(true);
  expect(r.modalTxt, 'modal mostra o alerta explicado').toMatch(/explicado/i);
  expect(r.modalTxt, 'modal mostra o alerta sem explicação').toMatch(/sem ação manual/i);
});
