const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// Painel de Vendas (placar.html) + Relatório de Fechamento (financeiro.html) + Margem.
// Dados reais de outubro vêm do snapshot (mock). Nada é gravado no banco.

test('Painel de Vendas: Peças vendidas Out/26 = 2.854 (Rokbox 1.045 / Rk 1.809) + amostras/brindes', async ({ page }) => {
  const errors = trackErrors(page);
  await installMock(page);
  await page.goto('/placar.html');

  const r = await page.evaluate(async () => {
    await vbiCarregar();
    const pecas = (empVal) => {
      _vbiF = { mes: '2026-10', de: '', ate: '', emp: new Set(), seg: '', loja: '', vend: '', col: '', dia: '', fonte: 'sistema', op: new Set(['venda', 'troca']) };
      if (empVal) _vbiF.emp.add(empVal);
      renderUV();
      return [...document.querySelectorAll('.vbi-kpi')].find(k => k.querySelector('.kl') && k.querySelector('.kl').textContent === 'Peças vendidas')?.querySelector('.kv')?.textContent;
    };
    const todas = pecas('');
    const rokbox = pecas('Rokbox');
    const rk = pecas('Rk');
    pecas('');
    const fat = [...document.querySelectorAll('.vbi-kpi')].find(k => k.querySelector('.kl') && k.querySelector('.kl').textContent === 'Faturamento')?.querySelector('.kv')?.textContent;
    const cap = document.querySelector('.uv-amostra-cap')?.innerText || '';
    return { todas, rokbox, rk, fat, cap };
  });

  expect(r.todas).toBe('2.854');
  expect(r.rokbox).toBe('1.045');
  expect(r.rk).toBe('1.809');
  expect(r.fat).toBe('R$ 251.152,02');
  expect(r.cap).toContain('21 amostra');
  expect(r.cap).toContain('187 brinde');
  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});

test('Relatório de Fechamento: Peças vendidas Out/26 = 2.854 + amostras/brindes', async ({ page }) => {
  const errors = trackErrors(page);
  await installMock(page);
  await page.goto('/financeiro.html');

  const r = await page.evaluate(async () => {
    await carregar();
    mesSel = '2026-10';
    renderFechamento();
    const el = document.getElementById('fechamento-conteudo');
    let pecas = null;
    el.querySelectorAll('div').forEach(d => {
      if (d.textContent.trim().toUpperCase() === 'PEÇAS VENDIDAS') { const v = d.nextElementSibling; if (v) pecas = v.textContent.trim(); }
    });
    return { pecas, txt: el.innerText };
  });

  expect(r.pecas).toBe('2.854');
  expect(r.txt).toMatch(/21\s*amostra\(s\) em pedido de venda/);
  expect(r.txt).toMatch(/187\s*brinde\(s\) em pedido de Atacado/);
  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});

test('Painel de Vendas Out/26: soma por vendedor e por segmento = 251.152,02', async ({ page }) => {
  const errors = trackErrors(page);
  await installMock(page);
  await page.goto('/placar.html');

  const r = await page.evaluate(async () => {
    await vbiCarregar();
    _vbiF = { mes: '2026-10', de: '', ate: '', emp: new Set(), seg: '', loja: '', vend: '', col: '', dia: '', fonte: 'sistema', op: new Set(['venda', 'troca']) };
    const facts = _vbiFacts.filter(_vbiPass);
    const soma = (campo) => { const m = {}; facts.forEach(f => { const k = f[campo] || '(sem)'; m[k] = (m[k] || 0) + f.val; }); return Object.values(m).reduce((s, v) => s + v, 0); };
    return { porVend: +soma('vendedor').toFixed(2), porSeg: +soma('segmento').toFixed(2) };
  });

  expect(Math.abs(r.porVend - 251152.02)).toBeLessThan(0.01);
  expect(Math.abs(r.porSeg - 251152.02)).toBeLessThan(0.01);
  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});

test('Fechamento: fotos de jun–set NÃO mudam (faturamento por mês)', async ({ page }) => {
  const errors = trackErrors(page);
  await installMock(page);
  await page.goto('/financeiro.html');

  const fat = await page.evaluate(async () => {
    await carregar();
    const out = {};
    for (const m of ['2026-06', '2026-07', '2026-08', '2026-09']) {
      mesSel = m; renderFechamento();
      const el = document.getElementById('fechamento-conteudo');
      let v = null;
      el.querySelectorAll('div').forEach(d => {
        if (d.textContent.trim() === 'Faturamento') {
          const nx = d.nextElementSibling;
          if (nx && /R\$/.test(nx.textContent)) v = nx.textContent.trim(); // o card (não o título do gráfico)
        }
      });
      out[m] = v;
    }
    return out;
  });

  expect(fat['2026-06']).toContain('362.825,82');
  expect(fat['2026-07']).toContain('192.103,97');
  expect(fat['2026-08']).toContain('385.509,47');
  expect(fat['2026-09']).toContain('164.772,02');
  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});

test('Margem: #41020 = R$ 527,47 (cascata completa)', async ({ page }) => {
  const errors = trackErrors(page);
  await installMock(page);
  await page.goto('/financeiro.html');

  const a = await page.evaluate(async () => {
    await carregar();
    const x = analiseDoPedido('41020');
    if (!x || !x.cascade) return { erro: x && x.erro, nulo: true };
    const c = x.cascade;
    return { receita: c.receita, custoTot: c.custoTot, taxa: c.taxa, imposto: c.imposto, comissao: c.comissao, correios: c.correios, embalagem: c.embalagem, campanhaCusto: c.campanhaCusto, margemFinal: c.margemFinal, margemFinalPct: c.margemFinalPct, incompleto: x.linhasIncompletas };
  });
  // Margem do #41020 com TODOS os custos atuais (custo, taxa, imposto, comissão, correios, embalagem,
  // campanha 5% global). Dá 527,47 (42,9%). O 629,33 antigo era de antes de entrarem campanha/embalagem/
  // correios estimado como custo. Confere o valor E a integridade da cascata (soma dos componentes).
  expect(a.nulo).toBeFalsy();
  expect(a.incompleto).toBeFalsy();
  const somaCascata = a.receita - a.custoTot - a.taxa - a.imposto - a.comissao - a.correios - a.embalagem - a.campanhaCusto;
  expect(Math.abs(a.margemFinal - somaCascata)).toBeLessThan(0.01); // integridade da cascata
  expect(Math.abs(a.margemFinal - 527.47)).toBeLessThan(0.01);      // valor atual do #41020
  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});
