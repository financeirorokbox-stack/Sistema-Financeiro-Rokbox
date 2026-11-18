const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// BARTE NA CONCILIAÇÃO (18/11): a Barte é gateway com repasse (igual PayPal/Braavo). Um crédito "PIX RECEBIDO
// BARTE ... BARTE BRASIL LTDA" abre já com a Barte selecionada, lista os recebíveis Barte, e conciliar casa os
// 5 pedidos (R$ 1.299,77). No Contas a Receber, esses 5 passam a aparecer PAGOS via Barte (data do repasse).
async function boot(page) {
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return Array.isArray(pedidos) && pedidos.length > 100 && Array.isArray(extratoBancario); } catch (e) { return false; } }, { timeout: 45000 });
}

// injeta 5 recebíveis Barte (líq soma 1.299,77) + o crédito PIX BARTE de 09/11
async function injetarBarte(page) {
  return await page.evaluate(() => {
    window.confirm = () => true; // conciliação pede confirmação
    const base = '2026-11-08T12:00:00';
    const liqs = [300.00, 300.00, 300.00, 299.77, 100.00]; // = 1299.77
    const peds = ['BRT1','BRT2','BRT3','BRT4','BRT5'];
    peds.forEach((pid,i)=>{
      recebimentosConsolidado.push({ gateway:'Barte', bruto:+(liqs[i]+1).toFixed(2), taxa:1, liq:liqs[i], data: base, nped: pid, nome:'Cliente Barte '+(i+1), tipo:'PIX', status:'pago', _txnId:'barte-tx-'+i, _nsite:'2758'+i });
      if(!pedidos.find(p=>String(p.id)===pid)) pedidos.push({ id: pid, numero: pid, nome:'Cliente Barte '+(i+1), empresa:'Rokbox', data: base, situacao:'Atendido', valor: liqs[i], loja:0, linhas:[] });
    });
    const extId = 'ext-barte-0911';
    if(!extratoBancario.find(t=>t.id===extId)) extratoBancario.push({ id: extId, data:'2026-11-09T12:00:00', valor: 1299.77, memo:'PIX RECEBIDO BARTE BRASIL LTDA 09/11', descricao:'PIX RECEBIDO BARTE BRASIL LTDA 09/11', banco:'Itaú - Rokbox' });
    return { extId, peds };
  });
}

test('Barte é detectada pela descrição e entra no seletor de repasse', async ({ page }) => {
  await boot(page);
  const { extId } = await injetarBarte(page);
  const r = await page.evaluate((extId) => {
    const t = extratoBancario.find(x=>x.id===extId);
    const gwDetectado = gatewayDoCredito(t);                 // deve ser 'Barte'
    // acúmulo dos recebíveis Barte até bater o depósito
    const acc = acumularRepasse('Barte', Math.abs(t.valor), repasseUsados());
    return { gwDetectado, nAcc: acc.n, somaAcc: +acc.soma.toFixed(2), valorDep: Math.abs(t.valor) };
  }, extId);
  expect(r.gwDetectado, 'crédito com BARTE → gateway Barte').toBe('Barte');
  expect(r.nAcc, 'acumula os 5 recebíveis Barte').toBe(5);
  expect(r.somaAcc, 'soma = valor do depósito (1.299,77)').toBe(1299.77);
});

test('O seletor da Conciliação mostra Barte e lista os recebíveis', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  const { extId } = await injetarBarte(page);
  const r = await page.evaluate((extId) => {
    try { bancoConcSel = '__todos'; } catch(e){}
    try { if (typeof buscaPersist !== 'undefined') buscaPersist.banco = ''; } catch(e){}
    try { dateFilters = {}; } catch(e){}
    renderBanco();
    const sel = document.getElementById('cb-rep-gw-' + extId);
    if(!sel) return { semSel:true };
    const opts = [...sel.options].map(o=>o.value);
    return { semSel:false, opts, barteSelecionado: sel.value==='Barte' };
  }, extId);
  expect(r.semSel, 'crédito Barte aparece com seletor de repasse').toBeFalsy();
  expect(r.opts, 'Barte está no seletor').toContain('Barte');
  expect(r.barteSelecionado, 'crédito com BARTE abre já com Barte selecionada').toBe(true);
  expect(errors, 'console limpo: ' + errors.join(' | ')).toEqual([]);
});

test('Conciliar o PIX de 09/11 → Repasse Barte (5 pedidos, 1.299,77) e pedidos PAGOS via Barte', async ({ page }) => {
  await boot(page);
  const { extId, peds } = await injetarBarte(page);
  const r = await page.evaluate(({extId, peds}) => {
    try { bancoConcSel = '__todos'; dateFilters = {}; } catch(e){}
    renderBanco();
    cbConciliarRepasse(extId);                     // confirm está stubbado p/ true
    const link = repasseLinks[extId];
    // CR: os 5 pedidos agora têm recebimento Barte com data do banco (09/11) = pagos
    const pagos = peds.map(pid => {
      const ped = pedidos.find(p => String(p.id)===pid);
      const recs = ped ? (getRecebimentosDoPedido(ped) || []) : [];
      const b = recs.find(x => x.gateway==='Barte');
      return b ? { pid, dataLiq: (b.dataLiq||b.data||'').toString().slice(0,10) } : null;
    });
    return {
      temLink: !!link, gw: link&&link.gateway, total: link&&+(link.total).toFixed(2), nItens: link&&link.itens.length,
      pagos: pagos.filter(Boolean).length, datasBanco: pagos.filter(p=>p&&p.dataLiq==='2026-11-09').length
    };
  }, {extId, peds});
  expect(r.temLink, 'criou o vínculo de repasse').toBe(true);
  expect(r.gw, 'repasse é Barte').toBe('Barte');
  expect(r.total, 'total do repasse = 1.299,77').toBe(1299.77);
  expect(r.nItens, '5 recebíveis no repasse').toBe(5);
  expect(r.pagos, 'os 5 pedidos têm recebimento Barte').toBe(5);
  expect(r.datasBanco, 'os 5 ficam com a data do banco (09/11) = pagos via Barte').toBe(5);
});
