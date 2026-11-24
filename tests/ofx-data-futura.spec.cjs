const { test, expect } = require('@playwright/test');
const { installMock } = require('./support/mock.cjs');

// OFX DATA FUTURA (d) 24/11: na importação do OFX do Extrato, lançamento com data DEPOIS de hoje NÃO entra e
// aparece na prévia como "data FUTURA — ignorados (N)". Vale pro botão e pro Sincronizar (mesmo handler file-ext).
async function boot(page) {
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return typeof _entregarAoInput === 'function' && Array.isArray(extratoBancario); } catch (e) { return false; } }, { timeout: 45000 });
}

test('OFX: lançamento com data futura é ignorado e aparece na prévia; o passado entra', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    try { renderExtrato(); } catch (e) {}
    await new Promise(res => setTimeout(res, 300));
    window.escolherBancoDoArquivo = () => 'Itaú - Teste';   // não pergunta o banco
    const _ymd = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
    const ofx = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>341</BANKID><ACCTID>99977</ACCTID></BANKACCTFROM><BANKTRANLIST>`
      + `<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>${_ymd(-1)}</DTPOSTED><TRNAMT>100.00</TRNAMT><FITID>P1</FITID><MEMO>LANC ONTEM</MEMO></STMTTRN>`
      + `<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>${_ymd(0)}030000</DTPOSTED><TRNAMT>150.00</TRNAMT><FITID>H1</FITID><MEMO>LANC HOJE</MEMO></STMTTRN>`  // HOJE com hora 03:00 (a hora é ignorada; o dia de hoje ENTRA)
      + `<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>${_ymd(3)}</DTPOSTED><TRNAMT>200.00</TRNAMT><FITID>F1</FITID><MEMO>LANC FUTURO</MEMO></STMTTRN>`
      + `</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    let msg = ''; const _c = window.confirm; window.confirm = m => { msg = String(m); return true; };
    const _a = window.alert; window.alert = () => {};
    const antes = extratoBancario.length;
    _entregarAoInput('file-ext', [{ nome: 'itau futuro.ofx', base64: btoa(unescape(encodeURIComponent(ofx))) }]);
    await new Promise(res => setTimeout(res, 800));
    window.confirm = _c; window.alert = _a;
    return {
      msg, add: extratoBancario.length - antes,
      temFuturo: extratoBancario.some(t => (t.memo || '').includes('LANC FUTURO')),
      temHoje: extratoBancario.some(t => (t.memo || '').includes('LANC HOJE')),
      temOntem: extratoBancario.some(t => (t.memo || '').includes('LANC ONTEM'))
    };
  });
  expect(r.msg, 'a prévia menciona os futuros ignorados').toMatch(/data FUTURA.*ignorad/i);
  expect(r.temOntem, 'o lançamento de ontem ENTRA').toBe(true);
  expect(r.temHoje, 'o lançamento de HOJE (com hora 03:00) ENTRA — comparação é pelo DIA, hora ignorada').toBe(true);
  expect(r.temFuturo, 'o lançamento futuro NÃO entra').toBe(false);
  expect(r.add, '2 entram (ontem + hoje); só o futuro é ignorado').toBe(2);
});

test('OFX só com datas futuras: nada é importado (aviso, sem prévia de gravar)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    try { renderExtrato(); } catch (e) {}
    await new Promise(res => setTimeout(res, 300));
    window.escolherBancoDoArquivo = () => 'Itaú - Teste';
    const _ymd = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
    const ofx = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>341</BANKID><ACCTID>88866</ACCTID></BANKACCTFROM><BANKTRANLIST>`
      + `<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>${_ymd(2)}</DTPOSTED><TRNAMT>50.00</TRNAMT><FITID>X9</FITID><MEMO>SO FUTURO</MEMO></STMTTRN>`
      + `</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    let msg = ''; let confChamado = false; const _c = window.confirm; window.confirm = () => { confChamado = true; return true; };
    const _a = window.alert; window.alert = m => { msg = String(m); };
    const antes = extratoBancario.length;
    _entregarAoInput('file-ext', [{ nome: 'so futuro.ofx', base64: btoa(unescape(encodeURIComponent(ofx))) }]);
    await new Promise(res => setTimeout(res, 800));
    window.confirm = _c; window.alert = _a;
    return { msg, add: extratoBancario.length - antes, confChamado };
  });
  expect(r.msg, 'avisa que todos têm data futura').toMatch(/data FUTURA/i);
  expect(r.add, 'nada é importado').toBe(0);
  expect(r.confChamado, 'não chega a pedir confirmação de gravar').toBe(false);
});
