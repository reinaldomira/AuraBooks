# 📚 Lumina Books — Biblioteca Editorial & Leitor Imersivo

> **Lumina Books** é uma aplicação completa e moderna para amantes da literatura. Funciona como uma biblioteca pessoal refinada com leitor imersivo em página dupla ou simples, suporte a múltiplos formatos de e-books (.EPUB, .PDF, .MOBI, .AZW3 e .TXT), narração em áudio (audiolivro com voz natural), gerenciamento e upload de capas personalizadas, além de sincronização em nuvem e suporte total a PWA para celulares e computadores.

---

## ✨ Principais Funcionalidades

### 📖 Leitor Imersivo & Editorial
* **Experiência de Livro Físico**: Modos de visualização em duas páginas (spread editorial clássico) ou página única.
* **Formatos Suportados**: Leitura e parsing de arquivos **.EPUB**, **.PDF**, **.MOBI**, **.AZW3** e **.TXT**.
* **Personalização Visual Completa**:
  * **Temas**: Alabastro (papel creme suave), Sépia clássico, Modo Escuro (Dark) e Papiro.
  * **Tipografia**: Fontes serifadas editoriais (*Playfair Display*, *Newsreader*, *Georgia*, *Merriweather*) e sem serifa (*Plus Jakarta Sans*, *Inter*).
  * **Ajustes de Leitura**: Controle de tamanho da fonte, entrelinha (line-height) e margens de coluna.
* **Anotações & Marcadores**:
  * Destaques de texto (highlights) coloridos com notas pessoais.
  * Marcadores de página (bookmarks) para retorno rápido.
  * Dicionário integrado para consulta instantânea de significados.

---

### 🎧 Audiolivro com Narração Natural (TTS)
* **Narração Dinâmica**: Acompanha parágrafo por parágrafo com realce visual sincronizado.
* **Auto-Scroll Inteligente**: A rolagem do leitor acompanha a leitura da voz em tempo real.
* **Controles de Áudio**:
  * Velocidade ajustável (0.75x a 2.0x).
  * Seleção de vozes do sistema operacional/navegador.
  * Mini player fixo para continuar ouvindo enquanto navega na biblioteca.
  * **Timer de Sono (Sleep Timer)**: Pausa automática após 15, 30, 45 ou 60 minutos.

---

### 🖼️ Gerenciamento Inteligente de Capas
* **Upload do Dispositivo**: Carregamento de imagens locais (.JPG, .PNG, .WEBP) para definir a capa de qualquer livro.
* **Busca Oficial na Web**: Localização de capas canônicas via Open Library e deduções inteligentes com **Google Gemini**.
* **Link Direto (URL)**: Opção de colar qualquer link de imagem da internet com pré-visualização instantânea.
* **Otimização Ultraleve**: Compressão automática no navegador para thumbnails leves (~25-45KB), garantindo carregamento instantâneo no celular e compatibilidade com o Firestore.
* **Capa Editorial em Canvas**: Geração de capas clássicas estilizadas com vinco 3D de lombada e selo tipográfico quando não há imagem disponível.

---

### ☁️ Sincronização em Nuvem & Multi-Dispositivo
* **Firebase (Auth & Firestore)**:
  * Login com Google ou E-mail e Senha.
  * Sincronização bidirecional de metadados, capas, progresso percentual, CFI e histórico entre computadores e celulares.
* **Google Drive**:
  * Integração opcional para backup e salvamento dos arquivos originais na pasta `/Livros`.
  * Restauração automática de livros em novos dispositivos.
* **Armazenamento Local Offline**:
  * Banco de dados local com **IndexedDB** (`AuraBooksDB`), permitindo ler e ouvir e-books mesmo sem conexão à internet.

---

### 📱 Experiência Mobile & PWA (Progressive Web App)
* **Instalável**: Pode ser instalado diretamente na tela inicial de celulares (Android e iOS) ou desktop.
* **Interface Responsiva**: Barra inferior de navegação (*MobileBottomNav*) adaptada para telas sensíveis ao toque.
* **Leitura com Gestos**: Suporte a gestos de toque (swipe) para virar de página.

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologias |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Motion, Lucide React |
| **Leitura & Documentos** | Foliate-js (EPUB/MOBI), PDF.js (Mozilla), JSZip, fflate |
| **Backend / API** | Node.js, Express, TSX, Google GenAI SDK (`@google/genai` / Gemini 3.8 Flash) |
| **Persistência & Nuvem** | IndexedDB local, Firebase Auth, Google Cloud Firestore, Google Drive API |
| **PWA** | Vite Plugin PWA, Service Workers (Workbox) |

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
* **Node.js** (versão 18 ou superior recomendada)
* **npm** ou **pnpm** / **yarn**

### 1. Clonar o repositório e instalar dependências
```bash
git clone <url-do-repositorio>
cd lumina-books
npm install
```

### 2. Configurar Variáveis de Ambiente
Crie um arquivo `.env` com base no `.env.example`:
```bash
cp .env.example .env
```

Preencha as seguintes chaves se desejar utilizar os recursos de IA:
```env
# Chave da API do Google Gemini (usada para busca de capas e dedução bibliográfica)
GEMINI_API_KEY="SUA_CHAVE_GEMINI_AQUI"

# URL da aplicação
APP_URL="http://localhost:3000"
```

### 3. Iniciar o Servidor de Desenvolvimento
```bash
npm run dev
```
Acesse `http://localhost:3000` no seu navegador.

---

## 📦 Scripts Disponíveis

* `npm run dev`: Inicia o servidor backend Express integrado ao Vite em modo de desenvolvimento.
* `npm run build`: Compila a aplicação para produção e gera o Service Worker PWA na pasta `dist/`.
* `npm run start`: Executa o servidor Node de produção.
* `npm run lint`: Executa a verificação estática de tipos com TypeScript (`tsc --noEmit`).

---

## 📂 Estrutura do Projeto

```
├── public/                 # Ícones, manifest PWA e assets estáticos
├── src/
│   ├── components/         # Componentes React (Leitores, Modais, Estante, Capas, Controles)
│   │   ├── BookCover.tsx        # Renderizador de capa de alta performance com fallback
│   │   ├── ChangeCoverModal.tsx # Modal para upload manual, busca web ou link de capa
│   │   ├── EpubReaderView.tsx   # Leitor avançado de EPUBs
│   │   ├── ReaderView.tsx       # Leitor editorial geral com temas e modo spread
│   │   ├── LibraryView.tsx      # Estante principal com filtros, ordenação e estatísticas
│   │   └── ...
│   ├── context/            # Contextos React (Autenticação, Leitor de Áudio, etc.)
│   ├── services/           # Serviços (coverService, firebase, storageService, etc.)
│   ├── types/              # Definições de tipos TypeScript (Book, ReaderSettings, etc.)
│   ├── App.tsx             # Componente raiz da aplicação
│   └── main.tsx            # Ponto de entrada do React
├── server.ts               # Servidor Express com rotas de API para capas e IA Gemini
├── vite.config.ts          # Configuração do Vite, Tailwind CSS e PWA
└── metadata.json           # Metadados e permissões da aplicação
```

---

## 📄 Licença

Este projeto é desenvolvido para fins educacionais e de leitura pessoal. Consulte o arquivo de licença correspondente para mais detalhes.
