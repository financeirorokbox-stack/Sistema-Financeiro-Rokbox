/* ════════════════════════════════════════════════════════════════════
   pecas-vendidas.js — FONTE ÚNICA da regra de "Peças vendidas", amostras
   e brindes dentro de pedidos de venda. Usada pelo Painel de Vendas
   (placar.html) e pelo Relatório de Fechamento (financeiro.html) para que
   os dois NUNCA divirjam.

   Regra (combinada com a Elaine, 05/11/2026):
   - Peças vendidas = soma das quantidades das linhas dos pedidos de
     Venda + Troca do mês, TIRANDO as linhas com preço unitário <= R$ 0,01.
   - Linha <= R$ 0,01:
       • PRODUTO  -> "Amostra em pedido de venda".
       • SACOLA/EMBALAGEM em pedido de ATACADO -> "Brinde em pedido de Atacado".
       • SACOLA/EMBALAGEM nos outros canais (varejo/site) -> só custo de
         embalagem (não é peça, amostra nem brinde).
   - NÃO altera faturamento, comissão, NF nem meses fechados: só conta peças.

   Lista de SKUs de embalagem = quem casa o regex EMB (hoje, em todos os
   dados, só o RK26TNT-U "Sacola TNT RK").
   ════════════════════════════════════════════════════════════════════ */
;(function (global) {
  'use strict';

  // Mesma deteção de embalagem/sacola usada na Margem do financeiro.
  var EMB = /sacola|embalag|\btnt\b|rk26tnt/i;

  // Situações que NÃO entram em venda (iguais ao Gestão / SITUACOES_OCULTAS_GESTAO).
  var NAOAP = ['cancelado', 'em aberto', 'em andamento', 'atualização de estoque', 'atualizacao de estoque', 'correios', 'sit#15'];

  // Preço unitário real da linha (igual ao da Margem: valorLinha / qtd, com fallback precoUnit).
  function puLinha(l) {
    var q = +l.qtd || 0;
    var val = (+l.valorLinha) || ((+l.precoUnit || 0) * q);
    return q > 0 ? val / q : (+l.precoUnit || 0);
  }

  // Linha de cortesia = preço unitário <= R$ 0,01 (0,011 dá folga pra arredondamento).
  function ehCortesia(l) { return puLinha(l) <= 0.011; }

  // A linha é sacola/embalagem? (pelo SKU ou pela descrição)
  function ehEmbalagem(l) {
    return EMB.test((l.sku || '') + ' ' + (l.nome || l.descricao || ''));
  }

  // Categoria de UMA linha, dado o segmento do pedido:
  // 'venda' | 'amostra' | 'brinde' | 'embalagem'.
  function categoriaLinha(l, segmento) {
    if (!ehCortesia(l)) return 'venda';
    if (ehEmbalagem(l)) return (segmento === 'Atacado') ? 'brinde' : 'embalagem';
    return 'amostra';
  }

  // Resumo a partir de "fatos" já prontos (1 por linha), cada um com
  // { qtd, cortesia, categoria, pedido }. Usado pelo placar (que monta os
  // fatos do flatVendas + linhas e aplica os filtros da tela).
  function resumoFatos(fatos) {
    var R = { pecas: 0, amostra: 0, brinde: 0, embalagem: 0, amostraPeds: 0, brindePeds: 0, embalagemPeds: 0 };
    var ap = {}, bp = {}, ep = {};
    (fatos || []).forEach(function (f) {
      var q = +f.qtd || 0; if (!q) return;
      if (!f.cortesia) { R.pecas += q; return; }
      if (f.categoria === 'brinde') { R.brinde += q; bp[f.pedido] = 1; }
      else if (f.categoria === 'embalagem') { R.embalagem += q; ep[f.pedido] = 1; }
      else { R.amostra += q; ap[f.pedido] = 1; }
    });
    R.amostraPeds = Object.keys(ap).length;
    R.brindePeds = Object.keys(bp).length;
    R.embalagemPeds = Object.keys(ep).length;
    return R;
  }

  // Resumo direto a partir de pedidos (Relatório de Fechamento):
  // pedidos[], mes 'YYYY-MM' (ou vazio = todos), lojaCadastro (loja -> {operacao,segmento}).
  // Conta só Venda + Troca, fora das situações ocultas — mesma base do faturamento.
  function resumoPedidos(pedidos, mes, lojaCadastro) {
    var lc = lojaCadastro || {};
    var opDe = function (l) { return (lc[l] && lc[l].operacao) ? String(lc[l].operacao).toLowerCase() : ''; };
    var segDe = function (l) { return (lc[l] && lc[l].segmento) ? lc[l].segmento : ''; };
    var fatos = [];
    (pedidos || []).forEach(function (p) {
      if (mes && String(p.data || '').slice(0, 7) !== mes) return;
      if (NAOAP.indexOf(String(p.situacao || '').toLowerCase()) >= 0) return;
      var op = opDe(p.loja); if (op !== 'venda' && op !== 'troca') return;
      var seg = segDe(p.loja);
      var linhas = Array.isArray(p.linhas) ? p.linhas : [];
      linhas.forEach(function (l) {
        var q = +l.qtd || 0; if (!q) return;
        fatos.push({ qtd: q, cortesia: ehCortesia(l), categoria: categoriaLinha(l, seg), pedido: String(p.id || '') });
      });
    });
    return resumoFatos(fatos);
  }

  global.RKPecas = {
    EMB: EMB,
    NAOAP: NAOAP,
    puLinha: puLinha,
    ehCortesia: ehCortesia,
    ehEmbalagem: ehEmbalagem,
    categoriaLinha: categoriaLinha,
    resumoFatos: resumoFatos,
    resumoPedidos: resumoPedidos
  };
})(typeof window !== 'undefined' ? window : this);
