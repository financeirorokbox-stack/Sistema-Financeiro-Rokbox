const { test, expect } = require('@playwright/test');
const { installMock } = require('./support/mock.cjs');

// PREVENÇÃO (parte 2): o Compras não pode gerar uma parcela com vencimento em mês FECHADO.
// _ajustarVencsMesFechado pergunta a data real (sugere hoje) e aplica; cancelar aborta a geração.
async function abrir(page) {
  await installMock(page);
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return typeof _ajustarVencsMesFechado === 'function' && Array.isArray(pedidos); } catch (e) { return false; } }, { timeout: 60000 });
  return erros;
}

test('Compras: parcela em mês fechado pede a data real e aplica; fora do fechado passa direto', async ({ page }) => {
  const erros = await abrir(page);
  const r = await page.evaluate(() => {
    mesesFechados = ['2026-10'];
    const out = {};
    // 1) vencimento em mês fechado → pergunta e aplica a data digitada (27/11/2026)
    window.prompt = () => '27/11/2026'; window.alert = () => {};
    const p1 = [{ venc: new Date('2026-10-26T12:00:00'), valor: 100 }];
    out.ok1 = _ajustarVencsMesFechado(p1);
    out.ym1 = p1[0].venc.getFullYear() + '-' + String(p1[0].venc.getMonth() + 1).padStart(2, '0');
    out.dia1 = p1[0].venc.getDate();
    // 2) cancelar (prompt null) → aborta (false), não cria
    window.prompt = () => null;
    const p2 = [{ venc: new Date('2026-10-20T12:00:00'), valor: 50 }];
    out.ok2 = _ajustarVencsMesFechado(p2);
    // 3) data corrigida TAMBÉM em mês fechado → aborta
    window.prompt = () => '15/10/2026';
    const p3 = [{ venc: new Date('2026-10-10T12:00:00'), valor: 50 }];
    out.ok3 = _ajustarVencsMesFechado(p3);
    // 4) vencimento fora de mês fechado → passa sem perguntar (prompt que falharia o teste se chamado)
    let chamou = false; window.prompt = () => { chamou = true; return '01/01/2027'; };
    const p4 = [{ venc: new Date('2026-11-27T12:00:00'), valor: 70 }];
    out.ok4 = _ajustarVencsMesFechado(p4);
    out.ym4 = p4[0].venc.getFullYear() + '-' + String(p4[0].venc.getMonth() + 1).padStart(2, '0');
    out.perguntou4 = chamou;
    // 5) sem meses fechados → sempre passa
    mesesFechados = [];
    const p5 = [{ venc: new Date('2026-10-26T12:00:00'), valor: 10 }];
    out.ok5 = _ajustarVencsMesFechado(p5);
    return out;
  });
  expect(r.ok1, 'mês fechado + data válida = ok').toBe(true);
  expect(r.ym1, 'vencimento movido pra novembro').toBe('2026-11');
  expect(r.dia1, 'dia aplicado = 27').toBe(27);
  expect(r.ok2, 'cancelar aborta a geração').toBe(false);
  expect(r.ok3, 'nova data também em mês fechado aborta').toBe(false);
  expect(r.ok4, 'fora do mês fechado passa').toBe(true);
  expect(r.ym4, 'fora do mês fechado não muda').toBe('2026-11');
  expect(r.perguntou4, 'não pergunta quando não cai em mês fechado').toBe(false);
  expect(r.ok5, 'sem meses fechados sempre passa').toBe(true);
  expect(erros, 'sem erro de console/página: ' + JSON.stringify(erros)).toEqual([]);
});
