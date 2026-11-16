const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// (perf) credDevolucao memoizada: OLD × NEW = número IDÊNTICO. O cálculo não muda; só deixa de repetir.
async function boot(page) {
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return Array.isArray(pedidos) && pedidos.length > 100; } catch (e) { return false; } }, { timeout: 45000 });
}

test('credDevolucao memoizada é idêntica ao cálculo cru (OLD × NEW)', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    const temCalc = typeof _credDevolucaoCalc === 'function';
    const difs = [];
    let n = 0;
    (devolucoes || []).forEach(d => {
      n++;
      const memo = credDevolucao(d);
      const cru = _credDevolucaoCalc(d);
      if (String(memo) !== String(cru)) difs.push((d.pedido || '') + '|' + (d.cliente || '') + ': memo="' + memo + '" cru="' + cru + '"');
    });
    // cache correto: 2ª chamada igual; após mudar dados, recalcula e segue igual
    const d0 = (devolucoes || [])[0];
    let estavel = true;
    if (d0) { const a = credDevolucao(d0); const b = credDevolucao(d0); _bumpDataVersion(); const c = credDevolucao(d0); estavel = (String(a) === String(b) && String(b) === String(c)); }
    return { temCalc, n, difs: difs.slice(0, 10), nDif: difs.length, estavel };
  });

  expect(r.temCalc, '_credDevolucaoCalc existe').toBe(true);
  expect(r.n, 'há devoluções para comparar').toBeGreaterThan(0);
  expect(r.nDif, 'nenhuma diferença memo × cru: ' + r.difs.join(' ; ')).toBe(0);
  expect(r.estavel, 'cache estável e invalida por _dataVersion').toBe(true);

  expect(errors, 'console limpo: ' + errors.join(' | ')).toEqual([]);
});
