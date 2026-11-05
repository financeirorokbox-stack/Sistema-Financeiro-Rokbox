const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// Importar o MESMO extrato do Bradesco 2x não pode duplicar, mesmo o banco trocando o FITID
// a cada download. Usa o parser e o dedup reais do Gestão (parseOFX + dedupInserirExtrato).

// Monta um OFX (XML) com os lançamentos citados pela Elaine. `fitids` troca os ids entre "downloads".
function ofxBradesco(fitids) {
  const trn = (tipo, dt, amt, fitid, memo) =>
    `<STMTTRN><TRNTYPE>${tipo}<DTPOSTED>${dt}<TRNAMT>${amt}<FITID>${fitid}<MEMO>${memo}</STMTTRN>`;
  return `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
${trn('DEBIT','20261015','-28757.81',fitids[0],'GASTOS CARTAO DE CREDITO')}
${trn('CREDIT','20261015','13705.81',fitids[1],'RESG AUTOMATICO INVESTIM')}
${trn('CREDIT','20261015','6463.86',fitids[2],'PIX RECEBIDO REM: PAYPAL DO BRASIL INST 15/10')}
${trn('DEBIT','20261015','-183.60',fitids[3],'TARIFA BANCARIA Max Empresarial 1')}
${trn('DEBIT','20261015','-1.00',fitids[4],'TARIFA BANCARIA TRANSF PGTO PIX')}
${trn('DEBIT','20261015','-1.00',fitids[5],'TARIFA BANCARIA TRANSF PGTO PIX')}
${trn('DEBIT','20261015','-1.00',fitids[6],'TARIFA BANCARIA TRANSF PGTO PIX')}
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
}

test('Extrato: importar o mesmo OFX do Bradesco 2x (FITID muda) não duplica; e preserva repetidos legítimos', async ({ page }) => {
  const errors = trackErrors(page);
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return Array.isArray(extratoBancario) && typeof dedupInserirExtrato === 'function' && typeof parseOFX === 'function'; } catch (e) { return false; } }, { timeout: 45000 });

  const r = await page.evaluate(({ ofxA, ofxB }) => {
    const BANCO = 'Bradesco - TESTE-E2E';
    // garante que o teste parte de ZERO desse banco fictício (não mexe nos dados reais do snapshot)
    extratoBancario = extratoBancario.filter(t => t.banco !== BANCO);
    const base = extratoBancario.length;

    // 1º download (dia em andamento): FITIDs A
    const nA = parseOFX(ofxA);
    const rA = dedupInserirExtrato(nA, BANCO);
    const depoisA = extratoBancario.length;

    // 2º download (dia fechado): MESMOS lançamentos, FITIDs DIFERENTES
    const nB = parseOFX(ofxB);
    const rB = dedupInserirExtrato(nB, BANCO);
    const depoisB = extratoBancario.length;

    // quantos lançamentos desse banco existem por conteúdo (confere repetidos legítimos: 3 tarifas R$1)
    const tarifa1 = extratoBancario.filter(t => t.banco === BANCO && +t.valor === -1).length;
    const gastos = extratoBancario.filter(t => t.banco === BANCO && +t.valor === -28757.81).length;

    return {
      arquivo: nA.length,
      addA: rA.add, jaTinhaA: rA.jaTinha,
      addB: rB.add, jaTinhaB: rB.jaTinha,
      cresceuA: depoisA - base, cresceuB: depoisB - depoisA,
      tarifa1, gastos
    };
  }, { ofxA: ofxBradesco(['N1025B','N10338','N1034C','N103C6','N10A01','N10A02','N10A03']),
       ofxB: ofxBradesco(['N104D0','N1042C','N10440','N104BA','N10B01','N10B02','N10B03']) });

  // 1ª importação: entra o arquivo inteiro (7 lançamentos; 3 tarifas R$1 são repetidos LEGÍTIMOS)
  expect(r.arquivo).toBe(7);
  expect(r.addA).toBe(7);
  expect(r.cresceuA).toBe(7);
  expect(r.tarifa1).toBe(3); // preservou os 3 repetidos legítimos
  expect(r.gastos).toBe(1);

  // 2ª importação do MESMO extrato (FITIDs diferentes): NADA entra, nada duplica
  expect(r.addB).toBe(0);
  expect(r.jaTinhaB).toBe(7);
  expect(r.cresceuB).toBe(0);
  expect(r.tarifa1).toBe(3); // continua 3 (não virou 6)
  expect(r.gastos).toBe(1);  // continua 1 (não duplicou)

  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});
