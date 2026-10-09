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
- O Bling é a fonte da verdade do pedido de venda. O Gestão espelha data, situação, valor, frete, loja e vendedor, SÓ em meses abertos. A sync nunca toca empresa/categoria.
- Pago/Recebido só pela conciliação bancária (CR e CP).
- Atalhos que marcam pago/recebido (lista do scanner) estão sendo blindados. Enquanto existirem, devem respeitar a trava de mês fechado e registrar no histórico.

## 2. Meses fechados
- Meses fechados (até ago/2026) e meses travados nunca são alterados.
- Trava: diasFechados, mesesFechados, crFechado, cpFechado. _mesCongeladoCR = mesesFechados OU crFechado/cpFechado.
- crFechado/cpFechado guardam as planilhas OFICIAIS; o Power BI usa elas nos meses fechados.
- O fechamento do mês é feito dentro da Conciliação.

## 3. Contas a Receber (CR)
- Montado dos pedidos Venda/Troca, uma linha por forma/parcela.
- CR pelo LÍQUIDO. Taxas de gateway ficam só em Recebimentos e na Conciliação de cartão.
- Boleto usa a data do crédito.
- O título só vira recebido pela conciliação bancária. O boletoCobrancaStatus (relatório do Itaú / baixa na Cobrança) é informativo.
- Boleto sai líquido do crédito de troca (parcela = valor do pedido menos crédito de troca).
- Crédito de troca abate o CR (não é dinheiro de banco).
- Empresa e categoria obrigatórias em todo lançamento.

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

## 10. Empresas
- Rokbox e Rk. São 2 contas Bling; a 2ª (Rk) é PL/White Label, CNPJ diferente, fica separada.
- A empresa do título do CR deve herdar da conta Bling do pedido.

## 11. Sincronização Bling
- Datas comparadas por data-calendário (sem erro de fuso).
- Mudança que mova o pedido para dentro de, ou para fora de, um mês fechado é bloqueada.
- Pedido cancelado no Bling não apaga o pedido no Gestão (só marca).
- Toda alteração vinda do Bling vai pro log (blingSyncLog) e as divergências pras Pendências (blingPendencias).
- Adoção de pedido sem marca: por conta + número + empresa + cliente (nome igual ou prefixo), com tolerância de R$ 0,05 no valor (vale o valor do Bling).

## 12. Painel RK
- Saldo em banco sempre ATUAL: último extrato de cada conta, com a data, independente do filtro de mês.

## 13. Pedido cancelado com dinheiro no banco (ex. #426 Mawu)
- Se o pedido foi cancelado no Bling mas tem valor conciliado no banco: MANTER o recebido (o dinheiro entrou) e sinalizar em Pendências. Não apagar o recebido.

## 14. Dados e backup
- Dados só são alterados com aprovação da Elaine, backup e prévia antes.
- Backup diário. Hoje: IndexedDB local (14 dias, por aparelho). Em andamento: também no Supabase, incluindo mesesFechados (ver plano de backup).

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

## Manutenção deste documento
- Toda decisão nova de regra deve ser acrescentada aqui, na mesma sessão em que for decidida.
