
# Documentação Técnica e Funcional - Music Scale Manager
**Desenvolvido por:** CunhaLabs  
**Versão:** 0.2 Beta

---

## 1. Visão Geral
O **Music Scale Manager** é uma Single-Page Application (SPA) projetada para líderes de louvor e ministérios de música. O objetivo é simplificar a gestão de repertório, a criação de escalas (setlists) de música e a organização das escalas de integrantes da banda.

---

## 2. Arquitetura Técnica

### Frontend (Stack)
*   **Framework:** React 19 (via CDN/Importmap).
*   **Linguagem:** TypeScript (TSX).
*   **Estilização:** Tailwind CSS (com suporte a Dark Mode).
*   **Roteamento:** React Router DOM v7.
*   **Ícones:** Componentes SVG customizados (baseados em Heroicons).
*   **Gerenciamento de Estado:** React Context API (`AuthContext`, `MusicDataContext`, `ModalContext`, `ThemeContext`, `SuggestionContext`).

### Backend (BaaS - Backend as a Service)
*   **Plataforma:** Google Firebase.
*   **Autenticação:** Firebase Auth (Email/Senha).
*   **Banco de Dados:** Cloud Firestore (NoSQL).

---

## 3. Estrutura de Dados (Backend - Firestore)

O banco de dados é estruturado nas seguintes coleções:

1.  **users**: Perfis de usuário estendidos.
    *   `uid`, `email`, `displayName`, `photoURL`, `roleId` (FK), `specialtyIds` (Array de FKs), `address`, configurações de visualização.
2.  **roles**: Funções e Permissões.
    *   `name` (ex: Líder, Ministro), `permissions` (Objeto booleano definindo acesso a módulos).
3.  **songs**: Repertório musical.
    *   `title`, `artist`, `key`, `bpm`, `lyrics`, `chords`, `tags`, `status` (active/inactive), `videoUrl`.
4.  **scales**: Escalas de Músicas (Setlists).
    *   `date`, `eventTypeId`, `locationId`, `songIds` (Array), `bandScaleId` (Link opcional).
5.  **bandScales**: Escalas de Integrantes.
    *   `date`, `assignments` (Array de objetos {userId, instrumentId}), `musicScaleId` (Link opcional).
6.  **fixedBandScales**: Modelos de escalas de banda salvos para reuso rápido.
7.  **suggestions**: Indicações de músicas feitas pelos usuários.
8.  **Auxiliares**: `eventTypes`, `locations`, `eventNames`, `tags`, `instruments`.

---

## 4. Detalhamento do Frontend (Tela por Tela)

### 4.1. Login / Registro (`/login`)
*   **Objetivo:** Porta de entrada do sistema.
*   **Elementos:**
    *   **Logo:** Branding do Music Scale Manager.
    *   **Formulário:** Alterna entre "Entrar" e "Cadastrar".
    *   **Campos (Cadastro):** Nome Completo, E-mail, Senha, Confirmar Senha, Função na Banda (Dropdown inicial).
    *   **Ações:** Login persistente (LocalPersistence) ou Sessão.

### 4.2. Layout Principal (`Sidebar` + `Header`)
*   **Sidebar (Menu Lateral):**
    *   Navegação colapsável.
    *   Links: Dashboard, Repertório (Músicas, Integrantes), Escalas (Músicas, Bandas), Cifras, Indicações, Banco de Dados.
    *   Configurações: Perfil, Usuários (Admin), Funções (Admin).
    *   Ajuda: Reportar Erro, SAC, Tutoriais, Sobre a CunhaLabs.
    *   Seletor de Tema: Claro, Escuro, Sistema.
    *   Logout.
*   **Header (Topo):**
    *   Título da página atual.
    *   Botão de Ajuda Rápida.
    *   Notificações de novas sugestões (ícone de sino).

### 4.3. Dashboard (`/`)
*   **Visão:** Resumo gerencial.
*   **Cards de Estatísticas:** Total de Músicas, Músicas Novas, Músicas Ativas, Músicas Inativas (clicáveis para filtro).
*   **Próximo Evento:** Destaque visual com contagem regressiva, data, local e lista resumida de músicas.
*   **Meus Compromissos:** Lista onde o usuário logado está escalado.
*   **Sugestões de Ensaio:** Algoritmo que sugere músicas pouco tocadas ou novas.
*   **Ações:** Botão rápido para "Indicar Música" e "Criar Nova Escala".

### 4.4. Repertório de Músicas (`/songs`)
*   **Visão:** Lista completa de músicas.
*   **Barra de Ferramentas:**
    *   Busca (Título/Artista).
    *   Botão Filtros (Status, Com/Sem Cifra, Com/Sem Letra, Tags).
    *   Modo de Visualização (Cards ou Tabela).
    *   Modo de Seleção (Múltipla seleção para ações em massa).
    *   Botão "Nova Música".
*   **Card da Música:** Título, Artista, Tom, BPM, Badges (Cifra/Letra/Tags).
*   **Ações no Card:** Ver Detalhes, Editar, Excluir (com permissão), Criar Escala a partir desta música.
*   **Modais:**
    *   **Formulário:** Cadastro completo (Letra, Cifra, Links).
    *   **Detalhes:** Visão geral, histórico de execuções, Metrônomo integrado, botões para ver Cifra (Transponível), Cifra Original (se houver URL externa) ou Letra.

### 4.5. Integrantes (`/band`)
*   **Visão:** Lista de usuários cadastrados.
*   **Filtros:** Busca por nome, Filtro por Especialidade (Instrumento).
*   **Card de Usuário:** Foto/Avatar, Nome, Função (Role), Tags de instrumentos que toca.

### 4.6. Escalas de Músicas (`/scales`)
*   **Visão:** Lista de setlists criados.
*   **Filtros:** Próximas / Passadas.
*   **Card de Escala:**
    *   Design tipo "Calendário" (Dia/Mês).
    *   Local e Tipo de Evento.
    *   Preview das músicas (lista compacta).
    *   Status "Arquivada" (se data passada).
*   **Modal de Detalhes:**
    *   Lista completa de músicas (clicáveis para ver detalhe).
    *   Link para Escala da Banda (mostra quem vai tocar).
    *   Botão "Compartilhar": Gera uma imagem PNG da escala ou copia o link direto.
    *   Botão "Clonar": Duplica a escala para uma nova data.

### 4.7. Escalas de Banda (`/band-scales`)
*   **Visão:** Quem toca quando.
*   **Card de Escala:** Semelhante ao de música, mas mostra avatares dos músicos escalados.
*   **Funcionalidade Chave:**
    *   Vinculação automática ou manual com Escala de Música.
    *   Gerenciador de Escalas Fixas (Templates de banda).

### 4.8. Visualizador de Cifras (`/chords` e Modal)
*   **Funcionalidades:**
    *   Transposição de tom (semitons +/-).
    *   Rolagem Automática com controle de velocidade.
    *   Ajustes de Fonte (Tamanho, Família, Cor da Letra/Cifra).
    *   Editor de Cifra integrado (para usuários com permissão).

### 4.9. Banco de Dados (`/database`)
*   **Gerenciamento de Auxiliares:**
    *   Tipos de Evento (Culto, Ensaio, etc).
    *   Locais (Igreja, Praça, etc).
    *   Tags (Adoração, Júbilo, etc).
    *   Especialidades/Instrumentos.

### 4.10. Configurações Administrativas (`/users`, `/roles`)
*   **Usuários:** Alterar função de um usuário (ex: promover de Visitante para Ministro).
*   **Funções:** Criar novas funções e definir granularmente as permissões (checkboxes para: Gerenciar Usuários, Repertório, Escalas, etc).

---

## 5. Fluxos de Usuário Específicos

### Fluxo de Link Compartilhado
1.  Usuário recebe link (ex: `/scales/ID_DA_ESCALA`).
2.  App carrega. `ModalContext` detecta o ID na URL.
3.  Lógica de proteção (`useRef`) impede loop infinito.
4.  Modal da Escala abre sobre a tela principal.
5.  Correção de Z-Index garante que, se o usuário clicar em uma música dentro da escala, o modal da música abra **por cima** da escala.

### Fluxo de Edição de Cifras
1.  Usuário abre música -> Ver Cifra.
2.  Clica em "Ajustes" -> "Editar Cifra".
3.  Editor de texto mono-espaçado abre.
4.  Ao salvar, o backend atualiza o campo `chords`, `chordsLastModifiedBy` e `chordsLastModifiedAt`.

---

## 6. Permissões (RBAC)

O sistema utiliza controle de acesso baseado em funções (Role-Based Access Control).
*   **Administrador:** Acesso total.
*   **Líder/Ministro:** Pode criar/editar músicas e escalas. Não gerencia usuários.
*   **Músico/Vocal:** Pode ver tudo, usar ferramentas de cifra, mas não altera repertório.
*   **Visitante:** Apenas visualização básica.

---

## 7. Histórico de Atualizações Recentes
*   **UI/UX:** Redesign dos cards para estilo "Clean/Premium" (Linear style).
*   **Correções:**
    *   `JSON circular structure`: Corrigido no comparador de permissões.
    *   `Infinite Loop`: Corrigido ao abrir links diretos (deep links).
    *   `Android Touch`: Corrigido clique em listas usando botões semânticos.
    *   `Z-Index Stacking`: Reorganização das camadas de modais.
    *   **Transposição de Cifras:** Ajuste na expressão regular para identificar corretamente sustenidos e bemóis, evitando a duplicação de símbolos (#).
*   **Funcionalidade:**
    *   Adicionado Metrônomo nos detalhes da música.
    *   Botão "Cifra Original" (anteriormente Link Original) para abrir cifras externas.
*   **Conteúdo:** Atualização do texto "Sobre" para **CunhaLabs**.
