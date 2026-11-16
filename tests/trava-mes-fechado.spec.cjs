const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// TRAVA DE MÊS FECHADO (incidente 12/11): nenhuma rotina automática pode apagar/alterar/mesclar uma conta
// com vencimento OU pagamento em mês fechado. Só "Ajuste de mês fechado" (opts.ajusteMesFechado) passa.
// Mês aberto continua livre. E uma gravação SEM mudança (no-op) NUNCA pode ser bloqueada (segurança em produção).
async function boot(page) {
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return Array.isArray(pedidos) && pedidos.length > 100; } catch (e) { return false; } }, { timeout: 45000 });
}

test('Trava mês fechado: no-op passa; rotina não apaga/altera conta fechada; Ajuste passa; mês aberto livre', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(async () => {
    if (!mesesFechados.includes('2026-07')) mesesFechados.push('2026-07');
    if (!mesesFechados.includes('2026-10')) mesesFechados.push('2026-10');
    // identidade por ÍNDICE (os _uid colidem, então não dá pra usá-los)
    const idxFech = contasPagar.findIndex(c => _contaEmMesFechado(c));
    if (idxFech < 0) return { semAlvo: true };
    const alvo = contasPagar[idxFech];

    // 0) NO-OP: gravar o mesmo array não pode ser bloqueado (senão o app trava em produção)
    const noop = await saveData('contasPagar', contasPagar.slice());

    // 1) rotina APAGA uma conta de mês fechado -> BLOQUEIA (false)
    const del = contasPagar.filter((_, i) => i !== idxFech);
    const delBloq = await saveData('contasPagar', del);

    // 2) rotina ALTERA o valor de uma conta de mês fechado -> BLOQUEIA (false)
    const alt = contasPagar.map((c, i) => i === idxFech ? Object.assign({}, c, { valor: (+c.valor || 0) + 123 }) : c);
    const altBloq = await saveData('contasPagar', alt);

    // 3) "Ajuste de mês fechado" (manual) -> PASSA (true)
    const delOk = await saveData('contasPagar', del, { ajusteMesFechado: true });

    // 4) mês ABERTO continua livre: apagar conta de mês aberto passa (true)
    const idxAberto = contasPagar.findIndex(c => c.vencimento && !_contaEmMesFechado(c));
    const delAbertoArr = contasPagar.filter((_, i) => i !== idxAberto);
    const delAberto = idxAberto >= 0 ? await saveData('contasPagar', delAbertoArr) : true;

    return { noop, delBloq, altBloq, delOk, delAberto, temAberta: idxAberto >= 0, alvoNome: alvo.fornecedor || alvo.descricao || '' };
  });

  expect(r.semAlvo, 'achou conta de mês fechado no snapshot').toBeFalsy();
  expect(r.noop, 'gravação SEM mudança NÃO é bloqueada (produção não trava)').toBe(true);
  expect(r.delBloq, 'apagar conta de mês fechado por rotina é BLOQUEADO').toBe(false);
  expect(r.altBloq, 'alterar conta de mês fechado por rotina é BLOQUEADO').toBe(false);
  expect(r.delOk, 'Ajuste de mês fechado (manual) PASSA').toBe(true);
  expect(r.temAberta, 'há conta de mês aberto pra testar').toBe(true);
  expect(r.delAberto, 'mês aberto continua livre').toBe(true);

  expect(errors, 'console limpo: ' + errors.join(' | ')).toEqual([]);
});
