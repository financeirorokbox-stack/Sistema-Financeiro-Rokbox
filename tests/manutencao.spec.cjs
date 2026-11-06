const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// Painel financeiro (financeiro.html) em manutenção: só o ADMIN vê. Diretor/qualquer não-admin vê só a mensagem.
// Placar (placar.html) não é afetado.

test('Manutenção: não-admin (Diretor) vê só a mensagem, sem números', async ({ page }) => {
  await installMock(page);
  await page.goto('/financeiro.html');
  const r = await page.evaluate(() => {
    try { localStorage.setItem('rk_role', 'diretor'); } catch (e) {}
    const flag = FIN_MANUTENCAO, admin = ehAdmin();
    const bloqueado = flag && !admin;
    if (bloqueado) _mostrarManutencao(); // é o que abrir() faz para não-admin (e retorna antes de carregar dados)
    return { flag, admin, bloqueado, body: document.body.innerText, temApp: !!document.getElementById('app'), temAbas: document.querySelectorAll('.aba').length };
  });
  expect(r.flag).toBe(true);        // chave ligada
  expect(r.admin).toBe(false);      // diretor não é admin
  expect(r.bloqueado).toBe(true);
  expect(r.body).toContain('em manutenção');
  expect(r.body).not.toMatch(/R\$/); // nenhum número/valor na tela
  expect(r.temApp).toBe(false);      // o app (com as abas/números) foi removido
  expect(r.temAbas).toBe(0);
});

test('Manutenção: admin NÃO é bloqueado (vê tudo)', async ({ page }) => {
  await installMock(page);
  await page.goto('/financeiro.html');
  const r = await page.evaluate(() => {
    try { localStorage.setItem('rk_role', 'admin'); } catch (e) {}
    const admin = ehAdmin(), bloqueado = FIN_MANUTENCAO && !admin;
    if (FIN_MANUTENCAO && admin) _bannerManutencao();
    const banner = document.getElementById('manut-banner');
    return { admin, bloqueado, temBanner: !!banner, bannerTxt: banner ? banner.textContent : '', temApp: !!document.getElementById('app') };
  });
  expect(r.admin).toBe(true);
  expect(r.bloqueado).toBe(false);   // admin passa
  expect(r.temApp).toBe(true);       // o app continua lá
  expect(r.temBanner).toBe(true);    // faixa de aviso
  expect(r.bannerTxt).toContain('só admin está vendo');
});

test('Placar (Painel de Vendas) NÃO é afetado pela manutenção do financeiro', async ({ page }) => {
  const errors = trackErrors(page);
  await installMock(page);
  await page.goto('/placar.html');
  const r = await page.evaluate(() => ({ temFlag: typeof FIN_MANUTENCAO !== 'undefined', body: document.body.innerText.slice(0, 200) }));
  expect(r.temFlag).toBe(false);     // placar não tem o gate de manutenção
  expect(r.body).not.toContain('em manutenção');
  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});
