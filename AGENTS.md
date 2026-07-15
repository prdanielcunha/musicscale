# Regras Obrigatórias para Agentes de IA

Este documento contém regras fundamentais e inegociáveis para qualquer IA que venha a trabalhar no repositório MusicScale. O não cumprimento destas regras resultará em bloqueio da tarefa ou falha na integração.

## 1. Princípios Básicos
- **Leia o Código e os Documentos:** Antes de alterar qualquer arquivo, você deve ler a base de código e a documentação técnica relevante (ex: `/docs/ARCHITECTURE_CURRENT.md` e `/docs/AI_CHANGE_PROTOCOL.md`).
- **Entenda o Comportamento:** Analise como o sistema se comporta atualmente antes de sugerir ou implementar mudanças.
- **Escopo Estrito:** Faça somente alterações dentro do escopo solicitado. Não modifique rotas, textos, layout, contratos, banco, arquitetura ou permissões se não tiver sido explicitamente pedido.
- **Sem Refatorações Oportunistas:** É proibido refatorar código que está funcionando apenas por questões de estilo ou preferência se isso não for o escopo principal da solicitação.
- **Preserve Funcionalidades:** Qualquer nova funcionalidade não deve quebrar ou alterar funcionalidades já existentes.

## 2. Isolamento e Organização
- **Preservar Multi-Tenant:** Toda leitura e escrita deve respeitar o isolamento por `organizationId`. Uma organização nunca deve acessar os dados de outra.
- **Não Confiar Cega no Frontend:** O backend não deve aceitar cegamente parâmetros como `organizationId`, `userId`, `role`, permissões ou contexto enviados pelo client (frontend). 
- **Autorizações Críticas:** As autorizações devem ser validadas sempre pelo backend através de JWT ou cookies validados, ou no acesso aos documentos no Firestore (Server/Regras de Segurança).
- **Firestore Rules:** As regras de segurança (`firestore.rules`) devem permanecer compatíveis e seguras, bloqueando acessos a documentos que o usuário não possua permissão (baseado no `organizationId`).
- **Nenhum Bypass:** É expressamente proibido criar regras de contorno (bypass) baseadas em verificação de e-mail específico, UID hardcoded, nome ou qualquer valor fixo no código.

## 3. Integração no Ecossistema MillionsNest
- **Respeito à Plataforma:** O MusicScale é um satélite integrado à MillionsNest. Respeite essa hierarquia.
- **Não Duplicar Responsabilidades:** Não crie fontes paralelas de identidade, organizações, memberships, RBAC (Role-Based Access Control), sistema de billing, ou status de assinatura/entitlements. Todas essas informações emanam da MillionsNest.
- **Diferenciação de Papéis:** Lide adequadamente com a diferença de escopo entre `owner` (Ecossistema), membro com papel global (MillionsNest), membro com `organizationRole` (Papel Organizacional interno), e Função Operacional/Musical (Band Role/Função Ministerial que é puramente descritiva).

## 4. Front-End, Design e UX
- **Mobile First & Desktop Excellent:** As aplicações devem continuar otimizadas e perfeitamente funcionais em smartphones, tablets e desktop.
- **Preservar Internacionalização:** Todo texto novo ou modificação visível ao usuário DEVE suportar os 3 idiomas base do projeto: Português, English, e Español, utilizando o `react-i18next` ou padrão do projeto.
- **Design System:** Preserve a paleta de cores (Dark Premium), a família de fontes (Inter e JetBrains Mono) e a utilização do Tailwind CSS + Motion sem incluir bibliotecas de interface não solicitadas.

## 5. Proteção de Dados e Estrutura
- **Contratos Intactos:** Não altere o formato das coleções e subcoleções, não adicione índices desnecessários, não mude as Firestore Rules nem modifique as variáveis de ambiente sem uma justificativa técnica profunda.
- **Segredos e Tokens:** Em hipótese alguma exponha credenciais, `GEMINI_API_KEY`, Stripe Tokens ou chaves confidenciais. A API/LLM deve ser chamada somente no backend Node.js (Express).

## 6. Procedimento Técnico e Execução
- **Comandos Reais:** Utilize somente comandos que de fato existam no repositório. Por exemplo, execute `npm run lint` ou equivalente se estiver no `package.json`.
- **Validações de Código:** Execute (quando aplicável):
  - `lint` (`npm run lint` ou `npx tsc --noEmit`)
  - `typecheck`
  - `build` (`npm run build`)
  - Testes relacionados já existentes no repo.
- **Revisão Integral do Diff:** Antes de concluir a resposta, analise o *diff* da sua alteração.
- **Evidências:** Nunca afirme que um teste "passou" se você não tiver executado a instrução explicitamente através de terminal e visto o output sem erros.

## 7. Relatórios de Conclusão de Tarefa
Toda vez que concluir uma alteração, informe de forma clara:
- Arquivos criados.
- Arquivos modificados.
- Comportamento anterior (brevemente).
- Novo comportamento implementado.
- Comandos executados para validação.
- Resultados obtidos nesses comandos.
- Quaisquer riscos ainda restantes ou pendências identificadas.
- Configurações manuais exigidas pelo administrador (ex: variáveis de ambiente a preencher).
- Confirmação explícita de ausência de mudanças fora do escopo.
