const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// HISTÓRICO DE ALTERAÇÕES (19/11): toda gravação do Gestão registra na tabela 'historico' (quem/quando/chave/
// tela/qtd antes→depois). GARANTIA: fire-and-forget — NUNCA trava nem atrasa o salvar; se o histórico cair, o
// dado grava normal e o erro só vai pro console. Robô (headless) não registra. Quadro só-admin no Painel marca
// em VERMELHO as linhas em que a quantidade DIMINUIU.

async function bootGestao(page, initScript) {
  if (initScript) await page.addInitScript(initScript);
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return typeof saveData === 'function' && typeof _registrarHistorico === 'function'; } catch (e) { return false; } }, { timeout: 45000 });
}

test('GARANTIA: histórico fora do ar → o dado salva normal (erro só no console)', async ({ page }) => {
  // navegador "humano" (webdriver=false) → o histórico É tentado; e vamos fazê-lo FALHAR
  await bootGestao(page, () => { try { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); window.__ROBO = false; } catch (e) {} });
  let postsHist = 0;
  await page.route(/\/rest\/v1\/historico/i, route => { if (route.request().method() === 'POST') { postsHist++; return route.abort(); } return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); });
  const r = await page.evaluate(async () => {
    let threw = false, ret;
    try { ret = await saveData('calcParcelamento', { teste: 1, historico: [] }); } catch (e) { threw = true; }
    return { ret, threw };
  });
  await page.waitForTimeout(200);
  expect(r.threw, 'saveData NÃO lança erro mesmo com o histórico fora do ar').toBe(false);
  expect(r.ret, 'o DADO foi gravado normal (saveData = true)').toBe(true);
  expect(postsHist, 'o histórico foi TENTADO (e falhou, sem afetar o salvar)').toBeGreaterThan(0);
});

test('Não-robô REGISTRA: chave, qtd antes→depois e tela vão no POST do histórico', async ({ page }) => {
  await bootGestao(page, () => { try { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); window.__ROBO = false; } catch (e) {} });
  const corpos = [];
  await page.route(/\/rest\/v1\/historico/i, route => { const req = route.request(); if (req.method() === 'POST') { try { corpos.push(JSON.parse(req.postData() || '{}')); } catch (e) {} return route.fulfill({ status: 201, contentType: 'application/json', body: '' }); } return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); });
  await page.evaluate(async () => { _histQtd['bancosCadastro'] = 3; await saveData('bancosCadastro', ['Itaú', 'Bradesco']); }); // 3 → 2 (diminuiu)
  await page.waitForTimeout(250);
  const g = corpos.find(c => c.chave === 'bancosCadastro');
  expect(g, 'gravou 1 linha de histórico pra bancosCadastro').toBeTruthy();
  expect(g.qtd_antes, 'antes = baseline (3)').toBe(3);
  expect(g.qtd_depois, 'depois = 2').toBe(2);
  expect(typeof g.tela, 'manda a tela de origem').toBe('string');
  expect('usuario' in g, 'NÃO manda usuario (banco preenche do JWT)').toBe(false);
});

test('ROBÔ não registra: com __ROBO, nenhum POST de histórico', async ({ page }) => {
  await bootGestao(page, () => { try { window.__ROBO = true; } catch (e) {} });
  let posts = 0;
  await page.route(/\/rest\/v1\/historico/i, route => { if (route.request().method() === 'POST') { posts++; return route.fulfill({ status: 201, body: '' }); } return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); });
  const ehRobo = await page.evaluate(async () => { const r = _ehRoboVer(); await saveData('flatCR', [{ a: 1 }]); await saveData('bancosCadastro', ['X']); return r; });
  await page.waitForTimeout(200);
  expect(ehRobo, 'detectou robô').toBe(true);
  expect(posts, 'robô NÃO registra histórico').toBe(0);
});

// ── Quadro no Painel (financeiro.html) ──
async function bootPainel(page, rows) {
  await page.addInitScript(() => { try { localStorage.setItem('rk_sb_sess', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 31536000000, email: 'financeirorokbox+admin@gmail.com', role: 'admin' })); localStorage.setItem('rk_role', 'admin'); localStorage.setItem('rk_gate_fin', '1'); } catch (e) {} });
  await page.route(/\/rest\/v1\/historico/i, route => { if (route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }); return route.fulfill({ status: 201, body: '' }); });
  await page.route(/\/rest\/v1\/sistema_dados/i, route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route(/\/rest\/v1\/acessos/i, route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route(/\/auth\/v1\//i, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 't', refresh_token: 'r', expires_in: 3600, user: { email: 'financeirorokbox+admin@gmail.com', app_metadata: { role: 'admin' } } }) }));
  await page.route(/supabase\.co\/(functions|storage)/i, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.goto('/financeiro.html');
  await page.waitForFunction(() => { try { return typeof renderHistorico === 'function'; } catch (e) { return false; } }, { timeout: 60000 });
}

test('Quadro Histórico (admin): lista e marca VERMELHO quando a quantidade diminuiu', async ({ page }) => {
  const H = h => new Date(Date.now() - h * 3600000).toISOString();
  const rows = [
    { usuario: 'financeirorokbox+admin@gmail.com', papel: 'admin', chave: 'repasseLinks', qtd_antes: 5, qtd_depois: 2, tela: 'financeiro · banco', criado_em: H(1) }, // DIMINUIU
    { usuario: 'financeirorokbox+vendas@gmail.com', papel: 'vendas', chave: 'pedidos', qtd_antes: 100, qtd_depois: 101, tela: 'vendas', criado_em: H(3) },
    { usuario: 'financeirorokbox+admin@gmail.com', papel: 'admin', chave: 'contasPagar', qtd_antes: 40, qtd_depois: 40, tela: 'financeiro · pagar', criado_em: H(26) }
  ];
  await bootPainel(page, rows);
  const r = await page.evaluate(async () => {
    try { document.getElementById('gate').style.display = 'none'; document.getElementById('app').classList.remove('hidden'); aplicarRole(); } catch (e) {}
    setAba('historico'); await new Promise(res => setTimeout(res, 500));
    const el = document.getElementById('historico-conteudo');
    const linhaDim = [...el.querySelectorAll('tbody tr')].find(tr => /repasseLinks/.test(tr.innerText));
    const bg = linhaDim ? getComputedStyle(linhaDim).backgroundColor : '';
    return { txt: el.innerText, temFiltros: el.querySelectorAll('select').length, bgDim: bg };
  });
  expect(r.txt, 'mostra a chave que diminuiu').toContain('repasseLinks');
  expect(r.txt, 'mostra o e-mail').toContain('financeirorokbox+admin@gmail.com');
  expect(r.temFiltros, 'tem os 3 filtros (dia/chave/usuário)').toBeGreaterThanOrEqual(3);
  expect(r.bgDim, 'linha que diminuiu fica em vermelho (fundo não transparente)').toMatch(/rgba?\(\s*2\d\d/); // ~ vermelho translúcido
});
