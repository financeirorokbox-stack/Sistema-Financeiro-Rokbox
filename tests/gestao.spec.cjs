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

test('Contas a Receber: botão "limpar" limpa o De/Até preso + Out/26 mostra os pedidos (Vencimento e Liquidação)', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    renderContas(); // garante os controles na tela
    const antesDe = (dateFilters.renderContas || {}).de;
    // 1) o botão REAL da tela ("✕ limpar" = limparFiltrosContas) tem que limpar o De/Até
    limparFiltrosContas();
    const posLimpar = JSON.parse(JSON.stringify(dateFilters.renderContas || {}));

    const card = (lab) => {
      let v = ''; const el = document.getElementById('v-contas');
      el.querySelectorAll('.card').forEach(c => {
        const l = ((c.querySelector('.c-label') || {}).textContent || '').replace(/\s*\(filtro\).*/, '').trim();
        if (l === lab) v = ((c.querySelector('.c-val') || {}).textContent || '').trim();
      });
      return v;
    };
    const leVisao = (dp) => {
      setDfMes('renderContas', '10'); renderContas();
      const s = document.getElementById('fc-datapor'); if (s) s.value = dp; renderContas();
      return { total: card('Total a Receber'), aberto: card('Em Aberto'), pago: card('Pago') };
    };
    const venc = leVisao('vencimento');
    const liq = leVisao('liquidacao');

    // referência: soma Venda+Troca dos pedidos de outubro (pela data do pedido)
    const NAOAP = (typeof SITUACOES_NAO_APLICAVEL !== 'undefined') ? SITUACOES_NAO_APLICAVEL : [];
    let vtOut = 0, nOut = 0;
    pedidos.forEach(p => {
      const m = String(p.data instanceof Date ? p.data.toISOString() : p.data).slice(0, 7);
      if (m !== '2026-10') return;
      if (NAOAP.includes((p.situacao || '').toLowerCase())) return;
      const op = (getClassificacao(p).operacao || '').toLowerCase();
      if (op === 'venda' || op === 'troca') { vtOut += (+p.valor || 0); nOut++; }
    });
    return { antesDe, limparDe: posLimpar.de, limparAte: posLimpar.ate, venc, liq, vtOut: +vtOut.toFixed(2), nOut };
  });

  // 1) o botão "limpar" da tela agora limpa o De/Até preso de novembro
  expect(r.antesDe).toBe('2026-11-01');
  expect(r.limparDe).toBe('');
  expect(r.limparAte).toBe('');
  // 2) Vencimento: os pedidos de outubro aparecem (antes sumiam → 45.979,20)
  expect(r.venc.total).toContain('284.789,53');
  expect(r.venc.aberto).toBe('48');
  expect(r.venc.pago).toBe('194');
  expect(r.venc.total).not.toContain('45.979,20');
  // o total da visão Vencimento cobre todos os Venda/Troca de outubro (nenhum some)
  const vencNum = +r.venc.total.replace(/[^\d,]/g, '').replace(/\./g, '').replace(',', '.');
  expect(vencNum).toBeGreaterThanOrEqual(r.vtOut - 0.01);
  // 3) Liquidação (recebimentos) — não muda com o fix de Vencimento
  expect(r.liq.total).toContain('306.095,79');
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
