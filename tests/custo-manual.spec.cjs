const { test, expect } = require('@playwright/test');
const { installMock } = require('./support/mock.cjs');

test('Custo manual #420 Geis: Rk out CMV sobe 437,00 e nada mais muda', async ({ page }) => {
  await installMock(page);
  await page.goto('/financeiro.html');
  const o = await page.evaluate(async () => {
    await carregar();
    let bc2 = {}, cpRaw = [], avul = [];
    try { const b = await gk('blingCustos2'); bc2 = (b && b.map) || {}; } catch (e) {}
    try { cpRaw = (await gk('contasPagar')) || []; } catch (e) {}
    try { avul = (await gk('receitasAvulsas')) || []; } catch (e) {}
    const meses = _dreMeses();
    // ANTES (sem custo manual)
    _FIN.custoManualLinha = {};
    const A = _dreCalcTudo(bc2, {}, cpRaw, avul, meses);
    const antes = { RkCmv: A['2026-10'].Rk.cmv, RkLB: A['2026-10'].Rk.lucroBruto, TotCmv: A['2026-10'].Total.cmv, TotEbitda: A['2026-10'].Total.ebitda, TotLL: A['2026-10'].Total.ll, TotRL: A['2026-10'].Total.recLiq, semSkuN: (A.__semSku||[]).length };
    const geisAntes = (A.__semSku||[]).find(s => s.id==='420' && /geis/i.test(s.desc));
    // DEPOIS (custo manual 1,90 na linha Geis do #420)
    _FIN.custoManualLinha = { '420|Geis': 1.90 };
    const D = _dreCalcTudo(bc2, {}, cpRaw, avul, meses);
    const depois = { RkCmv: D['2026-10'].Rk.cmv, RkLB: D['2026-10'].Rk.lucroBruto, TotCmv: D['2026-10'].Total.cmv, TotEbitda: D['2026-10'].Total.ebitda, TotLL: D['2026-10'].Total.ll, TotRL: D['2026-10'].Total.recLiq, semSkuN: (D.__semSku||[]).length };
    const geisDepois = (D.__semSku||[]).find(s => s.id==='420' && /geis/i.test(s.desc));
    // Rokbox não pode mudar
    const RokboxCmvA = A['2026-10'].Rokbox.cmv, RokboxCmvD = D['2026-10'].Rokbox.cmv;
    return { antes, depois, geisAntesPresente: !!geisAntes, geisDepoisPresente: !!geisDepois, RokboxCmvA, RokboxCmvD };
  });
  console.log('ANTES ', JSON.stringify(o.antes));
  console.log('DEPOIS', JSON.stringify(o.depois));
  console.log('Geis no aviso ANTES:', o.geisAntesPresente, '| DEPOIS:', o.geisDepoisPresente);
  console.log('Rokbox CMV out antes/depois:', o.RokboxCmvA, o.RokboxCmvD);
  // Rk CMV sobe exatamente 437,00
  expect(+(o.depois.RkCmv - o.antes.RkCmv).toFixed(2)).toBe(437.00);
  // Lucro Bruto da Rk cai 437 (CMV é subtraído); Total idem
  expect(+(o.antes.RkLB - o.depois.RkLB).toFixed(2)).toBe(437.00);
  expect(+(o.depois.TotCmv - o.antes.TotCmv).toFixed(2)).toBe(437.00);
  expect(+(o.antes.TotEbitda - o.depois.TotEbitda).toFixed(2)).toBe(437.00);
  expect(+(o.antes.TotLL - o.depois.TotLL).toFixed(2)).toBe(437.00);
  // Receita Líquida NÃO muda (CMV é abaixo da RL)
  expect(+(o.depois.TotRL - o.antes.TotRL).toFixed(2)).toBe(0);
  // Rokbox não muda
  expect(o.RokboxCmvD).toBe(o.RokboxCmvA);
  // o aviso tinha a linha Geis antes; depois some (resolvida)
  expect(o.geisAntesPresente).toBe(true);
  expect(o.geisDepoisPresente).toBe(false);
});
