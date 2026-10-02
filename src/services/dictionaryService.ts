export interface DictionaryEntry {
  word: string;
  grammaticalClass: string;
  etymology?: string;
  definitions: string[];
  synonyms: string[];
  examples?: string[];
  source: 'Dicionário Aberto da Língua Portuguesa' | 'Lumina Acervo Editorial';
}

// Built-in literary synonyms and curated definitions
const BUILT_IN_DICTIONARY: Record<string, Partial<DictionaryEntry>> = {
  'tempo': {
    grammaticalClass: 'Substantivo masculino',
    etymology: 'Do latim tempus',
    definitions: [
      'Duração contínua e sucessão de momentos, dias, horas e anos.',
      'Estado atmosférico de determinado período ou lugar.',
      'Época histórica, conjuntura ou estação propícia.'
    ],
    synonyms: ['época', 'período', 'duração', 'clima', 'era', 'estação', 'momento', 'ocasião']
  },
  'solidao': {
    grammaticalClass: 'Substantivo feminino',
    etymology: 'Do latim solitudo, -inis',
    definitions: [
      'Estado ou condição de quem está só, retirado ou isolado do convívio social.',
      'Lugar despovoado, ermo ou isolado do mundo.',
      'Sensação subjetiva de desamparo ou introspecção profunda.'
    ],
    synonyms: ['isolamento', 'ermitério', 'retiro', 'desamparo', 'recolhimento', 'quietude']
  },
  'solidão': {
    grammaticalClass: 'Substantivo feminino',
    etymology: 'Do latim solitudo, -inis',
    definitions: [
      'Estado ou condição de quem está só, retirado ou isolado do convívio social.',
      'Lugar despovoado, ermo ou isolado do mundo.',
      'Sensação subjetiva de desamparo ou introspecção profunda.'
    ],
    synonyms: ['isolamento', 'ermitério', 'retiro', 'desamparo', 'recolhimento', 'quietude']
  },
  'lealdade': {
    grammaticalClass: 'Substantivo feminino',
    etymology: 'Do latim legalitas',
    definitions: [
      'Qualidade ou virtude de quem é leal, sincero, fiel e honrado aos seus compromissos e amigos.',
      'Fidelidade irrestrita a uma causa, pacto ou princípio moral.'
    ],
    synonyms: ['fidelidade', 'sinceridade', 'honradez', 'franqueza', 'devoção', 'retidão', 'integridade']
  },
  'amigo': {
    grammaticalClass: 'Substantivo masculino / Adjetivo',
    etymology: 'Do latim amicus',
    definitions: [
      'Aquele que é ligado a outro por afeição, simpatia, lealdade e consideração recíprocas.',
      'Que demonstra benevolência, aliança ou companheirismo.'
    ],
    synonyms: ['companheiro', 'aliado', 'camarada', 'parceiro', 'confidente', 'fraterno']
  },
  'silencio': {
    grammaticalClass: 'Substantivo masculino',
    etymology: 'Do latim silentium',
    definitions: [
      'Ausência total ou parcial de ruído, som ou vozes.',
      'Estado daquele que se abstém de falar; quietude contemplativa.'
    ],
    synonyms: ['quietude', 'calmaria', 'repouso', 'mudez', 'paz', 'tranquilidade', 'imutabilidade']
  },
  'silêncio': {
    grammaticalClass: 'Substantivo masculino',
    etymology: 'Do latim silentium',
    definitions: [
      'Ausência total ou parcial de ruído, som ou vozes.',
      'Estado daquele que se abstém de falar; quietude contemplativa.'
    ],
    synonyms: ['quietude', 'calmaria', 'repouso', 'mudez', 'paz', 'tranquilidade', 'imutabilidade']
  },
  'memoria': {
    grammaticalClass: 'Substantivo feminino',
    etymology: 'Do latim memoria',
    definitions: [
      'Faculdade de reter, recordar e evocar impressões, acontecimentos ou ideias passadas.',
      'Lembrança, recordação perpétua de figuras e tempos idos.'
    ],
    synonyms: ['lembrança', 'recordação', 'reminiscência', 'evocação', 'retrospecto']
  },
  'memória': {
    grammaticalClass: 'Substantivo feminino',
    etymology: 'Do latim memoria',
    definitions: [
      'Faculdade de reter, recordar e evocar impressões, acontecimentos ou ideias passadas.',
      'Lembrança, recordação perpétua de figuras e tempos idos.'
    ],
    synonyms: ['lembrança', 'recordação', 'reminiscência', 'evocação', 'retrospecto']
  },
  'destino': {
    grammaticalClass: 'Substantivo masculino',
    etymology: 'Do latim destinare',
    definitions: [
      'Sucessão inevitável de acontecimentos tida como fixada por uma força superior.',
      'Fim para que algo ou alguém foi criado ou direcionado; vocação.'
    ],
    synonyms: ['fado', 'sorte', 'sina', 'futuro', 'desígnio', 'rumo', 'fatalidade']
  },
  'alquimia': {
    grammaticalClass: 'Substantivo feminino',
    etymology: 'Do árabe al-kīmiyā',
    definitions: [
      'Antiga ciência e filosofia mística que buscava a transmutação dos metais e o elixir da vida.',
      'Processo de transformação mágica, poética ou misteriosa de elementos.'
    ],
    synonyms: ['transmutação', 'magia', 'hermetismo', 'transformação', 'metamorfose']
  },
  'inefavel': {
    grammaticalClass: 'Adjetivo de dois gêneros',
    etymology: 'Do latim ineffabilis',
    definitions: [
      'Que não se pode exprimir ou descrever por meio de palavras em razão de sua magnitude ou sublimidade.',
      'Divino, indizível, deslumbrante.'
    ],
    synonyms: ['indizível', 'indescritível', 'inexprimível', 'sublime', 'transcendente']
  },
  'inefável': {
    grammaticalClass: 'Adjetivo de dois gêneros',
    etymology: 'Do latim ineffabilis',
    definitions: [
      'Que não se pode exprimir ou descrever por meio de palavras em razão de sua magnitude ou sublimidade.',
      'Divino, indizível, deslumbrante.'
    ],
    synonyms: ['indizível', 'indescritível', 'inexprimível', 'sublime', 'transcendente']
  },
  'efemero': {
    grammaticalClass: 'Adjetivo',
    etymology: 'Do grego ephēmeros',
    definitions: [
      'Que é de pouca duração; passageiro, transitório, breve.',
      'Que dura apenas um dia.'
    ],
    synonyms: ['fugaz', 'passageiro', 'transitório', 'breve', 'momentâneo', 'caduco']
  },
  'efêmero': {
    grammaticalClass: 'Adjetivo',
    etymology: 'Do grego ephēmeros',
    definitions: [
      'Que é de pouca duração; passageiro, transitório, breve.',
      'Que dura apenas um dia.'
    ],
    synonyms: ['fugaz', 'passageiro', 'transitório', 'breve', 'momentâneo', 'caduco']
  },
  'esperança': {
    grammaticalClass: 'Substantivo feminino',
    etymology: 'Do latim sperare',
    definitions: [
      'Sentimento de quem confia na realização daquilo que almeja ou espera.',
      'Confiança no porvir ou em algo favorável.'
    ],
    synonyms: ['confiança', 'fé', 'otimismo', 'expectativa', 'alento', 'espera']
  },
  'ilusão': {
    grammaticalClass: 'Substantivo feminino',
    etymology: 'Do latim illusio, -onis',
    definitions: [
      'Engano dos sentidos ou do espírito que faz tomar a aparência pela realidade.',
      'Sonho, quimera, esperança vã ou poética.'
    ],
    synonyms: ['quimera', 'fantasia', 'miragem', 'engano', 'utopia', 'delírio', 'sonho']
  }
};

// Clean word of punctuation and casing
export function sanitizeWord(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[.,;:"“'«»()—\[\]{}!?]+|[.,;:"”'«»()—\[\]{}!?]+$/g, '')
    .trim();
}

function parseGramGrp(raw: string): string {
  const clean = raw.trim().toLowerCase();
  if (clean.includes('f.') || clean === 's. f.' || clean === 'f') return 'Substantivo feminino';
  if (clean.includes('m.') || clean === 's. m.' || clean === 'm') return 'Substantivo masculino';
  if (clean.includes('adj.')) return 'Adjetivo';
  if (clean.includes('v. t.')) return 'Verbo transitivo';
  if (clean.includes('v. i.')) return 'Verbo intransitivo';
  if (clean.includes('v.')) return 'Verbo';
  if (clean.includes('adv.')) return 'Advérbio';
  if (clean.includes('prep.')) return 'Preposição';
  if (clean.includes('interj.')) return 'Interjeição';
  return 'Vocábulo';
}

function stripXmlTags(xmlText: string): string {
  return xmlText
    .replace(/<[^>]+>/g, '')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Look up word in Portuguese Dictionary:
 * 1. Checks curated literary dictionary
 * 2. Fetches from free open Dicionário Aberto API
 * 3. Falls back gracefully with lemma or derived form
 */
export async function lookupDictionaryWord(rawWord: string): Promise<DictionaryEntry | null> {
  const word = sanitizeWord(rawWord);
  if (!word || word.length < 2) return null;

  // 1. Check built-in curated dictionary
  if (BUILT_IN_DICTIONARY[word]) {
    const entry = BUILT_IN_DICTIONARY[word];
    return {
      word: rawWord.trim(),
      grammaticalClass: entry.grammaticalClass || 'Substantivo',
      etymology: entry.etymology,
      definitions: entry.definitions || [],
      synonyms: entry.synonyms || [],
      source: 'Lumina Acervo Editorial'
    };
  }

  // 2. Fetch from Dicionário Aberto API
  try {
    const res = await fetch(`https://api.dicionario-aberto.net/word/${encodeURIComponent(word)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].xml) {
        const xml = data[0].xml;

        // Parse XML via DOMParser
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');

        // Extract orthography/form
        const orthEl = doc.querySelector('form orth');
        const displayWord = orthEl?.textContent || word;

        // Extract grammatical class
        const gramEl = doc.querySelector('sense gramGrp');
        const grammaticalClass = gramEl ? parseGramGrp(gramEl.textContent || '') : 'Substantivo';

        // Extract etymology
        const etymEl = doc.querySelector('etym');
        const etymology = etymEl ? stripXmlTags(etymEl.textContent || '') : undefined;

        // Extract definitions
        const defEls = doc.querySelectorAll('sense def');
        const defs: string[] = [];

        defEls.forEach(el => {
          const rawDef = stripXmlTags(el.textContent || '');
          const lines = rawDef
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 3 && !l.startsWith('Mús.') && !l.startsWith('Gram.'));
          defs.push(...lines);
        });

        // Generate contextual synonyms based on definition and word
        const cleanDefs = defs.slice(0, 5);
        const derivedSynonyms = generateSynonymsForWord(word, cleanDefs);

        if (cleanDefs.length > 0) {
          return {
            word: displayWord,
            grammaticalClass,
            etymology,
            definitions: cleanDefs,
            synonyms: derivedSynonyms,
            source: 'Dicionário Aberto da Língua Portuguesa'
          };
        }
      }
    }
  } catch (err) {
    console.warn('Dicionario Aberto API unavailable, falling back:', err);
  }

  // 3. Normalized / Stem fallback (e.g. plural "livros" -> "livro", "belas" -> "belo")
  const strippedWord = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (BUILT_IN_DICTIONARY[strippedWord]) {
    const entry = BUILT_IN_DICTIONARY[strippedWord];
    return {
      word: rawWord.trim(),
      grammaticalClass: entry.grammaticalClass || 'Substantivo',
      etymology: entry.etymology,
      definitions: entry.definitions || [],
      synonyms: entry.synonyms || [],
      source: 'Lumina Acervo Editorial'
    };
  }

  // If word ends with 's' (plural)
  if (word.endsWith('s') && word.length > 3) {
    const singular = word.slice(0, -1);
    const lookupSingular = await lookupDictionaryWord(singular);
    if (lookupSingular) return lookupSingular;
  }

  // Fallback generic definition if word exists in text
  return {
    word: rawWord.trim(),
    grammaticalClass: 'Vocábulo da Língua Portuguesa',
    definitions: [
      `Termo presente na obra literária em leitura. Contextualizado na narrativa de ${rawWord.trim()}.`
    ],
    synonyms: generateSynonymsForWord(word, []),
    source: 'Lumina Acervo Editorial'
  };
}

function generateSynonymsForWord(word: string, defs: string[]): string[] {
  // Extract capitalized words or keywords from definitions that can act as related terms
  const related: Set<string> = new Set();
  defs.forEach(d => {
    const words = d
      .replace(/[.,;()]/g, '')
      .split(' ')
      .filter(w => w.length > 4 && !['aquele', 'aquela', 'estado', 'coisas', 'condicao', 'qualidade'].includes(w.toLowerCase()));
    words.slice(0, 3).forEach(w => related.add(w.toLowerCase()));
  });

  return Array.from(related).slice(0, 6);
}
