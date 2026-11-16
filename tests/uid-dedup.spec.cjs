const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// _uid À PROVA DE COLISÃO: ao gravar (e no _garantirUids), toda "gêmea" (conta que herdou o _uid por clonagem)
// recebe _uid NOVO e único, SEM mudar nenhum outro campo. Conciliação não depende do _uid (chaveContaPagar é
// composta), então re-uidar não muda vínculo. Nasce da colisão achada no incidente de 12/11.
async function boot(page) {
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return Array.isArray(pedidos) && pedidos.length > 100; } catch (e) { return false; } }, { timeout: 45000 });
}

test('_uid à prova de colisão: gêmeas ganham id novo, conteúdo intacto, 0 repetido ao gravar', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(async () => {
    const csig = c => [(c.fornecedor || c.descricao || ''), (Math.round((+c.valor || 0) * 100) / 100), String(c.vencimento || '').slice(0, 10), String(c.dataPag || '').slice(0, 10), c.pago ? 1 : 0].join('|');

    // 1) _dedupUids direto: 3 gêmeas + 1 sem uid -> todos distintos
    const t = [{ _uid: 'x', v: 1 }, { _uid: 'x', v: 2 }, { _uid: 'x', v: 3 }, { v: 4 }];
    const nfix = _dedupUids(t);
    const tDistintos = new Set(t.map(o => o._uid)).size;

    // 2) injeta colisão em duas contas de MÊS ABERTO e grava -> saveData de-dupa
    const abertas = contasPagar.filter(c => c._uid && !_contaEmMesFechado(c));
    if (abertas.length < 2) return { poucas: true };
    const antesMulti = contasPagar.map(csig).sort();
    abertas[1]._uid = abertas[0]._uid; // colisão forçada
    const dupAntes = contasPagar.length - new Set(contasPagar.map(c => c._uid)).size;
    const ok = await saveData('contasPagar', contasPagar); // deve passar (só open re-uidado) e de-dupar
    const dupDepois = contasPagar.length - new Set(contasPagar.map(c => c._uid)).size;
    const depoisMulti = contasPagar.map(csig).sort();
    const conteudoIgual = JSON.stringify(antesMulti) === JSON.stringify(depoisMulti);

    return { nfix, tDistintos, tLen: t.length, dupAntes, dupDepois, ok, conteudoIgual };
  });

  expect(r.poucas, 'há contas abertas pra testar').toBeFalsy();
  expect(r.nfix, '_dedupUids corrigiu 3 (2 gêmeas + 1 sem _uid)').toBe(3);
  expect(r.tDistintos, 'todos os _uid ficam distintos').toBe(r.tLen);
  expect(r.dupAntes, 'injetei ao menos 1 colisão').toBeGreaterThanOrEqual(1);
  expect(r.ok, 'gravação passou (só mês aberto re-uidado)').toBe(true);
  expect(r.dupDepois, '0 _uid repetido depois de gravar').toBe(0);
  expect(r.conteudoIgual, 'conteúdo intacto (só o _uid mudou)').toBe(true);

  expect(errors, 'console limpo: ' + errors.join(' | ')).toEqual([]);
});
