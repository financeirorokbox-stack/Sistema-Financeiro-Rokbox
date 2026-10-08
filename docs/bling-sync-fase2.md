# Sincronização Bling → Gestão (data e situação do pedido)

> Objetivo: quando um PEDIDO DE VENDA tiver a DATA ou a SITUAÇÃO alterada no Bling (em aberto, em andamento, atendido, cancelado), refletir automaticamente no Gestão (Supabase) e no Painel RK, sem quebrar regras financeiras nem meses fechados.

Status: Fase 1 (diagnóstico) concluída e aprovada. Implementação em partes, cada uma com aprovação da Elaine antes de publicar. NÃO implementar antes do ok dela.

## REGRA PRINCIPAL (atualizada 08/10/2026): BLING = FONTE DA VERDADE DO PEDIDO DE VENDA
Qualquer alteração do pedido no Bling (data, situação, valor, frete, loja, vendedor) é ESPELHADA no pedido do Gestão, em pedidos de MESES ABERTOS e em QUALQUER situação (inclusive "Em aberto"). Comparar datas por DATA-CALENDÁRIO (ajuste de fuso). Proteções: mês fechado/travado não muda nada (só loga); mudança de data que mova PARA ou DE mês fechado é bloqueada e logada; Cancelado atualiza a situação (não apaga); Empresa e Categoria nunca são apagadas/esvaziadas; log de toda alteração (aplicado/bloqueado + motivo). (Correção manual de loja/vendedor — lojaFixes/vendedorFixes — continua ganhando.)

## Decisões aprovadas (pela Elaine)

1. **Situação:** atualizar o campo `situacao` (NÃO criar `situacao_bling`), pois ele já é a situação do Bling e alimenta faturamento/vendas. Não altera status financeiro (pago é só conciliação bancária). Log de cada mudança. Cancelado → marca "cancelado no Bling" + Pendências, nunca apaga.
2. **Só meses abertos:** a sincronização (data e situação, inclusive cancelamento) só altera pedidos de meses ABERTOS (hoje set/out 2026). Mês fechado/travado → não altera, log + Pendências. Mudança de data que mova o pedido PARA ou DE um mês fechado → bloqueia, log + Pendências. Ao travar um mês, ele sai automaticamente da sincronização.
3. **Data:** Bling `data` → Gestão `data` (ver "Mapeamento de data"). Não altera a data se o título já estiver conciliado no banco → divergência + Pendências.
4. **Vínculo:** guardar o id interno do Bling + a conta (Rokbox=1 / Rk-PL=2) no pedido, além do número.
5. **Empresa e Categoria:** a sincronização nunca apaga nem esvazia Empresa e Categoria.
6. **Painel RK:** atualização automática; preferência por `vw_vendas` ler direto de `pedidos`. Ver "Painel RK (opções)" — tem ressalva técnica, a Elaine escolhe antes.
7. **Partes:** P1 = data no fluxo atual + guardas (2,3,5) + log + Pendências. P2 = webhook (1,2,4) + polling de reserva. P3 = Painel RK automático.
8. **Documento:** este arquivo. Detalhar a Parte 1.

Pendente de decisão da Elaine antes de codar: (a) sincronizar só `data` ou também `dataSaida` (ver Mapeamento de data); (b) qual opção do Painel RK (item 6).

## Diagnóstico (Fase 1, só leitura, concluída)

Fluxo hoje: **Bling → `bling-sync` (Edge Function, cron, polling) → `blingVendasRico`/`2` → auto-import no app (`_impBlingConta`, ao abrir) → `pedidos` → `flatVendas` (botão "Atualizar Power BI"/`_syncPowerBI`) → `vw_vendas` (Painel RK).**

- `bling-sync` (v15): OAuth, token só no servidor (`blingTokens`/`blingTokens2` no Supabase), secret na URL (`rk_sync_2f9c7a4e8b16d305`). Puxa as 2 Blings, mês atual + anterior. `SIT` = tabela fixa id→nome (`/situacoes/modulos` dá 403). Grava `blingVendasRico` com {numero, data, situacao, loja, vendedor, cliente, valor, frete, itens, pecas}. **Não traz o id interno do Bling no rico** (traz `numero`).
- `_impBlingConta` (index.html ~16796): para pedido EXISTENTE da conta, atualiza `situacao`, `valor`, `frete`, `loja`, `vendedor` (respeitando `lojaFixes`/`vendedorFixes`). **NÃO atualiza `data`.** Para pedido NOVO, cria com data/situação (pula Cancelado/Atualização de estoque/Correios). Dedup só pelo número (um `Map` por número).
- **Achado:** a SITUAÇÃO já sincroniza hoje; a DATA não. Falta: guarda de mês fechado no auto-import (hoje só não bate em fechado porque a janela do rico é mês atual+anterior), guarda de "título conciliado" na data, log, Pendências, id interno + conta.
- Situação é usada no faturamento (`SITUACOES_NAO_APLICAVEL` tira Cancelado/Em aberto/Atualização de estoque/Correios da venda), dashboard, filtros, exportações, placar.

### Webhook do Bling (v3)
- Escopo `order`; eventos `created`/`updated`/`deleted`. Payload v1 já traz `situacao.id` e `situacao.valor` (desde 05/02/2026). Assinatura HMAC `sha256=`.
- Entrega não ordenada, há retentativas; responder 2xx rápido, processar assíncrono e idempotente. Se falhar muito, o Bling DESATIVA o webhook até reativar na mão. Limite da API ~3 req/s (confirmar na referência oficial).
- Refs: developer.bling.com.br/webhooks ; /webhooks.changelogs ; /bling-api.

## Mapeamento de data

Campos do Gestão: `data` (data do pedido, define o MÊS DO FATURAMENTO), `dataSaida` (data de saída, usada no cálculo de vencimento de boleto), `dataFechamento` (exportação). Campos do Bling: `data` (emissão), `dataSaida` (saída), `dataPrevista`.

- **Bling `data` → Gestão `data`** (essencial; é a que causa o pedido no mês errado). RECOMENDADO sincronizar só esta.
- `dataSaida`/`dataFechamento`: por padrão NÃO sincronizar (hoje o import põe `dataSaida`=data e `dataFechamento`=null). Sincronizar `dataSaida` do Bling exige passar a trazer o campo no rico/webhook (hoje o rico não traz). **Decisão pendente da Elaine.**

## Vínculo (conta + número + id interno)

- Hoje NÃO há número repetido entre as Blings. Faixas: Rokbox 38.886–41.138; Rk/PL 279–439 (não se encostam). Mas o dedup por número só é frágil se as faixas se cruzarem.
- Passar a gravar no pedido: `_blingId` (id interno do Bling) e `_blingAcct` (1=Rokbox, 2=Rk/PL), além do `id` (número). Identidade da sincronização = (conta + número). O id interno exige incluir `id` no rico do `bling-sync` (pequena mudança na Edge) ou vem do payload do webhook (P2).

## Regras de aplicação (compartilhadas por polling e webhook)

Uma função única decide se aplica ou bloqueia cada mudança:

- **Mês aberto:** só aplica se o mês do pedido (atual) E o mês de destino (nova data) estiverem ABERTOS (`mesesFechados`/`crFechado`/`cpFechado`/`diasFechados`). Senão: não altera, log, Pendências.
- **Data + conciliado:** se o título do pedido já está conciliado no banco, não altera a data → divergência, log, Pendências.
- **Situação:** atualiza `situacao` sempre que mudar (em mês aberto); não toca em pago/aberto financeiro. Log.
- **Cancelado:** marca o pedido como "cancelado no Bling" (ex.: `situacao='Cancelado'` + flag `_canceladoBling`), nunca apaga; se tiver recebimento/estorno vinculado, Pendências pra Elaine revisar.
- **Empresa/Categoria:** nunca apaga nem esvazia.
- **Idempotência:** o mesmo evento aplicado 2x não muda de novo (compara valor atual == novo antes de gravar; no webhook, guarda id do evento processado).
- **Log** (`blingSyncLog`): {data_hora, pedido, conta, campo, valor_antigo, valor_novo, origem (webhook|polling), resultado (aplicado|bloqueado), motivo}.
- **Pendências** (`blingPendencias`): fila pra Elaine (mês fechado, conciliado, cancelado com vínculo, data inválida).

## Parte 1 — Espelhar o Bling no fluxo atual (polling) + guardas + log  [IMPLEMENTADA, aguardando ok p/ publicar]

Escopo: espelhar o Bling (data/situação/valor/frete/loja/vendedor) no fluxo que já existe (rico → `_impBlingConta`), em MESES ABERTOS, com as guardas. Não mexe no status financeiro (pago só pela conciliação).

**Feito (v em `_impBlingConta` e helpers acima de `_autoImportBling`):** guarda de mês fechado (origem → bloqueia tudo; destino → bloqueia a data); DATA por data-calendário (`_diaCalBling`); situação (Cancelado marca `_canceladoBling` + Pendências se tiver recebimento); valor/frete; loja/vendedor (correção manual ganha); grava `_blingAcct` (1/2); log em `blingSyncLog` e Pendências em `blingPendencias` (flush no fim). Nunca toca Empresa/Categoria.

**Teste (08/10, dados reais):** dos 30, 30 aplicariam a data, 0 bloqueados por mês fechado. Guardas sintéticas: origem ago → bloqueado; set→ago (destino) → bloqueado; set→out e out→out → aplicado. **Impacto no faturamento:** só 3 pedidos contam e mudam de mês (#41063/#41045/#41041, Rokbox, operação troca) = **setembro −1.953,18 / outubro +1.953,18**; Rk = 0 (todos Em aberto/Cancelado). Conciliados que mudam de mês e NÃO contam no faturamento: #435 (Em aberto 5.764,80) e #426 (Cancelado 50.543,80, vai pra Pendências) — a regra nova não tem guarda de "conciliado"; confirmar com a Elaine.

### Escopo antigo (substituído pela regra nova acima)

**CUIDADO FUSO (achado da prévia):** comparar a data pela DATA-CALENDÁRIO (os 10 primeiros chars da ISO / data em Brasília), NUNCA convertendo com `new Date().getDate()` local. O pedido guarda `...T03:00:00.000Z`; comparando por fuso local dá 413 "diferenças" falsas de ±1 dia. Pela data-calendário são só 30 reais.

**Prévia (08/10/2026, dados reais):** 30 pedidos com data realmente diferente (Bling x Gestão), TODOS em mês aberto, 0 em mês fechado. Ex.: #40888 16/09→01/10, #40732 01/09→01/10, #429 Rk 02/09→01/10. Muitos são "Em aberto" (não entram no faturamento de qualquer jeito); os que contam são Verificado/Atendido. Falta cruzar o "conciliado" (a maioria é Em aberto, não conciliada → aplicaria).

Mudanças:
1. Em `_impBlingConta`, no ramo do pedido EXISTENTE da conta, além de situação/valor/frete, avaliar a DATA:
   - Se `r.data` (Bling) difere de `ex.data` COMPARANDO POR DATA-CALENDÁRIO: chamar a função de regra (`_blingAplicaMudanca`).
   - Aplica `ex.data` só se: mês atual do pedido ABERTO, mês de destino ABERTO, e título NÃO conciliado no banco. Senão: não altera + log + Pendências.
2. Guarda de mês fechado também para SITUAÇÃO/valor/frete (hoje não tem): só altera pedido de mês aberto. (Fecha a brecha caso um pedido fechado volte pra janela do rico.)
3. Cancelado: ao detectar `situacao='Cancelado'`, marca `_canceladoBling=true`, mantém o pedido, e se houver recebimento/estorno vinculado → Pendências.
4. Gravar `_blingAcct` no pedido (1/2) ao sincronizar. (`_blingId` quando o rico passar a trazer o id interno — pequena mudança no `bling-sync`, pode entrar aqui ou na P2.)
5. Novas chaves: `blingSyncLog` (append, com teto de tamanho) e `blingPendencias`. Tela simples de Pendências/Log (aba ou seção) pode entrar aqui ou logo depois.
6. Nunca tocar Empresa/Categoria.

Teste (antes de publicar): pegar um pedido real de mês aberto, mudar a data no Bling, rodar o sync, e mostrar: data atualizada no Gestão + linha no log. Depois um caso bloqueado (pedido conciliado ou mês fechado) mostrando o bloqueio + Pendências. Conferir que nenhum pedido de mês fechado mudou.

## Parte 2 — Webhook (tempo real, qualquer mês aberto) + polling de reserva

- Nova Edge Function `bling-webhook` (pública, verify_jwt off), escopo `order`, nas 2 Blings. Valida HMAC, responde 2xx na hora, processa idempotente, aplica a MESMA função de regra da P1 direto no `pedidos` (service role). Guarda `_blingId`/`_blingAcct`.
- Polling (`bling-sync`) de reserva com a mesma regra, pra cobrir eventos perdidos (webhook desativado/fora do ar).

### Passo a passo no Bling (a Elaine faz, eu oriento)
Para CADA uma das 2 contas Bling (Rokbox e Rk/PL), no app de integração já usado (o mesmo do `bling-sync`):
1. Em Cadastros → (o app/integração) → Dados básicos do aplicativo: adicionar o **escopo `order`** (webhooks de pedido).
2. Em Webhooks: criar um webhook do recurso **pedido de venda**, eventos **updated** (e created/deleted se quiser), apontando para a URL da Edge Function `bling-webhook` (eu passo a URL), escolhendo a **versão v1** do payload.
3. Guardar o **segredo HMAC** do webhook como secret da Edge Function (eu configuro no Supabase; nunca no GitHub).
4. Reautorizar/salvar. Teste com um pedido real. Atenção: se o webhook falhar várias vezes, o Bling desativa; nesse caso reativar nas configurações do app.

## Parte 3 — Painel RK automático (opções)

A `vw_vendas` lê `flatVendas`, que é `pedidos` + campos CALCULADOS no app: `operacao` e `segmento` (de `lojaCadastro[loja]`), `devolucao_abatida` (abatimento de devoluções), `frete` (calculado). O `pedidos` não tem esses prontos.

- **Opção A — `vw_vendas` direto de `pedidos`:** viável para `data`/`situacao`/`valor`/`empresa` e, com JOIN em `lojaCadastro`, para `operacao`/`segmento`. Mas `devolucao_abatida` não sai fácil em SQL (vem do netting de devoluções) → o faturamento do painel ficaria sem abater devolução ou precisaria de uma fonte extra. Risco de divergir da tela.
- **Opção B (APROVADA pela Elaine) — manter `flatVendas` e dar PATCH server-side nos campos sincronizados:** quando o webhook/sync muda `data`/`situacao` de um pedido, atualizar o MESMO campo na linha correspondente de `flatVendas` (os campos calculados não mudam por uma troca de data/situação). Painel atualiza sozinho, sem botão.
  - **Pedido NOVO:** o sync/webhook adiciona a linha no `flatVendas` na hora, com `operacao`/`segmento` derivados do `lojaCadastro` (lookup server-side) e `devolucao_abatida=0` (pedido novo não tem devolução ainda).
  - **Refresh periódico automático (server, sem botão):** uma Edge Function agendada reconstrói o `flatVendas` dos MESES ABERTOS a partir de `pedidos` + `lojaCadastro` (operacao/segmento) + `devolucoes` (netting da devolução). Frequência proposta: **a cada 3 horas** (ajustável). Mês fechado nunca é tocado. Isso cobre devolução aplicada depois e qualquer drift.
  - **Cancelado no painel:** confirmado que o Painel RK (placar) EXCLUI cancelado pela situação (placar.html: OCULTAR/NAOAP filtram 'Cancelado'). Como o sync grava `situacao='Cancelado'` e o patch leva isso pro `flatVendas`, o cancelamento sai do faturamento automaticamente. (No Power BI, garantir que a medida de faturamento filtre `situacao` fora de: cancelado, em aberto, em andamento, atualização de estoque, correios, sit#15.)

## Restrições gerais
- Meses até ago/2026 fechados e meses travados: nunca alterar. Divergência → Pendências.
- Nunca apagar dados do usuário; editar só o necessário; backup antes de qualquer parte que grave dado em massa.
- Token do Bling só no servidor.

## Histórico
- (atualizar conforme cada parte conclui)
