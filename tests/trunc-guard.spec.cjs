const { test, expect } = require('@playwright/test');
const { installMock } = require('./support/mock.cjs');

// REGRA: saveData nunca grava uma versão de debitoLinks/extratoLinks/repasseLinks/receitaLinks
// com muito menos itens que a do banco (queda >20% ou para 0) sem liberar antes. Protege contra
// uma carga vazia zerar os vínculos (foi o que esvaziou o debitoLinks em 12/11).
test('Trava anti-truncamento: bloqueia queda grande dos vínculos; permite igual/maior', async ({ page }) => {
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await installMock(page);
  await page.goto('/index.html');
  const r = await page.evaluate(async () => {
    await carregarTudo();
    const nDb = Object.keys(debitoLinks).length; // do snapshot (banco do mock)
    // 1) queda para 1 item → BLOQUEADO (false)
    const okTrunc = await saveData('debitoLinks', { soUm: { chave: 'x' } });
    // 2) mesma quantidade → PASSA (true)
    const okIgual = await saveData('debitoLinks', debitoLinks);
    // 3) chave NÃO protegida com objeto pequeno → PASSA (true)
    const okOutra = await saveData('lojaFixes', { a: 1 });
    // 4) com o bypass ligado, a queda passa
    _permitirTruncLinks = true;
    const okBypass = await saveData('debitoLinks', { soUm: { chave: 'x' } });
    _permitirTruncLinks = false;
    return { nDb, okTrunc, okIgual, okOutra, okBypass };
  });
  expect(r.nDb, 'banco do mock tem vínculos suficientes').toBeGreaterThan(20);
  expect(r.okTrunc, 'queda grande bloqueada').toBe(false);
  expect(r.okIgual, 'mesma quantidade passa').toBe(true);
  expect(r.okOutra, 'chave nao protegida passa').toBe(true);
  expect(r.okBypass, 'bypass permite a reducao proposital').toBe(true);
});
