/* ════════════════════════════════════════════════════════════════════
   competencia.js — FONTE ÚNICA da regra de COMPETÊNCIA (mês da despesa/receita).
   Usada pelo Gestão (index.html: exportações do CR e do CP) e pelo Painel RK
   (financeiro.html: aba DRE), para que NUNCA divirjam.

   Regra (combinada com a Elaine, 11/11/2026):
   - RECEITA (pedido): mês da NF (se houver NF com data); senão, mês do pedido.
   - DESPESA (conta a pagar):
       • competência GRAVADA (campo c.competencia) manda, se preenchida;
       • senão, SUGESTÃO: folha/DAS = mês ANTERIOR ao pagamento; demais = mês
         do vencimento (documento).
   - Não grava nada e não altera meses fechados: é só cálculo.

   API (window.Competencia):
     receita(pedido, pedNFmapa)  -> 'YYYY-MM'  (pedNFmapa = { 'acct|id': { nf:{data} } })
     despesaSug(conta)           -> 'YYYY-MM'  (sugestão, ignora o campo gravado)
     gravada(conta)              -> 'YYYY-MM' | ''  (o campo competencia)
     despesa(conta)              -> 'YYYY-MM'  (gravada || sugestão; é a que o DRE usa)
   ════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  // folha/encargos/impostos sobre faturamento: a competência é o mês ANTERIOR ao pagamento.
  var FOLHA = /SAL[ÁA]RIO|COMISS|VALE|BENEF|F[ÉE]RIAS|INSS|FGTS|CONV[ÊE]NIO|SIMPLES|ICMS|DAS|PR[ÓO].?LABORE|S[ÓO]CIO|13|RESCIS/i;
  function empLabel(e) { e = e || ''; return (/rk/i.test(e) && !/rokbox/i.test(e)) ? 'Rk' : 'Rokbox'; }
  function mesDe(v) { if (!v) return ''; var d = (v instanceof Date) ? v : new Date(v); return isNaN(d) ? '' : (d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }
  function mesAnt(v) { if (!v) return ''; var d = (v instanceof Date) ? new Date(v.getTime()) : new Date(v); if (isNaN(d)) return ''; d.setMonth(d.getMonth() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }

  function competenciaReceita(p, pedNFmapa) {
    try {
      if (!p || !p.data) return '';
      var acct = empLabel(p.empresa) === 'Rk' ? 2 : 1;
      var ent = (pedNFmapa || {})[acct + '|' + p.id];
      var nf = (ent && ent.nf && ent.nf.id) ? ent.nf : null;
      var pm = String(p.data || '').slice(0, 7);
      return (nf && nf.data) ? String(nf.data).slice(0, 7) : pm;
    } catch (e) { return String((p && p.data) || '').slice(0, 7); }
  }
  function competenciaDespesaSug(c) {
    if (!c) return '';
    var base = c.dataPag || c.vencimento;
    return FOLHA.test(c.categoria || '') ? mesAnt(base) : mesDe(c.vencimento);
  }
  function competenciaGravada(c) { return (c && c.competencia) ? String(c.competencia).slice(0, 7) : ''; }
  function competenciaDespesa(c) { return competenciaGravada(c) || competenciaDespesaSug(c); }

  global.Competencia = {
    receita: competenciaReceita,
    despesaSug: competenciaDespesaSug,
    gravada: competenciaGravada,
    despesa: competenciaDespesa,
    empLabel: empLabel
  };
})(typeof window !== 'undefined' ? window : this);
