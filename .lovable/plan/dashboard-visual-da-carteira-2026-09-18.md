# Dashboard visual da carteira

## Objetivo
Manter a página inicial focada nos indicadores da carteira e abrir os clientes de cada situação em um painel lateral.

## Alterações
- Remover da área principal a busca, os filtros e a listagem fixa de clientes.
- Reorganizar os seis indicadores com hierarquia visual mais forte, mantendo “Críticos” como principal alerta.
- Acrescentar um gráfico de distribuição da saúde da carteira usando as contagens reais já disponíveis.
- Ao clicar em qualquer indicador, abrir um painel lateral com:
  - título e quantidade da situação;
  - busca por nome ou CPF/CNPJ;
  - lista dos clientes correspondentes;
  - Health Score, situação financeira, responsável e identificação;
  - acesso à ficha ao clicar no cliente;
  - exportação para Excel respeitando a situação aberta.
- Manter o indicador compacto de churn do mês no dashboard.
- Disponibilizar clientes arquivados em uma ação secundária que também abre o painel lateral, preservando arquivar e desarquivar.

## Detalhes técnicos
- Reutilizar a consulta e as regras atuais de classificação, inclusive “Em tratamento”.
- Usar o componente de painel lateral e os tokens visuais existentes.
- Usar o gráfico já disponível no projeto, sem dados simulados.
- Validar a apresentação em telas grandes e menores, além do acesso à ficha pelo painel.
