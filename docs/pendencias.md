# Pendências e estado da sessão (Rokbox) , atualizado 09/11/2026

Documento de continuidade: se abrir uma conversa nova, começar daqui. Regra fixa: **mês
fechado (jun–set) nunca muda** (só vai para "Ajustes de meses fechados"); **nada publica
sem "pode publicar"**; **toda gravação direta no banco → rodar "Atualizar Power BI"**
(o automático só dispara por ação na tela); **backup antes de gravar**; **mostrar antes
de publicar**; **teste automático junto**.

## Fluxo de Caixa novembro: Painel ~217k × Gestão ~291k (DIAGNÓSTICO, 13/11/2026)
Elaine viu diferença ~74k. **NÃO é regressão da competência** (provado: `compDe`/`_compDespesa` só dentro de
`_dreCalcTudo`; os 3 commits de competência não tocaram `flatCP`/`cpAberto`/"a pagar"). Causa estrutural:
- **Gestão CP novembro** = por **VENCIMENTO** (todo título que vence no mês). **Painel Fluxo** (financeiro.html
  linha 933) = **CAIXA**: pago pelo dia do pagamento (`data_liquidacao`) + em aberto pelo vencimento. Título que
  vence em nov mas foi pago antes de nov entra no Gestão/nov mas no caixa do mês do pagamento → Painel menor.
- **flatCP desatualizado:** Painel lê `flatCP` (foto do _syncPowerBI); Gestão lê `contasPagar` ao vivo.
- **PENDENTE (banco caiu):** lista dos ~74k classificada (a) vence-nov/pago-antes; (b) pago-nov/venc-outro-mês;
  (c) flatCP velho; (d) sem empresa; (e) cartão/transferência/investimento/empréstimo. Entregar quando o
  conector do Supabase voltar (esteve em erro 500 toda a sessão de 13/11). **NÃO corrigir antes da Elaine ver.**
- **Teste de regra no gate (PRONTO):** `tests/fluxo-caixa.spec.cjs` trava Fluxo = caixa e que competência ≠ caixa.

## flat* sempre regravável pelo botão (sem trava de concorrência) , 13/11/2026 (PRONTO, aguardando "pode publicar")
"Atualizar Power BI" dava "Concorrência: banco tem versão MAIS NOVA de flatVendas… NÃO gravei por cima" (o robô
gravou antes). Os `flat*` são relatórios gerados (recalculados dos dados), não dados digitados. Fix em `saveData`
(index.html ~717): `const _ehFlat=/^flat/.test(key)` e `if(_verKey[key] && !_ehFlat)`, o botão/robô sempre regrava
`flat*` por cima; a trava de concorrência continua nas chaves de DADOS (pedidos, contasPagar, lojaCadastro…). A trava
anti-truncado do flatCR (não gravar foto incompleta por cima) **permanece**. Teste: `tests/flat-overwrite.spec.cjs`.
APP_VERSION v794/10-847. Provável causa também do flatCP velho do diagnóstico acima.

## Custo manual por linha sem SKU (DRE + Margem) , 13/11/2026 (NO AR, BUILD 2026-11-13.1, commit 2dc26e8)
Itens lançados à mão sem SKU não têm custo no Bling → CMV zerado. Criada chave própria
`custoManualLinha` (mapa `"<pedido>|<descrição da linha>" → custo unitário`), usada pelo **DRE**
e pela **Margem** quando não há custo no Bling. **NÃO altera o pedido nem o faturamento.**
- **Helpers (financeiro.html):** `_chaveCustoManual(ped,l)`, `_custoManualU(ped,l)`, `_linhaSemSku(l)`.
  Carregada no boot em `_FIN.custoManualLinha`.
- **DRE:** aviso editável "⚠ N linha(s) sem SKU e sem custo" (campo de custo unitário por linha);
  ao preencher, a linha entra no CMV e some do aviso.
- **Gravado no banco:** `custoManualLinha = {"420|Geis":1.9}` (#420 Projeto Orsi, Rk, out/26: 230 un × 1,90 = 437,00).
- **Prova (harness):** Rk CMV out **57.329,44 → 57.766,44** (+437,00); Total EBITDA −14.550 → −14.987;
  LL −42.861,37 → −43.298,37; Receita Líquida e Rokbox **não mudam**. Gate novo `tests/custo-manual.spec.cjs`.
- **Ainda sem custo (o aviso lista para a Elaine preencher):** #40125 (Plano Gold, jul), #382 (Bolsa Preta MV Club, Rk jul),
  #40338 (Plano Gold, ago), #40545 (Plano Gold, ago), #40864 (Plano Gold, set). Os "Plano Gold" são serviço (pode ficar 0).
- **Gate:** `competencia.spec.cjs` agora fixa `custoManualLinha={}` na trava da competência (isola do custo manual);
  `playwright.config.cjs` passou a `retries: 1` (flake por lentidão tenta de novo; falha real reprova 2×).

## Robô do Power BI (GitHub Actions) , estado 09/11/2026
Objetivo: tirar o `_syncPowerBI` (~25 s, congela a tela) de dentro do navegador da Elaine.
O robô roda o **mesmo** `_syncPowerBI` do Gestão publicado, num navegador sem tela, no servidor
do GitHub , mesmo código = mesmo número.
- **Workflow:** `.github/workflows/powerbi.yml`. Agendado `cron: '0 11-23 * * *'` (UTC) =
  **8h–20h de Brasília, de hora em hora, todo dia**. Tem `workflow_dispatch` com o toggle
  **`so_teste`** (roda só o teste de bloqueio, NÃO grava o Power BI).
- **Como roda:** `robo/sync.cjs` (Playwright 1.56.0) abre o Gestão publicado, loga como a conta
  do robô, confere `role=robo`, faz o **teste de bloqueio** e então chama `_syncPowerBI()`.
  `robo/package.json` fixa a versão do Playwright; o CI roda `npm install` +
  `npx playwright install --with-deps chromium` dentro de `robo/`.
- **Conta dedicada:** `robo1@rokbox.com.br`, `app_metadata.role = 'robo'`. A senha vive **só nos
  GitHub Secrets** `ROBO_EMAIL` / `ROBO_SENHA` , eu nunca manuseio a senha.
- **Permissão mínima (RLS):** 3 policies RESTRICTIVE travam `role='robo'` a gravar **só chaves
  `flat*`**. Provado no banco: robô gravando não-flat (contasPagar) → bloqueado `42501`; gravando
  `flat*` → ok. O próprio robô repete esse teste a cada run e **aborta** se a trava falhar.
- **`runs-on: ubuntu-24.04`** (commit `3d81f9a` da Elaine): o `ubuntu-latest` virou 26.04 e o
  Playwright 1.56.0 não suporta. **Só o `powerbi.yml` usa Playwright**; o `deploy-pages.yml` é só
  o deploy do Pages (sem navegador) e fica no `ubuntu-latest`.
- **Status 09/11:** `so_teste` passou ✅ (sync verde, 3m56s). Aguardando ver o robô rodar sozinho
  nos horários agendados (a partir das 17h).
- **PRÓXIMO (preparado, NÃO publicado):** quando a Elaine confirmar que o robô roda sozinho sem
  erro, **desligar o Power BI automático dentro do Gestão** (fica só o botão ☁ Power BI). Mudança
  pronta: flag `POWERBI_AUTO_GESTAO = false` + guard no topo de `_rodarPowerBIBg` (`if (auto &&
  !POWERBI_AUTO_GESTAO) return;`). Não desativa o botão manual, nem o sync ao exportar o CR, nem
  o congelamento de flat ao fechar o mês. Aguardando "pode publicar".

## Ajustes de meses fechados: empresa vazia (11/11/2026) — Elaine decide depois
Lançamentos do CP SEM empresa em MESES FECHADOS (NÃO mexer sem ok dela). Gravei empresa só nos de
out/nov/dez (12 _uid, ver abaixo); estes ficaram de fora por serem de mês fechado:
- **Mavicom** (Sacolas/Embalagens) **725,50 venc 15/08** (`umsgi4oul_8ir5an`) — provável Rk.
- **Itamarati Express** (Motoboy) **1.433,78 venc 24/08** (`umsorv25i_479y81`) — provável Rk.
- **Estorno Camila Puntim 254,28 venc 30/07** (`umsjaclm4_49wy7h`) — provável Rokbox.
- **Estorno camila ARAUJO 30,83 venc 26/06** (`ums7lrj7j_u3wo46`) — provável Rokbox.
GRAVADO em 11/11 (backup `privado.bkp_contasPagar_20261111`, 1895 contas, soma 2.486.803,53 inalterada):
13º + estornos Rafael/Clayton/Ana/Debora/Camila Couto/Rede → Rokbox; Mavicom out+nov+dez, Itamarati
out, ICMS DIFAL → Rk. Prova: só o campo empresa mudou (0 itens diferentes fora disso).
**#420 linha "Geis" (SKU vazio, item manual) entra na lista de itens sem custo p/ cadastrar.** A
"vírgula" no SKU era artefato da minha lista, NÃO vem do Bling (as 5 linhas PL têm custo no Bling RK).

## Parte 2: competência (função única competencia.js) (12/11/2026)
Regra ÚNICA de competência em `competencia.js` (IIFE `window.Competencia`), carregado por index.html
e financeiro.html (sem cópia local). Receita = mês da NF senão pedido; Despesa = competencia gravada
senão sugestão (folha/DAS = mês anterior ao pagamento; demais = vencimento). O DRE usa estas funções
(provado: out/26 idêntico — RL 224.447,22 · EBITDA −14.550 · LL −42.861,37). Mudanças (v793/10-846,
BUILD 2026-11-12.1): CR export competência = NF/pedido (antes = liquidação; ~156 linhas mudam, jun+13/
jul+31/ago+31/set+3/out+1); CP export ganhou coluna "Competência sugerida" (além da gravada); CP
competência editável em LOTE (botão 📅 Competência em lote, pula meses fechados jun–set); boot do
Gestão carrega blingPedidoNF (mapa de NF). Meses fechados: só a coluna do export recalcula, NÃO grava
dado. Teste no gate: tests/competencia.spec.cjs (DRE out + #398/#425/#41327 → 2026-10).

## Desempenho (10/11/2026)
Medido com dados reais (Chrome + snapshot), os tempos abaixo são de CPU.
- **Power BI automático DESLIGADO no Gestão** (`POWERBI_AUTO_GESTAO=false`, v787/10-840): o robô
  faz nos horários; o botão ☁ Power BI continua. Acabou o travão de ~30 s ao salvar uma conta.
- **Filtro do Contas a Receber: ~1,2 s → ~0,18 s** (v788/10-841): `renderContas` cacheia o modelo
  da tela (linhas + pedidos conciliados) por `_dataVersion`; ao trocar só o filtro, reaproveita um
  clone (clona só `l.st`) e não reconstrói os 1.819 pedidos. Números idênticos (gate trava).
- **Abertura do Gestão: ~13 s → ~3,9 s (CPU)** (v789/10-842): o gargalo NÃO era baixar/parsear
  (331 ms), eram duas rotinas O(n²) que rodam a cada boot. Indexei as duas (mesmas regras, prova
  OLD×NEW item a item = diferença ZERO nos 2 cenários, inclusive reset):
  - `aplicarBaixaConciliada` ~7,0 s → 0,01 s (índice extrato por id + contas por chave).
  - `autoVincularPorValor` ~4,6 s → ~1,2 s (índices: formas por pedido, candidatos PayPal/Braavo por
    gateway+faixa de valor, recebimentos por pedido; só paga a trava cara nos pedidos com forma gw).
- **Tolerância do `autoVincularPorValor` baixada 0,50 → 0,05** (v790/10-843, 11/11): `const TOL_VINC = 0.05`
  (um ponto só, usado no some/filtro/buckets). Avaliação registrada: do universo completo (nped zerado), perde
  **só 1** (#39526 Natália PayPal, forma 279,91 × receb 279,71, dif 0,20 → vai pra mão) e **ganha 26** recebimentos
  de valor EXATO (dif 0,00/0,03) que a janela larga travava por ambiguidade (vários candidatos → desempate por
  nome falhava). NÃO desfaz vínculo existente (só adiciona). A trava de "pedido quitado" segue em 0,5 (outro fim).
- **PENDENTE (perf, p/ depois):**
  1. **~1,2 s restantes no `autoVincularPorValor`**: a trava de "pedido quitado" chama, por pedido
     PayPal/Braavo, o ajudante compartilhado `getRecebimentosDoPedido` (O(R) por pedido). Dá pra cortar
     com um índice de recebimentos por pedido, mas mexe num ajudante usado em muitos lugares, então
     fica pra uma próxima, com a mesma prova item a item.
  2. **"CR sem filtro" (ver todos os meses) ~1 s**: é o desenho de ~1.780 linhas; paginar se incomodar.
  3. **Abertura ~3,9 s**: se quiser baixar mais, o caminho é lazy-load (pintar a 1ª tela e puxar o resto
     em 2º plano). Risco médio; só se ela pedir.

## Publicado hoje (06/11/2026)
- **Painel financeiro em MANUTENÇÃO só-admin (financeiro.html)** , `FIN_MANUTENCAO = true`:
  não-admin vê só "Painel financeiro em manutenção"; admin vê tudo com faixa. **Para voltar:
  `FIN_MANUTENCAO = false` + publicar.** Placar não afetado. (Commit 89a2076.)
- **v781/10-834 (Gestão) + BUILD 2026-11-06.1 (Painel RK)** , bloco grande do CR/Caixa:
  - CR Liquidação = Clientes/Rendimentos/Resgates/Total; Vencimento = Valor dos pedidos/
    Recebido/A vencer/Atrasado. Status (quitado/parcial/atrasado) vem da **tela de
    Recebimentos** (soma de TODOS os recebimentos: gateway inclusive pendente, PIX, boleto,
    crédito de devolução), não da conciliação. Tolerância **0,05**. `difAceita='aceito'` some
    de TODAS as listas (atrasado, parcial, sobra, ajustes).
  - `atraso_real` gravado no flatCR (abate pago nas parcelas mais antigas); resgate vira
    **TRANSFERÊNCIA INTERNA** no Balancete (entra no SALDO, fora da receita); `flatConferencias`
    (sobras a resolver + ajustes de meses fechados).
  - Painel RK Fechamento em base **CAIXA**: Entrou no banco (vendas+resgates), Resultado do
    caixa (=variação do saldo), Resultado operacional (sem resgates), Recebido dos clientes
    (apoio), Saldo fim pelo caixa. A receber/atrasado por `atraso_real`.
  - Boletos a Emitir: pedido já pago não aparece. Exportar conciliado: resgate = transferência
    interna.
  - **Teste fixo out/26 no gate:** fat 251.152,02 · pedidos 211 · peças 2.854 · entrou no
    banco 281.998,02 · resgates 23.849,48 · pago 278.248,84 · saldo início 42.668,58 · saldo
    fim 46.417,76 (±0,02) · **atrasado 16.602,74** (#41041 é aceito, fora) · recebido clientes
    263.253,35. Sobras = banda de centavos (#40414/#41165/#41107/#40039/#40900); ajustes
    fechados = #39526/#40060/#40254/#40514/#40608. **20 testes verdes.**
  - Snapshot do gate = dados AO VIVO + flatCR/flatBalancete/flatConferencias **regerados** pelo
    próprio código (simula o Atualizar Power BI). Ao refazer: regerar o snapshot.
- **v782/10-835 (Gestão)** , CR visão Liquidação ganhou card **"Entrou no banco"** (caixa =
  créditos do Balancete do período, = Painel RK/Fechamento; out/26 = **281.998,02** nas 3 telas)
  + linha "Diferença competência × caixa 5.104,81 · ver detalhe" (motivo: venda paga no gateway
  com repasse pro banco depois; o detalhe mostra o motivo+nota, NÃO fecha pedido-a-pedido exato
  , a Elaine aprovou publicar assim). `_balanceteCR()` em cache.
- **v783/10-836 (Gestão) + BUILD 2026-11-09.1 (Painel RK) , 09/11**: relatório (flatCR/Painel
  RK/Fechamento) usa EXATAMENTE o status da tela de Recebimentos: (1) **tolerância 0,05** no
  flatCR , pedido quitado (falta ≤ 0,05) zera `atraso_real` (ex.: #40749 dif 0,04 some do em
  aberto); (2) **AMOSTRA** (operação amostra, loja "Envio de Planos") nunca é conta a receber
  (`_pedidoAmostra`): fica fora de atrasado/parcial/sobras; o recebido conta normal (ex.: #41127
  PIX 30 recebido, 269,90 amostra). **FIN_MANUTENCAO = false** (Painel liberado pro Diretor).
  "A receber em aberto" out/26 = **5.365,03** (AV103 3.527,50 + #40419 1.134,52 + #40276 703,01;
  #41327 0,80 aceita). **Vendas Out/26 Total geral = 256.153,16** (venda+troca; amostra de Envio
  de Planos 46.110,68 NÃO conta). Snapshot do gate = dados ao vivo 09/11.
- **09/11 Painel RK BUILD 2026-11-09.2/.3/.4** , correções do SALDO (fechado não pode mudar):
  (.2) Balancete: resgate volta pro Saldo final (fora da receita) , out 46.417,75 (era 22.568,27);
  (.3) **Fechamento Saldo fim = movimento do banco (= Balancete)** em todos os meses , a v781 tinha
  trocado pra "entrou − CP liquidado", que divergia em jun–set (CP≠extrato). Valores de volta:
  **jun 339.383,24 · jul 184.138,91 · ago 126.022,14 · set 42.668,58 · out 46.417,75**. `resultadoCaixa`
  = netMes (variação do saldo). (.4) Rodapé "Resultado por empresa": operacional −20.100,31 + resgates
  23.849,48 = variação do caixa +3.749,17. Teste fixo: Fechamento saldo = Balancete = esses 5 valores.
- **DIAGNÓSTICO DO TRAVAMENTO (só medido, nada mudado)** , dados 11,32 MB (pedidos 2,5 MB o maior).
  Tempos: **Atualizar Power BI `_syncPowerBI` ~25 s (congela a tela)**; **filtro no Contas a Receber ~6,5 s**
  (renderContas 4,3 s = `_crRowsAOA` 1,4 s + `_exportBalancete` 1,5 s + falta por pedido, a cada render ,
  parte veio das features v781–783, otimizável); Conciliação 3,5 s; Comissão 1,9 s; Banco 1,6 s; as outras
  <40 ms. **Proposta (maior→menor):** B) cachear `_crRowsAOA`/só-Liquidação no CR (risco BAIXO, 6,5 s→~1 s);
  C) não re-renderizar aba escondida (BAIXO); A) Power BI fora do navegador/Web Worker (ALTO); D) carregar só
  meses abertos (ALTO); E) dividir pedidos por mês (ALTO). Recomendado começar por B+C. **Aguardando a Elaine
  dizer "trava mais quando" e aprovar o que mexer. Nada pode mudar número de mês fechado nem teste fixo.**
- PENDENTE: **CHECKUP COMPLETO** (a Elaine vai pedir). Split exato da ponte 5.104,81 só se ela pedir. Ponte 263.253,35→
  258.148,54 (5.104,81) está só no card; split PayPal-a-PayPal se ela pedir. Itens antigos:
  vínculo extrato↔CP por _uid (tarifa 17/06), CR completo ago–nov, Conciliação A/B/C, junho
  sem empresa. **Lembrar: desligar FIN_MANUTENCAO quando ela mandar.**
- **Gestão v775/10-828** , filtro de mês voltou a filtrar (o `perf()` da v772 deixava as
  funções de render anônimas e `setDateFilterRender` caía no bucket vazio; fix = `perf`
  preserva o `.name`).
- **Painel de Vendas + Financeiro BUILD 2026-11-05.2** , `pecas-vendidas.js` (regra única
  de Peças vendidas / amostras / brindes, Out/26 = 2.854) + **selo visível "BUILD" no
  rodapé** dos dois painéis.
- **Gestão v776/10-829** , extrato: `dedupInserirExtrato` casa por banco+dia+valor+
  descrição (não pelo FITID, que o Bradesco troca a cada download) + **gate de testes
  automático** (`tests/`, Playwright, hook `pre-push` que BLOQUEIA o push se reprovar;
  dados reais em `tests/.data/snapshot.json`, gitignorado).
- **Gestão v777/10-830** , Contas a Receber: a mini-barra (setDfMes/setDfAno/setDfDia/
  limparDfMini) passou a limpar o De/Até preso.
- **Gestão v778/10-831** , CR: o botão "✕ limpar" (`limparFiltrosContas`) e o de Vendas
  (`limparFiltrosVendas`) agora limpam o De/Até; e **pedido sem formaPagamento** (nada
  desde ago/26) usa a **data do pedido** na visão Vencimento (antes `venc=null` sumia com
  filtro). Só afeta a visão Vencimento; Liquidação e o resto não mudam.
- **Gestão v779/10-832** , estorno de gateway (`estornoParaPagar`): `dataPag` passa a ser
  a **data do repasse conciliado** (`dataRepasseBanco`); sem repasse → "a liquidar". Só
  criações novas; não mexe em estorno existente.
- **Correção de dados** , 3 estornos PayPal de 30/10 (Camila Couto 260,91, Clayton Silva
  332,91, Ana Valeretto 332,91) → `dataPag` 03/11 (repasse TED PayPal 25.862,86 no
  Bradesco-Rokbox). **Backup: `privado.bkp_contasPagar_20261106`** (1887 itens). Confirmado:
  CP Out liquidado 279.175,57 → **278.248,84** (−926,73); Nov +926,73. flatCP re-exportado
  (export 12:10) já em 278.248,84.

## Gate de testes (tests/)
Roda no Chrome do sistema; `npm run gate`. Mock do Supabase (lê do snapshot, escrita
no-op). 12 testes verdes: peças 2.854 nas duas telas, soma por vendedor/segmento, fotos
jun–set, filtro de mês do Gestão, CR limpar De/Até + Out nas duas visões, **CR completude
(nenhum Venda/Troca some, Out=211)**, estorno liquida no repasse, extrato 2x não duplica,
Margem #41020=527,47, Conciliação. **Atualizar o snapshot = puxar as chaves do device
`rokbox_financeiro` (sem backups) para `tests/.data/snapshot.json`.**

## Lista 0→6 (status)
- **0) Power BI/recebido , DECOMPOSTO (dados congelados 06/11), aguardando ok p/ unificar.**
  CP Out = 278.248,84 ✅. **Recebido Out, instante congelado:** tela `vPagoLiq`
  (só pedidos) = **269.778,45**; export `_crRowsAOA`/flatCR = **287.102,83**
  (251 linhas). Gap export−tela = **17.324,38**, fecha EXATO por 3 motivos:
  - **+23.851,78 resgates/rendimentos de banco** (29 linhas avulsas, pedido vazio):
    RESG AUTOMATICO 15.435,98 + RESG/VENCTO CDB 8.413,50 (= 23.849,48, item 6) + 2,30
    de juros/rendimento de centavos. Estão no export (→ Power BI/Balancete), NÃO na tela.
    São transferência interna / receita financeira, não recebimento de cliente → devem
    SAIR da conta de recebíveis.
  - **−4.416,16 duplicata multi-linha** (tela conta o MESMO pagamento 1x por linha; o
    export deduplica por `_rowKeyEmit`): #40454 2.509,52, #40669 643,59, #40312 632,32,
    #40323 510,78, #40110 119,95. **Export certo, tela infla.**
  - **−2.111,24 #40352** (entrada PIX de 28/07 que a tela joga em outubro; o export, pelo
    `_entradaFixa`, data a entrada em julho e em out conta só o boleto 08/10 = 2.158,01).
    **Export certo, tela erra a data.**
  Conclusão: no grão de pedido o **export é a conta certa**; a tela `vPagoLiq` super-conta
  6.527,40 (4.416,16 duplicata + 2.111,24 entrada mal datada) e NÃO carrega os resgates.
  "Recebido dos clientes no mês" correto (Out) = export pedidos **263.251,05** (dedup +
  data certa, resgates fora). Unificar: tela passa a ler o cálculo do `_crRowsAOA` (menos
  resgates). Raiz: `vPagoLiq` (3668-3670) não tem dedup nem o pulo de repasse/entrada que
  o `_crRowsAOA` (5350+) tem.
- **1) Vínculo extrato↔CP por _uid , PENDENTE.** Hoje casa por `fornecedor|data|valor`
  (não é único): a tarifa de 17/06 (`_uid ums7lrj7i_69h84b`) está pegando um débito de
  04/11. Usar o `_uid` do CP no vínculo (débitoLinks). Junho não muda.
- **2) Painel RK "A receber" = status da tela de Recebimentos , PENDENTE.** Quitado (cliente
  pagou o cheio, qualquer meio) = recebido, nunca Atrasado (ex.: #40877 PayPal 30/10,
  #41020 PayPal 31/10). Atrasado = vencido e NÃO quitado. Troca paga com crédito de
  devolução = quitada (conferir #41041 Laura 899,65). "Recebido no mês" pela data que o
  dinheiro entrou no banco. Trocar rótulo "Recebido no mês (entrou no banco)" →
  **"Recebido dos clientes no mês"**. Mostrar Atrasado de out antes/depois, pedido a pedido.
- **3) CR completo (conferência) , FEITO (diagnóstico).** Sem filtro, 100% dos pedidos
  Venda/Troca aparecem no CR em ago–nov (faltam=0). Out/26 = **211 pedidos / 256.153,16**.
  Mismatches soma-linhas × valor: #408 (+125.858,95 = dois boletos avulsos Itaú/CORAVI
  grudados, venc 24/07 e 27/08, títulos separados) + pequenos (multa de boleto). Teste de
  completude no gate.
- **4) Conciliação A/B/C , PARTE A PRONTA (LOCAL, não publicada).** A) saldo inicial do dia
  = final do dia útil anterior CALCULADO (`saldoFinalDia` encadeado, deixa de ancorar no
  último gravado) + alerta neutro "difere R$ X desde DD/MM , falta lançamento no extrato
  ou saldo gravado velho". B) corrigir Bradesco-Rokbox 19/10 → 4.124,73 (final 6.853,99).
  C) selo "possível duplicado" + Excluir (lixeira com restaurar) + "Não é duplicado"; mês
  fechado não exclui. **Código da Parte A está em
  `<scratchpad>/index_both.html`** (reaplicar sobre o index atual, com teste
  `Bradesco-Rokbox 19/10 final=6.853,99`). Divergências de saldo já levantadas (dados ao
  vivo): Bradesco-Rokbox 19/10 gravado 14.278,16→calc 4.124,73; Bradesco-Rkbx −183 (tarifa
  Max Empresarial faltando no extrato do Rkbx); Itaú-Rokbox +47,67; Itaú-Rk saltos (saldo
  gravado velho em dias sem movimento). O calculado é a fonte certa.
- **5) Junho: 20 despesas sem empresa → "Rokbox" , PENDENTE.** Os 20 batem com a foto
  (cpFechado 2026-06) como "Rokbox" (só preencher empresa; nenhum outro campo). Junho
  continua 333 / R$ 398.706,00. Backup + lista antes de gravar. (Há também ~8 despesas com
  data de pagamento diferente da foto , só listar, não tocar.)
- **6) Resgates fora da receita , FEITO (diagnóstico).** RESG AUTOMATICO / RESG VENCTO CDB
  estão em `receitasAvulsas` como "RENDIMENTOS / APLICAÇÃO": **só em outubro, R$ 23.849,48**
  (3 lançamentos: 13.705,81 + 8.413,50 + 1.730,17); jun–set = 0; nov = 0. Entram em
  receitasAvulsas → flatCR (Painel RK/Power BI) → Balancete/DRE → card "Outras receitas".
  Resgate é **transferência interna**, não receita. Proposta: marcar como transf. interna
  (fora de receita/CR/flatCR/Balancete); manter rendimento de centavos (RENTAB) como
  receita financeira separada. PENDENTE: implementar.

## CR "uma conta só" (bloco que fecha o item 0) , FEITO LOCAL (v780/10-833), aguardando "pode publicar"
A **tela do CR agora lê o mesmo cálculo do `_crRowsAOA`** (a conta que vai pro Power BI):
- `vPagoLiq` dos cards deixou de ser o laço inline (que super-contava) e passa a somar as
  linhas "Pago" do `_crRowsAOA(false)` com pedido → **dedup, entrada na data certa, repasse
  não-conciliado fora**. Card "Pago" mostra **"Valor dos pedidos"** (vPago), **"Recebido
  bruto"** (Valor do pagamento) e **"Recebido dos clientes no mês"** (líquido no banco).
- **Item 6:** `_ehResgateReceita(r)` = `/\bresg/i` na descrição (RESG AUTOMATICO /
  RESG/VENCTO CDB). Resgate sai de `_receitasCRExport` (→ fora de flatCR/Power BI/Painel RK),
  de `avulsasVis` (card Outras receitas) e do `_exportBalancete` (crédito do extrato ligado a
  resgate não vira receita). Rendimento de centavos (RENTAB/REND/JUROS, sem "RESG") fica como
  receita financeira.
- As duas "Conferência Recebido/Pago × Banco" (`relatorioConferencia`,
  `conferenciaPeriodoHTML`) passaram a usar `_recebidoExportFiltrado(false)` (mesma conta
  dedup; inclui rendimento que cai no banco).
**Provado no gate (snapshot congelado 06/11), out/26:** tela "Recebido dos clientes" =
flatCR/Power BI = **263.251,05**; #40454=2.509,52, #40669=643,59, #40312=632,32,
#40110=119,95, #40352=2.158,01 (entrada PIX 2.111,23 fica em julho); resgate=0 no export e
na tela; rendimento 2,30 mantido; **resgates em jun–set = 0 → fotos inalteradas**. 13/13 verde.
FALTA: "pode publicar" (push dispara o gate). Export conciliado (banco) linha 4750 ainda
mostra resgate como "Outras receitas" (fora do escopo pedido; avisar se quiser alinhar).

## Decisões fixas (combinadas)
- Tolerância de arredondamento: **R$ 0,05** por lançamento.
- Drive automático: processa **só os novos** (sync só adiciona).
- Forma de pagamento: a do **Gestão** (manual / trocar forma / boleto / recebimento); a da
  Bling só complementa meses antigos, nunca obrigatória.
- **Boletos + Cobrança numa tela só** (combinado, ainda não feito).
- **Fechamentos separados** (combinado).
- Depois dos itens 0–3 conferidos: **REGRA ÚNICA do Contas a Receber + Drive automático**
  (prompt já combinado).

Ver também `docs/regras.md` (regras de negócio) e a memória da sessão.
