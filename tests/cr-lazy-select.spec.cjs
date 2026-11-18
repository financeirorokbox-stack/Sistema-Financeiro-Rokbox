const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// DESEMPENHO 18/11 (Contas a Receber): o seletor "trocar forma" (selectTrocaForma) é renderizado SÓ com 1 opção
// (a setinha ✏); as opções de forma são montadas no 1º clique (_fillTrocaForma). Antes, cada uma das ~1700 linhas
// trazia TODAS as opções + um formaPagamento.some() por linha. Visual colapsado idêntico.
async function boot(page) {
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return Array.isArray(pedidos) && pedidos.length > 100; } catch (e) { return false; } }, { timeout: 45000 });
}

test('selectTrocaForma: opções sob demanda (lazy) e trocarForma intacto', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    try { dateFilters = {}; if (typeof buscaPersist !== 'undefined') buscaPersist.contas = ''; } catch (e) {}
    document.querySelectorAll('.main').forEach(d => d.style.display = 'none');
    const v = document.getElementById('v-contas'); if (v) v.style.display = 'block';
    renderContas();
    const sels = v.querySelectorAll('select.ctf');
    if (!sels.length) return { semSel: true };
    const sel = sels[0];
    const optAntes = sel.querySelectorAll('option').length;           // deve ser 1 (lazy)
    const pedId = (sel.getAttribute('onchange') || '').match(/trocarForma\('([^']+)'/)[1];
    _fillTrocaForma(sel, pedId);                                       // simula o clique
    const optDepois = sel.querySelectorAll('option').length;          // deve crescer
    _fillTrocaForma(sel, pedId);                                       // idempotente
    const optDepois2 = sel.querySelectorAll('option').length;
    // todas as linhas visíveis têm selects com 1 opção no render (nenhuma já montada)
    const umaOpcao = [...sels].every(s => s.querySelectorAll('option').length === 1 || s === sel);
    return { semSel: false, optAntes, optDepois, optDepois2, umaOpcao, nSel: sels.length, temFn: typeof trocarForma === 'function', temClasse: !!v.querySelector('td.cr-liq') };
  });

  expect(r.semSel, 'há seletores de forma na tela').toBeFalsy();
  expect(r.optAntes, 'select nasce com 1 opção (lazy)').toBe(1);
  expect(r.optDepois, 'ao clicar, as opções são montadas').toBeGreaterThan(1);
  expect(r.optDepois2, 'preencher de novo não duplica (idempotente)').toBe(r.optDepois);
  expect(r.umaOpcao, 'nenhuma lista de opções é montada no render').toBe(true);
  expect(r.temFn, 'trocarForma continua existindo').toBe(true);
  expect(r.temClasse, 'estilos movidos p/ classe (cr-liq)').toBe(true);

  expect(errors, 'console limpo: ' + errors.join(' | ')).toEqual([]);
});
