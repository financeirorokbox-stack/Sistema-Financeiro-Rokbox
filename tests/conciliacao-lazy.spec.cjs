const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// DESEMPENHO (17/11): na Conciliação Bancária, a lista de contas de cada débito é montada SÓ no clique
// (cbToggleDebList → _cbDebListInnerHTML). O render só emite a caixa vazia (antes gerava ~94 MB de DOM).
async function boot(page) {
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return Array.isArray(pedidos) && pedidos.length > 100; } catch (e) { return false; } }, { timeout: 45000 });
}

test('lista de contas do débito é lazy: caixa vazia no render, montada no clique', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    try { bancoConcSel = '__todos'; } catch (e) {}
    try { if (typeof buscaPersist !== 'undefined') buscaPersist.banco = ''; } catch (e) {}
    try { dateFilters = {}; } catch (e) {}
    renderBanco();
    const boxes = [...document.querySelectorAll('[id^="cb-deb-box-"]')];
    if (!boxes.length) return { semBox: true };
    const box = boxes[0];
    const id = box.id.replace('cb-deb-box-', '');
    const vaziaAntes = box.innerHTML.trim() === '';           // render deixa vazio (lazy)
    cbToggleDebList(id);                                       // 1º clique monta
    const rowsDepois = box.querySelectorAll('.cb-deb-row-' + id).length;
    const temVincular = /cbVincularDebito/.test(box.innerHTML);
    const temCheckbox = box.querySelectorAll('.cb-deb-pick-' + id).length;
    cbToggleDebList(id);                                       // fecha
    const escondeu = box.style.display === 'none';
    // nenhuma caixa vem preenchida no render (todas vazias)
    const todasVaziasNoRender = boxes.every(b => b.id === box.id || b.innerHTML.trim() === '');
    return { semBox: false, vaziaAntes, rowsDepois, temVincular, temCheckbox, escondeu, todasVaziasNoRender, nContas: contasPagar.filter(c => !c.cancelado).length };
  });

  expect(r.semBox, 'há débitos não conciliados com caixa de contas').toBeFalsy();
  expect(r.vaziaAntes, 'a caixa nasce VAZIA no render (lazy)').toBe(true);
  expect(r.todasVaziasNoRender, 'nenhuma lista é montada no render').toBe(true);
  expect(r.rowsDepois, 'ao clicar, monta as linhas de contas').toBeGreaterThan(0);
  expect(r.temCheckbox, 'tem checkboxes de conta pra flegar').toBeGreaterThan(0);
  expect(r.temVincular, 'tem o botão Vincular flegados').toBe(true);
  expect(r.escondeu, 'segundo clique fecha a caixa').toBe(true);

  expect(errors, 'console limpo: ' + errors.join(' | ')).toEqual([]);
});
