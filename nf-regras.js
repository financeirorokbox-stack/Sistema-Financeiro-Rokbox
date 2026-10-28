/* nf-regras.js — regra ÚNICA de classificação de NF por pedido.
   Usado pela aba NF (financeiro.html) e pelos Afazeres (index.html).
   Mexeu numa regra aqui? Vale para os dois lugares. */
(function () {
  const HARD = ['cancelado', 'atualização de estoque', 'atualizacao de estoque', 'correios', 'sit#15']; // nunca é venda com nota
  const EMPROG = ['em aberto', 'em andamento']; // em progresso: fora da base de venda
  const PROB = ['venda_sem_nota', 'amostra_sem_remessa', 'troca_sem_remessa', 'nota_nao_concluido', 'natureza_dif', 'nota_nao_aut', 'nota_mes_dif', 'valor_dif', 'pgdas_sem_nf'];
  const SELO_INFO = {
    venda_sem_nota: ['🔴', 'venda sem nota', 'var(--red)'],
    amostra_sem_remessa: ['🟠', 'amostra sem remessa', 'var(--amber)'],
    troca_sem_remessa: ['🔁', 'troca sem remessa', 'var(--amber)'],
    nota_nao_concluido: ['🚚', 'pedido com nota, não concluído', 'var(--amber)'],
    natureza_dif: ['❌', 'natureza diferente', 'var(--red)'],
    nota_nao_aut: ['⛔', 'nota cancelada/denegada', 'var(--red)'],
    nota_mes_dif: ['📅', 'nota em mês diferente', 'var(--amber)'],
    valor_dif: ['💰', 'valor nota ≠ pedido', 'var(--amber)'],
    pgdas_sem_nf: ['📣', 'declarado no PGDAS sem NF', 'var(--amber)'],
    sem_esperada: ['·', 'sem nota esperada', 'var(--muted)'],
    ok: ['✅', 'ok', 'var(--lime)']
  };
  function _norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
  function empG(s) { const t = String(s || '').toLowerCase(); if (t.includes('rkbx')) return 'rkbx'; if (t.includes('rokbox')) return 'rokbox'; if (t.includes('rk')) return 'rk'; return ''; }
  function acctDe(e) { return empG(e) === 'rk' ? 2 : 1; }
  function empLabel(e) { return empG(e) === 'rk' ? 'Rk' : 'Rokbox'; }
  const ehVendaNat = s => /venda de (mercadoria|produ)/i.test(String(s || ''));
  const sitLbl = s => ({ 6: 'autorizada', 5: 'autorizada', 1: 'pendente', 0: 'rascunho', 2: 'cancelada', 3: 'denegada' }[s] || ('sit ' + s));
  function trocaMap(dev) { const t = {}; (dev || []).forEach(d => { const m = String(d.pedidoCredito || '').match(/\d{4,6}/g) || []; const temNF = !!String(d.nfOrigem || '').trim(); m.forEach(x => { if (temNF) t[x] = true; else if (!(x in t)) t[x] = false; }); }); return t; }

  // Classifica UM pedido. ctx = {lc, pedNF, pgSemNF, _troca}. Retorna linha ou null (pedido ignorado).
  function classificaPedido(p, ctx) {
    const lc = ctx.lc || {}, pedNF = ctx.pedNF || {}, pgSemNF = ctx.pgSemNF || {}, trocaNfOrig = ctx._troca || {};
    const empresa = p.empresa || ''; const sit = String(p.situacao || '').toLowerCase();
    if (HARD.includes(sit)) return null;
    const loja = p.loja || ''; const info = lc[loja] || {}; const operacao = String(info.operacao || '').toLowerCase();
    const esperada = info.naturezaNF || ''; const acct = acctDe(empresa);
    const ent = pedNF[acct + '|' + p.id]; const nf = (ent && ent.nf && ent.nf.id) ? ent.nf : null;
    const pedVal = +p.valor || 0; const nfVal = nf && nf.valor != null ? +nf.valor : null;
    const autoriz = nf && (nf.sit === 5 || nf.sit === 6); const autVenda = autoriz && ehVendaNat(nf.natNome);
    const emProg = EMPROG.includes(sit); const emSep = /em separa/.test(sit);
    if (emProg && !autVenda) return null; // em aberto/andamento sem nota de venda: nada a reportar
    const naBase = !emProg; // base de venda exclui em aberto/andamento (inclui em separação/checkout/verificado/atendido)
    let selo, espDisp = esperada, devConf = false;
    if (pgSemNF[empresa + '|' + p.id]) selo = 'pgdas_sem_nf';
    else if (operacao === 'troca') {
      const temOrig = trocaNfOrig[p.id] === true;
      if (temOrig) { espDisp = 'Remessa em troca'; devConf = true; if (!nf) selo = 'troca_sem_remessa'; else if (!autoriz) selo = 'nota_nao_aut'; else if (ehVendaNat(nf.natNome)) selo = 'natureza_dif'; else selo = 'ok'; }
      else { espDisp = 'Sem nota esperada'; selo = 'sem_esperada'; }
    }
    else if (autVenda && (emProg || emSep) && operacao === 'venda') selo = 'nota_nao_concluido';
    else if (/sem nota esperada/i.test(esperada)) selo = 'sem_esperada';
    else if (operacao === 'amostra') { if (!nf) selo = 'amostra_sem_remessa'; else if (!autoriz) selo = 'nota_nao_aut'; else if (ehVendaNat(nf.natNome)) selo = 'natureza_dif'; else selo = 'ok'; }
    else if (operacao === 'venda') { if (!nf) selo = 'venda_sem_nota'; else if (!autoriz) selo = 'nota_nao_aut'; else if (nf.natNome && _norm(nf.natNome) !== _norm(esperada)) selo = 'natureza_dif'; else if (nf.foraMes) selo = 'nota_mes_dif'; else if (nfVal != null && Math.abs(pedVal - nfVal) > 1) selo = 'valor_dif'; else selo = 'ok'; }
    else selo = 'sem_esperada';
    return { id: String(p.id), nome: p.nome || '', empresa, loja, operacao: info.operacao || '(loja sem cadastro)', esperada: espDisp, data: p.data || '', pedVal, nf, nfVal, autVenda, naBase, devConf, selo };
  }

  // Monta rows + agregados para um mês + filtro de empresa.
  // ctx = {pedidos, pedNF, lc, pgSemNF, dev, nfidx, nfidxNat, mes, empresa}
  function classificar(ctx) {
    const mes = ctx.mes; const empF = ctx.empresa || 'todas';
    const c2 = Object.assign({}, ctx, { _troca: trocaMap(ctx.dev) });
    const empOk = e => empF === 'todas' ? true : (empG(e) === empG(empF));
    const rows = [];
    (ctx.pedidos || []).forEach(p => { if (String(p.data || '').slice(0, 7) !== mes) return; if (!empOk(p.empresa || '')) return; const r = classificaPedido(p, c2); if (r) rows.push(r); });
    const vendaSistema = rows.filter(r => r.operacao.toLowerCase() === 'venda' && r.naBase).reduce((s, r) => s + r.pedVal, 0);
    const casadaVenda = rows.filter(r => r.operacao.toLowerCase() === 'venda' && r.naBase && r.autVenda).reduce((s, r) => s + r.pedVal, 0);
    const vendaSemNota = +(vendaSistema - casadaVenda).toFixed(2);
    const notasVenda = rows.filter(r => r.autVenda);
    const nfVendaAut = notasVenda.reduce((s, r) => s + (r.nfVal != null ? r.nfVal : r.pedVal), 0);
    const semPedN = notasSemPedido(ctx, [mes], empF);
    return { rows, vendaSistema, casadaVenda, vendaSemNota, nfVendaAut, notasVendaLen: notasVenda.length, semPedN };
  }

  // Conta notas de venda autorizadas no índice sem pedido casado. Retorna {n, emp:{Rokbox,Rk}}.
  function notasSemPedidoDetalhe(ctx, meses, empF) {
    const res = { n: 0, emp: {} };
    [1, 2].forEach(a => {
      if (empF && empF !== 'todas' && acctDe(empF) !== a) return;
      const idx = (ctx.nfidx && ctx.nfidx[a]) || {}, nat = (ctx.nfidxNat && ctx.nfidxNat[a]) || {};
      const linked = new Set(); Object.values(ctx.pedNF || {}).forEach(e => { if (e && e.nf && e.nf.id && String(e.acct) === String(a)) linked.add(String(e.nf.id)); });
      Object.keys(idx).forEach(id => { const o = idx[id]; if (!meses.includes(String(o.data || '').slice(0, 7))) return; if (o.sit !== 5 && o.sit !== 6) return; if (!ehVendaNat(nat[String(o.nat)] || '')) return; if (!linked.has(String(id))) { res.n++; const eg = a === 2 ? 'Rk' : 'Rokbox'; res.emp[eg] = (res.emp[eg] || 0) + 1; } });
    });
    return res;
  }
  function notasSemPedido(ctx, meses, empF) { return notasSemPedidoDetalhe(ctx, meses, empF).n; }

  // Resumo de avisos: um item por TIPO, somando empresas, com split por empresa.
  // meses = lista de meses abertos. Retorna [{selo, icon, label, n, valor, emp:{Rokbox:{n,valor}, Rk:{...}}}].
  function resumoAvisos(ctx, meses) {
    const tally = {};
    const add = (selo, valor, empresa) => { const t = tally[selo] = tally[selo] || { n: 0, valor: 0, emp: {} }; t.n++; t.valor += valor; const eg = empLabel(empresa); t.emp[eg] = t.emp[eg] || { n: 0, valor: 0 }; t.emp[eg].n++; t.emp[eg].valor += valor; };
    (meses || []).forEach(mes => { const r = classificar(Object.assign({}, ctx, { mes, empresa: 'todas' })); r.rows.forEach(row => { if (PROB.includes(row.selo)) add(row.selo, row.pedVal, row.empresa); }); });
    const out = PROB.filter(s => tally[s]).map(s => ({ selo: s, icon: SELO_INFO[s][0], label: SELO_INFO[s][1], n: tally[s].n, valor: +tally[s].valor.toFixed(2), emp: tally[s].emp }));
    const sp = notasSemPedidoDetalhe(ctx, meses || [], 'todas');
    if (sp.n) out.push({ selo: 'nota_sem_pedido', icon: '🧾', label: 'nota sem pedido', n: sp.n, valor: null, emp: Object.fromEntries(Object.entries(sp.emp).map(([k, v]) => [k, { n: v, valor: 0 }])) });
    return out;
  }

  function mesesAbertos(mes, mesPrev, fechados) { return [mes, mesPrev].filter((m, i, a) => a.indexOf(m) === i && !(fechados || []).includes(m)); }

  window.NFRegras = { HARD, EMPROG, PROB, SELO_INFO, _norm, empG, acctDe, empLabel, ehVendaNat, sitLbl, classificaPedido, classificar, resumoAvisos, notasSemPedido, mesesAbertos };
})();
