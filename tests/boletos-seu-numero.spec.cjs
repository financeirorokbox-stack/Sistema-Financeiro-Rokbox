const { test, expect } = require('@playwright/test');
const { installMock, trackErrors } = require('./support/mock.cjs');

// Pedido Elaine: "Seu Número" do Itaú às vezes vem com o nº do pedido REPETIDO (ex.: Lorena #40639 veio "4063940639")
// ou com zeros à esquerda. _pedidoSeuNumero devolve o pedido certo (só quando o pedido existe), pra reconhecer na prévia.
async function boot(page) {
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return Array.isArray(pedidos) && pedidos.length > 100; } catch (e) { return false; } }, { timeout: 45000 });
}

test('_pedidoSeuNumero: nº repetido e zeros à esquerda viram o pedido certo; desconhecido fica igual', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  const r = await page.evaluate(() => {
    // pega um pedido real com id numérico
    const pid = String((pedidos.find(p => /^\d{3,7}$/.test(String(p.id))) || {}).id || '');
    const temMuitoGrande = String(999999999); // id que não existe
    return {
      pid,
      repetido: _pedidoSeuNumero(pid + pid),      // "4063940639" → "40639"
      zeros: _pedidoSeuNumero('000' + pid),        // zeros à esquerda
      exato: _pedidoSeuNumero(pid),                // já certo
      desconhecido: _pedidoSeuNumero(temMuitoGrande + temMuitoGrande), // não existe → não mexe
      lorena: _pedidoSeuNumero('4063940639'),      // caso real (se #40639 existir no snapshot)
      tem40639: pedidos.some(p => String(p.id) === '40639')
    };
  });

  expect(r.pid, 'achou um pedido numérico').not.toBe('');
  expect(r.repetido, 'nº repetido vira o pedido').toBe(r.pid);
  expect(r.zeros, 'zeros à esquerda viram o pedido').toBe(r.pid);
  expect(r.exato, 'nº certo fica igual').toBe(r.pid);
  expect(r.desconhecido, 'nº desconhecido NÃO é alterado').toBe('999999999999999999');
  if (r.tem40639) expect(r.lorena, 'Lorena 4063940639 → 40639').toBe('40639');

  expect(errors, 'console limpo: ' + errors.join(' | ')).toEqual([]);
});
