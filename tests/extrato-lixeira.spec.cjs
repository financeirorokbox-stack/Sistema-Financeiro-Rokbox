const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// Pedido Elaine 17/11: lixeira recuperável na Conciliação Bancária. Mandar p/ lixeira tira do extrato e guarda
// (linha + vínculo); se conciliado, o vínculo é desfeito (conta volta em aberto) e VOLTA no restaurar; mês fechado bloqueia.
async function boot(page) {
  page.on('dialog', d => d.accept()); // confirmações/alerts auto-ok
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return Array.isArray(pedidos) && pedidos.length > 100; } catch (e) { return false; } }, { timeout: 45000 });
}

test('lixeira: conciliado reverte e restaura; não-conciliado ida/volta; mês fechado bloqueia', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(async () => {
    const res = {};
    // ---- caso 1: lançamento CONCILIADO (débito ligado a uma conta paga) ----
    const conta = { _uid: 'lix_c1', numero: '', fornecedor: 'Fornecedor Lix ZZ', valor: 123.45, empresa: 'Rokbox', vencimento: '2026-11-20T03:00:00.000Z', dataPag: '2026-11-20T03:00:00.000Z', pago: true, situacao: 'Pago', categoria: 'TESTE' };
    contasPagar.push(conta);
    const chave = chaveContaPagar(conta);
    const A = { id: 'LIXTEST_C', data: new Date('2026-11-20T03:00:00.000Z'), valor: -123.45, memo: 'TESTE LIXEIRA CONC ZZ', banco: 'Itaú - Rk' };
    extratoBancario.push(A);
    debitoLinks['LIXTEST_C'] = { itens: [{ chave, valor: 123.45, setPago: true, valorAnt: 123.45 }], total: 123.45 };
    deleteSelection.clear();
    deleteSelection.add('extrato:' + (extratoBancario.length - 1));
    mandarExtratoLixeiraSelecao();
    res.c_saiuDoExtrato = !extratoBancario.some(t => t.id === 'LIXTEST_C');
    res.c_naLixeira = extratoLixeira.some(x => x.t.id === 'LIXTEST_C');
    res.c_semLink = !debitoLinks['LIXTEST_C'];
    res.c_contaEmAberto = contasPagar.find(c => c._uid === 'lix_c1').pago === false;
    // restaura
    const ix = extratoLixeira.findIndex(x => x.t.id === 'LIXTEST_C');
    restaurarDaLixeira(ix);
    res.c_voltouExtrato = extratoBancario.some(t => t.id === 'LIXTEST_C');
    res.c_linkVoltou = !!debitoLinks['LIXTEST_C'];
    res.c_contaPagaDeNovo = contasPagar.find(c => c._uid === 'lix_c1').pago === true;
    res.c_foraDaLixeira = !extratoLixeira.some(x => x.t.id === 'LIXTEST_C');

    // ---- caso 2: lançamento SEM vínculo, ida/volta ----
    const B = { id: 'LIXTEST_S', data: new Date('2026-11-21T03:00:00.000Z'), valor: -50, memo: 'TESTE LIXEIRA SEM ZZ', banco: 'Itaú - Rk' };
    extratoBancario.push(B);
    deleteSelection.clear(); deleteSelection.add('extrato:' + (extratoBancario.length - 1));
    mandarExtratoLixeiraSelecao();
    res.s_saiu = !extratoBancario.some(t => t.id === 'LIXTEST_S') && extratoLixeira.some(x => x.t.id === 'LIXTEST_S');
    restaurarDaLixeira(extratoLixeira.findIndex(x => x.t.id === 'LIXTEST_S'));
    res.s_voltou = extratoBancario.some(t => t.id === 'LIXTEST_S');

    // ---- caso 3: MÊS FECHADO bloqueia (não vai pra lixeira) ----
    if (!mesesFechados.includes('2026-10')) mesesFechados.push('2026-10');
    const C = { id: 'LIXTEST_F', data: new Date('2026-10-20T03:00:00.000Z'), valor: -77, memo: 'TESTE LIXEIRA FECHADO ZZ', banco: 'Itaú - Rk' };
    extratoBancario.push(C);
    deleteSelection.clear(); deleteSelection.add('extrato:' + (extratoBancario.length - 1));
    mandarExtratoLixeiraSelecao();
    res.f_continuaNoExtrato = extratoBancario.some(t => t.id === 'LIXTEST_F');
    res.f_naoFoiPraLixeira = !extratoLixeira.some(x => x.t.id === 'LIXTEST_F');
    return res;
  });

  expect(r.c_saiuDoExtrato, 'conciliado saiu do extrato').toBe(true);
  expect(r.c_naLixeira, 'conciliado foi pra lixeira').toBe(true);
  expect(r.c_semLink, 'vínculo desfeito ao mandar').toBe(true);
  expect(r.c_contaEmAberto, 'conta voltou a em aberto').toBe(true);
  expect(r.c_voltouExtrato, 'restaurou pro extrato').toBe(true);
  expect(r.c_linkVoltou, 'vínculo voltou').toBe(true);
  expect(r.c_contaPagaDeNovo, 'conta voltou a paga').toBe(true);
  expect(r.c_foraDaLixeira, 'saiu da lixeira ao restaurar').toBe(true);
  expect(r.s_saiu, 'sem-vínculo foi pra lixeira').toBe(true);
  expect(r.s_voltou, 'sem-vínculo restaurou').toBe(true);
  expect(r.f_continuaNoExtrato, 'mês fechado NÃO foi pra lixeira (continua no extrato)').toBe(true);
  expect(r.f_naoFoiPraLixeira, 'mês fechado não entrou na lixeira').toBe(true);

  expect(errors, 'console limpo: ' + errors.join(' | ')).toEqual([]);
});
