# Regras de negócio, Sistema Financeiro Rokbox
Toda sessão lê isto ANTES de alterar o sistema.

## 0. Princípios de trabalho
- Gestão = base operacional de apoio ao Bling. Relatório vai pro Painel RK.
- Mexer só no que foi pedido; se notar outra coisa, avisar e esperar o ok; dizer exatamente o que mudou.
- Nunca tocar no banco (Supabase) sem avisar. Antes de gravar dado: backup, prévia, confirmação.
- Não publicar sem o ok da Elaine. Sempre dizer a versão (selo) depois de publicar.
- Conferência/double-check: mostrar o que diverge na hora, nunca processar em silêncio.
- Textos da Elaine: sem travessão (vírgula/dois-pontos/parênteses); tratamento feminino.

### Protocolo antes de publicar
- `git pull` antes de começar (várias sessões mexem no sistema).
- Diff só no que foi pedido; nada de "mexer de brinde" em outra coisa.
- Sem mutação de dado compartilhado em memória (não alterar arrays/objetos globais de leitura).
- Syntax-check do arquivo alterado.
- Teste de conciliação: Checagem = 0 no mês de referência.
- Para mudança em exportação: comparar o export antigo (antes x depois).

## 1. Fonte da verdade
- O Bling é a fonte da verdade do pedido de venda. O Gestão espelha data, situação, valor, frete, loja, vendedor, cliente (nome e id do contato) e itens, SÓ em meses abertos. A sync nunca toca empresa/categoria.
- Pago/Recebido só pela conciliação bancária (CR e CP).
- Atalhos que marcam pago/recebido (lista do scanner) estão sendo blindados. Enquanto existirem, devem respeitar a trava de mês fechado e registrar no histórico.

## 2. Meses fechados
- Meses fechados (até ago/2026) e meses travados nunca são alterados.
- Trava: diasFechados, mesesFechados, crFechado, cpFechado. _mesCongeladoCR = mesesFechados OU crFechado/cpFechado.
- crFechado/cpFechado guardam as planilhas OFICIAIS; o Power BI usa elas nos meses fechados.
- O fechamento do mês é feito dentro da Conciliação.
- **REGRA FIXA (30/10/2026):**
  1. **Mês fechado NUNCA é alterado** — nem valor, nem número de pedido, nem rótulo, MESMO que o total não mude. Não perguntar nem propor correção em mês fechado.
  2. **Erro achado em mês fechado vai só para a lista "Ajustes de meses fechados"** (chave `ajustesMesFechado`, aparece no Afazeres): mês, pedido, o que está errado e o valor. Nada além disso.
  3. **Se o erro afeta dinheiro EM ABERTO** (ex.: recebimento duplicado), o acerto é proposto no **mês aberto atual**, como ajuste, e só com o ok da Elaine.
  - A Conciliação atual pode divergir do rótulo congelado na foto (ex.: ago/2026 tem um DEPÓSITO de 5.006,70 em 13/08 rotulado "388", que é CORAVI #398/#446); isso fica na lista, a foto não muda.

## 3. Contas a Receber (CR)
- Montado dos pedidos Venda/Troca, uma linha por forma/parcela.
- CR pelo LÍQUIDO. Taxas de gateway ficam só em Recebimentos e na Conciliação de cartão.
- Boleto usa a data do crédito.
- O título só vira recebido pela conciliação bancária. O boletoCobrancaStatus (relatório do Itaú / baixa na Cobrança) é informativo.
- Boleto sai líquido do crédito de troca (parcela = valor do pedido menos crédito de troca).
- Crédito de troca abate o CR (não é dinheiro de banco).
- Empresa e categoria obrigatórias em todo lançamento.
- **Recebimento compartilhado (1 crédito → N pedidos, `nped` com vírgula) — rateio pela FALTA QUE RESTA.** `alocRecebGateway`: pedido de mês ABERTO recebe só o que ainda falta (valor − solos − já alocado em recebimentos anteriores, processados em ordem de data), para o 1º pedido não "comer" o valor cheio a cada crédito e criar sobra falsa. Recebimento SOLO (1 pedido) = valor inteiro. Pedido de mês FECHADO/congelado (`_mesCongeladoCR`) mantém a regra ANTIGA (nada já fechado muda). A cópia read-only do Export conciliado usa a mesma regra. Cache reconstruído a cada `renderConcResult`/`_syncPowerBI` (`_invalidarAloc`). Ex.: par CORAVI #398/#446 (Rk, out) — o crédito de ago/13 (R$ 5.006,70) e os solos não mudam; só o crédito de out/22 (R$ 21.220,66) passa a dividir 19.825,75 p/ #398 e 1.394,91 p/ #446 → os dois ficam quitados (a sobra falsa de 1.394,91 some).
- **Visual da Conciliação de Recebíveis:** ao lado de cada recebimento mostra a data (liquidação: repasse do banco p/ gateway, data do crédito p/ PIX/boleto). Se o pagamento é de outro MÊS que o do pedido (adiantamento), mostra o ano (dd/mm/aa). Só visual, não muda cálculo.

## 4. Contas a Pagar (CP)
- Pago vem da conciliação de débito no banco (debitoLinks).
- Categoria vem da Descrição (planilha "Categoria Despesas").
- Juros/multa: conta separada (categoria Juros/Multa), linha própria no grupo do débito.
- Débito sem título (tarifa, IOF): lançado como ajuste, com categoria.
- Pagamento em lote: dentro do grupo do débito.
- Empresa e categoria obrigatórias em todo lançamento.

## 5. Estornos netados no repasse
- Categoria da conta: ESTORNO (PayPal) e TARIFAS (tarifa de máquina da Rede).
- No Balancete, a despesa ESTORNO fica no grupo ESTORNOS.
- Receita volta no gateway (CC PAYPAL / CC REDE); a despesa fica na categoria da conta (ESTORNO ou TARIFAS).
- Base = LÍQUIDO (o que o gateway abateu no repasse). Nunca o bruto (contaria a taxa 2x).
- Marca: _origemEstorno. Critério único: _ehEstornoNetado = (não cancelado e _origemEstorno).
- Mesma regra no export conciliado e no Balancete. Gross-up só em mês aberto; resultado e saldo do banco ficam inalterados.

## 6. Categorias
- Receitas: aba "Categoria Fluxo de Caixa" (PayPal→CC PAYPAL, BraavoPay→BRAAVO PAY, Rede→CC REDE, Boleto Itaú→BOLETO ITAU, PIX→DEPÓSITO, Pagar.me→CC PAGARME, RENDIMENTOS→JUROS).
- Despesas: planilha "Categoria Despesas". O mapa categoria→grupo (CMV, Pessoal, etc.) é espelho entre index.html e os painéis: se mudar num, atualizar no outro.

## 7. Export conciliado (banco)
- Montado do extrato, por lançamento bancário, idêntico ao banco, com Checagem e Pendências. É saída que FICA no Gestão.
- Filtro por data de liquidação.
- Uma linha por item, sem subtotal nem mescla. Colunas novas sempre no fim. O export antigo fica intacto.
- Estornos: linha negativa no CR e "Compensação no repasse" no CP, fora da soma.
- Receitas avulsas (OUTRAS RECEITAS, JUROS etc.): linha no CR.
- Empresa: título → venda de origem → conta bancária (Itaú/Bradesco-Rokbox → Rokbox, Itaú-Rk → Rk, Itaú/Bradesco-Rkbx → Rkbx). Sem empresa → Pendências.

## 8. Cobrança e boletos
- Protesto é só MARCAÇÃO (boletoProtesto): não muda o título nem bloqueia; a cobrança continua, só a mensagem passa a informar o protesto.
- Acordo (renegociação): sigla A01; os boletos originais saem com selo; concilia pela sigla no Extrato.

## 9. Situações não-venda (Bling)
- Não contam como venda: cancelado, em aberto, em andamento, atualização de estoque, correios, sit#15. Checkout parcial CONTA como venda.
- Base da META do Painel (§12): entram só Verificado, Atendido e Checkout parcial (Venda/Troca). Em separação NÃO entra na meta; quando o pedido avança no Bling pra Atendido/Verificado, passa a contar sozinho. Para venda, faturamento, comissão e aba NF, Em separação continua contando.

## 10. Empresas
- Rokbox e Rk. São 2 contas Bling; a 2ª (Rk) é PL/White Label, CNPJ diferente, fica separada.
- A empresa do título do CR deve herdar da conta Bling do pedido.

## 11. Sincronização Bling
- Datas comparadas por data-calendário (sem erro de fuso).
- Mudança que mova o pedido para dentro de, ou para fora de, um mês fechado é bloqueada.
- Pedido cancelado no Bling não apaga o pedido no Gestão (só marca).
- Toda alteração vinda do Bling vai pro log (blingSyncLog) e as divergências pras Pendências (blingPendencias).
- Adoção de pedido sem marca: por conta + número + empresa + cliente (nome igual ou prefixo), com tolerância de R$ 0,05 no valor (vale o valor do Bling).
- Cliente e itens também são espelhados em pedido que já existe (não só no pedido novo). Cliente = nome + id do contato; itens vêm do blingDetCache (SKU, descrição, qtd, preço). Isso corrige os pedidos que entraram como "Etiqueta de Correios": um pedido assim se conserta sozinho na sincronização seguinte.
- Proteções do espelhamento de cliente/itens (vão para Pendências, NÃO sobrescrevem):
  - Contato virou "Atualização de estoque SAIDA" no Bling (pode ter deixado de ser venda).
  - Pedido tocado à mão: tem anotação em obsPedido, OU itens com custo (vieram da planilha de vendas, que o Bling não traz).
  - Reuso de número: o cliente do Bling é outra pessoa (os nomes não casam por tokens) e o Gestão tem itens reais. Nome mais completo da mesma pessoa (ex.: "Maria Brito" para "Maria Eugenia Brito") não é reuso, aplica. Pedido-placeholder (sem SKU real) também aplica.
  - Mês fechado: não altera, só loga a divergência (para o "Aplicar mesmo assim").
- **Visibilidade (quando o Painel parece "atrasado" vs o Bling):** o pedido no Gestão se sincroniza sozinho a cada abertura (auto-import), mas o Painel só muda depois de rodar **Atualizar Power BI** (que reconstrói o flatVendas). Para não parecer erro:
  - **Aviso no Afazeres** "pedido(s) de mês aberto divergente(s) do Bling": compara, só mês ABERTO, o pedido em memória com o snapshot do Bling da mesma conta (situação e valor, tolerância R$ 0,05). Fica ~zero quando tudo sincronizou; sobra o que o sync NÃO conseguiu aplicar (SAIDA, tocado à mão, reuso de nº). Clicar lista os pedidos. Mês fechado fica no aviso separado "mudança bloqueada por mês fechado".
  - **"Dados atualizados em: dd/mm às hh:mm"** no cabeçalho do Painel de Vendas (placar) e do Financeiro = coluna `atualizado_em` do flatVendas (quando rodou o último Atualizar Power BI). É SÓ LEITURA: o Painel não grava nada.

## 12. Painel RK
- Saldo em banco sempre ATUAL: último extrato de cada conta, com a data, independente do filtro de mês.
- Base da META (realizado × meta, por vendedor) = valor do pedido − frete − devolução, para pedido de Venda ou Troca em situação que entra na meta (Verificado, Atendido, Checkout parcial), COM ou SEM recebimento lançado. Em separação fica de fora até avançar no Bling. A Troca entra e a devolução abate, com teto no valor do pedido. Checkout parcial conta o valor cheio (a NF de venda sai pelo total do pedido).
- A base da META NÃO depende de recebimento, e é SÓ do Painel. A comissão a pagar no Gestão não muda: continua com a base dela (valor − frete − devolução − outras − o que está em aberto; boleto conta cheio). As duas bases podem divergir, e isso é esperado (antes, pedido sem recebimento zerava na meta; ex.: Atacado da Karen em out/2026, pedidos 41130/41291/41301/41330).
- Fica num lugar só: placar.html, constante `_META_SIT` e o campo `metaBase` na `vbiBuildFacts`, somado em `_vbiComBaseVend` e `_vbiComBaseVendFiltrado`. Mudou a regra, muda aqui. (Antes a meta usava `comissao_base`, que descontava o valor em aberto e zerava pedido sem recebimento.)

## 13. Pedido cancelado com dinheiro no banco (ex. #426 Mawu)
- Se o pedido foi cancelado no Bling mas tem valor conciliado no banco: MANTER o recebido (o dinheiro entrou) e sinalizar em Pendências. Não apagar o recebido.

## 14. Dados e backup
- Dados só são alterados com aprovação da Elaine, backup e prévia antes.
- Backup em 3 camadas (v705/10-758):
  - Nuvem (Supabase), diário, compactado (gzip). Retenção 7 diários + 8 semanais + 6 mensais, com poda. Sobrevive à perda do aparelho.
  - Local diário (IndexedDB), 14 dias, por aparelho.
  - Semanal (IndexedDB), 12 semanas, + aviso pra baixar o .json e guardar fora do sistema (Drive/pendrive).
  - Teste de restauração na telinha 🕘: ida-e-volta numa chave separada, não toca em nada.
  - A BACKUP_KEYS inclui mesesFechados, crFechado, cpFechado, diasFechados e os *Links (extrato/debito/repasse/receita). Ficam de fora (recriáveis): flat*, caches/servidor do Bling, e o legado recebimentos.
- Backup no servidor por cron (sem depender de abrir o Gestão) = Nível 2, pendente.

## 15. Comportamentos atuais a corrigir (atalhos a blindar)
Pontos que hoje marcam pago/recebido ou editam sem checar a trava de mês fechado. Devem ser blindados (checar _mesCongeladoCR/diaFechado e registrar no histórico):
- boletoCobrancaStatus marcando "recebido" (deveria ser só informativo; o recebido é da conciliação).
- setPagoConta e updateContaPagar (edição inline do Contas a Pagar).
- Import de planilha de Vendas (sobrescreve pedido mesmo de mês fechado).
- Import de boletos do Itaú (regrava sem checar mês fechado).
- Baixas manuais "✓ Recebi" (baixarBoletoSis, baixarAvulso) e recebimento manual.
- estornoParaPagar (cria conta paga sem guarda de mês fechado).
- Pedido de compra / NF (reescreve contas a pagar sem checar).

Quando um atalho for blindado: remover da lista e registrar a versão em que foi corrigido.

## 16. Coleções e acessórios (produtoColecao)
- O SKU é ligado à coleção pelo `produtoColecao` (chave = SKU-base, valor = nome do grupo).
- Acessórios (mochila, bandana, garrafa, boné, viseira, meia, necessaire, chaveiro etc.) vão para o grupo "Acessórios", não para coleção.
- No Painel, "Acessórios" aparece como grupo próprio, separado das coleções sazonais: não entra no top das coleções do mês nem no "Sem coleção".

## 17. Aba Margem (Painel RK, Financeiro) — análise de desconto e margem
Fica SÓ no Painel RK (financeiro.html). Nada de tela nova no Gestão. Login vendas não abre o Financeiro. Padrões, tolerância e limites editáveis só pelo admin (ehAdmin); diretor e vendas visualizam.

**Fonte de preço e custo:** cadastro do produto no Bling por SKU, nas 2 contas (preco = tabela; precoCusto = custo). Populado pela sincronização que já roda (precisa do escopo Produtos reautorizado). Variação usa o preço/custo do pai; se vazio, o pai. Custo congelado na DATA DA VENDA (mudança de custo no Bling não altera meses passados). Planilhas "Custo e Compras" = só comparação, não é fonte oficial.

**Cascata (colunas):** Peças | Tabela | Desc. linha | Desc. pedido | Receita líquida | Custo | Margem bruta | Imposto | Taxa cartão | Comissão | Frete | Margem de contribuição.
- Tabela = preço de cadastro (varejo) × qtd (régua única para todos).
- Desconto da linha = tabela − praticado; desconto do pedido = desconto geral, rateado por valor. Receita líquida = tabela − descontos.
- Margem bruta = receita líquida − custo. Margem de contribuição = margem bruta − imposto − taxa − comissão − frete.
- Percentuais das margens e despesas sobre a RECEITA LÍQUIDA; desconto % sobre a TABELA.
- Botão "só margem bruta" × "cascata completa".

**Segmento:** vem de lojaCadastro[loja].segmento (Atacado, Varejo, Site, PL, WL, Plano, Eventos). Segmento é o filtro principal; nunca misturar segmentos numa média sem mostrar a separação.

**Regra de desconto por segmento (editável, admin):**
- Varejo, Site, Plano, Eventos: real × tabela, > 15% amarelo, > 20% vermelho. Tolerância 2 pts.
- Atacado: referência 50% (é a lista de atacado, ~50% do varejo). > 55% amarelo, > 60% vermelho.
- WL e PL: fora da análise de desconto (preço negociado/SKU próprio), só margem. PL fora até a reautorização da 2ª conta.
- Site NÃO tem lista própria (a maioria vende a preço cheio); segue a regra do Varejo. O Bling não tem campo de promoção/cupom nem preço promocional.
- Promoção (outlet/campanha): NÃO há regra de tempo; é marcada por SKU, lida do site Braavo (www.rokbox.com.br) 1x ao dia. Categorias lidas: Outlet (/c/outlet), Grip 30% OFF (/cat/207) e Chinelos 30% OFF (/cat/219). Mecânica: página da categoria → links /prod/{id} → campo "Referência" = SKU Rokbox (não há feed/API de produtos; só as páginas). **Guardar o histórico diário** (data + SKUs em promoção naquele dia), não só a lista atual.
- Descoberta de campanha nova: além das categorias fixas, o robô varre o menu do site e inclui qualquer categoria cujo nome tenha "%", "Promo", "Outlet" ou "NN% OFF" (regra do "OFF": só com número/% junto, ex. "30% OFF" — NÃO casar "Off White", que é cor). Campanha nova (categoria que ainda não estava na lista conhecida) é lida igual e **dispara um alerta na tela de Afazeres** (login da Elaine) pra ela conferir.
- Uma venda é "Promoção (outlet)" se o SKU estava na lista NA DATA DA VENDA. Vendas anteriores ao início do robô: usar a primeira lista lida, marcadas "outlet estimado".
- Override manual (admin): caixa "Outlet" por coleção (chave `colecoesOutlet`) e/ou inclusão/exclusão por SKU, para ajustar à mão.
- Venda em promoção: sem alerta de desconto, mas alerta se a margem bruta ficar abaixo do limite do segmento. Fora da promoção (e produto sem coleção): alerta de desconto 15% / 20%.

**Funcionário (2 casos):**
- Venda para funcionário = vendedor Elaine Lima + operação Venda/Troca: é venda (Varejo), desconto padrão 65%, bloco "Venda funcionário" à parte, fora das médias e do ranking de vendedores, alerta só acima de 65%.
- Retirada de funcionário = loja "Retirada Funcionários" (operação Amostra): não é venda, é benefício. Fora de faturamento, meta, comissão e desconto. Bloco "Benefício funcionário": peças e custo do mês (receita 0).

**Despesas (dados reais do Bling/Gestão, sem digitação):**
- Imposto: Simples Nacional (RBT12 do PGDAS-D, anexo por empresa, alíquota efetiva), só em pedido COM NF emitida (NF do Bling, mesma fonte da aba NF), sobre o valor da nota. Sem nota = 0. Comparar o esperado do mês com o DAS lançado no Contas a Pagar (esperado × pago × diferença; aviso se diferença > 5%). Sem dado do mês, usar o do mês anterior marcado "estimada". Nota emitida em mês diferente do pedido usa a alíquota do mês da NOTA (competência do DAS). Pedido de venda sem NF fica com imposto 0 e marca "sem NF" na Margem (linha e total), para a margem não parecer melhor do que é. Conferência gerencial, não substitui a contabilidade.
- Exceção: a NF de venda emitida em loja de operação Amostra (ex.: Envio de Planos) NÃO entra no imposto da Margem por pedido (a Margem é só Venda/Troca). Esse imposto deve ir para a margem do Plano de Assinatura (pendente). Por isso o imposto da Margem fica abaixo do DAS no valor dessas notas (set/26: Envio de Planos 1.429,40).
- Taxa de cartão: taxa real do recebimento (gateway), ligada pelo número do pedido. Não recebido = taxa estimada do meio de pagamento, marcada "estimada".
- Comissão: mesma base e % da aba Comissão do Gestão (o Bling traz comissão por item).
- Frete: entra o frete PAGO pela empresa (Correios), cruzando o código de rastreio do Bling com a fatura dos Correios (pasta "Correios" no Drive; colunas: rastreio, valor pago, data de postagem), abatendo o frete cobrado. Aviso quando pago − cobrado > R$ 30.

**Avisos no topo (respeitam os filtros):** venda abaixo do custo (margem bruta negativa), desconto acima do padrão (> 15 pts acima do padrão do segmento; PL/WL fora), margem de contribuição negativa, taxa de cartão acima da esperada, frete pago > cobrado + R$ 30, produto sem custo no cadastro. Aviso de custo incompleto enquanto não populado ("X% das peças sem custo").

**Limites de margem (editável, admin):** Varejo/Site < 55% amarelo, < 40% vermelho; Atacado/PL/WL < 35% amarelo, < 25% vermelho; Plano/Eventos < 45% amarelo, < 30% vermelho.

**Estrutura pronta** para somar imposto/taxa/comissão/frete (fase seguinte); a Etapa 1 mostra até a margem bruta.

## Aba NF (Painel RK, Financeiro, só admin)
Confere a NF de cada pedido contra o esperado. Fonte da nota = chave `blingPedidoNF` (nota do detalhe do pedido no Bling: número, data, natureza, situação, valor), por `empresa|número`. PGDAS = chave `pgdasDeclarado` (receita, DAS, alíquota efetiva, anexo por empresa/mês). `nfPgdasSemNota` marca pedido declarado no PGDAS sem NF (ex.: Rk #411). Natureza esperada = `lojaCadastro.naturezaNF` (opção "Sem nota esperada" não gera alerta).

- **Base de venda** = lojas de operação Venda em situação concluída (exclui Cancelado, Atualização de estoque, Correios, Em aberto, Em andamento; inclui Verificado, Atendido, Checkout parcial, Em separação). Bate com o Painel.
- **Venda sem nota** = venda no sistema − venda casada a pedido (pedido a pedido; NÃO usa o total de NF). A nota de venda sem pedido casado fica só no selo "nota sem pedido".
- **NF de venda autorizada** = situação 5/6 e natureza "Venda de..." (soma pelo valor da nota), em qualquer loja (inclui remessa/venda em amostra e troca). Pode ser > base de venda.
- **Situação**: 5/6 = autorizada; 1 = pendente; 0 = rascunho; 2 = cancelada; 3 = denegada.

**Avisos (selo + filtro, vão para os Afazeres):** venda sem nota; amostra sem remessa (ou com nota de venda = natureza diferente); troca sem remessa; pedido com nota e não concluído (NF de venda autorizada em pedido Em separação/Em aberto/Em andamento — é o status do Bling atrasado, não o sync); natureza diferente da esperada; nota cancelada/denegada; nota em mês diferente do pedido; valor da nota ≠ pedido (> R$ 1,00); declarado no PGDAS sem NF; nota sem pedido no sistema.

**Troca / Troca Atacado:** liga à origem pela chave `devolucoes` (`pedidoCredito` = nº do pedido de troca → `nfOrigem`).
- Origem COM NF (nfOrigem preenchida): esperado Remessa em troca. Saiu nota de venda → "natureza diferente"; sem nota → "troca sem remessa"; remessa → ok. Em todos, marca "· devolução: conferir" na linha (a NF de devolução de entrada não existe no Bling — 0 notas de entrada em set/out nas 2 contas; é entrada de terceiro/cliente).
- Origem SEM NF: sem nota esperada, sem alerta (mesmo que tenha saído nota de venda, fica só marca neutra).

## Manutenção deste documento
- Toda decisão nova de regra deve ser acrescentada aqui, na mesma sessão em que for decidida.
