# Lucro Real e importação de clientes

## 1. Nova tributação
- Adicionar `lucro_real` / “Lucro Real” às opções do cadastro, com ícone e destaque próprios.
- Exibir a tributação na listagem de clientes e permitir filtrar por regime, incluindo “sem tributação”.
- Incluir “Tributação” nas duas exportações de clientes para Excel.
- Reconhecer também os formatos antigos já gravados na base, sem alterar clientes existentes.

## 2. Importação da planilha
- Validar as abas “Clientes” e “Contatos”, CNPJs, datas, tiers e regimes antes de gravar.
- Comparar os CNPJs somente pelos dígitos contra ativos, arquivados e distratados; não criar nem alterar registros já existentes.
- Criar somente clientes novos com os nomes da planilha, sem consultar a BrasilAPI, e vincular os contatos válidos.
- Conferir o resultado na base e informar criados, contatos e linhas ignoradas com seus motivos.

## Bloqueio atual
A única planilha Excel anexa disponível é `Analise_Demandas_CS_1.xlsx`, com as abas “Matriz de Decisão CS” e “Metodologia e Limites”. Ela não contém clientes nem contatos. A importação depende do envio da planilha correta.

## Validação
- Testar as regras de exibição e filtro da tributação.
- Conferir Lucro Real no cadastro, na listagem e no Excel pelo preview.
