const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// REGRA "mês fechado lê a FOTO" na Conciliação Bancária:
// Um mês já fechado/congelado NÃO pode aparecer em "Faltam conciliar" (sugeria vincular/lançar num mês
// fechado = duplicaria despesa). O aviso passa a dizer "Mês fechado — conforme a foto". Mês ABERTO não muda.
async function boot(page) {
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return Array.isArray(pedidos) && pedidos.length > 100; } catch (e) { return false; } }, { timeout: 45000 });
}

test('Conciliação: mês FECHADO lê a foto (não pede "faltam conciliar"); mês ABERTO ainda pede', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    // Garante um mês congelado determinístico (independe do snapshot).
    if (!mesesFechados.includes('2026-10')) mesesFechados.push('2026-10');
    const mk = (iso) => new Date(iso + 'T12:00:00');
    // Débito NÃO conciliado em mês FECHADO e outro igual em mês ABERTO (dezembro/26, sem foto).
    const txFech   = { id: '__t_fech__',   banco: 'TesteBancoFoto', data: mk('2026-10-10'), valor: -1234.56, memo: 'DEBITO MES FECHADO' };
    const txAberto = { id: '__t_aberto__', banco: 'TesteBancoFoto', data: mk('2026-12-10'), valor: -1234.56, memo: 'DEBITO MES ABERTO' };
    delete debitoLinks['__t_fech__']; delete debitoLinks['__t_aberto__']; // garante "não conciliado"

    const congeladoFech   = (typeof _mesCongeladoCR === 'function') && _mesCongeladoCR(txFech.data);
    const congeladoAberto = (typeof _mesCongeladoCR === 'function') && _mesCongeladoCR(txAberto.data);

    const tvFech   = _travaConciliacao([txFech]);
    const tvAberto = _travaConciliacao([txAberto]);
    const htmlFech   = _travaConciliacaoHTML([txFech]);
    const htmlAberto = _travaConciliacaoHTML([txAberto]);

    return {
      congeladoFech, congeladoAberto,
      fechOk: tvFech.ok, fechDeb: tvFech.debNC.length,
      abertoOk: tvAberto.ok, abertoDeb: tvAberto.debNC.length,
      htmlFechCitaFoto: htmlFech.includes('Mês fechado'),
      htmlFechSemFaltam: !htmlFech.includes('Faltam conciliar'),
      htmlAbertoFaltam: htmlAberto.includes('Faltam conciliar'),
    };
  });

  expect(r.congeladoFech, '2026-10 é mês congelado (foto)').toBe(true);
  expect(r.congeladoAberto, '2026-12 é mês aberto').toBe(false);
  // Mês fechado: lê a foto → nada a conciliar, 0 débitos cobrados, banner cita a foto e não diz "Faltam conciliar".
  expect(r.fechOk, 'mês fechado: _travaConciliacao.ok (lê a foto)').toBe(true);
  expect(r.fechDeb, 'mês fechado: 0 débitos cobrados').toBe(0);
  expect(r.htmlFechCitaFoto, 'banner do mês fechado cita a foto').toBe(true);
  expect(r.htmlFechSemFaltam, 'banner do mês fechado NÃO diz "Faltam conciliar"').toBe(true);
  // Mês aberto: comportamento igual ao de antes (continua cobrando).
  expect(r.abertoOk, 'mês aberto: ainda falta conciliar').toBe(false);
  expect(r.abertoDeb, 'mês aberto: o débito aparece').toBe(1);
  expect(r.htmlAbertoFaltam, 'banner do mês aberto diz "Faltam conciliar"').toBe(true);

  expect(errors, 'console limpo: ' + errors.join(' | ')).toEqual([]);
});
