// Robô do Power BI: abre o Gestão PUBLICADO num navegador sem tela, loga como a conta do robô
// (Secrets ROBO_EMAIL/ROBO_SENHA), roda o MESMO _syncPowerBI do navegador (mesmo código = mesmo número)
// e grava os flat* no Supabase. Antes de rodar, faz um TESTE DE BLOQUEIO (permissão mínima):
//   - gravar uma chave NÃO-flat (ex.: contasPagar) tem que levar 401/403 (RLS);
//   - gravar um flat* tem que passar.
// Se o teste falhar, ABORTA sem rodar o Power BI.
const { chromium } = require('playwright');

const URL_GESTAO = process.env.URL_GESTAO || 'https://financeirorokbox-stack.github.io/Sistema-Financeiro-Rokbox/index.html';
const EMAIL = process.env.ROBO_EMAIL;
const SENHA = process.env.ROBO_SENHA;
const SO_TESTE = process.env.SO_TESTE === '1'; // só o teste de bloqueio (não grava o Power BI)

function die(code, msg) { console.error('✘ ' + msg); process.exitCode = code; }

(async () => {
  if (!EMAIL || !SENHA) { die(2, 'Faltam os Secrets ROBO_EMAIL / ROBO_SENHA.'); return; }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  const erros = [];
  page.on('pageerror', e => erros.push(String((e && e.message) || e)));
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });

  try {
    await page.goto(URL_GESTAO, { waitUntil: 'domcontentloaded', timeout: 120000 });

    // Login + carga de dados (mesma sequência do app: _sbLogin -> _bootPosLogin)
    const login = await page.evaluate(async ({ email, senha }) => {
      try { await _sbLogin(email, senha); } catch (e) { return { ok: false, erro: 'login: ' + (e && e.message) }; }
      try { await _bootPosLogin(); } catch (e) { return { ok: false, erro: 'carga: ' + (e && e.message) }; }
      return { ok: true, role: (typeof _sbSess !== 'undefined' && _sbSess && _sbSess.role) || null, pedidos: (typeof pedidos !== 'undefined' ? pedidos.length : 0) };
    }, { email: EMAIL, senha: SENHA });
    if (!login.ok) { die(3, 'Login/carga falhou: ' + login.erro); await browser.close(); return; }
    console.log('Login OK · role=' + login.role + ' · pedidos=' + login.pedidos);
    if (login.role !== 'robo') { die(4, 'A conta NÃO tem role=robo (role=' + login.role + '). Abortando por segurança.'); await browser.close(); return; }

    // TESTE DE BLOQUEIO (permissão mínima)
    const teste = await page.evaluate(async () => {
      const tok = _sbSess && _sbSess.access_token;
      const idBig = () => Date.now() * 1000 + Math.floor(Math.random() * 1000); // bigint explícito (authenticated não usa a sequence)
      const post = async (chave) => {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/sistema_dados`, {
          method: 'POST',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ id: idBig(), device_id: 'robo-selftest', chave, valor: JSON.stringify({ robo_test: true, ts: Date.now() }), atualizado_em: new Date().toISOString() })
        });
        return { status: res.status, body: (await res.text()).slice(0, 200) };
      };
      const kNao = 'contasPagar__robo_selftest_' + Date.now(); // chave NÃO-flat
      const kFlat = 'flat__robo_selftest_' + Date.now();        // chave flat*
      const rNao = await post(kNao);
      const rFlat = await post(kFlat);
      // limpa o flat de teste (robô pode apagar flat*)
      try { await fetch(`${SUPABASE_URL}/rest/v1/sistema_dados?chave=eq.${encodeURIComponent(kFlat)}`, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${tok}` } }); } catch (e) {}
      return { rNao, rFlat };
    });
    const bloqueado = [401, 403].includes(teste.rNao.status) || /row-level security|violates|42501/i.test(teste.rNao.body);
    const flatOk = teste.rFlat.status >= 200 && teste.rFlat.status < 300;
    console.log('TESTE BLOQUEIO · gravar NÃO-flat (contasPagar) → HTTP ' + teste.rNao.status + ' ' + (bloqueado ? 'BLOQUEADO ✔' : 'PASSOU ✘ (RLS FALHOU!)'));
    console.log('TESTE BLOQUEIO · gravar flat* → HTTP ' + teste.rFlat.status + ' ' + (flatOk ? 'OK ✔' : 'FALHOU ✘'));
    if (!bloqueado || !flatOk) { die(5, 'Teste de bloqueio falhou — não rodei o Power BI.'); await browser.close(); return; }

    if (SO_TESTE) { console.log('SO_TESTE=1 → não rodei o _syncPowerBI (só o teste de bloqueio).'); await browser.close(); return; }

    // RODA O POWER BI (mesmo _syncPowerBI do navegador da Elaine)
    const t0 = Date.now();
    const r = await page.evaluate(async () => {
      try { const res = await _syncPowerBI(); return { ok: true, res: res || null }; } catch (e) { return { ok: false, erro: e && e.message }; }
    });
    if (!r.ok) { die(6, '_syncPowerBI falhou: ' + r.erro); await browser.close(); return; }
    console.log('Power BI atualizado ✔ em ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
    if (erros.length) console.log('(avisos de console: ' + erros.slice(0, 5).join(' | ') + ')');
  } catch (e) {
    die(1, 'Erro inesperado: ' + (e && e.message));
  } finally {
    await browser.close();
  }
})();
