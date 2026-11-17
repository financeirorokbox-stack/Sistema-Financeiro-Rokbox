const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// Painel passo 1 (17/11): o Balancete de mês fechado passa a ler uma FOTO (balanceteFechado), imune a recálculo.
//  - overlay: um mês com foto sai do cálculo e vem da foto; mês SEM foto segue o ao-vivo (jun-set não mudam).
//  - opts.grossUpMeses: força o gross-up de estorno SÓ nos meses marcados (resultado idêntico; só reclassifica
//    o estorno netado pra ESTORNOS + receita de volta). Usado pra GERAR a foto de outubro sem mexer em jun-set.
async function boot(page) {
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return Array.isArray(pedidos) && pedidos.length > 100; } catch (e) { return false; } }, { timeout: 45000 });
}

test('foto do Balancete (balanceteFechado) sobrepõe o mês fechado e não toca nos outros', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    const salvo = JSON.parse(JSON.stringify(balanceteFechado || {}));
    // escolhe dois meses fechados reais p/ comparar (ou cai em 2026-09/2026-08)
    const mesFoto = '2026-09', mesOutro = '2026-08';
    const semFoto = _exportBalancete({ semFoto: true });
    const outroAntes = JSON.stringify(semFoto.rows.filter(r => r.mes === mesOutro));

    // injeta uma foto sintética no mesFoto
    const fake = [{ mes: mesFoto, emp: 'RK', tipo: 'R', grupo: 'TESTE', sub: 'teste', col: '(sem coleção)', valor: 42.42 }];
    balanceteFechado[mesFoto] = fake;
    const comFoto = _exportBalancete();
    const rowsFoto = comFoto.rows.filter(r => r.mes === mesFoto);
    const outroDepois = JSON.stringify(comFoto.rows.filter(r => r.mes === mesOutro));
    const fotoVenceu = rowsFoto.length === 1 && rowsFoto[0].grupo === 'TESTE' && Math.abs(rowsFoto[0].valor - 42.42) < 0.005;
    const outroIntacto = outroAntes === outroDepois;

    balanceteFechado = salvo; // restaura
    return { fotoVenceu, outroIntacto };
  });

  expect(r.fotoVenceu, 'a foto substitui as linhas do mês fechado').toBe(true);
  expect(r.outroIntacto, 'outro mês fechado (sem foto) não muda').toBe(true);
  expect(errors, 'console limpo: ' + errors.join(' | ')).toEqual([]);
});

test('grossUpMeses: gross-up de estorno é neutro no resultado e só mexe no mês marcado', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    const MES = '2026-10', OUTRO = '2026-08';
    const mesDe = d => { const dt = d ? new Date(d) : null; return (dt && !isNaN(dt)) ? (dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0')) : null; };
    // soma dos estornos netados pagos de outubro (o que o gross-up deve add em R e em D)
    const estSum = +(contasPagar || []).filter(c => c.pago && c._origemEstorno && !c.cancelado && mesDe(c.dataPag) === MES && (+c.valor || 0) > 0.005).reduce((s, c) => s + (+c.valor || 0), 0).toFixed(2);

    const agg = (rows, mes) => { let R = 0, D = 0, EST = 0; rows.filter(x => x.mes === mes).forEach(x => { if (x.tipo === 'R' && x.grupo !== 'TRANSFERÊNCIA INTERNA') R += x.valor; else if (x.tipo === 'D') D += x.valor; if (x.grupo === 'ESTORNOS') EST += x.valor; }); return { R: +R.toFixed(2), D: +D.toFixed(2), res: +(R - D).toFixed(2), EST: +EST.toFixed(2) }; };

    // garante MES como FECHADO (o snapshot do gate pode ser anterior ao fechamento) pra o base pular o gross-up
    if (!mesesFechados.includes(MES)) mesesFechados.push(MES);
    const base = _exportBalancete({ semFoto: true });
    const on = _exportBalancete({ grossUpMeses: [MES], semFoto: true });
    const bOut = agg(base.rows, MES), oOut = agg(on.rows, MES);
    const bOutro = JSON.stringify(agg(base.rows, OUTRO)), oOutro = JSON.stringify(agg(on.rows, OUTRO));
    return { estSum, bOut, oOut, outroIgual: bOutro === oOutro };
  });

  // invariantes do gross-up (valem p/ qualquer dataset): resultado NÃO muda; R sobe igual a D; e o aumento é
  //  o total dos estornos netados do mês (ESTORNOS pode subir menos, se algum estorno tiver categoria TARIFAS).
  const dR = +(r.oOut.R - r.bOut.R).toFixed(2), dD = +(r.oOut.D - r.bOut.D).toFixed(2);
  expect(r.estSum, 'há estornos netados em outubro pra testar').toBeGreaterThan(0);
  expect(Math.abs(r.oOut.res - r.bOut.res) < 0.02, 'resultado idêntico (gross-up é neutro)').toBe(true);
  expect(Math.abs(dR - dD) < 0.02, 'receitas e despesas sobem o MESMO valor').toBe(true);
  expect(Math.abs(dR - r.estSum) < 0.02, 'aumento = total dos estornos netados do mês').toBe(true);
  expect(r.oOut.EST - r.bOut.EST > -0.02 && (r.oOut.EST - r.bOut.EST) <= r.estSum + 0.02, 'ESTORNOS sobe (até o total do mês)').toBe(true);
  expect(r.outroIgual, 'outro mês fechado não é afetado pelo grossUpMeses').toBe(true);
  expect(errors, 'console limpo: ' + errors.join(' | ')).toEqual([]);
});
