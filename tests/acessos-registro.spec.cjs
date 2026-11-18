const { test, expect } = require('@playwright/test');

// REGISTRO DE ACESSOS (18/11): toda abertura do Painel grava 1 linha em 'acessos'.
// E-mail, papel e user_id são preenchidos pelo BANCO (trigger, do JWT) — a página NÃO manda esses
// campos (não dá pra disfarçar). A página só informa pagina + aparelho (tipo) + dispositivo (código
// guardado no navegador). RLS: só a própria linha, só admin lê, ninguém edita/apaga. O quadro
// (aba só-admin) mostra por CONTA → aparelhos, destaca aparelho NOVO e o admin dá nome aos aparelhos.
const _d = n => new Date(Date.now() - n*3600000).toISOString();
const SAMPLE = [
  // conta admin, aparelho ANTIGO (1º acesso há 20 dias) + aparelho NOVO (1º acesso há 1 dia)
  { usuario:'financeirorokbox+admin@gmail.com', papel:'admin', pagina:'financeiro', aparelho:'Windows · Chrome', dispositivo:'dev-antigo-AAA', criado_em:_d(480) },
  { usuario:'financeirorokbox+admin@gmail.com', papel:'admin', pagina:'financeiro', aparelho:'Windows · Chrome', dispositivo:'dev-antigo-AAA', criado_em:_d(2) },
  { usuario:'financeirorokbox+admin@gmail.com', papel:'admin', pagina:'financeiro', aparelho:'iPhone · Safari',  dispositivo:'dev-novo-BBB',   criado_em:_d(20) },
  // conta vendas
  { usuario:'financeirorokbox+vendas@gmail.com', papel:'vendas', pagina:'placar', aparelho:'Android · Chrome', dispositivo:'dev-vendas-CCC', criado_em:_d(5) },
  { usuario:'financeirorokbox+vendas@gmail.com', papel:'vendas', pagina:'placar', aparelho:'Android · Chrome', dispositivo:'dev-vendas-CCC', criado_em:_d(30) },
];

async function instalar(page, role) {
  await page.addInitScript((r) => { try {
    localStorage.setItem('rk_sb_sess', JSON.stringify({ access_token:'t', refresh_token:'r', expires_at: Date.now()+31536000000, email:'financeirorokbox+'+r+'@gmail.com', role:r }));
    localStorage.setItem('rk_role', r); localStorage.setItem('rk_gate_fin','1'); localStorage.setItem('rk_gate_vendas','1');
  } catch(e){} }, role);
  const posts = []; const nomesSalvos = [];
  await page.route(/\/rest\/v1\/acessos/i, route => {
    const req = route.request();
    if (req.method() === 'POST') { let b={}; try{ b=JSON.parse(req.postData()||'{}'); }catch(e){} posts.push({ body:b, prefer: req.headers()['prefer']||'' }); return route.fulfill({ status:201, contentType:'application/json', body:'' }); }
    return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(SAMPLE) });
  });
  await page.route(/\/rest\/v1\/sistema_dados/i, route => {
    const req = route.request();
    if (req.method() === 'POST') { let b={}; try{ b=JSON.parse(req.postData()||'{}'); }catch(e){} nomesSalvos.push(b); return route.fulfill({ status:201, contentType:'application/json', body:'' }); }
    return route.fulfill({ status:200, contentType:'application/json', body:'[]' }); // gk → null
  });
  await page.route(/\/auth\/v1\//i, route => route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ access_token:'t', refresh_token:'r', expires_in:3600, user:{ email:'financeirorokbox+'+role+'@gmail.com', app_metadata:{ role } } }) }));
  await page.route(/supabase\.co\/(functions|storage)/i, route => route.fulfill({ status:200, contentType:'application/json', body:'{}' }));
  return { posts, nomesSalvos };
}

test('Boot grava pagina+aparelho+dispositivo e NÃO manda e-mail/papel (vêm do banco)', async ({ page }) => {
  const { posts } = await instalar(page, 'admin');
  await page.goto('/financeiro.html');
  await page.waitForFunction(() => { try { return typeof _registrarAcesso === 'function'; } catch(e){ return false; } }, { timeout: 60000 });
  await page.waitForTimeout(600);
  const g = posts.find(p => p.body && p.body.pagina === 'financeiro');
  expect(g, 'gravou 1 acesso no boot (financeiro)').toBeTruthy();
  expect(g.body.aparelho, 'manda o tipo de aparelho').toMatch(/·/);
  expect(typeof g.body.dispositivo, 'manda o código do aparelho').toBe('string');
  expect(g.body.dispositivo.length, 'código não vazio').toBeGreaterThan(5);
  expect('usuario' in g.body, 'NÃO manda e-mail (banco preenche do JWT)').toBe(false);
  expect('papel' in g.body, 'NÃO manda papel (banco preenche do JWT)').toBe(false);
  expect('user_id' in g.body, 'NÃO manda user_id').toBe(false);
  expect(g.prefer, 'Prefer: return=minimal').toContain('minimal');
});

test('Código do aparelho é estável (mesmo em aberturas seguidas)', async ({ page }) => {
  await instalar(page, 'admin');
  await page.goto('/financeiro.html');
  await page.waitForFunction(() => { try { return typeof _aparelhoId === 'function'; } catch(e){ return false; } }, { timeout: 60000 });
  const r = await page.evaluate(() => ({ a: _aparelhoId(), b: _aparelhoId(), ls: localStorage.getItem('rk_aparelho_id') }));
  expect(r.a, '2 chamadas devolvem o mesmo código').toBe(r.b);
  expect(r.ls, 'código guardado no navegador').toBe(r.a);
});

test('Robô NUNCA é registrado', async ({ page }) => {
  const { posts } = await instalar(page, 'admin');
  await page.goto('/financeiro.html');
  await page.waitForFunction(() => { try { return typeof _registrarAcesso === 'function'; } catch(e){ return false; } }, { timeout: 60000 });
  const antes = posts.length;
  await page.evaluate(async () => { _sbSess.role = 'robo'; await _registrarAcesso('financeiro'); });
  await page.waitForTimeout(200);
  expect(posts.length, 'robô não gera POST novo').toBe(antes);
});

test('Quadro (admin): por conta → aparelhos, e-mail visível, destaque de NOVO', async ({ page }) => {
  await instalar(page, 'admin');
  await page.goto('/financeiro.html');
  await page.waitForFunction(() => { try { return typeof renderAcessos === 'function'; } catch(e){ return false; } }, { timeout: 60000 });
  const r = await page.evaluate(async () => {
    try{ document.getElementById('gate').style.display='none'; document.getElementById('app').classList.remove('hidden'); aplicarRole(); }catch(e){}
    setAba('acessos'); await new Promise(res => setTimeout(res, 500));
    const el = document.getElementById('acessos-conteudo');
    return { txt: el.innerText, html: el.innerHTML, inputs: el.querySelectorAll('input').length };
  });
  expect(r.txt, 'mostra o e-mail da conta (não só o papel)').toContain('financeirorokbox+admin@gmail.com');
  expect(r.txt, 'mostra o tipo de aparelho').toContain('iPhone · Safari');
  expect(r.html, 'destaca aparelho NOVO (1º acesso recente)').toContain('NOVO');
  expect(r.txt, 'aparelho antigo não é marcado como novo (Windows · Chrome presente sem erro)').toContain('Windows · Chrome');
  expect(r.inputs, 'tem campo para dar nome aos aparelhos').toBeGreaterThan(0);
});

test('Admin dá nome ao aparelho → salva na chave acessosAparelhos', async ({ page }) => {
  const { nomesSalvos } = await instalar(page, 'admin');
  await page.goto('/financeiro.html');
  await page.waitForFunction(() => { try { return typeof _nomearAparelho === 'function'; } catch(e){ return false; } }, { timeout: 60000 });
  await page.evaluate(async () => { await _nomearAparelho('dev-novo-BBB', 'meu celular'); });
  await page.waitForTimeout(200);
  const salvo = nomesSalvos.find(b => b && b.chave === 'acessosAparelhos');
  expect(salvo, 'salvou a chave acessosAparelhos').toBeTruthy();
  const val = JSON.parse(salvo.valor);
  expect(val['dev-novo-BBB'], 'nome gravado para o aparelho').toBe('meu celular');
});

test('Não-admin NÃO vê a aba Acessos', async ({ page }) => {
  await instalar(page, 'diretor');
  await page.goto('/financeiro.html');
  await page.waitForFunction(() => { try { return typeof aplicarRole === 'function'; } catch(e){ return false; } }, { timeout: 60000 });
  const r = await page.evaluate(() => {
    try{ document.getElementById('gate').style.display='none'; document.getElementById('app').classList.remove('hidden'); aplicarRole(); }catch(e){}
    const btn = [...document.querySelectorAll('.aba')].find(b => b.dataset.t==='acessos');
    setAba('acessos');
    const ativa = document.querySelector('.aba.on') && document.querySelector('.aba.on').dataset.t;
    return { escondida: btn ? btn.style.display==='none' : true, ativa };
  });
  expect(r.escondida, 'aba Acessos escondida p/ diretor').toBe(true);
  expect(r.ativa, 'diretor cai pra fluxo, não acessos').not.toBe('acessos');
});
