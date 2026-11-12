const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// Função ÚNICA de competência (competencia.js), usada pelo DRE (financeiro.html) e pelas exportações
// do CR/CP (index.html). Trava: o DRE de outubro não pode mudar, e a competência de 3 pedidos no CR
// (NF senão pedido) tem que dar outubro.

test('Competência única: DRE out/26 inalterado (RL 224.447,22 · EBITDA −14.550,00 · LL −42.861,37)', async ({ page }) => {
  const errors = trackErrors(page);
  await installMock(page);
  await page.goto('/financeiro.html');
  const o = await page.evaluate(async () => {
    await carregar();
    let bc2 = {}, cpRaw = [], avul = [];
    try { const b = await gk('blingCustos2'); bc2 = (b && b.map) || {}; } catch (e) {}
    try { cpRaw = (await gk('contasPagar')) || []; } catch (e) {}
    try { avul = (await gk('receitasAvulsas')) || []; } catch (e) {}
    const T = _dreCalcTudo(bc2, {}, cpRaw, avul, _dreMeses())['2026-10'].Total;
    return { temCompetencia: (typeof Competencia === 'object' && typeof Competencia.receita === 'function'), recLiq: T.recLiq, ebitda: T.ebitda, ll: T.ll };
  });
  expect(o.temCompetencia, 'competencia.js carregado e exposto').toBe(true);
  expect(Math.abs(o.recLiq - 224447.22), 'Receita Líquida out/26').toBeLessThan(0.01);
  expect(Math.abs(o.ebitda - (-14550.00)), 'EBITDA out/26').toBeLessThan(0.01);
  expect(Math.abs(o.ll - (-42861.37)), 'Lucro Líquido out/26').toBeLessThan(0.01);
  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});

test('Competência única: CR out/26 pela NF/pedido (#398, #425, #41327 → 2026-10)', async ({ page }) => {
  const errors = trackErrors(page);
  await installMock(page);
  await page.goto('/index.html');
  const o = await page.evaluate(async () => {
    await carregarTudo();
    const byId = {}; (pedidos || []).forEach(p => byId[String(p.id)] = p);
    const comp = id => (byId[id] ? competenciaReceita(byId[id]) : 'SEM_PEDIDO');
    return { nf: Object.keys(_blingPedNFmapa || {}).length, c398: comp('398'), c425: comp('425'), c41327: comp('41327') };
  });
  expect(o.nf, 'mapa de NF carregado no boot').toBeGreaterThan(0);
  expect(o.c398, '#398').toBe('2026-10');
  expect(o.c425, '#425').toBe('2026-10');
  expect(o.c41327, '#41327').toBe('2026-10');
  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});
