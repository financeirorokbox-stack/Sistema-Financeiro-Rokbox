const { test, expect } = require('@playwright/test');
const { installMock } = require('./support/mock.cjs');

// REGRA: os relatórios gerados flat* (flatCR/flatCP/flatVendas/...) podem SEMPRE ser regravados
// por cima pelo botão "Atualizar Power BI" (e pelo robô), mesmo que o banco tenha versão mais nova.
// A trava de concorrência continua valendo para as chaves de DADOS (pedidos, contasPagar, lojaCadastro...).
test('flat* ignora a trava de concorrência; chave de dados continua travada', async ({ page }) => {
  await installMock(page); // o mock responde atualizado_em = 2026-11-05 para toda chave
  const dialogs = [];
  page.on('dialog', d => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  await page.goto('/index.html');

  const r = await page.evaluate(async () => {
    await carregarTudo();
    // força "esta sessão viu uma versão ANTIGA" → o banco (2026-11-05) fica mais novo que a sessão
    _verKey['flatVendas'] = '2000-01-01T00:00:00.000Z';
    _verKey['lojaCadastro'] = '2000-01-01T00:00:00.000Z';
    // flat*: tem que gravar por cima (true)
    const okFlat = await saveData('flatVendas', [{ t: 'teste', n: 1 }]);
    // chave de dados não-mesclável: tem que BLOQUEAR (false)
    const okDados = await saveData('lojaCadastro', { __teste: { operacao: 'venda' } });
    return { okFlat, okDados };
  });

  expect(r.okFlat, 'flatVendas gravou por cima').toBe(true);
  expect(r.okDados, 'lojaCadastro foi bloqueada pela concorrência').toBe(false);
  // o aviso de concorrência só pode ter aparecido para a chave de dados, nunca para flat*
  const avisosFlat = dialogs.filter(m => /flatVendas/.test(m));
  const avisosDados = dialogs.filter(m => /lojaCadastro/.test(m));
  expect(avisosFlat.length, 'nenhum aviso de concorrência para flat*').toBe(0);
  expect(avisosDados.length, 'aviso de concorrência para a chave de dados').toBeGreaterThan(0);
});
