const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// Pedido da Elaine (17/11): o bloco "Saldo inicial do dia — por banco" do Contas a Pagar passa a usar chave PRÓPRIA
// (saldoDiaCP), SÓ manual. Fechamento/Balancete/Fluxo/Power BI continuam no saldoInicialDia (preenchido pelo OFX).
// saldoDiaCP é SEMEADO 1x do saldoInicialDia -> o relatório de aprovação sai IDÊNTICO ao de antes.
async function boot(page) {
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return Array.isArray(pedidos) && pedidos.length > 100; } catch (e) { return false; } }, { timeout: 45000 });
}

test('saldoDiaCP separado: seed idêntico; editar CP não mexe no Fechamento; OFX só no saldoInicialDia', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    _ensureSaldoDiaCP(); // semeia do saldoInicialDia
    const datas = Object.keys(saldoInicialDia).sort();
    // 1) SEED idêntico: para várias datas, o total do CP (saldoDiaCP) = o do saldoInicialDia
    const amostra = (datas.length ? datas.slice(0, 5) : ['2026-10-01']).concat(['2026-10-31', '2026-11-16']);
    const iguais = amostra.every(d => Math.abs(getSaldoDiaCP(d) - getSaldoInicialDia(d)) < 0.005);

    // pega uma data e banco informados
    const d0 = datas.find(d => saldoInicialDia[d] && typeof saldoInicialDia[d] === 'object' && Object.keys(saldoInicialDia[d]).length) || datas[0] || '2026-10-01';
    const banco = (saldoInicialDia[d0] && Object.keys(saldoInicialDia[d0])[0]) || 'Itaú - Rk';

    // 2) editar o saldo do CP NÃO muda o saldoInicialDia (Fechamento fica igual)
    _saldoDiaData = d0;
    const antesSI = JSON.stringify(saldoInicialDia[d0] || {});
    const antesFech = getSaldoInicialDia(d0);
    setSaldoDiaCPBanco(banco, '99999,99');
    const siInalterado = JSON.stringify(saldoInicialDia[d0] || {}) === antesSI && Math.abs(getSaldoInicialDia(d0) - antesFech) < 0.005;
    const cpMudou = saldoDiaCPBancoValor(d0, banco) === 99999.99;

    // 3) OFX (aplicarSaldoExtratoNoDia) grava no saldoInicialDia, NÃO no saldoDiaCP
    const dRef = new Date(2026, 11, 1); const dk = '2026-12-02';
    if (saldoInicialDia[dk]) delete saldoInicialDia[dk][banco];
    if (saldoDiaCP[dk]) delete saldoDiaCP[dk][banco];
    aplicarSaldoExtratoNoDia(banco, { valor: 7777.77, data: dRef }, []);
    const ofxNoSI = saldoInicialDiaBancoValor(dk, banco) === 7777.77;
    const ofxNaoNoCP = saldoDiaCPBancoValor(dk, banco) === null;

    return { iguais, siInalterado, cpMudou, ofxNoSI, ofxNaoNoCP, d0, banco };
  });

  expect(r.iguais, 'seed: saldoDiaCP idêntico ao saldoInicialDia (relatório não muda)').toBe(true);
  expect(r.cpMudou, 'editar o CP grava no saldoDiaCP').toBe(true);
  expect(r.siInalterado, 'editar o CP NÃO altera o saldoInicialDia (Fechamento/Fluxo/Power BI iguais)').toBe(true);
  expect(r.ofxNoSI, 'OFX grava no saldoInicialDia (Fechamento continua automático)').toBe(true);
  expect(r.ofxNaoNoCP, 'OFX NÃO toca no saldoDiaCP (CP é só manual)').toBe(true);

  expect(errors, 'console limpo: ' + errors.join(' | ')).toEqual([]);
});
