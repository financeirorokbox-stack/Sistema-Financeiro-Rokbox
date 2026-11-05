const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// Gestão (index.html) com dados reais (mock). Pega a classe de bug que vinha quebrando:
// filtro de data que não filtrava. Nada é gravado no banco.

const brNum = (s) => {
  const m = String(s || '').match(/-?[\d.]+,\d{2}/);
  if (!m) return NaN;
  return parseFloat(m[0].replace(/\./g, '').replace(',', '.'));
};

async function boot(page) {
  await installMock(page);
  await page.goto('/index.html');
  // espera o boot carregar os pedidos (pedidos é um 'let' global léxico, não window.pedidos)
  await page.waitForFunction(() => { try { return Array.isArray(pedidos) && pedidos.length > 100; } catch (e) { return false; } }, { timeout: 45000 });
}

test('Vendas: filtro de mês filtra (Out/26 = 302.263,84 / Fat real 251.152,02; muda no Nov; limpa volta ao total)', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    const leia = () => ({
      total: document.querySelector('#v-vendas .card.blue .c-val')?.textContent || '',
      fat: document.querySelector('#v-vendas .card.amber .c-val')?.textContent || ''
    });
    setDfMes('renderVendas', '10'); const out = leia();
    setDfMes('renderVendas', '11'); const nov = leia();
    setDfMes('renderVendas', '');  const todos = leia();
    return { out, nov, todos };
  });

  // Out/26 exato
  expect(r.out.total).toContain('302.263,84');
  expect(r.out.fat).toContain('251.152,02');
  // trocar p/ Novembro muda o total (o filtro realmente filtra)
  expect(brNum(r.nov.total)).toBeGreaterThan(0);
  expect(r.nov.total).not.toContain('302.263,84');
  // limpar o mês mostra o total geral (maior que o de um mês só)
  expect(brNum(r.todos.total)).toBeGreaterThan(brNum(r.out.total));

  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});

test('Contas a Receber: De/Até preso em novembro não esconde o mês (Jun e Out mostram seus pedidos)', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    const antes = JSON.parse(JSON.stringify(dateFilters.renderContas || {})); // estado real: de/ate preso em novembro
    const leMes = (mm) => {
      setDfMes('renderContas', mm); // a usuária escolhe o mês na mini-barra
      renderContas();
      const el = document.getElementById('v-contas');
      const card = (lab) => {
        let v = '';
        el.querySelectorAll('.card').forEach(c => {
          const l = ((c.querySelector('.c-label') || {}).textContent || '').replace(/\s*\(filtro\).*/, '').trim();
          if (l === lab) v = ((c.querySelector('.c-val') || {}).textContent || '').trim();
        });
        return v;
      };
      return { de: dateFilters.renderContas.de, total: card('Total a Receber'), aberto: card('Em Aberto'), pago: card('Pago') };
    };
    return { antesDe: antes.de, jun: leMes('06'), out: leMes('10') };
  });

  expect(r.antesDe).toBe('2026-11-01'); // o De/Até preso de novembro que escondia o mês
  // Junho — contas a receber (pedidos) do mês
  expect(r.jun.de).toBe(''); // ao escolher o mês, o intervalo preso foi limpo (fix)
  expect(r.jun.total).toContain('222.538,93');
  expect(r.jun.aberto).toBe('2');
  expect(r.jun.pago).toBe('393');
  // Outubro — contas a receber (pedidos) do mês
  expect(r.out.total).toContain('45.979,20');
  expect(r.out.aberto).toBe('4');
  expect(r.out.pago).toBe('31');
  // o filtro realmente troca de mês (não ficou preso em novembro)
  expect(r.jun.total).not.toBe(r.out.total);
  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});

test('Contas a Pagar: abre e filtra por mês sem erro', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const txtLen = await page.evaluate(() => {
    setDfMes('renderPagar', '10');
    const el = document.getElementById('v-pagar');
    return (el && el.innerText || '').length;
  });

  expect(txtLen).toBeGreaterThan(200);
  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});

test('Conciliação: abre, filtra por mês e limpa', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(async () => {
    await renderConc();
    const el = () => document.getElementById('v-conc');
    const abriu = (el() && el().innerText || '').length;
    // filtra Outubro no filtro de data da aba (mini-barra 'renderBanco'); re-renderiza a conciliação
    setDfMes('renderBanco', '10');
    await renderConc();
    const comFiltro = (el() && el().innerText || '').length;
    // limpar o filtro
    setDfMes('renderBanco', '');
    await renderConc();
    const limpo = (el() && el().innerText || '').length;
    return { abriu, comFiltro, limpo, dfLimpo: !dfAtivo() };
  });

  expect(r.abriu).toBeGreaterThan(100);
  expect(r.comFiltro).toBeGreaterThan(50);
  expect(r.limpo).toBeGreaterThan(100);
  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});
