const { test, expect } = require('@playwright/test');
const { installMock } = require('./support/mock.cjs');

// AVISO DE VERSÃO NOVA + trava de aba velha (18/11): se o publicado é mais novo, mostra faixa "clique p/ atualizar"
// e BLOQUEIA o saveData (avisando O QUE ficou sem salvar). O robô (navigator.webdriver / window.__ROBO) NUNCA é
// afetado e é sempre a versão atual. Checa na abertura, a cada 15 min e ao VOLTAR pra aba (foco).
async function boot(page, initScript) {
  if (initScript) await page.addInitScript(initScript);
  await installMock(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => { try { return typeof saveData === 'function' && typeof _publicadoMaisNovo === 'function'; } catch (e) { return false; } }, { timeout: 45000 });
}

test('comparação de versão: só bloqueia quando o publicado é MAIS NOVO (rollback/empate não)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => ({
    novo: _publicadoMaisNovo('v816/10-869', 'v815/10-868'),   // publicado mais novo → true
    buildNovo: _publicadoMaisNovo('v815/10-869', 'v815/10-868'),
    igual: _publicadoMaisNovo('v815/10-868', 'v815/10-868'),  // igual → false
    rollback: _publicadoMaisNovo('v814/10-867', 'v815/10-868')// publicado mais velho → false
  }));
  expect(r.novo, 'publicado mais novo').toBe(true);
  expect(r.buildNovo, 'build mais novo').toBe(true);
  expect(r.igual, 'versão igual não é "mais novo"').toBe(false);
  expect(r.rollback, 'rollback não dispara (publicado mais velho)').toBe(false);
});

test('ABA VELHA: saveData é bloqueado e a mensagem diz O QUE não foi salvo', async ({ page }) => {
  // navegador "humano": webdriver=false e __ROBO=false → a trava vale
  await boot(page, () => { try { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); window.__ROBO = false; } catch (e) {} });
  const r = await page.evaluate(async () => {
    const alerts = []; const _a = window.alert; window.alert = m => alerts.push(String(m));
    _versaoVelha = true; // simula: o publicado está mais novo
    const antes = JSON.stringify(repasseLinks || {});
    const ret = await saveData('repasseLinks', { 'x': { gateway: 'Barte', total: 1, itens: [] } });
    window.alert = _a;
    return { ret, alerts, mexeuBanco: false, msg: alerts.join(' | ') };
  });
  expect(r.ret, 'saveData devolve false (não gravou)').toBe(false);
  expect(r.alerts.length, 'avisou (nada some calado)').toBeGreaterThan(0);
  expect(r.msg, 'diz o QUE não foi salvo (vínculo de repasse)').toMatch(/vínculo de repasse/i);
  expect(r.msg, 'manda atualizar (F5/faixa)').toMatch(/F5|faixa|atualiz/i);
  expect(r.msg, 'deixa claro que não gravou').toMatch(/não foi gravado|não salv|não salvei/i);
});

test('ROBÔ roda normal: com __ROBO/webdriver o saveData NÃO é bloqueado mesmo com versão velha', async ({ page }) => {
  await boot(page, () => { try { window.__ROBO = true; } catch (e) {} }); // robô
  const r = await page.evaluate(async () => {
    const alerts = []; const _a = window.alert; window.alert = m => alerts.push(String(m));
    _versaoVelha = true; // mesmo "velho", o robô não pode ser travado
    const retFlat = await saveData('flatCR', [{ a: 1 }]);   // o robô grava flat*
    const retDado = await saveData('repasseLinks', { 'y': { gateway: 'Barte', total: 2, itens: [] } });
    window.alert = _a;
    return { retFlat, retDado, bloqueouAlgo: alerts.some(m => /VERSÃO ANTIGA/i.test(m)), ehRobo: _ehRoboVer() };
  });
  expect(r.ehRobo, 'detectou como robô').toBe(true);
  expect(r.bloqueouAlgo, 'robô NUNCA vê a trava de versão').toBe(false);
  expect(r.retFlat, 'robô grava flat* normalmente (não retornou false da trava)').not.toBe(false);
});

test('FAIXA aparece quando o publicado é mais novo (e aí o salvar trava)', async ({ page }) => {
  await boot(page, () => { try { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); window.__ROBO = false; } catch (e) {} });
  // a auto-checagem busca o próprio index.html (com ?cb=): devolvemos uma versão MAIS NOVA
  await page.route(/index\.html\?cb=/i, route => route.fulfill({ status: 200, contentType: 'text/html', body: "<script>const APP_VERSION = 'v999/99-999';</script>" }));
  const r = await page.evaluate(async () => {
    await _checarVersao(true);                 // força a checagem agora
    await new Promise(res => setTimeout(res, 150));
    const faixa = document.getElementById('faixa-versao');
    const alerts = []; const _a = window.alert; window.alert = m => alerts.push(String(m));
    const ret = await saveData('contasPagar', [{ x: 1 }]); // agora deve travar
    window.alert = _a;
    return { temFaixa: !!faixa, txtFaixa: faixa ? faixa.innerText : '', versaoVelha: _versaoVelha, selo: _versaoNovaSelo, retSave: ret, avisou: alerts.length > 0 };
  });
  expect(r.temFaixa, 'faixa "versão nova" apareceu').toBe(true);
  expect(r.txtFaixa, 'faixa diz versão nova + clique p/ atualizar').toMatch(/vers[aã]o nova/i);
  expect(r.versaoVelha, 'marcou a aba como velha').toBe(true);
  expect(r.selo, 'pegou o selo publicado').toBe('v999/99-999');
  expect(r.retSave, 'depois da faixa, o salvar trava').toBe(false);
  expect(r.avisou, 'e avisa o que não salvou').toBe(true);
});

// FLUXO REAL (23/11): publicar versão nova com a aba aberta → o 1º SAVE confere a versão ANTES de gravar (quando
// faz tempo que não checa) e BARRA, sem depender do timer de 5 min. Isso fecha a janela que deixou passar o
// salvar 24 min após publicar.
test('Aba velha é barrada JÁ NO SAVE (checagem antes de gravar), sem esperar o timer', async ({ page }) => {
  await boot(page, () => { try { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); window.__ROBO = false; } catch (e) {} });
  await page.route(/index\.html\?cb=/i, route => route.fulfill({ status: 200, contentType: 'text/html', body: "<script>const APP_VERSION = 'v999/99-999';</script>" }));
  const r = await page.evaluate(async () => {
    _versaoVelha = false; _ultChecagemVer = 0;            // simula: acabou de publicar, a aba ainda NÃO detectou
    const alerts = []; const _a = window.alert; window.alert = m => alerts.push(String(m));
    const ret = await saveData('bancosCadastro', ['Itaú']); // o próprio save deve conferir e barrar
    window.alert = _a;
    return { ret, versaoVelha: _versaoVelha, faixa: !!document.getElementById('faixa-versao'), avisou: alerts.length > 0, msg: alerts.join(' | ') };
  });
  expect(r.versaoVelha, 'o save detectou a versão nova').toBe(true);
  expect(r.ret, 'o save foi BARRADO (não gravou)').toBe(false);
  expect(r.faixa, 'mostrou a faixa de versão nova').toBe(true);
  expect(r.avisou, 'avisou o que não foi salvo').toBe(true);
});

test('Versão IGUAL: a checagem antes de gravar NÃO bloqueia (salva normal)', async ({ page }) => {
  await boot(page, () => { try { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); window.__ROBO = false; } catch (e) {} });
  const atual = await page.evaluate(() => (typeof APP_VERSION !== 'undefined') ? APP_VERSION : '');
  // o "publicado" devolve EXATAMENTE a versão atual da aba → não é mais novo → não bloqueia
  await page.route(/index\.html\?cb=/i, route => route.fulfill({ status: 200, contentType: 'text/html', body: `<script>const APP_VERSION = '${atual}';</script>` }));
  const r = await page.evaluate(async () => {
    _versaoVelha = false; _ultChecagemVer = 0;
    const ret = await saveData('bancosCadastro', ['Itaú']);
    return { ret, versaoVelha: _versaoVelha };
  });
  expect(r.versaoVelha, 'versão igual não marca como velha').toBe(false);
  expect(r.ret, 'salva normal').toBe(true);
});
