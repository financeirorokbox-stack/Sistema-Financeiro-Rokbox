const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// Alocação de pagamento COMPARTILHADO (um PIX paga 2 pedidos) em MÊS FECHADO:
// deve ratear pela FALTA QUE RESTA (igual ao mês aberto). Antes, o ramo "antigo" de mês fechado dava a cada
// pagamento o valor CHEIO do pedido, então o grande engolia tudo e o pequeno ficava com 0 (bug CORAVI #398/#446).
async function boot(page) {
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return Array.isArray(pedidos) && pedidos.length > 100; } catch (e) { return false; } }, { timeout: 45000 });
}

test('alocação mês fechado: pagamento grande+pequeno credita o pequeno (falta que resta)', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    // mês julho FECHADO
    if (!mesesFechados.includes('2026-07')) mesesFechados.push('2026-07');
    // 2 pedidos de teste num mês fechado
    pedidos.push({ id: 'TA_ALOC', nome: 'TESTE GRANDE', data: '2026-07-15T03:00:00.000Z' });
    pedidos.push({ id: 'TB_ALOC', nome: 'TESTE PEQUENO', data: '2026-07-15T03:00:00.000Z' });
    // stub do alvo de conciliação: grande 5000, pequeno 300
    const _orig = getValorConciliacaoPedido;
    window.getValorConciliacaoPedido = (p) => (p && String(p.id) === 'TA_ALOC') ? 5000 : (p && String(p.id) === 'TB_ALOC') ? 300 : _orig(p);
    try { if (typeof pedidoPorId === 'function' && pedidoPorId.cache) pedidoPorId.cache = null; } catch (e) {}
    // um ÚNICO pagamento compartilhado de 5300 cobre os dois
    const receb = { gateway: 'PIX (Extrato)', nped: 'TA_ALOC,TB_ALOC', bruto: 5300, liq: 5300, data: '2026-07-28T03:00:00.000Z', tipo: 'PIX', status: 'pago' };
    recebimentosConsolidado.push(receb);
    if (typeof _invalidarAloc === 'function') _invalidarAloc();
    const congeladoA = _mesCongeladoCR('2026-07-15T03:00:00.000Z');
    const aGrande = alocRecebGateway(receb, 'TA_ALOC');
    const aPequeno = alocRecebGateway(receb, 'TB_ALOC');
    window.getValorConciliacaoPedido = _orig; // restaura
    return { congeladoA, aGrande: +(+aGrande).toFixed(2), aPequeno: +(+aPequeno).toFixed(2) };
  });

  expect(r.congeladoA, 'julho está fechado no teste').toBe(true);
  expect(r.aGrande, 'pedido grande recebe só o alvo dele (5000), não os 5300').toBe(5000);
  expect(r.aPequeno, 'pedido pequeno é creditado (300), não fica em 0').toBe(300);

  expect(errors, 'console limpo: ' + errors.join(' | ')).toEqual([]);
});
