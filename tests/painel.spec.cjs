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

test('TESTE FIXO Out/26 (Painel RK / Fechamento, caixa): entrou 281.998,02, saldo fim 46.417,76, a receber em aberto 5.365,03 (atrasado = só boletos = mesmo valor)', async ({ page }) => {
  const errors = trackErrors(page);
  await installMock(page);
  await page.goto('/financeiro.html');

  const r = await page.evaluate(async () => {
    mesSel = '2026-10';
    await carregar();
    renderFechamento();
    const fech = document.getElementById('fechamento-conteudo').innerText;
    const num = re => { const m = fech.match(re); return m ? +m[1].replace(/\./g, '').replace(',', '.') : null; };
    const _n = s => +String(s || '').replace(/[^\d,]/g, '').replace(/\./g, '').replace(',', '.');
    return {
      fat: num(/Faturamento\s*R\$\s*([\d.,]+)/),
      pedidos: num(/Pedidos\s*([\d.]+)/),
      vendasCaixa: num(/Vendas \(caíram no banco\)\s*R\$\s*([\d.,]+)/),
      resgates: num(/Resgates[^R]*R\$\s*([\d.,]+)/),
      entrou: num(/Total que entrou\s*R\$\s*([\d.,]+)/),
      pago: num(/Pago no mês\s*R\$\s*([\d.,]+)/),
      resultadoCaixa: num(/Resultado do caixa\s*R\$\s*([\d.,]+)/),
      resultadoOper: num(/Resultado operacional[^\d]*([\d.,]+)/),
      recCli: num(/Recebido dos clientes[^R]*R\$\s*([\d.,]+)/),
      saldoIni: num(/Saldo início do mês\s*R\$\s*([\d.,]+)/),
      saldoFim: num(/Saldo fim do mês\s*R\$\s*([\d.,]+)/),
      crAb: num(/A receber \(em aberto\)\s*R\$\s*([\d.,]+)/),
      footerResg: /Resgates de aplicação \(Rokbox\)/.test(fech),
      varCaixa: num(/Variação do caixa\s*R\$\s*([\d.,]+)/),
      crAtraso: _n((document.getElementById('cr-atraso') || {}).textContent || '')
    };
  });

  const near = (v, alvo, tol = 0.02) => Math.abs(v - alvo) <= tol;
  expect(r.fat).toBe(251152.02);           // faturamento
  expect(r.pedidos).toBe(211);             // pedidos
  expect(r.vendasCaixa).toBe(258148.54);   // vendas que caíram no banco
  expect(r.resgates).toBe(23849.48);       // resgates (transferência interna)
  expect(r.entrou).toBe(281998.02);        // entrou no banco = vendas + resgates
  expect(near(r.pago, 278248.84, 0.02)).toBe(true);   // pago
  expect(near(r.resultadoCaixa, 3749.18)).toBe(true); // entrou − pago = variação do saldo
  expect(near(r.resultadoOper, 20100.30)).toBe(true); // operacional (sem resgates) −20.100,30
  expect(r.recCli).toBe(263253.35);        // recebido dos clientes (apoio)
  expect(r.saldoIni).toBe(42668.58);       // saldo início
  expect(near(r.saldoFim, 46417.76)).toBe(true);      // saldo fim (±0,02)
  expect(r.crAb).toBe(5365.03);       // A receber em aberto = mesmo status da tela de Recebimentos (ao vivo 09/11):
                                      // AV103 3.527,50 + #40419 1.134,52 + #40276 703,01.
                                      // #40749 (0,04 tolerância), #41127 (AMOSTRA) e #41327 (0,80 aceita) NÃO entram.
  expect(r.crAtraso).toBe(5365.03);   // dashboard: mesmo número
  // Rodapé do "Resultado por empresa": operacional −20.100,31 + resgates 23.849,48 = variação do caixa +3.749,17
  expect(r.footerResg).toBe(true);
  expect(near(r.varCaixa, 3749.17, 0.02)).toBe(true);
  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});

test('Balancete: Saldo final = Saldo fim do Fechamento (jun–out); resgate fora da receita, dentro do saldo', async ({ page }) => {
  const errors = trackErrors(page);
  await installMock(page);
  await page.goto('/financeiro.html');
  const r = await page.evaluate(async () => {
    await carregar();
    const _n = s => { const m = String(s || '').match(/-?[\d.]+,\d{2}/); return m ? +m[0].replace(/\./g, '').replace(',', '.') : null; };
    const meses = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
    const out = {};
    for (const M of meses) {
      mesSel = M;
      renderBalancete();
      let saldoBal = null;
      document.querySelectorAll('#aba-balancete tr').forEach(tr => { if (/Saldo final/.test(tr.textContent)) saldoBal = _n((tr.querySelector('td:nth-last-child(2)') || {}).textContent); });
      renderFechamento();
      const fech = document.getElementById('fechamento-conteudo').innerText;
      const mFim = fech.match(/Saldo fim do mês\s*R\$\s*([\d.,]+)/);
      const saldoFech = mFim ? _n(mFim[1]) : null;
      out[M] = { saldoBal, saldoFech };
    }
    return out;
  });
  // Saldo fim do Fechamento = Saldo final do Balancete = movimento do banco, em TODOS os meses (jun–out).
  // Meses fechados (jun–set) NÃO mudam. Resgate entra no saldo, fora da receita.
  const esperado = { '2026-06': 339383.24, '2026-07': 184138.91, '2026-08': 126022.14, '2026-09': 42668.58, '2026-10': 46417.75 };
  for (const M of Object.keys(esperado)) {
    expect(r[M].saldoBal, `${M} Balancete saldo`).not.toBeNull();
    expect(r[M].saldoFech, `${M} Fechamento saldo`).not.toBeNull();
    expect(Math.abs(r[M].saldoBal - r[M].saldoFech), `${M}: Balancete ${r[M].saldoBal} ≠ Fechamento ${r[M].saldoFech}`).toBeLessThanOrEqual(0.05);
    expect(Math.abs(r[M].saldoFech - esperado[M]), `${M}: Fechamento ${r[M].saldoFech} ≠ esperado ${esperado[M]}`).toBeLessThanOrEqual(0.05);
  }
  // NÃO é mais 22.568,27 (bug do resgate fora do saldo) em out.
  expect(Math.abs(r['2026-10'].saldoBal - 22568.27)).toBeGreaterThan(1000);
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
