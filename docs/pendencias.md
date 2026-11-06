# Pendências e estado da sessão (Rokbox) , atualizado 06/11/2026

Documento de continuidade: se abrir uma conversa nova, começar daqui. Regra fixa: **mês
fechado (jun–set) nunca muda** (só vai para "Ajustes de meses fechados"); **nada publica
sem "pode publicar"**; **toda gravação direta no banco → rodar "Atualizar Power BI"**
(o automático só dispara por ação na tela); **backup antes de gravar**; **mostrar antes
de publicar**; **teste automático junto**.

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
- PENDENTE depois do v782: **CHECKUP COMPLETO** (a Elaine vai pedir). Split exato da ponte
  5.104,81 (casar repasse×crédito do extrato) só se ela pedir. Ponte 263.253,35→
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
