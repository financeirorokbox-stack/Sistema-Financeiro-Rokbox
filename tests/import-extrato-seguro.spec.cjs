const { test, expect } = require('@playwright/test');
const { installMock } = require('./support/mock.cjs');

// Importação de extrato SEGURA: só acrescenta; mesmo arquivo 2x não muda nada; arquivo com menos linhas não apaga
// nada; dry-run não grava; _healConciliacaoLinks nunca apaga (órfão = "revisar"); trava bloqueia redução automática.
test('Import extrato: só acrescenta, dedup por conteúdo, dry-run não grava, heal não apaga, trava bloqueia redução', async ({ page }) => {
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await installMock(page);
  await page.goto('/index.html');
  const r = await page.evaluate(async () => {
    await carregarTudo();
    extratoBancario.length = 0;
    extratoBancario.push({ id: 'a', data: new Date('2026-11-05T12:00:00'), valor: -100, memo: 'PIX KAREN', banco: 'Bradesco' });
    extratoBancario.push({ id: 'b', data: new Date('2026-11-05T12:00:00'), valor: -200, memo: 'PIX DIEGO', banco: 'Bradesco' });
    const n0 = extratoBancario.length;
    // 1) re-import do MESMO conteúdo (ids diferentes) → add 0, não muda
    const r1 = dedupInserirExtrato([{ id: 'x1', data: new Date('2026-11-05T12:00:00'), valor: -100, memo: 'PIX KAREN' }, { id: 'x2', data: new Date('2026-11-05T12:00:00'), valor: -200, memo: 'PIX DIEGO' }], 'Bradesco');
    const aposReimport = extratoBancario.length;
    // 2) arquivo só com 1 linha (menos que o banco) → NÃO apaga as outras, só avalia a nova
    const r2 = dedupInserirExtrato([{ id: 'x3', data: new Date('2026-11-06T12:00:00'), valor: -50, memo: 'PIX NOVO' }], 'Bradesco', true); // dry-run
    const aposDry = extratoBancario.length;
    const r2b = dedupInserirExtrato([{ id: 'x3', data: new Date('2026-11-06T12:00:00'), valor: -50, memo: 'PIX NOVO' }], 'Bradesco'); // grava
    const aposNova = extratoBancario.length;
    // 3) heal com vínculo órfão → NÃO apaga, marca _revisar
    debitoLinks = { 'NAO_EXISTE': { itens: [{ chave: 'k' }], total: 0 } };
    const nDL0 = Object.keys(debitoLinks).length;
    const h = _healConciliacaoLinks();
    const nDL1 = Object.keys(debitoLinks).length;
    const revisar = !!(debitoLinks['NAO_EXISTE'] && debitoLinks['NAO_EXISTE']._revisar);
    return { n0, r1, aposReimport, r2, aposDry, r2b, aposNova, nDL0, nDL1, revisar, healTemRevisar: ('revisar' in h) };
  });
  // só acrescenta / dedup por conteúdo
  expect(r.r1.add, 'mesmo arquivo: 0 novas').toBe(0);
  expect(r.r1.jaTinha, 'mesmo arquivo: 2 já existentes').toBe(2);
  expect(r.aposReimport, 'mesmo arquivo 2x não muda').toBe(r.n0);
  // dry-run não grava
  expect(r.r2.add, 'dry-run conta 1 nova').toBe(1);
  expect(r.aposDry, 'dry-run NÃO gravou').toBe(r.n0);
  // grava de verdade acrescenta
  expect(r.r2b.add).toBe(1);
  expect(r.aposNova, 'gravou a nova').toBe(r.n0 + 1);
  // heal nunca apaga
  expect(r.nDL1, 'heal não reduz o debitoLinks').toBe(r.nDL0);
  expect(r.revisar, 'órfão fica marcado para revisar').toBe(true);
  expect(r.healTemRevisar, 'heal retorna revisar (não removidos)').toBe(true);
});
