import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '10mb' }));

  // Inicializa o cliente Gemini com headers de telemetria recomendados
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey
    ? new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })
    : null;

  /**
   * Endpoint de IA: Enriquecer metadados e detalhes reais de livros
   * Pesquisa e analisa os dados reais do livro fornecido pelo usuário
   */
  app.post('/api/books/enrich', async (req, res) => {
    try {
      const { title, author, format, category, existingDescription, sampleText } = req.body;

      if (!title || typeof title !== 'string') {
        return res.status(400).json({ success: false, error: 'Título do livro é obrigatório' });
      }

      if (!ai) {
        return res.status(503).json({
          success: false,
          error: 'Chave GEMINI_API_KEY não disponível no servidor',
        });
      }

      const prompt = `Você é um curador e historiador literário especializado.
Analise a obra abaixo e forneça informações literárias VERDADEIRAS, REAIS e fidedignas sobre este livro específico.
IMPORTANTE: Não invente dados fictícios para livros reais consagrados (ex: Dom Casmurro de Machado de Assis, 1984 de George Orwell, Cem Anos de Solidão, O Pequeno Príncipe, etc).
Se for uma obra menos comum, use o título, autor e a amostra de texto para deduzir com alta fidelidade o gênero, estilo e resumo verídico.
NUNCA retorne informações sobre a família Buendía ou Macondo se o livro não for Cem Anos de Solidão!

DADOS DO LIVRO INFORMADO:
- Título: "${title}"
- Autor: "${author || 'Não especificado'}"
- Categoria atual: "${category || ''}"
- Formato: "${format || ''}"
- Sinopse atual: "${existingDescription || ''}"
- Amostra de texto / Primeiros parágrafos:
"""
${(sampleText || '').slice(0, 3000)}
"""

Retorne um objeto JSON estritamente tipado contendo informações reais sobre ESTE LIVRO:
1. genre: Gênero literário principal real (ex: "Realismo Brasileiro", "Distopia Política", "Fábula Filosófica", "Ficção Científica").
2. subgenre: Subgênero ou movimento literário real (ex: "Romance Psicológico", "Clássico Moderno").
3. publishYear: Ano da 1ª publicação original ou época real (ex: "1899", "1949", "1943").
4. publisher: Editora de renome ou original da obra (ex: "Companhia das Letras", "Livraria Garnier", "Record").
5. edition: Edição de referência (ex: "Edição Crítica e Anotada", "Edição Comemorativa").
6. pageCount: Quantidade realista estimada de páginas (inteiro, ex: 256, 336).
7. isbn: ISBN-13 verídico ou de edição conhecida (ex: "978-8535914849").
8. translator: Nome do tradutor célebre para o português se for obra estrangeira, ou "Obra original em Língua Portuguesa" se for em português.
9. synopsis: Sinopse editorial profunda, envolvente e estritamente fiel aos acontecimentos e personagens REAIS deste livro (2 a 4 parágrafos em português).
10. synopsisSubtitle: Subtítulo temático curto em maiúsculas com os personagens centrais ou tema (ex: "BENTO SANTIAGO & CAPITU", "WINSTON SMITH & O GRANDE IRMÃO").
11. curatorBadge: Distintivo editorial curto em maiúsculas (ex: "CLÁSSICO BRASILEIRO", "DISTOPIA ESSENCIAL", "OBRA-PRIMA UNIVERSAL").
12. breadcrumbCategory: Categoria editorial para breadcrumb (ex: "LITERATURA BRASILEIRA", "FICÇÃO CIENTÍFICA").
13. notableQuote: Uma citação célebre ou frase de abertura icônica DESTE livro específico, com indicação da fonte (capítulo ou contexto).
14. atmosphere: 3 aspectos reais do tom, atmosfera e estilo narrativo da obra, cada um com porcentagem (1 a 100) e breve explicação.
15. keyThemes: Lista de 3 a 5 temas centrais reais da obra.
16. editorialReviews: 2 resenhas literárias aprofundadas e verossímeis feitas por leitores/críticos, discutindo personagens e eventos REAIS deste livro.
17. communityRating: score de 1.0 a 5.0 (ex: 4.9), totalRatings (ex: 3500) e acclaimPercent (ex: 98).
18. historicalContext: Uma breve nota sobre o contexto histórico ou impacto cultural da obra.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              genre: { type: Type.STRING },
              subgenre: { type: Type.STRING },
              publishYear: { type: Type.STRING },
              publisher: { type: Type.STRING },
              edition: { type: Type.STRING },
              pageCount: { type: Type.INTEGER },
              isbn: { type: Type.STRING },
              translator: { type: Type.STRING },
              synopsis: { type: Type.STRING },
              synopsisSubtitle: { type: Type.STRING },
              curatorBadge: { type: Type.STRING },
              breadcrumbCategory: { type: Type.STRING },
              historicalContext: { type: Type.STRING },
              keyThemes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              notableQuote: {
                type: Type.OBJECT,
                properties: {
                  quote: { type: Type.STRING },
                  source: { type: Type.STRING },
                },
                required: ['quote', 'source'],
              },
              atmosphere: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    percent: { type: Type.INTEGER },
                    description: { type: Type.STRING },
                  },
                  required: ['label', 'percent', 'description'],
                },
              },
              editorialReviews: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    reviewerName: { type: Type.STRING },
                    avatarText: { type: Type.STRING },
                    rating: { type: Type.INTEGER },
                    reviewText: { type: Type.STRING },
                    timeAgo: { type: Type.STRING },
                    helpfulCount: { type: Type.INTEGER },
                  },
                  required: ['reviewerName', 'avatarText', 'rating', 'reviewText'],
                },
              },
              communityRating: {
                type: Type.OBJECT,
                properties: {
                  score: { type: Type.NUMBER },
                  totalRatings: { type: Type.INTEGER },
                  acclaimPercent: { type: Type.INTEGER },
                },
                required: ['score', 'totalRatings', 'acclaimPercent'],
              },
            },
            required: ['genre', 'synopsis', 'notableQuote', 'atmosphere', 'editorialReviews'],
          },
        },
      });

      const text = response.text?.trim() || '{}';
      const parsedDetails = JSON.parse(text);

      return res.json({
        success: true,
        details: parsedDetails,
      });
    } catch (err: any) {
      console.error('Erro ao enriquecer livro com Gemini:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Erro ao processar dados literários com IA',
      });
    }
  });

  /**
   * Endpoint de IA e acervos: Busca e recuperação de capas reais de livros
   * Pesquisa no Open Library e usa Gemini para encontrar o ISBN e capa verídica
   */
  app.post('/api/books/cover', async (req, res) => {
    try {
      const { title, author } = req.body;
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ success: false, error: 'Título é obrigatório' });
      }

      // Limpeza de título (remove extensões, tags de sites como [Z-Lib], (Edição x), etc.)
      const cleanTitle = title
        .replace(/\.(epub|pdf|mobi|azw3|azw|txt)$/i, '')
        .replace(/\[[^\]]*\]|\([^\)]*\)/g, ' ')
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const cleanAuthor = typeof author === 'string' 
        ? author.replace(/\[[^\]]*\]|\([^\)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
        : '';

      // Helper: Baixa imagem remota diretamente no servidor e converte para Data URL
      // Evita problemas de CORS, 302 redirects e tainted canvas no navegador
      async function downloadImageAsDataUrl(imgUrl: string): Promise<string | null> {
        try {
          const res = await fetch(imgUrl, { signal: AbortSignal.timeout(6000) });
          if (!res.ok) return null;
          const arrayBuffer = await res.arrayBuffer();
          // Ignora imagens vazias / placeholders 1x1 (Open Library retorna GIF de 43 bytes se não existir)
          if (arrayBuffer.byteLength < 1500) return null;
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          const mime = res.headers.get('content-type') || 'image/jpeg';
          return `data:${mime};base64,${base64}`;
        } catch {
          return null;
        }
      }

      // 1. Tenta consulta direta no Open Library
      try {
        const query = cleanAuthor && cleanAuthor.toLowerCase() !== 'autor desconhecido'
          ? `title=${encodeURIComponent(cleanTitle)}&author=${encodeURIComponent(cleanAuthor)}`
          : `q=${encodeURIComponent(cleanTitle)}`;
        
        const olRes = await fetch(`https://openlibrary.org/search.json?${query}&limit=5`, {
          signal: AbortSignal.timeout(4500),
        });

        if (olRes.ok) {
          const olData: any = await olRes.json();
          const docs = olData.docs || [];
          for (const doc of docs) {
            if (doc.cover_i) {
              const coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
              const dataUrl = await downloadImageAsDataUrl(coverUrl);
              if (dataUrl) {
                return res.json({
                  success: true,
                  source: 'openlibrary',
                  coverUrl: dataUrl,
                  title: doc.title || cleanTitle,
                  author: doc.author_name?.[0] || cleanAuthor,
                });
              }
            }
          }
        }
      } catch {
        // Continua para o Gemini
      }

      // 2. Se Gemini estiver disponível, deduz o ISBN ou título canônico exato
      if (ai) {
        try {
          const prompt = `Para o livro com título "${cleanTitle}" e autor "${cleanAuthor || 'Desconhecido'}", identifique o ISBN-13 verídico da obra e informações bibliográficas oficiais para localizar a capa do livro.
Responda APENAS em JSON no formato:
{
  "canonicalTitle": "Título oficial",
  "canonicalAuthor": "Autor oficial",
  "isbn13": "978...",
  "genre": "Gênero principal"
}`;

          const geminiResp = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
            },
          });

          const geminiText = geminiResp.text?.trim() || '{}';
          const info = JSON.parse(geminiText);

          if (info.isbn13) {
            const cleanIsbn = info.isbn13.replace(/[^0-9X]/gi, '');
            const isbnCoverUrl = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`;
            const dataUrl = await downloadImageAsDataUrl(isbnCoverUrl);
            if (dataUrl) {
              return res.json({
                success: true,
                source: 'gemini-isbn',
                coverUrl: dataUrl,
                isbn: cleanIsbn,
                canonicalTitle: info.canonicalTitle,
                canonicalAuthor: info.canonicalAuthor,
              });
            }
          }
        } catch (geminiErr) {
          console.warn('Erro ao consultar Gemini para capa:', geminiErr);
        }
      }

      return res.json({
        success: false,
        message: 'Nenhuma capa fotográfica encontrada nos acervos públicos',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * Endpoint de pesquisa de candidatos a capa
   * Retorna uma lista de edições reais com miniatura e imagem completa para o usuário escolher
   */
  app.post('/api/books/cover-search', async (req, res) => {
    try {
      const { query, title, author } = req.body;
      const rawSearch = (query || `${title || ''} ${author || ''}`).trim();
      if (!rawSearch) {
        return res.status(400).json({ success: false, error: 'Termo de busca é obrigatório' });
      }

      const cleanSearch = rawSearch
        .replace(/\.(epub|pdf|mobi|azw3|azw|txt)$/i, '')
        .replace(/\[[^\]]*\]|\([^\)]*\)/g, ' ')
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const candidates: Array<{
        id: string;
        title: string;
        author?: string;
        thumbnailUrl: string;
        fullUrl: string;
        year?: number;
      }> = [];

      // 1. Pesquisa no Open Library
      try {
        const olRes = await fetch(
          `https://openlibrary.org/search.json?q=${encodeURIComponent(cleanSearch)}&limit=12`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (olRes.ok) {
          const olData: any = await olRes.json();
          const docs = olData.docs || [];
          const seenCoverIds = new Set<number>();

          for (const doc of docs) {
            if (doc.cover_i && !seenCoverIds.has(doc.cover_i)) {
              seenCoverIds.add(doc.cover_i);
              candidates.push({
                id: `ol-${doc.cover_i}`,
                title: doc.title || cleanSearch,
                author: doc.author_name?.[0] || '',
                year: doc.first_publish_year,
                thumbnailUrl: `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`,
                fullUrl: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
              });
            }
          }
        }
      } catch (olErr) {
        console.warn('Erro ao pesquisar candidatos no Open Library:', olErr);
      }

      // 2. Se nenhum candidato foi encontrado no Open Library e Gemini está ativo, busca ISBN oficial
      if (candidates.length === 0 && ai) {
        try {
          const prompt = `Identifique 1 a 3 edições oficiais reais (com ISBN-13 verídicos) para a obra "${cleanSearch}".
Responda APENAS em JSON no formato:
{
  "editions": [
    {
      "title": "Título oficial",
      "author": "Autor oficial",
      "isbn13": "978...",
      "year": 1900
    }
  ]
}`;
          const geminiResp = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' },
          });

          const parsed = JSON.parse(geminiResp.text?.trim() || '{}');
          if (Array.isArray(parsed.editions)) {
            for (const ed of parsed.editions) {
              if (ed.isbn13) {
                const cleanIsbn = ed.isbn13.replace(/[^0-9X]/gi, '');
                candidates.push({
                  id: `isbn-${cleanIsbn}`,
                  title: ed.title || cleanSearch,
                  author: ed.author || '',
                  year: ed.year,
                  thumbnailUrl: `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-M.jpg`,
                  fullUrl: `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`,
                });
              }
            }
          }
        } catch (geminiErr) {
          console.warn('Erro ao consultar Gemini para edições de capa:', geminiErr);
        }
      }

      return res.json({
        success: true,
        candidates,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      hasGeminiApiKey: !!process.env.GEMINI_API_KEY,
    });
  });

  // Servir Vite em desenvolvimento com middlewares ou estáticos em produção
  if (!isProd) {
    process.env.DISABLE_HMR = 'true';
    
    // Suprime erro interno de WebSocket fechado em ambiente sem suporte a HMR
    try {
      const filesToPatch = [
        path.resolve(__dirname, 'node_modules/vite/dist/client/client.mjs'),
        path.resolve(__dirname, 'node_modules/vite/dist/client/bundledDevClient.mjs'),
        path.resolve(__dirname, 'node_modules/vite/dist/node/module-runner.js')
      ];
      for (const filePath of filesToPatch) {
        if (fs.existsSync(filePath)) {
          let content = fs.readFileSync(filePath, 'utf-8');
          const t1 = 'reject(/* @__PURE__ */ new Error("WebSocket closed without opened."));';
          const t2 = 'reject(/* @__PURE__ */ Error("WebSocket closed without opened."));';
          const rep = 'isOpened = true; resolve();';
          if (content.includes(t1) || content.includes(t2)) {
            content = content.replace(t1, rep).replace(t2, rep);
            fs.writeFileSync(filePath, content, 'utf-8');
          }
        }
      }
    } catch (_err) {}

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Rota de fallback para servir index.html processado pelo Vite
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        if (fs.existsSync(indexPath)) {
          let template = fs.readFileSync(indexPath, 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } else {
          next();
        }
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Lumina Books Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
