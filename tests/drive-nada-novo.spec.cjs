const { test, expect } = require('@playwright/test');
const { installMock } = require('./support/mock.cjs');

// SINCRONIZAR DO DRIVE (24/11): quando dá "Nada novo", mostrar a lista dos arquivos que o robô ACHOU na pasta
// (nome + hora, se o robô mandar) + a frase "espere 1 minuto e sincronize de novo". Assim ela sabe se o arquivo foi visto.
async function boot(page) {
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return typeof puxarMesDrive === 'function' && typeof _listaAchadosDrive === 'function'; } catch (e) { return false; } }, { timeout: 45000 });
}

test('_listaAchadosDrive e _fmtHoraDrive: agrupa por tipo e mostra a hora só quando vem', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => ({
    lista: _listaAchadosDrive([{ tipo: 'Extratos', nome: 'a.ofx', hora: null }, { tipo: 'Extratos', nome: 'b.ofx' }, { tipo: 'Paypal', nome: 'c.csv', hora: '2026-11-24T09:05:00Z' }]),
    semHora: _fmtHoraDrive(null),
    comHora: _fmtHoraDrive('2026-11-24T12:05:00'),
    frase: _FRASE_DRIVE_ESPERE
  }));
  expect(r.lista, 'agrupa por tipo e lista os nomes').toContain('a.ofx');
  expect(r.lista).toContain('b.ofx');
  expect(r.lista).toContain('Paypal');
  expect(r.semHora, 'sem hora = vazio').toBe('');
  expect(r.comHora, 'com hora mostra dd/mm hh:mm').toMatch(/· \d\d\/\d\d \d\d:\d\d/);
  expect(r.frase, 'a frase do "espere 1 minuto"').toMatch(/espere 1 minuto/i);
});

test('"Nada novo": o alerta lista os arquivos achados + a frase', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    // robô devolve 1 extrato (sem hora, como hoje)
    const NOME = 'Extrato_9104_24-11-2026_Rk.ofx';
    window._drivePasta = async (action, extra) => action === 'arquivos' ? { arquivos: [{ tipo: extra.tipo, nome: NOME, base64: 'eA==' }] } : {};
    // marca como já sincronizado → "nada novo"
    const mesId = 'mes-nov';
    driveSyncLidos[_driveKey(mesId, 'Extratos', NOME)] = true;
    // modal falso com a caixinha "Só os novos" marcada
    const ov = document.createElement('div'); ov.id = 'drive-modal'; ov.innerHTML = '<div><input type="checkbox" id="drive-so-novos" checked></div>'; document.body.appendChild(ov);
    let msg = ''; const _a = window.alert; window.alert = m => { msg = String(m); };
    await puxarMesDrive(mesId, 'Novembro', 4); // grupo 4 = Extratos
    window.alert = _a;
    return { msg };
  });
  expect(r.msg, 'avisa que nada novo').toMatch(/Nada novo/i);
  expect(r.msg, 'lista o arquivo achado (pra ela ver se foi visto)').toContain('Extrato_9104_24-11-2026_Rk.ofx');
  expect(r.msg, 'inclui a frase do "espere 1 minuto"').toMatch(/espere 1 minuto e sincronize de novo/i);
});

test('"Nenhum arquivo encontrado": também mostra a frase do "espere 1 minuto"', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    window._drivePasta = async () => ({ arquivos: [] }); // pasta vazia
    const ov = document.createElement('div'); ov.id = 'drive-modal'; ov.innerHTML = '<div><input type="checkbox" id="drive-so-novos" checked></div>'; document.body.appendChild(ov);
    let msg = ''; const _a = window.alert; window.alert = m => { msg = String(m); };
    await puxarMesDrive('mes-x', 'Novembro', 4);
    window.alert = _a;
    return { msg };
  });
  expect(r.msg, 'nenhum arquivo').toMatch(/Nenhum arquivo encontrado/i);
  expect(r.msg, 'com a frase do "espere 1 minuto"').toMatch(/espere 1 minuto/i);
});
