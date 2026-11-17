const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// Pedido Elaine 17/11: reembolso de gateway CONCLUÍDO ⇒ conta de estorno (lançada a partir de Recebimentos) fica PAGA,
// dataPag = data do reembolso, empresa = a do pedido original. Retenção/disputa PENDENTE fica em aberto. Mês fechado não muda.
async function boot(page) {
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return Array.isArray(pedidos) && pedidos.length > 100; } catch (e) { return false; } }, { timeout: 45000 });
}

test('reembolso concluído marca estorno PAGO; pendente e mês fechado não', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    const mk = c => chaveContaPagar(c);
    // 3 estornos em aberto, lançados a partir de Recebimentos
    const A = { _uid: 't_concl', numero: '', fornecedor: 'Teste Concluido ZZ', valor: 100, categoria: 'ESTORNO', empresa: '', vencimento: '2026-11-20T03:00:00.000Z', dataPag: null, pago: false, situacao: 'Em Aberto', _origemEstorno: true };
    const B = { _uid: 't_pend', numero: '', fornecedor: 'Teste Pendente ZZ', valor: 50, categoria: 'ESTORNO', empresa: '', vencimento: '2026-11-21T03:00:00.000Z', dataPag: null, pago: false, situacao: 'Em Aberto', _origemEstorno: true };
    const C = { _uid: 't_fech', numero: '', fornecedor: 'Teste Fechado ZZ', valor: 70, categoria: 'ESTORNO', empresa: '', vencimento: '2026-10-20T03:00:00.000Z', dataPag: null, pago: false, situacao: 'Em Aberto', _origemEstorno: true };
    if (!mesesFechados.includes('2026-10')) mesesFechados.push('2026-10'); // garante out fechado em qualquer snapshot
    contasPagar.push(A, B, C);
    recebimentosConsolidado.push(
      { _reembolso: true, bruto: -100, liq: -100, nome: 'Teste Concluido ZZ', status: 'concluído', data: '2026-11-20T03:00:00.000Z', _estornoChave: mk(A) },
      { _reembolso: true, bruto: -50, liq: -50, nome: 'Teste Pendente ZZ', status: 'pendente', data: '2026-11-21T03:00:00.000Z', _estornoChave: mk(B) },
      { _reembolso: true, bruto: -70, liq: -70, nome: 'Teste Fechado ZZ', status: 'concluído', data: '2026-10-20T03:00:00.000Z', _estornoChave: mk(C) }
    );
    const mudou = _reconciliarEstornosConcluidos();
    const g = u => contasPagar.find(c => c._uid === u);
    const idemp = _reconciliarEstornosConcluidos().length; // 2ª passada não muda nada
    return {
      mudou,
      A: { pago: g('t_concl').pago, dataPag: g('t_concl').dataPag },
      B: { pago: g('t_pend').pago },
      C: { pago: g('t_fech').pago, mesFechado: _mesCongeladoCR('2026-10-20T03:00:00.000Z') },
      idemp
    };
  });

  expect(r.A.pago, 'concluído → PAGO').toBe(true);
  expect(String(r.A.dataPag).slice(0, 10), 'dataPag = data do reembolso').toBe('2026-11-20');
  expect(r.B.pago, 'pendente/disputa fica em aberto').toBe(false);
  expect(r.C.mesFechado, '2026-10 é mês fechado no snapshot').toBe(true);
  expect(r.C.pago, 'mês fechado não muda').toBe(false);
  expect(r.mudou.length, 'só 1 marcado (o concluído de mês aberto)').toBe(1);
  expect(r.idemp, 'idempotente: 2ª passada não muda nada').toBe(0);

  expect(errors, 'console limpo: ' + errors.join(' | ')).toEqual([]);
});
