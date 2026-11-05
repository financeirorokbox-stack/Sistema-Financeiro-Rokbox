# Teste automático (gate antes de publicar)

Roda os painéis e o Gestão com uma CÓPIA LOCAL dos dados reais e confere os números-chave.
Serve pra pegar regressões (filtro que não filtra, peças erradas, extrato duplicando) ANTES
de todo push.

## Como rodar

```
cd tests
npm install            # 1ª vez
npx playwright install chromium   # 1ª vez (ou usa o Chrome do sistema, ver config)
npm run gate
```

Tem que dar **tudo verde** pra publicar.

## O que ele confere

- **Painel de Vendas** (placar.html): Peças vendidas Out/26 = 2.854 (Rokbox 1.045 / Rk 1.809),
  amostras 21, brindes 187, Faturamento 251.152,02, console limpo.
- **Relatório de Fechamento** (financeiro.html): Peças vendidas Out/26 = 2.854 + amostras/brindes.
- **Margem** #41020 = 527,47 (cascata completa íntegra).
- **Gestão** (index.html): filtro de mês FILTRA (Out = 302.263,84 / 251.152,02; muda no Nov;
  limpar volta ao total); Contas a Pagar abre com filtro; Conciliação abre.
- **Extrato**: importar o mesmo OFX do Bradesco 2x (FITID muda) NÃO duplica, e preserva os
  repetidos legítimos (tarifas de R$1 do dia).

## Dados

Os dados reais ficam SÓ em `tests/.data/snapshot.json` (gitignored, NUNCA vão pro GitHub).
O teste intercepta o Supabase: leitura responde do snapshot, escrita vira no-op — nunca grava
no banco. Pra atualizar a cópia, gere um novo `tests/.data/snapshot.json`.
