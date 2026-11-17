const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// Barte (gateway quando a Braavo está fora): só StatusCobranca=PAGA entra; repasse=DataRecebimento; vínculo pelo nº
// do site (ProdutoServicoPlano "27581-… - Rokbox"); dedup por IdentificadorCobranca (vai no _txnId). Prévia antes de gravar.
async function boot(page) {
  page.on('dialog', d => d.accept());
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return typeof parseBarteRows === 'function' && Array.isArray(pedidos); } catch (e) { return false; } }, { timeout: 45000 });
}

test('Barte: só PAGA entra, valores (vírgula/ponto), site→pedido, dedup por IdentificadorCobranca', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    const rows = [
      { IdentificadorCobranca: 'uuid-1', ProdutoServicoPlano: '27581-1794143479 - Rokbox', Valor: '131,80', TaxaCobranca: '1.69', ValorLiquido: '130.11', StatusCobranca: 'PAGA', MetodoPagamento: 'PIX', DataPagamento: '08/11/2026', DataRecebimento: '09/11/2026', NomeCliente: 'Vania Tostes ' },
      { IdentificadorCobranca: 'uuid-2', ProdutoServicoPlano: '27584-1794148276 - Rokbox', Valor: '297,97', TaxaCobranca: '0', ValorLiquido: '297.97', StatusCobranca: 'ATRASADA', MetodoPagamento: 'PIX', DataPagamento: '', DataRecebimento: '', NomeCliente: 'Patricia ' },
      { IdentificadorCobranca: 'uuid-3', ProdutoServicoPlano: '27585-1794148753 - Rokbox', Valor: '1.234,56', TaxaCobranca: '20,00', ValorLiquido: '', StatusCobranca: 'PAGA', MetodoPagamento: 'PIX', DataPagamento: '08/11/2026', DataRecebimento: '10/11/2026', NomeCliente: 'Cliente Mil ' }
    ];
    const target = [];
    parseBarteRows(rows, target);
    // re-importar NÃO duplica (recKey por _txnId)
    const _valImp = x => (x.bruto != null ? x.bruto : (x.liq || 0));
    const recKey = x => x._txnId ? ('tx:' + x._txnId + '@' + _valImp(x)) : 'k';
    const antes = new Set(target.map(recKey));
    const target2 = []; parseBarteRows(rows, target2);
    const novos = target2.filter(x => !antes.has(recKey(x))).length;
    return { target, novos };
  });

  const t = r.target;
  expect(t.length, 'só as 2 PAGAS entram (ATRASADA fora)').toBe(2);
  const v = t.find(x => x._txnId === 'uuid-1');
  expect(v.bruto).toBe(131.8);            // "131,80" vírgula decimal
  expect(v.liq).toBe(130.11);             // "130.11" ponto decimal
  expect(v.taxa).toBe(1.69);
  expect(v._nsite, 'nº do site extraído do ProdutoServicoPlano').toBe('27581');
  expect(new Date(v.data).toISOString().slice(0, 10), 'repasse = DataRecebimento').toBe('2026-11-09');
  expect(v.gateway).toBe('Barte');
  expect(v.status).toBe('pago');
  const m = t.find(x => x._txnId === 'uuid-3');
  expect(m.bruto, 'milhar com vírgula decimal').toBe(1234.56);
  expect(m.taxa).toBe(20);
  expect(m.liq, 'ValorLiquido vazio → bruto − taxa').toBeCloseTo(1214.56, 2);
  expect(t.some(x => x._txnId === 'uuid-2'), 'ATRASADA não entra').toBe(false);
  expect(r.novos, 'reimportar não duplica (dedup por IdentificadorCobranca)').toBe(0);

  expect(errors, 'console limpo: ' + errors.join(' | ')).toEqual([]);
});
