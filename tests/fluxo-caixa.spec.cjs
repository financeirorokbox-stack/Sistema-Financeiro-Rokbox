const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// REGRA: o Fluxo de Caixa do Painel soma o CP por CAIXA (pago pelo dia do pagamento +
// em aberto pelo vencimento), NUNCA por competência. Competência é só DRE/exportação.
// Trava dupla:
//  (1) o "Total de contas do mês" que a tela mostra = a fórmula de caixa aplicada ao flatCP;
//  (2) a regra de caixa e a de competência classificam em MESES diferentes (prova que
//      trocar uma pela outra mudaria o número, logo o Fluxo não pode usar competência).

test('Fluxo de Caixa: total do CP = caixa (pago por pagamento + aberto por vencimento), nunca competência', async ({ page }) => {
  const errors = trackErrors(page);
  await installMock(page);
  await page.goto('/financeiro.html');

  const o = await page.evaluate(async () => {
    const MES = '2026-10';
    mesSel = MES; empSel = 'todas';
    await carregar();

    // (1) número que a tela mostra ("Total de contas do mês")
    const el = document.querySelector('#cp-cat .n');
    const telaTotal = el ? +String(el.textContent || '').replace(/[^\d,]/g, '').replace(/\./g, '').replace(',', '.') : null;

    // fórmula de CAIXA, recalculada do flatCP (a MESMA das linhas 932-933 do app)
    const cpA = Array.isArray(_FIN.cp) ? _FIN.cp : ((_FIN.cp && _FIN.cp.itens) || []);
    const emMes = v => String(v || '').slice(0, 7) === MES;
    const pagoNoMes = r => !r.cancelado && emMes(r.data_liquidacao);
    const abertoNoMes = r => !r.cancelado && !r.data_liquidacao && !r.pago && emMes(r.vencimento);
    const caixaTotal = +cpA.filter(r => pagoNoMes(r) || abertoNoMes(r))
      .reduce((s, r) => s + (+r.valor || 0), 0).toFixed(2);

    // soma ALTERNATIVA por COMPETÊNCIA (o que NÃO pode estar no Fluxo)
    const compTotal = +cpA.filter(r => !r.cancelado && Competencia.despesa(r) === MES)
      .reduce((s, r) => s + (+r.valor || 0), 0).toFixed(2);

    // (2) prova que caixa ≠ competência para um lançamento de folha que vence em M mas tem competência M-1
    const folha = { valor: 1000, vencimento: '2026-11-05', dataPag: null, data_liquidacao: null, pago: false, cancelado: false, categoria: 'Salários' };
    const caixaMes = folha.vencimento.slice(0, 7);        // aberto → pelo vencimento
    const compMes = Competencia.despesa(folha);           // folha → mês anterior

    return { telaTotal, caixaTotal, compTotal, caixaMes, compMes };
  });

  // (1) a tela usa exatamente a fórmula de caixa
  expect(o.telaTotal, 'tela leu o total').not.toBeNull();
  expect(Math.abs(o.telaTotal - o.caixaTotal) < 0.02, `tela ${o.telaTotal} = caixa ${o.caixaTotal}`).toBe(true);
  // a soma por competência dá um número DIFERENTE no mesmo mês (senão a trava seria vazia)
  expect(Math.abs(o.caixaTotal - o.compTotal) > 0.02, `caixa ${o.caixaTotal} ≠ competência ${o.compTotal}`).toBe(true);
  // (2) caixa e competência classificam em meses diferentes (folha que vence em nov, competência out)
  expect(o.caixaMes).toBe('2026-11');
  expect(o.compMes).toBe('2026-10');
  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});
