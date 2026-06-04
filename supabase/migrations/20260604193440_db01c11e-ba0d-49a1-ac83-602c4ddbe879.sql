-- Passo 1: campo de parceria no cliente
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS parceria text;

-- Passo 3: checklist da etapa de ativação VMk (item 4 = e-mail de orientação pós-constituição)
INSERT INTO public.onboarding_checklist_items (stage, order_index, title, sla_hours, is_required, responsible_role, description)
SELECT v.stage, v.order_index, v.title, v.sla_hours, true, 'cs', v.description
FROM (VALUES
  ('vmk_ativacao', 1, 'Cadastro completo nos sistemas', 48, 'Cadastrar o cliente VMk em todos os sistemas internos.'),
  ('vmk_ativacao', 2, 'Gerar tarefas iniciais', 24, 'Criar as tarefas operacionais iniciais da parceria.'),
  ('vmk_ativacao', 3, 'Enviar boas-vindas da parceria VMk', 24, 'Enviar mensagem de boas-vindas ao cliente da parceria VMk.'),
  ('vmk_ativacao', 4, 'Enviar e-mail de orientação pós-constituição', 48, 'Enviar o e-mail de orientação ao cliente logo após a constituição da empresa.'),
  ('vmk_ativacao', 5, 'Confirmar dados bancários', 72, 'Confirmar os dados bancários da empresa recém-constituída.'),
  ('vmk_ativacao', 6, 'Marcar ativação como concluída', 120, 'Finalizar a ativação da parceria VMk.')
) AS v(stage, order_index, title, sla_hours, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.onboarding_checklist_items i
  WHERE i.stage = v.stage AND i.order_index = v.order_index
);

-- Passo 2: template do e-mail de orientação pós-constituição (parceria VMk)
INSERT INTO public.message_templates (onboarding_type, stage, moment, title, content, variables)
SELECT 'vmk_parceria', 'vmk_ativacao', 'orientacao_pos_constituicao',
  'E-mail de orientação pós-constituição',
  E'Olá, [NOME_CLIENTE]!\n\nParabéns pela constituição da sua empresa! Esse é um passo muito importante e estamos felizes em acompanhar você nesta jornada por meio da parceria VMk.\n\nCNPJ: [CNPJ_EMPRESA]\n\nA partir de agora, a 2M [SAUDE/CONTABILIDADE] assume toda a sua contabilidade. Para começarmos organizados, seguem algumas orientações importantes:\n\n1. Emissão de notas fiscais: aguarde a liberação dos acessos que enviaremos antes de emitir qualquer nota.\n2. Conta bancária: mantenha a conta PJ separada das suas contas pessoais.\n3. Documentos: guarde todos os comprovantes de receitas e despesas do período.\n4. Impostos e obrigações: cuidaremos de todos os prazos e cálculos por você.\n5. Dúvidas do dia a dia: fale comigo por aqui sempre que precisar.\n\nEm breve entro em contato para alinharmos os próximos passos. Seja muito bem-vindo(a)!\n\n[NOME_CS]',
  to_jsonb(ARRAY['NOME_CLIENTE','CNPJ_EMPRESA','SAUDE/CONTABILIDADE','NOME_CS'])
WHERE NOT EXISTS (
  SELECT 1 FROM public.message_templates m
  WHERE m.onboarding_type = 'vmk_parceria' AND m.moment = 'orientacao_pos_constituicao'
);