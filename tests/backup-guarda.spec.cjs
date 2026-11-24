const { test, expect } = require('@playwright/test');
const { installMock } = require('./support/mock.cjs');

// BACKUP (c) 24/11: flat* entram no backup (puxados do banco); nova regra de guarda (30 dias + segundas de 6 meses
// + todo dia 1º pra sempre); NUNCA apaga sozinho (fora-da-guarda vira sugestão no 🛡 Conferência, com o ok dela);
// tamanho do banco na conferência com alerta amarelo acima de 60%.
const _d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
function _ultSegunda(diasAtras) { const x = new Date(); x.setDate(x.getDate() - diasAtras); while (x.getDay() !== 1) x.setDate(x.getDate() - 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }

async function boot(page, admin) {
  if (admin) await page.addInitScript(() => { try { localStorage.setItem('rk_sb_sess', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 31536000000, email: 'financeirorokbox+admin@gmail.com', role: 'admin' })); } catch (e) {} });
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return typeof _bkpDiasManter === 'function' && typeof _montarBackupCompleto === 'function'; } catch (e) { return false; } }, { timeout: 45000 });
}

test('Guarda: mantém 30 dias + segundas de 6 meses + todo dia 1º; o resto é "fora da guarda"', async ({ page }) => {
  await boot(page);
  const segOld = _ultSegunda(90); // uma segunda ~3 meses atrás (dentro de 6 meses, fora de 30 dias)
  const r = await page.evaluate(({ hoje, d5, d29, d45, segOld }) => {
    const dias01 = '2026-01-01'; // dia 1º antigo (guarda pra sempre)
    const terca45 = d45; // ~45 dias atrás (fora de 30d; se nao for segunda nem dia-01 -> fora)
    const lista = [hoje, d5, d29, segOld, dias01, terca45];
    const keep = [..._bkpDiasManter(lista)];
    const fora = _bkpForaDaGuarda(lista);
    return { keep, fora, ehSeg: new Date(segOld + 'T12:00:00').getDay(), ehDia1: dias01.slice(8) === '01' };
  }, { hoje: _d(0), d5: _d(-5), d29: _d(-29), d45: _d(-45), segOld });
  expect(r.keep, 'mantém hoje').toContain(_d(0));
  expect(r.keep, 'mantém -5 dias').toContain(_d(-5));
  expect(r.keep, 'mantém -29 dias').toContain(_d(-29));
  expect(r.keep, 'mantém a segunda de ~3 meses').toContain(segOld);
  expect(r.keep, 'mantém o dia 1º antigo (pra sempre)').toContain('2026-01-01');
  // um dia ~45 atrás que nao é segunda nem dia-01 fica fora
  if (new Date(_d(-45) + 'T12:00:00').getDay() !== 1 && _d(-45).slice(8) !== '01') {
    expect(r.fora, 'dia antigo comum fica fora da guarda').toContain(_d(-45));
  }
});

test('_montarBackupCompleto inclui os flat* (puxados do banco)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const _orig = window.loadData;
    window.loadData = async (k) => /^flat/.test(k) ? [{ linha: 1 }, { linha: 2 }] : (_orig ? _orig(k) : null);
    const dados = await _montarBackupCompleto();
    return { temFlatCR: Array.isArray(dados.flatCR) && dados.flatCR.length === 2, temFlatCP: !!dados.flatCP, chaves: Object.keys(dados).filter(k => /^flat/.test(k)) };
  });
  expect(r.temFlatCR, 'flatCR entrou no backup').toBe(true);
  expect(r.temFlatCP, 'flatCP entrou no backup').toBe(true);
  expect(r.chaves.length, 'os 5 flat* entram').toBeGreaterThanOrEqual(5);
});

test('GARANTIA: falha ao buscar os flat* NÃO derruba o backup; marca a falha ("backup sem flat*")', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const _orig = window.loadData;
    window.loadData = async (k) => { if (k === 'flatCR') throw new Error('rede caiu'); return /^flat/.test(k) ? [{ x: 1 }] : (_orig ? _orig(k) : null); };
    const dados = await _montarBackupCompleto();
    return { temBase: Object.keys(dados).length > 0, flatCRfora: !('flatCR' in dados), flatCPok: !!dados.flatCP, falhas: _bkpFalhasFlat };
  });
  expect(r.temBase, 'o backup tem os dados base (nunca deixa de ser feito)').toBe(true);
  expect(r.flatCRfora, 'o flatCR que falhou fica de fora').toBe(true);
  expect(r.flatCPok, 'os demais flat* entram normalmente').toBe(true);
  expect(r.falhas, 'marca flatCR como falha → vira aviso "backup sem flat*"').toContain('flatCR');
});

test('Conferência mostra o % do banco e, acima de 60%, alerta amarelo + seção de backups fora da guarda', async ({ page }) => {
  await boot(page, true);
  const ROWS = [{ id: 5, criado_em: new Date().toISOString(), origem: 'auto', status: 'amarelo', resumo: 'Banco acima de 60%', db_pct: 65, db_bytes: 340000000, alertas: [{ chave: '_banco', cor: 'amarelo', banco: true, explicado: false, acao: 'Banco em 65% do limite (500 MB) — decida se apaga backups fora da guarda' }] }];
  await page.route(/\/rest\/v1\/conferencia/i, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROWS) }));
  const r = await page.evaluate(async () => {
    // simula 2 backups fora da guarda
    window._bkpListarNuvem = async () => ['2026-11-24', '2026-11-23', '2026-07-15', '2026-05-20'];
    await _confModalG(); await new Promise(res => setTimeout(res, 150));
    const m = document.getElementById('conf-modal');
    return { html: m ? m.innerHTML : '', txt: m ? m.innerText : '' };
  });
  expect(r.txt, 'mostra a seção de backups').toContain('Backups na nuvem');
  expect(r.txt, 'mostra o % do banco').toMatch(/65% de 500 MB/);
  expect(r.txt, 'alerta de banco amarelo').toMatch(/Banco/i);
  expect(r.html, 'tem o botão de apagar fora da guarda').toMatch(/_bkpApagarForaGuarda/);
  expect(r.txt, 'fala em fora da guarda').toMatch(/fora da guarda/i);
});
