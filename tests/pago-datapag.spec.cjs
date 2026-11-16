const { test, expect } = require('@playwright/test');
const { installMock } = require('./support/mock.cjs');

// REGRA (item 1): conta PAGA sem conciliação entra no "pago no mês" pela dataPag, marcada "não conciliada".
// Antes virava null (sumia) e um erro/falta de conciliação zerava o mês. Em aberto continua sem liquidação.
test('Pago sem conciliação conta pela dataPag (não some); em aberto continua null', async ({ page }) => {
  await installMock(page);
  await page.goto('/index.html');
  const r = await page.evaluate(async () => {
    await carregarTudo();
    // simula o debitoLinks ZERADO (o incidente): nenhuma conciliação
    debitoLinks = {};
    const paga   = { pago: true,  dataPag: '2026-11-05', vencimento: '2026-11-05', fornecedor: 'Fulano', valor: 100, empresa: 'Rk', categoria: 'SALÁRIOS' };
    const aberta = { pago: false, dataPag: null,         vencimento: '2026-11-20', fornecedor: 'Ciclano', valor: 50,  empresa: 'Rk', categoria: 'ALUGUEL' };
    const estorno= { pago: true,  dataPag: '2026-11-03', vencimento: '2026-11-03', fornecedor: 'Beltrano', valor: 30, empresa: 'Rk', categoria: 'ESTORNO' };
    return {
      liqPaga: String(dataLiquidacaoConta(paga) || '').slice(0, 7),
      liqAberta: dataLiquidacaoConta(aberta),
      liqEstorno: String(dataLiquidacaoConta(estorno) || '').slice(0, 7),
      concPaga: _contaConciliadaBanco(paga),
      concEstorno: _contaConciliadaBanco(estorno),
    };
  });
  expect(r.liqPaga, 'paga sem conciliação → mês da dataPag').toBe('2026-11');
  expect(r.liqAberta, 'em aberto continua sem liquidação').toBe(null);
  expect(r.liqEstorno, 'estorno segue pela dataPag').toBe('2026-11');
  expect(r.concPaga, 'paga sem débito = NÃO conciliada').toBe(false);
  expect(r.concEstorno, 'estorno conta como conciliado (pelo repasse)').toBe(true);
});
