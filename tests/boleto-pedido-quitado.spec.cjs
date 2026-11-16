const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// Regra: pedido JÁ QUITADO pelos recebimentos (PIX/outra forma) => a parcela de boleto conta como PAGA
// (não aparece como vencida nem na cobrança). _stParcelaBoleto passa a usar _boletoCobPago (mesma regra do relatório).
async function boot(page) {
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return Array.isArray(pedidos) && pedidos.length > 100; } catch (e) { return false; } }, { timeout: 45000 });
}

test('boleto de pedido quitado por PIX conta como pago (some de vencidas/cobrança)', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    // pedido de teste com forma Boleto Itaú, 1 parcela de 1000, emitida e NÃO carimbada
    pedidos.push({ id: 'TQPIX', nome: 'TESTE QUIT PIX', valor: 1000, data: '2026-11-01T03:00:00.000Z', situacao: 'Em aberto' });
    formaPagamento.push({ pedido: 'TQPIX', descricao: 'Boleto Itaú', valor: 1000 });
    boletoConfig['TQPIX'] = { prazo: '30', dataSaida: '2026-11-01' };
    _bumpDataVersion();
    const bp = getBoletosPorPedido().find(b => String(b.pedido) === 'TQPIX');
    const parc = getParcelas(bp)[0];
    boletoStatus[parc.key] = true; // emitido
    _bumpDataVersion();
    const antes = _stParcelaBoleto(parc).recebido; // sem recebimento -> em aberto

    // paga por PIX (depois da saída => não é entrada; baixa o boleto)
    recebimentosConsolidado.push({ gateway: 'PIX (Extrato)', nped: 'TQPIX', bruto: 1000, liq: 1000, data: '2026-11-05T03:00:00.000Z', tipo: 'PIX', status: 'pago' });
    _bumpDataVersion();
    const st = _stParcelaBoleto(parc);
    // aparece na cobrança a cobrar?
    const naCobranca = (typeof boletosACobrar === 'function') && boletosACobrar().some(x => String(x.ref) === 'TQPIX' || String(x.key) === parc.key);
    return { antes, depois: st.recebido, detalhe: st.detalhe, naCobranca };
  });

  expect(r.antes, 'sem recebimento, a parcela fica em aberto').toBe(false);
  expect(r.depois, 'pago por PIX => parcela conta como paga').toBe(true);
  expect(r.detalhe, 'selo indica pago por outra forma').toContain('PIX');
  expect(r.naCobranca, 'não aparece mais na lista de cobrança').toBe(false);

  expect(errors, 'console limpo: ' + errors.join(' | ')).toEqual([]);
});
