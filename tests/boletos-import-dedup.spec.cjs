const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// #5 import de boletos: dedup por CONTEÚDO (pagador+dia+valor, tol 0,05) IGNORANDO o nº do pedido.
// Pega o caso do lixo "4.016,34" (um valor caiu no campo do pedido) que a dedup por pedido deixava passar.
async function boot(page) {
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return Array.isArray(pedidos) && pedidos.length > 100; } catch (e) { return false; } }, { timeout: 45000 });
}

test('boletos import: dedup por conteúdo ignora nº de pedido (lixo não duplica)', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    const temFn = typeof _boletoConteudoJaExiste === 'function';
    // injeta um boleto avulso "real"
    boletosAvulsos.push({ _uid: 'teste_x1', pedido: '39951', cliente: 'FERREIRA CLOTHES LTDA', valorTitulo: 1338.78, valorPago: 1338.78, dataPagamento: '2026-10-05', vencimento: '2026-10-05' });
    // 1) mesmo conteúdo, pedido LIXO "4.016,34" -> já existe (não duplica)
    const lixo = _boletoConteudoJaExiste('FERREIRA CLOTHES LTDA', '2026-10-05', 1338.78);
    // 2) tolerância 0,05
    const tol = _boletoConteudoJaExiste('FERREIRA CLOTHES LTDA', '2026-10-05', 1338.82);
    // 3) valor bem diferente -> não existe
    const outroValor = _boletoConteudoJaExiste('FERREIRA CLOTHES LTDA', '2026-10-05', 1500.00);
    // 4) outro dia -> não existe
    const outroDia = _boletoConteudoJaExiste('FERREIRA CLOTHES LTDA', '2026-10-06', 1338.78);
    // 5) outro pagador -> não existe
    const outroNome = _boletoConteudoJaExiste('OUTRO CLIENTE', '2026-10-05', 1338.78);
    return { temFn, lixo, tol, outroValor, outroDia, outroNome };
  });

  expect(r.temFn, '_boletoConteudoJaExiste existe').toBe(true);
  expect(r.lixo, 'mesmo conteúdo (pedido lixo) é detectado como já existente').toBe(true);
  expect(r.tol, 'tolerância 0,05 detecta').toBe(true);
  expect(r.outroValor, 'valor diferente não é duplicata').toBe(false);
  expect(r.outroDia, 'dia diferente não é duplicata').toBe(false);
  expect(r.outroNome, 'pagador diferente não é duplicata').toBe(false);

  expect(errors, 'console limpo: ' + errors.join(' | ')).toEqual([]);
});
