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
    // simula o De/Até PRESO (novembro) que travava a tela — independente do que veio no snapshot
    dateFilters.renderContas = Object.assign({ ano: [], mes: [], dia: [] }, dateFilters.renderContas, { de: '2026-11-01', ate: '2026-11-30' });
    renderContas(); // garante os controles na tela
    const antesDe = (dateFilters.renderContas || {}).de;
    // 1) o botão REAL da tela ("✕ limpar" = limparFiltrosContas) tem que limpar o De/Até
    limparFiltrosContas();
    const posLimpar = JSON.parse(JSON.stringify(dateFilters.renderContas || {}));

    // 1b) o mesmo tem que valer pra VENDAS (limparFiltrosVendas) — injeta preso e limpa
    dateFilters.renderVendas = Object.assign({ ano: [], mes: [], dia: [] }, dateFilters.renderVendas, { de: '2026-11-01', ate: '2026-11-30' });
    renderVendas();
    const vendasAntesDe = (dateFilters.renderVendas || {}).de;
    limparFiltrosVendas();
    const vendasPos = JSON.parse(JSON.stringify(dateFilters.renderVendas || {}));

    const card = (lab) => {
      let v = ''; const el = document.getElementById('v-contas');
      el.querySelectorAll('.card').forEach(c => {
        const l = ((c.querySelector('.c-label') || {}).textContent || '').replace(/\s*\(filtro\).*/, '').trim();
        if (l === lab) v = ((c.querySelector('.c-val') || {}).textContent || '').trim();
      });
      return v;
    };
    const setDP = (dp) => { setDfMes('renderContas', '10'); const s = document.getElementById('fc-datapor'); if (s) s.value = dp; renderContas(); };
    setDP('vencimento'); const venc = { valor: card('Valor dos pedidos'), recebido: card('Recebido'), atrasado: card('Atrasado') };
    setDP('liquidacao'); const liq = { clientes: card('Recebido dos clientes'), total: card('Total recebido') };

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
    return { antesDe, limparDe: posLimpar.de, limparAte: posLimpar.ate, vendasAntesDe, vendasDe: vendasPos.de, vendasAte: vendasPos.ate, venc, liq, vtOut: +vtOut.toFixed(2), nOut };
  });

  // 1) o botão "limpar" da tela limpa o De/Até preso de novembro (CR e Vendas)
  expect(r.antesDe).toBe('2026-11-01');
  expect(r.limparDe).toBe('');
  expect(r.limparAte).toBe('');
  expect(r.vendasAntesDe).toBe('2026-11-01');
  expect(r.vendasDe).toBe('');
  expect(r.vendasAte).toBe('');
  // 2) Vencimento: os pedidos de outubro aparecem (antes sumiam) — "Valor dos pedidos" cobre todos os Venda/Troca de out
  const _n = s => +String(s || '').replace(/[^\d,]/g, '').replace(/\./g, '').replace(',', '.');
  expect(_n(r.venc.valor)).toBeGreaterThanOrEqual(r.vtOut - 0.01);
  expect(_n(r.venc.recebido)).toBeGreaterThan(0);
  // 3) Liquidação: "Recebido dos clientes" e "Total recebido" mostram valores reais de outubro
  expect(_n(r.liq.clientes)).toBeGreaterThan(100000);
  expect(_n(r.liq.total)).toBeGreaterThan(100000);
  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});

test('Contas a Receber: nenhum pedido de Venda/Troca some do CR (ago–nov)', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    const NAOAP = (typeof SITUACOES_NAO_APLICAVEL !== 'undefined') ? SITUACOES_NAO_APLICAVEL : [];
    const mOf = p => String(p.data instanceof Date ? p.data.toISOString() : p.data).slice(0, 7);
    const vt = {};
    pedidos.forEach(p => {
      if (NAOAP.includes((p.situacao || '').toLowerCase())) return;
      const op = (getClassificacao(p).operacao || '').toLowerCase();
      if (op !== 'venda' && op !== 'troca') return;
      const m = mOf(p); if (!['2026-08', '2026-09', '2026-10', '2026-11'].includes(m)) return;
      (vt[m] = vt[m] || new Set()).add(String(p.id));
    });
    // CR sem filtro de data (todos os pedidos)
    dateFilters.renderContas = { ano: [], mes: [], dia: [], de: '', ate: '' };
    renderContas();
    const noCR = new Set();
    document.querySelectorAll('#v-contas .table-wrap tbody tr').forEach(tr => {
      const td = tr.querySelector('td:nth-child(2)'); // coluna "Pedido"
      const id = td ? td.textContent.replace(/[^\d]/g, '') : '';
      if (id) noCR.add(id);
    });
    const faltam = {};
    for (const m of Object.keys(vt)) {
      const miss = [...vt[m]].filter(id => !noCR.has(id));
      faltam[m] = { nVT: vt[m].size, faltam: miss.length, ids: miss.slice(0, 5) };
    }
    return faltam;
  });

  // nenhum pedido de Venda/Troca pode faltar no CR
  for (const m of ['2026-08', '2026-09', '2026-10', '2026-11']) {
    expect(r[m].nVT).toBeGreaterThan(0);
    expect(r[m].faltam, `${m} faltam no CR: ${JSON.stringify(r[m].ids)}`).toBe(0);
  }
  expect(r['2026-10'].nVT).toBe(211); // Out/26 = 211 pedidos Venda/Troca
  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});

test('Contas a Receber "uma conta só": tela = export = Power BI, sem duplicar parcela, resgate fora (out/26)', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    const inM = (d, m) => { const x = d instanceof Date ? d : (d ? new Date(d) : null); return x && !isNaN(x) && (x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0')) === m; };
    const card = (lab) => { let o = { val: '', sub: '' }; document.querySelectorAll('#v-contas .card').forEach(c => { const l = ((c.querySelector('.c-label') || {}).textContent || '').replace(/\s*[›●ⓘ].*/, '').replace(/\s*\(filtro\).*/, '').trim(); if (l === lab) o = { val: ((c.querySelector('.c-val') || {}).textContent || '').trim(), sub: ((c.querySelector('.c-sub') || {}).textContent || '').trim() }; }); return o; };
    const setDP = v => { const s = document.getElementById('fc-datapor'); if (s) s.value = v; renderContas(); };
    setDfMes('renderContas', '10'); renderContas();
    setDP('liquidacao');
    // cards da visão Liquidação: 3 (Recebido dos clientes · Rendimentos · Total recebido)
    const cLiq = { clientes: card('Recebido dos clientes'), rend: card('Rendimentos'), resg: card('Resgates'), total: card('Total recebido') };
    // cards da visão Vencimento: Atrasado + lista
    setDP('vencimento');
    const cAtras = card('Atrasado');
    const box = document.getElementById('cr-atrasados-box');
    const atrasPeds = box ? [...box.querySelectorAll('span')].map(s => (s.textContent.match(/#(AV)?\d+/) || [''])[0]).filter(Boolean) : [];
    setDP('liquidacao');

    const aoa = _crRowsAOA(false);
    const byPed = {}; let recCli = 0, resgExport = 0, rendAvul = 0;
    aoa.slice(1).forEach(row => {
      if (row[4] !== 'Pago' || !inM(row[0], '2026-10')) return;
      const pid = String(row[2] || '').trim(); const v = +row[10] || 0;
      if (pid) { byPed[pid] = (byPed[pid] || 0) + v; recCli += v; }
      if (/\bresg/i.test(String(row[13] || '') + String(row[3] || ''))) resgExport += v;
      if (!pid && /rentab|rend|juros/i.test(String(row[13] || '') + String(row[3] || ''))) rendAvul += v;
    });
    // Power BI (flatCR) = _crRowsAOA(true); parte de cliente de out
    const aoaAll = _crRowsAOA(true); let pbiCli = 0;
    aoaAll.slice(1).forEach(row => { if (row[4] === 'Pago' && inM(row[0], '2026-10') && String(row[2] || '').trim()) pbiCli += (+row[10] || 0); });

    // resgate na tela de CR? (texto da aba não pode citar RESG)
    const resgNaTela = /resg\b/i.test(document.getElementById('v-contas').innerText);
    // resgates em meses-foto (jun–set) devem ser 0 → nada muda nas fotos
    const resgJunSet = (typeof receitasAvulsas !== 'undefined' ? receitasAvulsas : []).filter(x => /\bresg/i.test(x.descricao || '') && ['2026-06', '2026-07', '2026-08', '2026-09'].includes(String(x.data instanceof Date ? x.data.toISOString() : x.data).slice(0, 7))).length;

    const _n = s => +String(s || '').replace(/[^\d,]/g, '').replace(/\./g, '').replace(',', '.');
    return {
      cLiq, cAtras, atrasPeds,
      recCli: +recCli.toFixed(2), pbiCli: +pbiCli.toFixed(2),
      resgExport: +resgExport.toFixed(2), rendAvul: +rendAvul.toFixed(2), resgNaTela, resgJunSet,
      casos: { p40454: +(byPed['40454'] || 0).toFixed(2), p40669: +(byPed['40669'] || 0).toFixed(2), p40312: +(byPed['40312'] || 0).toFixed(2), p40110: +(byPed['40110'] || 0).toFixed(2), p40352: +(byPed['40352'] || 0).toFixed(2) },
      _n: { cli: _n(cLiq.clientes.val), rend: _n(cLiq.rend.val), resg: _n(cLiq.resg.val), tot: _n(cLiq.total.val), atras: _n(cAtras.val) }
    };
  });

  // estrutural (sempre vale): a tela lê a MESMA conta do export/Power BI
  expect(r.recCli).toBe(r.pbiCli);
  // resgate (RESG AUTOMATICO / RESG VENCTO CDB) fora do CR e do Power BI; rendimento de centavos continua receita
  expect(r.resgExport).toBe(0);
  expect(r.resgNaTela).toBe(false);
  expect(r.rendAvul).toBeGreaterThan(0);
  expect(r.rendAvul).toBeLessThan(10);
  expect(r.resgJunSet).toBe(0); // fotos jun–set não mudam
  // RECEITA SEPARADA (visão Liquidação) out/26: Clientes 263.251,05 · Rendimentos 2,30 · Resgates 23.849,48 · Total 287.102,83
  expect(r._n.cli).toBe(263251.05);
  expect(r._n.rend).toBe(2.30);
  expect(r._n.resg).toBe(23849.48); // resgate informativo (fora da receita)
  expect(r._n.tot).toBe(287102.83); // clientes + rendimentos + resgates
  expect(r.cLiq.clientes.sub).toContain('216 pedido'); // pedidos distintos
  // ATRASADO (visão Vencimento) out/26 = 16.611,84; quitados/sobra nunca aparecem
  expect(r._n.atras).toBe(16602.74); // #41041 (9,10) tem diferença aceita → fora do atraso
  expect(r.atrasPeds).toContain('#41241');
  expect(r.atrasPeds).toContain('#AV103');
  expect(r.atrasPeds).not.toContain('#40877'); // quitado no gateway (PayPal) → nunca atrasado
  expect(r.atrasPeds).not.toContain('#41020'); // idem
  expect(r.atrasPeds).not.toContain('#429');   // pagou a mais (sobra) → não é atraso
  // casos fixos out/26 (dedup + entrada na data certa)
  expect(r.casos.p40454).toBe(2509.52);
  expect(r.casos.p40669).toBe(643.59);
  expect(r.casos.p40312).toBe(632.32);
  expect(r.casos.p40110).toBe(119.95);
  expect(r.casos.p40352).toBe(2158.01); // entrada PIX de 2.111,23 fica em julho
  expect(r.recCli).toBe(263251.05);
  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});

test('Boletos a Emitir: pedido já pago (nada a emitir) não aparece (ex.: #417)', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  const r = await page.evaluate(() => {
    renderBoletos();
    const linhas = [...document.querySelectorAll('#v-boletos table tbody tr')].map(tr => (tr.textContent.match(/#?(\d{3,6})/) || [])[1]).filter(Boolean);
    const temRecebimento = typeof getRecebimentosDoPedido === 'function';
    const falta417 = (() => { const p = pedidos.find(x => String(x.id) === '417'); return p ? _faltaPedido(p) : null; })();
    return { n: linhas.length, tem417: linhas.includes('417'), falta417: falta417 != null ? +falta417.toFixed(2) : null, temRecebimento };
  });
  expect(r.tem417).toBe(false);          // #417 está pago (sobra) → fora da lista
  expect(r.falta417).toBeLessThanOrEqual(0.05); // confirma que #417 não deve nada
  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});

test('Conferências CR: Sobras a resolver (0,05) e Ajustes de meses fechados', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    const c = _scanConferenciasCR();
    const sob = {}; c.sobras.forEach(s => sob[s.pedido] = s.sobra);
    const aj = {}; c.ajustesFechados.forEach(a => aj[a.pedido] = a.falta);
    return { nSob: c.sobras.length, nAj: c.ajustesFechados.length, sob, aj };
  });

  // Sobras a resolver = banda de centavos a mais (a tolerância 0,05 passou a mostrar). #429 e #41137 têm
  // diferença ACEITA (difAceita='aceito') → NÃO aparecem em nenhuma lista.
  expect(r.sob['429']).toBeUndefined();
  expect(r.sob['41137']).toBeUndefined();
  expect(r.sob['40414']).toBe(0.11);
  expect(r.sob['41165']).toBe(0.10);
  expect(r.sob['41107']).toBe(0.21);
  expect(r.sob['40039']).toBe(0.47); // crédito de devolução
  expect(r.sob['40900']).toBe(0.35); // crédito de devolução
  // Ajustes de meses fechados (falta de centavos, 0,05–0,50, mês fechado) = os 5 confirmados
  expect(r.nAj).toBe(5);
  expect(r.aj['39526']).toBe(0.20);
  expect(r.aj['40060']).toBe(0.07);
  expect(r.aj['40254']).toBe(0.06);
  expect(r.aj['40514']).toBe(0.40); // crédito de devolução
  expect(r.aj['40608']).toBe(0.07);
  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});

test('Exportar conciliado (banco): resgate aparece como transferência interna, não como Outras receitas', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    setDfMes('renderContas', '10'); renderContas(); // ativa o filtro de out
    const res = buildConciliadoBanco(_conciliadoBancoG());
    const cr = res.crRows.slice(1);
    const resg = cr.filter(row => /\bresg/i.test(String(row[23] || '') + String(row[13] || '')));
    return {
      nResg: resg.length,
      cats: [...new Set(resg.map(row => String(row[15] || '')))],
      tipos: [...new Set(resg.map(row => String(row[25] || '')))],
      resgEmOutras: cr.filter(row => String(row[15] || '') === 'OUTRAS RECEITAS' && /\bresg/i.test(String(row[23] || ''))).length,
      soma: +resg.reduce((s, row) => s + (+row[24] || 0), 0).toFixed(2)
    };
  });

  expect(r.nResg).toBe(3); // out/26: RESG AUTOMATICO x2 + RESG/VENCTO CDB
  expect(r.cats).toEqual(['RESGATE / TRANSFERÊNCIA INTERNA']);
  expect(r.tipos).toEqual(['transferência interna']);
  expect(r.resgEmOutras).toBe(0);
  expect(r.soma).toBe(23849.48);
  expect(errors, 'console sem erros: ' + errors.join(' | ')).toEqual([]);
});

test('Estorno de gateway: liquida na data do repasse conciliado, nunca antes (estornoParaPagar)', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    window.confirm = () => true; window.alert = () => {}; window.renderRecebimentos = () => {};
    // acha um recebimento cujo repasse foi conciliado numa data DIFERENTE do dia do recebimento
    let idx = -1, rep = null, recData = null;
    for (let i = 0; i < recebimentosConsolidado.length; i++) {
      const rr = recebimentosConsolidado[i]; const dr = dataRepasseBanco(rr);
      if (dr && rr.data && (+new Date(dr) !== +new Date(rr.data))) { idx = i; rep = +new Date(dr); recData = +new Date(rr.data); break; }
    }
    if (idx < 0) return { semCaso: true };
    const before = contasPagar.length;
    estornoParaPagar(idx);
    const c = contasPagar[contasPagar.length - 1];
    return { added: contasPagar.length - before, dataPag: c.dataPag ? +new Date(c.dataPag) : null, pago: c.pago, origem: !!c._origemEstorno, rep, recData };
  });

  if (r.semCaso) return; // snapshot sem caso adequado — não falha
  expect(r.added).toBe(1);
  expect(r.origem).toBe(true);
  expect(r.dataPag).toBe(r.rep);            // liquida na data do REPASSE conciliado
  expect(r.dataPag).not.toBe(r.recData);    // NÃO na data do lançamento/recebimento
  expect(r.dataPag).toBeGreaterThanOrEqual(r.recData); // nunca antes do repasse
  expect(r.pago).toBe(true);
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
