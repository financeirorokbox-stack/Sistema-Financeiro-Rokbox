const { test, expect } = require('@playwright/test');
const { installMock } = require('./support/mock.cjs');

// MARGEM — tela reorganizada (25/11): mesmos CÁLCULOS, só muda a organização.
// Guarda a ESTRUTURA nova: 3 cards, alertas compactos, tabela enxuta (6 col) ↔ detalhes (12 col),
// Configurações recolhidas, e que renderiza SEM erro de console nas 5 abas. Os números em si já têm
// a prova OLD×NEW (feita na implementação); aqui garantimos que a tela não quebra e os toggles funcionam.
const MES = '2026-10';

async function abrirMargem(page) {
  await installMock(page);
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  await page.goto('/financeiro.html');
  await page.waitForFunction(() => typeof _FIN !== 'undefined' && _FIN && (_FIN.pedidos || []).length > 0, { timeout: 60000 });
  await page.evaluate((mes) => { try { document.getElementById('app').classList.remove('nums-ocultos'); } catch (e) {} mesSel = mes; setAba('margem'); }, MES);
  await page.waitForTimeout(500);
  return erros;
}

function headerCols(page) {
  return page.evaluate(() => {
    const el = document.getElementById('margem-conteudo');
    // tabela principal = a que tem "Peças" na 2ª coluna do cabeçalho
    const t = [...el.querySelectorAll('table.bal')].find(t => { const r = t.querySelector('tr'); return r && r.children[1] && /Peças/.test(r.children[1].textContent); });
    const r = t ? t.querySelector('tr') : null;
    return r ? r.children.length : 0;
  });
}

test('Margem: 3 cartões de topo + Destaques + tabela enxuta (6 col) sem erro', async ({ page }) => {
  const erros = await abrirMargem(page);
  // os 3 cartões de topo (por rótulo), independentes dos cartões de Destaques
  const txt = await page.evaluate(() => document.getElementById('margem-conteudo').innerText);
  expect(txt).toMatch(/Receita líquida/i);
  expect(txt).toMatch(/Margem de contribuição/i);
  expect(txt).toMatch(/Lucro do mês/i);
  // Destaques (parte 2)
  expect(txt, 'cartão mais lucrou').toMatch(/mais lucrou/i);
  expect(txt, 'cartão mais vendeu').toMatch(/mais vendeu/i);
  // tabela enxuta = 6 colunas
  expect(await headerCols(page), 'tabela enxuta tem 6 colunas').toBe(6);
  expect(erros, 'sem erro de console/página: ' + JSON.stringify(erros)).toEqual([]);
});

test('Margem: filtro de empresa particiona exato (Rokbox + Rk = Todas)', async ({ page }) => {
  const erros = await abrirMargem(page);
  const tot = (emp) => page.evaluate((e) => {
    _margEmp = e; _margDim = 'colecao'; _margDetalhes = true; renderMargem();
    const el = document.getElementById('margem-conteudo');
    const t = [...el.querySelectorAll('table.bal')].find(t => { const r = t.querySelector('tr'); return r && r.children[1] && /Peças/.test(r.children[1].textContent); });
    let pcs = 0, rec = 0, custo = 0, mg = 0;
    const num = s => { const m = (s || '').match(/-?\d[\d.]*,\d{2}|-?\d[\d.]*/g); if (!m) return 0; return Math.round(parseFloat(m[0].replace(/\./g, '').replace(',', '.')) * 100) / 100; };
    if (t) [...t.querySelectorAll(':scope>tbody>tr, :scope>tr')].forEach(tr => { if (tr.classList.contains('mdet') || tr.querySelector('th')) return; const c = [...tr.children]; if (!c.length) return; pcs += num(c[1].textContent); rec += num(c[5].textContent); custo += num(c[9].textContent); mg += num(c[10].textContent); });
    return { pcs, rec, custo, mg };
  }, emp);
  const A = await tot(''), R = await tot('Rokbox'), K = await tot('Rk');
  const close = (a, b) => Math.abs(a - b) < 0.5;
  expect(close(A.rec, R.rec + K.rec), `receita Todas ${A.rec} = Rokbox+Rk ${R.rec + K.rec}`).toBe(true);
  expect(close(A.custo, R.custo + K.custo), `custo ${A.custo} = ${R.custo + K.custo}`).toBe(true);
  expect(close(A.mg, R.mg + K.mg), `margem ${A.mg} = ${R.mg + K.mg}`).toBe(true);
  expect(close(A.pcs, R.pcs + K.pcs), `peças ${A.pcs} = ${R.pcs + K.pcs}`).toBe(true);
  expect(R.rec, 'cada empresa tem parte da receita').toBeGreaterThan(0);
  expect(K.rec).toBeGreaterThan(0);
  expect(erros, 'sem erro: ' + JSON.stringify(erros)).toEqual([]);
});

test('Margem: custos fixos por empresa persistem e lucro Rokbox+Rk = Todas', async ({ page }) => {
  const erros = await abrirMargem(page);
  await page.evaluate(() => { mesSel = '2026-11'; setAba('margem'); setCustoFixoEmp('Rokbox', '10000'); setCustoFixoEmp('Rk', '5.000,00'); });
  const saved = await page.evaluate(() => JSON.stringify((_FIN.custosFixosMes || {})['2026-11']));
  expect(saved, 'gravou por empresa').toBe('{"Rokbox":10000,"Rk":5000}');
  const lucro = (emp) => page.evaluate((e) => { _margEmp = e; renderMargem(); const el = document.getElementById('margem-conteudo'); const c = [...el.querySelectorAll('.card')].find(c => /LUCRO DO MÊS/i.test(c.innerText)); const t = c.querySelector('.big').textContent; const n = (t.match(/-?\d[\d.]*,\d{2}/) || ['0'])[0].replace(/\./g, '').replace(',', '.'); return Math.round(parseFloat(n) * 100) / 100; }, emp);
  const A = await lucro(''), R = await lucro('Rokbox'), K = await lucro('Rk');
  expect(Math.abs(A - (R + K)) < 0.05, `lucro Todas ${A} = Rokbox+Rk ${R + K}`).toBe(true);
  // sem custo fixo em outro mês → cartão pede pra informar
  const semFixo = await page.evaluate(() => { mesSel = '2026-09'; setAba('margem'); _margEmp = ''; renderMargem(); return /informe os custos fixos/i.test(document.getElementById('margem-conteudo').innerText); });
  expect(semFixo, 'mês sem custo fixo mostra "informe os custos fixos"').toBe(true);
  expect(erros, 'sem erro: ' + JSON.stringify(erros)).toEqual([]);
});

test('Margem: Campanha auto-aplica por período+segmentos e compara com a base (venda normal)', async ({ page }) => {
  const erros = await abrirMargem(page);
  const r = await page.evaluate(() => {
    mesSel = '2026-11'; setAba('margem');
    const c = criarCampanha('Teste BF', '2026-11-01', '2026-11-09', '5', ['Site', 'Varejo', 'Atacado']);
    _margEmp = ''; _margCampAberta = true; _margCampVer = c.id; renderMargem();
    const card = document.querySelector('[data-campsec]');
    const txt = card.innerText;
    // linha recolhida da campanha deve existir (nome + período)
    const temLinha = /Teste BF/.test(txt) && /01\/11\/2026/.test(txt);
    // comparação dentro × base
    const temBase = /Venda normal/.test(txt) && /base 0?2\/10\/2026/.test(txt);
    // lista ordenada por maior desconto: extrai a coluna Desconto da tabela de pedidos
    const tabs = [...card.querySelectorAll('table.bal')];
    const lista = tabs.find(t => /Desconto/.test(t.querySelector('tr') ? t.querySelector('tr').textContent : ''));
    let descs = [];
    if (lista) descs = [...lista.querySelectorAll('tbody tr')].map(tr => { const c = tr.children[2]; return c ? parseFloat((c.textContent.match(/[\d.]+/) || ['0'])[0]) : null; }).filter(v => v != null);
    const ordenado = descs.every((v, i) => i === 0 || descs[i - 1] >= v);
    return { temLinha, temBase, nLista: descs.length, ordenado };
  });
  expect(r.temLinha, 'linha recolhida da campanha').toBe(true);
  expect(r.temBase, 'comparação com base (venda normal) e período da base').toBe(true);
  expect(r.nLista, 'lista de pedidos da campanha tem itens').toBeGreaterThan(0);
  expect(r.ordenado, 'lista ordenada por maior desconto primeiro').toBe(true);
  expect(erros, 'sem erro: ' + JSON.stringify(erros)).toEqual([]);
});

test('Margem: Destaques por coleção (todos os meses) renderiza sem erro', async ({ page }) => {
  const erros = await abrirMargem(page);
  // escolhe a primeira coleção do seletor e confere que os cartões continuam
  const col = await page.evaluate(() => { const s = document.querySelector('#margem-conteudo select'); const op = [...s.options].find(o => o.value); if (op) { setMargDestaque(op.value); return op.value; } return null; });
  await page.waitForTimeout(400);
  const txt = await page.evaluate(() => document.getElementById('margem-conteudo').innerText);
  expect(col, 'há coleções no seletor').toBeTruthy();
  expect(txt).toMatch(/mais lucrou/i);
  expect(txt).toMatch(/todos os meses/i);
  expect(erros, 'sem erro: ' + JSON.stringify(erros)).toEqual([]);
});

test('Margem: "Mostrar detalhes" expande pra 12 colunas e volta', async ({ page }) => {
  await abrirMargem(page);
  expect(await headerCols(page)).toBe(6);
  await page.evaluate(() => toggleMargDetalhes());
  await page.waitForTimeout(200);
  expect(await headerCols(page), 'detalhes = 12 colunas (todas as de hoje)').toBe(12);
  await page.evaluate(() => toggleMargDetalhes());
  await page.waitForTimeout(200);
  expect(await headerCols(page), 'volta pra enxuta').toBe(6);
});

test('Margem: alerta "fora da margem" abre a tabela, e Configurações recolhem', async ({ page }) => {
  await abrirMargem(page);
  // Configurações começam recolhidas: os inputs de margem mínima não estão no DOM
  let temCfg = await page.evaluate(() => !!document.getElementById('margem-conteudo').innerHTML.match(/Margem mínima por segmento/));
  expect(temCfg, 'configurações começam recolhidas').toBe(false);
  await page.evaluate(() => toggleMargCfg());
  await page.waitForTimeout(200);
  temCfg = await page.evaluate(() => !!document.getElementById('margem-conteudo').innerHTML.match(/Margem mínima por segmento/));
  expect(temCfg, 'configurações aparecem ao abrir').toBe(true);
  // alerta fora da margem: abre a tabela de pedidos fora
  await page.evaluate(() => setMargAlerta('fora'));
  await page.waitForTimeout(200);
  const temFora = await page.evaluate(() => !!document.getElementById('margem-conteudo').innerHTML.match(/Pedidos fora da margem/));
  expect(temFora, 'alerta fora abre a lista').toBe(true);
});
