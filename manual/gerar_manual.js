const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, TableOfContents, PageBreak,
  AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType
} = require('docx');
const fs = require('fs');

// ---------- helpers ----------
const H1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 140 }, children: [new TextRun({ text: t })] });
const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 90 }, children: [new TextRun({ text: t })] });
const H3 = t => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 70 }, children: [new TextRun({ text: t })] });
const P = (t) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: t })] });
// Parágrafo com pedaços (permite negrito no meio). Passa array de {t, b}
const PR = (parts) => new Paragraph({ spacing: { after: 120 }, children: parts.map(p => new TextRun({ text: p.t, bold: !!p.b, italics: !!p.i })) });
const B = (t) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: t })] });
const BB = (lead, rest) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: lead, bold: true }), new TextRun({ text: rest || '' })] });
const STEP = (n, t) => new Paragraph({ spacing: { after: 80 }, indent: { left: 360 }, children: [new TextRun({ text: n + '. ', bold: true }), new TextRun({ text: t })] });
const SPACER = () => new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: '' })] });
const NOTE = (t) => new Paragraph({
  spacing: { before: 80, after: 140 }, indent: { left: 200 },
  border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'E8A33D', space: 12 } },
  children: [new TextRun({ text: t, italics: true })]
});
const HR = () => new Paragraph({ spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } }, children: [new TextRun({ text: '' })] });

// tabela simples 2 colunas
function tabela2(rows, w1, w2, header) {
  const totW = w1 + w2;
  const cell = (txt, w, opts = {}) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: opts.head ? { type: ShadingType.CLEAR, fill: '1F6F5C', color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text: txt, bold: !!opts.head || !!opts.b, color: opts.head ? 'FFFFFF' : undefined })] })]
  });
  const trs = [];
  if (header) trs.push(new TableRow({ tableHeader: true, children: [cell(header[0], w1, { head: true }), cell(header[1], w2, { head: true })] }));
  rows.forEach(r => trs.push(new TableRow({ children: [cell(r[0], w1, { b: true }), cell(r[1], w2)] })));
  return new Table({ columnWidths: [w1, w2], width: { size: totW, type: WidthType.DXA }, rows: trs });
}

const children = [];

// ---------- CAPA ----------
children.push(new Paragraph({ spacing: { before: 2600, after: 0 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Sistema Financeiro Rokbox', bold: true, size: 56, color: '1F6F5C' })] }));
children.push(new Paragraph({ spacing: { before: 120, after: 0 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Manual do Usuário', size: 34, color: '444444' })] }));
children.push(new Paragraph({ spacing: { before: 1400, after: 0 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Guia completo, tela por tela, da rotina do dia a dia ao fechamento do mês.', italics: true, size: 22, color: '666666' })] }));
children.push(new Paragraph({ spacing: { before: 120, after: 0 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Agosto de 2026', size: 20, color: '888888' })] }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---------- SUMÁRIO ----------
children.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: 'Sumário', bold: true, size: 32, color: '1F6F5C' })] }));
children.push(new TableOfContents('Sumário', { hyperlink: true, headingStyleRange: '1-2' }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 1. INTRODUÇÃO
// ============================================================
children.push(H1('1. Introdução'));
children.push(P('Este é o sistema financeiro da Rokbox. Ele reúne num só lugar as vendas, o que a empresa tem a receber e a pagar, a conciliação com o banco, a folha, o fluxo de caixa e os relatórios. Foi feito para bater com o extrato bancário ao centavo e para você não perder nada.'));

children.push(H2('Como abrir e manter atualizado'));
children.push(BB('Onde fica: ', 'o sistema abre no navegador (Google Chrome ou Edge), pelo link publicado. Basta salvar o link nos favoritos.'));
children.push(BB('Versão: ', 'no rodapé da tela aparece a versão (ex.: v521/08-640). Ela serve para você conferir se pegou a última atualização.'));
children.push(BB('Atualizar: ', 'quando eu publico uma melhoria, aperte Ctrl e Shift e R ao mesmo tempo (recarrega forçado). A versão no rodapé muda e a novidade aparece.'));
children.push(NOTE('Dica: se algo parecer estranho ou um botão novo não aparecer, quase sempre é o navegador com a versão antiga em cache. Ctrl+Shift+R resolve.'));

children.push(H2('Como os dados são guardados'));
children.push(P('Tudo é salvo em dois lugares ao mesmo tempo: na nuvem (Supabase) e no próprio navegador (cópia local de segurança). Por isso os dados sincronizam entre os aparelhos: o que você faz no computador aparece também em outro que abrir o mesmo sistema.'));
children.push(BB('Sincroniza sozinho: ', 'não precisa "salvar", cada ação já grava.'));
children.push(BB('Funciona offline: ', 'se a internet cair, ele usa a cópia local e sobe para a nuvem quando voltar.'));

children.push(H2('Regras de ouro'));
children.push(BB('Mês fechado não se mexe: ', 'depois que um mês é conferido e fechado, não altere lançamentos dele. Vários botões que apagam já checam isso e travam.'));
children.push(BB('O sistema nunca apaga seus dados sozinho: ', 'importações só ADICIONAM. Para tirar algo, use "Cancelado" (mantém o histórico) em vez de apagar.'));
children.push(BB('O banco é a verdade: ', 'quando houver dúvida de valor, o que vale é o extrato bancário. Todo o sistema é montado para bater com ele.'));

// mapa das telas
children.push(H2('Mapa das telas (menu de cima)'));
children.push(tabela2([
  ['Dashboard', 'Visão geral (resumo).'],
  ['Vendas', 'Os pedidos de venda importados da planilha.'],
  ['🛒 Compras', 'Notas e contas de fornecedores, que viram Contas a Pagar.'],
  ['👥 RH', 'Funcionários, folha, adiantamento e holerite.'],
  ['Financeiro', 'O coração: Receber, Pagar, Extrato, Conciliação, Fluxo e Comissão.'],
  ['Cadastro', 'Empresas, bancos, lojas e configurações de base.'],
  ['☁ Sincronizar do Drive', 'Puxa os arquivos do mês do Google Drive e distribui nas telas. Só adiciona.'],
], 2600, 6300, ['Tela', 'Para que serve']));
children.push(SPACER());
children.push(P('Dentro de Financeiro, a aba Contas a Receber ainda tem sub-abas: Contas a Receber, Recebimentos e Conciliação, Boletos a Emitir, Cobrança e Devolução / Troca.'));

// ============================================================
// 2. SINCRONIZAR DO DRIVE
// ============================================================
children.push(H1('2. Sincronizar do Drive'));
children.push(P('É o jeito rápido de trazer os arquivos do mês (Vendas, Forma de pagamento, Recebimentos, Boletos e Extrato) de uma pasta do Google Drive para dentro do sistema, sem subir um por um.'));
children.push(BB('Botão: ', '☁ Sincronizar do Drive, no canto direito do menu de cima.'));
children.push(BB('Regra: ', 'só ADICIONA o que é novo, nunca apaga o que já existe. Pode rodar quantas vezes quiser.'));
children.push(P('Se preferir, cada arquivo também pode ser subido manualmente na sua própria tela (Vendas, Extrato, etc.).'));

// ============================================================
// 3. VENDAS
// ============================================================
children.push(H1('3. Vendas'));
children.push(P('Aqui ficam os pedidos de venda, importados da planilha do sistema de vendas. Cada pedido tem cliente, loja, vendedor, empresa (Rokbox ou Rk), valor, itens (SKU, quantidade, custo) e situação.'));
children.push(H2('Importar a planilha de vendas'));
children.push(STEP('1', 'Exporte a planilha de pedidos do sistema de vendas.'));
children.push(STEP('2', 'Suba na aba Vendas (ou use o Sincronizar do Drive).'));
children.push(STEP('3', 'O sistema guarda o detalhe completo (itens, SKU, custo) e mantém as correções que você já fez (loja/vendedor).'));
children.push(H2('A última planilha manda'));
children.push(P('Ao reimportar, a planilha mais recente é a que vale. O sistema confere o total na hora e avisa se algum pedido sumiu da nova exportação (os chamados pedidos "fantasmas"), para você conferir. Ele nunca apaga sozinho, só avisa.'));
children.push(NOTE('Sempre que ele mostrar um aviso de conferência (total ou pedidos que sumiram), leia com atenção: é ele te protegendo de perder ou duplicar venda.'));

// ============================================================
// 4. COMPRAS
// ============================================================
children.push(H1('4. Compras'));
children.push(P('As compras de fornecedores entram aqui e viram Contas a Pagar. A categoria da despesa é definida pela descrição, usando a planilha-mestre de Categorias de Despesas.'));
children.push(P('Contas a Pagar funciona como um "hub": ele recebe as despesas de três lugares: Compras, Comissão e Folha (RH). Tudo isso se junta no Contas a Pagar e depois alimenta o Fluxo de Caixa.'));

// ============================================================
// 5. RH
// ============================================================
children.push(H1('5. RH (Folha e Adiantamento)'));
children.push(P('Na aba RH você cadastra funcionários (com salário) e gera a folha do mês. A folha vira lançamentos no Contas a Pagar, com o selo de folha (👤).'));
children.push(H2('Gerar a folha do mês'));
children.push(P('Ao gerar, o sistema cria por funcionário: salário, comissão, DSR, férias, vale transporte, extras e adiantamento, cada um na sua competência e categoria certa (adiantamento e VT caem no mês seguinte).'));
children.push(H2('Adiantamento'));
children.push(BB('Cálculo automático: ', 'o adiantamento é calculado sozinho como 40% do salário. Você revê antes de enviar.'));
children.push(BB('Ajustes: ', 'se a pessoa foi demitida ou está de férias (sem adiantamento), você zera só ela, antes de mandar para o Contas a Pagar. Assim não precisa mandar e depois zerar.'));
children.push(BB('Conferência: ', 'a aba RH permite conferir o líquido contra o PDF do holerite.'));

// ============================================================
// 6. FINANCEIRO
// ============================================================
children.push(H1('6. Financeiro'));
children.push(P('É o centro do sistema. Tem as sub-abas: Contas a Receber, Contas a Pagar, Extrato (OFX), Conciliação Bancária, Fluxo de Caixa e Comissão.'));

// 6.1 Contas a Receber
children.push(H2('6.1 Contas a Receber (CR)'));
children.push(P('Mostra tudo que a empresa tem a receber, montado a partir dos pedidos e dos recebimentos (PayPal, BraavoPay, PIX, Boleto Itaú, etc.). Cada recebimento vira uma linha, na data em que o dinheiro caiu no banco.'));
children.push(BB('Data do boleto: ', 'o boleto entra na data do CRÉDITO no banco (quando compensou), não na data em que o cliente pagou. É isso que faz o CR bater com a conciliação dia a dia.'));
children.push(BB('📤 Exportar: ', 'gera a planilha do Contas a Receber. Filtre por Data: Liquidação + o mês para bater com os créditos do banco. A coluna Recebido é o líquido (o que caiu na conta).'));
children.push(BB('☁ Atualizar Power BI: ', 'grava o CR e o CP já calculados na nuvem para o Power BI ler (ver capítulo do Power BI).'));
children.push(BB('Sigla de acordo: ', 'em Recebimentos você pode marcar a sigla do acordo (ex.: A01) para conciliar renegociações.'));
children.push(H3('Sub-abas de Contas a Receber'));
children.push(tabela2([
  ['📋 Contas a Receber', 'A lista principal do que há a receber.'],
  ['💳 Recebimentos e Conciliação', 'Os recebimentos importados (PayPal, Braavo, PIX, boleto) e o casamento com os pedidos.'],
  ['🧾 Boletos a Emitir', 'Os boletos do Itaú a emitir/emitidos.'],
  ['📥 Cobrança', 'Painel único de cobrança (ver abaixo).'],
  ['🔄 Devolução / Troca', 'Devoluções e créditos de cliente.'],
], 3000, 5900, ['Sub-aba', 'Para que serve']));
children.push(SPACER());
children.push(H3('Cobrança (painel único)'));
children.push(P('Reúne numa lista só, por data de vencimento, os boletos feitos no sistema e os de fora do sistema. Assim você não precisa olhar em dois lugares e não perde vencimento.'));
children.push(BB('Status: ', 'cada linha mostra se está Pago, Em Aberto ou Atrasado.'));
children.push(BB('Vencimento próximo: ', 'vencimentos a até 5 dias aparecem em negrito.'));
children.push(BB('Flag: ', 'marque as linhas que precisam de mensagem de cobrança ou acordo, para agir em bloco.'));

// 6.2 Contas a Pagar
children.push(H2('6.2 Contas a Pagar (CP)'));
children.push(P('Tudo que a empresa tem a pagar: compras, comissão e folha. A categoria vem da descrição. A data de liquidação de uma conta é a data do DÉBITO no banco (quando conciliada).'));
children.push(BB('Status da linha: ', 'você troca entre Em Aberto, Pago, Atrasada, Vencendo hoje e Cancelado.'));
children.push(BB('Cancelar (não apagar): ', 'para tirar uma duplicata, use o status Cancelado. Some dos totais mas mantém o histórico. Não existe lixeira por linha, cancelar é o jeito certo.'));
children.push(BB('Mês fechado: ', 'não altere contas de um mês já fechado.'));

// 6.3 Extrato
children.push(H2('6.3 Extrato (OFX)'));
children.push(P('Aqui você sobe o extrato bancário (arquivo OFX baixado do banco). Ele alimenta a Conciliação Bancária. Cada banco/empresa tem seu extrato (Itaú Rokbox, Itaú Rk, Bradesco, etc.).'));
children.push(NOTE('Importante: o número interno de cada lançamento do Itaú (FITID) muda a cada download. Por isso, ao re-subir o extrato, alguns vínculos podem se soltar. O sistema tem o botão "Reparar vínculos" para religar automaticamente (ver Conciliação).'));

// 6.4 Conciliação Bancária
children.push(H2('6.4 Conciliação Bancária'));
children.push(P('É onde o sistema casa cada lançamento do banco (crédito ou débito) com um pedido (recebimento) ou com uma conta a pagar. É o que garante que Receber e Pagar batem com o banco, dia a dia.'));
children.push(H3('A trava (barra verde / vermelha)'));
children.push(P('No topo da tela aparece uma barra:'));
children.push(BB('Verde: ', 'tudo do banco no período está conciliado. CR/CP batem com a conciliação. Pode confiar.'));
children.push(BB('Vermelha/amarela: ', 'mostra o que ainda NÃO está conciliado (créditos sem pedido, débitos sem conta). Isso é o que faz o mês não bater. Ela distingue "falta vincular" (a conta já existe) de "falta lançar" (não existe ainda).'));
children.push(P('A trava também avisa quando você exporta, se houver algo não conciliado no período.'));
children.push(H3('Botões principais'));
children.push(tabela2([
  ['⚡ Débitos automáticos', 'Concilia débitos que batem exatamente com uma Conta a Pagar pelo valor.'],
  ['⚡ Repasses automáticos', 'Concilia repasses de PayPal/Braavo/Boleto que batem (acúmulo por data). Rode ao subir dados novos.'],
  ['📤 Exportar (créd/déb)', 'Exporta crédito e débito em duas abas, com as mesmas colunas do Contas a Receber.'],
  ['🔍 Duplicidades', 'Procura bancos com nome parecido e os mesmos lançamentos em bancos diferentes.'],
  ['🔧 Reparar vínculos', 'Religa vínculos que se perderam quando o extrato foi re-importado (o FITID do Itaú muda a cada download).'],
  ['🎯 Re-conciliar tarifas por data', 'Casa cada conta de tarifa (R$1) com o débito do MESMO dia. Conserta tarifa grudada no dia errado e mostra os dias que não batem.'],
], 3200, 5700, ['Botão', 'O que faz']));
children.push(SPACER());
children.push(H3('Por que uma conciliação "se perde sozinha"'));
children.push(P('Quando você re-sobe o extrato do Itaú, o número interno de cada lançamento muda. Os vínculos antigos ficam apontando para um número que não existe mais e "descolam". O botão 🔧 Reparar vínculos religa tudo ao lançamento atual do mesmo valor. Ele roda automático ao importar o extrato e também na mão.'));
children.push(H3('Tarifas iguais (R$1)'));
children.push(P('Como toda tarifa de PIX é R$1 igual, ao conciliar por valor a conta podia grudar no débito de outro dia, e o débito do dia certo ficava sem par (a trava acusava mesmo a conta existindo). O botão 🎯 Re-conciliar tarifas por data casa cada tarifa com o débito do mesmo dia e aponta qual dia não bate e qual conta sobra (duplicata para cancelar).'));

// 6.5 Fluxo de Caixa
children.push(H2('6.5 Fluxo de Caixa'));
children.push(P('Mostra o caixa dia a dia, por banco, conferindo o saldo calculado contra o saldo real do banco. Também traz um balancete no estilo da sua planilha (categoria e subcategoria, com saldo inicial, movimento e saldo final), que pode ser exportado.'));
children.push(BB('Usa os mesmos valores do CR e do CP: ', 'o Fluxo puxa os valores já liquidados de Contas a Receber e Contas a Pagar, então bate com eles.'));
children.push(BB('Saldo diário por banco: ', 'seção por banco, dia a dia, começa recolhida. Compara saldo calculado x saldo real.'));

// 6.6 Comissão
children.push(H2('6.6 Comissão'));
children.push(P('Calcula a comissão por loja (vendedores), com percentual por loja. Ela se junta por nome e entra no Contas a Pagar (dentro da folha). Casos de não-vendedores são tratados um a um.'));

// ============================================================
// 7. CADASTRO
// ============================================================
children.push(H1('7. Cadastro'));
children.push(P('Onde ficam as bases que o resto do sistema usa: Empresas (Rokbox, Rk), Bancos, Lojas (com a empresa de cada loja), condições de pagamento e mapeamentos. Manter isso certo faz o sistema classificar tudo direitinho (empresa, operação, categoria).'));

// ============================================================
// 8. POWER BI
// ============================================================
children.push(H1('8. Power BI'));
children.push(P('O Power BI se conecta direto no mesmo banco de dados do sistema (Supabase) e lê os números por meio de "relatórios prontos" (views). Ele só LÊ, nunca altera o sistema.'));
children.push(H2('Como funciona'));
children.push(BB('Mesmo banco: ', 'o sistema e o Power BI olham para o mesmo Supabase. Por isso os números são os mesmos.'));
children.push(BB('5 relatórios (views): ', 'Contas a Pagar, Contas a Receber, Conciliação Bancária, Vendas e Vendas por Item (com custo, para margem).'));
children.push(BB('☁ Atualizar Power BI: ', 'na aba Contas a Receber, este botão grava o CR e o CP já calculados na nuvem. Clique nele sempre que fechar um mês, para o Power BI refletir os números certos.'));
children.push(H2('Regra importante'));
children.push(P('O Power BI é um espelho fiel do sistema: ele mostra o que o sistema calculou na última vez que você clicou em Atualizar Power BI. Se um mês estiver batendo (trava verde) e você atualizar, o Power BI bate. Se você mexer no extrato depois de fechar, atualize de novo.'));
children.push(NOTE('Segurança: para conectar o Power BI, o ideal é usar a conexão própria do banco (no Supabase, em Project Settings, Database, Connection), e não a chave que fica dentro do sistema.'));

// ============================================================
// 9. BACKUP E SAÚDE
// ============================================================
children.push(H1('9. Backup e Saúde do sistema'));
children.push(BB('Backup (exportar): ', 'você pode exportar um arquivo de backup com os dados. Guarde de tempos em tempos.'));
children.push(BB('Restaurar (📂): ', 'a restauração repõe apenas as chaves que estão no arquivo (o que não está no arquivo é preservado). O código do sistema nunca é afetado por um backup.'));
children.push(BB('Painel de Saúde: ', 'mostra o estado dos dados e ajuda a identificar problemas.'));

// ============================================================
// 10. ROTINA DE FECHAMENTO
// ============================================================
children.push(H1('10. Rotina de fechamento do mês'));
children.push(P('Passo a passo sugerido para fechar um mês batendo com o banco:'));
children.push(STEP('1', 'Importe as VENDAS do mês (planilha ou Sincronizar do Drive). Confira os avisos de total e de pedidos que sumiram.'));
children.push(STEP('2', 'Importe os RECEBIMENTOS (PayPal, Braavo, PIX, boletos) e o EXTRATO (OFX) de cada banco.'));
children.push(STEP('3', 'Importe/gere as despesas: Compras, Folha (RH) e Comissão. Elas caem no Contas a Pagar.'));
children.push(STEP('4', 'Na Conciliação Bancária, rode ⚡ Débitos automáticos e ⚡ Repasses automáticos.'));
children.push(STEP('5', 'Se re-subiu extrato, clique 🔧 Reparar vínculos. Se houver tarifas, 🎯 Re-conciliar tarifas por data.'));
children.push(STEP('6', 'Olhe a TRAVA (barra) do mês: resolva o que ela apontar (vincular ou lançar) até ficar VERDE.'));
children.push(STEP('7', 'Confira: Contas a Receber (Liquidação + mês) x Créditos do banco; Contas a Pagar x Débitos do banco.'));
children.push(STEP('8', 'Confira o Fluxo de Caixa (saldo calculado x saldo real do banco).'));
children.push(STEP('9', 'Clique ☁ Atualizar Power BI para o Power BI refletir o mês fechado.'));
children.push(STEP('10', 'Não mexa mais nesse mês. Se precisar re-subir extrato depois, repita a conferência e atualize o Power BI.'));

// ============================================================
// 11. RESOLVENDO PROBLEMAS
// ============================================================
children.push(H1('11. Resolvendo problemas'));
children.push(tabela2([
  ['A trava acusa débito/crédito não conciliado', 'Vá ao Extrato/Conciliação e vincule. Se a conta já existe, é "falta vincular"; se não existe, "falta lançar".'],
  ['Conciliação "se perdeu sozinha" após re-subir extrato', 'Clique 🔧 Reparar vínculos. O FITID do Itaú muda a cada download e solta os vínculos; ele religa.'],
  ['Tarifas de R$1 acusando mesmo existindo a conta', 'Clique 🎯 Re-conciliar tarifas por data. Casa cada tarifa com o débito do mesmo dia.'],
  ['"Nº repetido" / conta duplicada', 'Não apague: mude o status da linha para Cancelado (some do total, mantém histórico).'],
  ['Botão novo não aparece / tela estranha', 'Aperte Ctrl+Shift+R para recarregar a versão nova. Confira a versão no rodapé.'],
  ['Power BI não bate com o sistema', 'Deixe o mês verde na trava e clique ☁ Atualizar Power BI. O Power BI reflete o último clique.'],
  ['Um pedido sumiu da venda', 'Veja o aviso de "pedidos fantasmas" na importação. O sistema não apaga sozinho, só avisa.'],
], 3400, 5500, ['Situação', 'O que fazer']));

// ============================================================
// 12. GLOSSÁRIO
// ============================================================
children.push(H1('12. Glossário'));
children.push(tabela2([
  ['CR (Contas a Receber)', 'O que a empresa tem a receber dos clientes.'],
  ['CP (Contas a Pagar)', 'O que a empresa tem a pagar (compras, folha, comissão).'],
  ['Conciliação', 'Casar cada lançamento do banco com um pedido ou uma conta.'],
  ['Liquidação', 'A data em que o dinheiro realmente entrou ou saiu do banco.'],
  ['Repasse', 'Depósito único do gateway (PayPal/Braavo/boletos) que junta vários recebimentos.'],
  ['Boleto avulso', 'Boleto do Itaú a receber que não veio pelo fluxo normal do pedido.'],
  ['Trava', 'A barra verde/vermelha que avisa o que não está conciliado no período.'],
  ['Sigla de acordo (A01, A02...)', 'Identifica uma renegociação (acordo) para conciliar no extrato.'],
  ['View (Power BI)', 'Um "relatório pronto" no banco que o Power BI lê. Só leitura.'],
  ['FITID', 'Número interno de cada lançamento do OFX. No Itaú muda a cada download.'],
  ['OFX', 'Formato do arquivo de extrato bancário.'],
], 3200, 5700, ['Termo', 'O que significa']));

children.push(SPACER());
children.push(HR());
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: 'Sistema Financeiro Rokbox • Manual do Usuário • Agosto de 2026', italics: true, size: 18, color: '888888' })] }));

// ---------- documento ----------
const doc = new Document({
  creator: 'Rokbox',
  title: 'Manual do Sistema Financeiro Rokbox',
  styles: {
    default: {
      document: { run: { font: 'Calibri', size: 22, color: '2A2A2A' } }
    },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 30, bold: true, color: '1F6F5C' }, paragraph: { spacing: { before: 320, after: 140 } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, color: '2E7D63' }, paragraph: { spacing: { before: 220, after: 90 } } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 23, bold: true, color: '444444' }, paragraph: { spacing: { before: 160, after: 70 } } }
    ]
  },
  sections: [{
    properties: { page: { margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } } },
    children
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(process.argv[2], buf);
  console.log('OK gerado:', process.argv[2], buf.length, 'bytes');
});
