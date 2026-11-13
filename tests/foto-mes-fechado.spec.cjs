const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// REGRA 1c: mês FECHADO lê a FOTO (cpFechado/crFechado). O Painel sobrepõe a foto no flatCP/flatCR dos meses
// congelados no load, então mesmo um flatCP "derivado" (ao vivo errado) não muda o número do mês fechado.
test('Painel: overlay da foto nos meses fechados (flatCP derivado não altera o mês fechado)', async ({ page }) => {
  const errors = trackErrors(page);
  await installMock(page);
  await page.goto('/financeiro.html');
  const o = await page.evaluate(async () => {
    await carregar(); // tem que rodar sem lançar, com o overlay no boot
    const temFn = (typeof _overlayFoto === 'function');
    // flat "derivado" (outubro errado = 267.590,86) + foto correta (278.248,84)
    const flat = [
      { data_liquidacao: '2026-11-03', valor: 500 },           // mês vigente: fica
      { data_liquidacao: '2026-10-05', valor: 267590.86 },     // outubro derivado: sai
    ];
    const foto = { '2026-10': [ { data_liquidacao: '2026-10-15', valor: 278248.84 } ] };
    const out = _overlayFoto(flat, foto);
    const somaOut = +out.filter(r => String(r.data_liquidacao).slice(0, 7) === '2026-10').reduce((s, r) => s + r.valor, 0).toFixed(2);
    const somaNov = +out.filter(r => String(r.data_liquidacao).slice(0, 7) === '2026-11').reduce((s, r) => s + r.valor, 0).toFixed(2);
    return { temFn, somaOut, somaNov, finCpOk: !!(typeof _FIN === 'object' && _FIN && Array.isArray(_FIN.cp)) };
  });
  expect(o.temFn, '_overlayFoto existe').toBe(true);
  expect(o.finCpOk, 'carregar() rodou e _FIN.cp é lista').toBe(true);
  expect(o.somaOut, 'outubro (fechado) vem da FOTO').toBe(278248.84);
  expect(o.somaNov, 'mês vigente não muda').toBe(500);
  expect(errors, 'console limpo: ' + errors.join(' | ')).toEqual([]);
});
