import type { RagCitation } from '../src/types.ts';
import { getGeminiClient } from './geminiClient.ts';

interface KnowledgeChunk {
  id: string;
  title: string;
  source: string;
  category: 'regulatory' | 'health_guidance' | 'indoor_air' | 'mobility' | 'meteorology' | 'community';
  standard: string;
  year: number;
  content: string;
}

const ENVIRONMENTAL_KNOWLEDGE_BASE: KnowledgeChunk[] = [
  {
    id: 'cpcb-naqi-01',
    title: 'CPCB Indian National Air Quality Index (NAQI) Bands & Thresholds',
    source: 'Central Pollution Control Board (CPCB), Ministry of Environment, India',
    category: 'regulatory',
    standard: 'CPCB NAQI',
    year: 2014,
    content:
      'India CPCB NAQI classifies ambient air into six bands based on 8 pollutants (PM2.5, PM10, NO2, SO2, CO, O3, NH3, Pb): Good (0–50, PM2.5 0–30 µg/m³), Satisfactory (51–100, PM2.5 31–60 µg/m³), Moderate (101–200, PM2.5 61–90 µg/m³), Poor (201–300, PM2.5 91–120 µg/m³), Very Poor (301–400, PM2.5 121–250 µg/m³), and Severe (401–500, PM2.5 >250 µg/m³). The overall NAQI equals the highest sub-index among measured pollutants.',
  },
  {
    id: 'who-aqg-2021',
    title: 'WHO 2021 Global Air Quality Guidelines',
    source: 'World Health Organization (WHO) Global Air Quality Guidelines',
    category: 'regulatory',
    standard: 'WHO AQG 2021',
    year: 2021,
    content:
      'WHO 2021 recommended air quality guideline levels are PM2.5: 5 µg/m³ annual mean and 15 µg/m³ 24-hour mean; PM10: 15 µg/m³ annual and 45 µg/m³ 24-hour mean; NO2: 10 µg/m³ annual and 25 µg/m³ 24-hour mean; O3: 100 µg/m³ 8-hour daily maximum; SO2: 40 µg/m³ 24-hour mean; CO: 4 mg/m³ 24-hour mean. Even concentrations below national compliance thresholds carry cumulative exposure effects over prolonged outdoor exertion.',
  },
  {
    id: 'indoor-hepa-cadr',
    title: 'Indoor Air Filtration: HEPA CADR & Air Changes per Hour (ACH)',
    source: 'US EPA Guide to Air Cleaners in the Home & ASHRAE 62.2 Guidance',
    category: 'indoor_air',
    standard: 'US EPA / ASHRAE',
    year: 2023,
    content:
      'To size a portable HEPA air purifier for a room, compute room volume (Area in m² × Ceiling Height in m). Target 4 to 5 Air Changes per Hour (ACH) during high outdoor PM2.5 episodes. Required Clean Air Delivery Rate (CADR in m³/h) = Room Volume (m³) × Target ACH. True HEPA (H13) captures at least 99.95% of 0.3 µm particles. Avoid ozone-generating ionizers. Run purifiers continuously on medium-quiet speed in bedrooms overnight with doors closed.',
  },
  {
    id: 'indoor-cooking-ventilation',
    title: 'Reducing Kitchen Particulate Matter, NO2 & Indoor Dust',
    source: 'US EPA Indoor Air Quality & Clean Cooking Guidelines',
    category: 'indoor_air',
    standard: 'US EPA IAQ',
    year: 2023,
    content:
      'High-heat cooking, frying, and gas stoves can briefly elevate indoor PM2.5 above 200 µg/m³ and generate NO2. Always activate a ducted chimney/exhaust hood 5 minutes before cooking and keep it running 15 minutes afterward. Use lids on simmering pots, prefer induction or electric kettles when feasible, damp-mop floors instead of dry sweeping to prevent resuspending PM10 dust, and time natural cross-ventilation strictly to the lowest outdoor AQI afternoon window (typically 13:00–16:00 when boundary-layer mixing peaks).',
  },
  {
    id: 'family-exposure-guidance',
    title: 'Age-Group Activity Planning & Exposure Reduction (Non-Medical)',
    source: 'WHO Public Advice & CPCB Graded Response Action Plan (GRAP)',
    category: 'health_guidance',
    standard: 'CPCB GRAP / WHO',
    year: 2024,
    content:
      'Children breathe faster relative to body weight during active outdoor play, and older adults may prefer lower-intensity exertion during elevated particulate periods. When CPCB NAQI exceeds 200 (Poor), move vigorous play and jogging indoors or reschedule to the cleanest 2-hour window. When NAQI exceeds 300 (Very Poor), minimize prolonged outdoor exposure for children and older adults, use well-fitted N95/KN95/FFP2 masks for essential outdoor commutes, and consult qualified healthcare professionals for any personal health symptoms.',
  },
  {
    id: 'mobility-emission-factors',
    title: 'Urban Transport CO2 Emission Factors & Commuter Exposure Tradeoffs',
    source: 'India GHG Program (WRI/TERI) & IPCC Transport Emission Factors',
    category: 'mobility',
    standard: 'India GHG / IPCC',
    year: 2022,
    content:
      'Average per-passenger CO2 emission factors: Petrol passenger car (solo) ~192 g/km; Carpool (3 riders) ~64 g/km; Electric car (India grid mix) ~68 g/km; Electric bus ~28 g/km; Urban Metro/Rail ~32 g/km; Cycling and Walking ~0 g/km tailpipe. In-cabin air-conditioned metro trains with filtration typically yield 35–50% lower PM2.5 inhalation dose than open roadside walking or cycling next to heavy congestion during Poor AQI episodes, while cycling on separated green corridors during Good/Satisfactory AQI delivers both zero emissions and low exposure.',
  },
  {
    id: 'winter-smog-inversion',
    title: 'Nocturnal Thermal Inversions & Winter Smog Accumulation',
    source: 'IMD / SAFAR Urban Air Meteorology Research',
    category: 'meteorology',
    standard: 'SAFAR / WMO',
    year: 2023,
    content:
      'During cool seasons, rapid nighttime ground cooling creates a shallow planetary boundary layer (thermal inversion) trapping vehicular exhaust, domestic heating, and biomass smoke close to the surface. When wind speeds drop below 7 km/h and relative humidity rises above 70%, PM2.5 concentrations typically spike between 21:00 and 08:30 and disperse after midday solar heating lifts the mixing layer between 12:00 and 16:00.',
  },
  {
    id: 'community-clean-air',
    title: 'Community Pollution Incident Verification & Urban Dust Mitigation',
    source: 'CPCB Dust Mitigation Guidelines & Urban Local Body Clean-Air Playbooks',
    category: 'community',
    standard: 'CPCB Dust Guidelines',
    year: 2023,
    content:
      'Recurring local pollution spikes frequently stem from uncovered construction material transport, dry mechanized sweeping without water sprinkling, open municipal waste burning, and idling diesel generators. Citizen reports with approximate neighborhood coordinates, time of observation, and visual documentation help municipal bodies target mechanized wet sweeping, green-net shielding, and waste collection enforcement without exposing reporters’ personal home addresses.',
  },
];

let chunkEmbeddings: Map<string, number[]> = new Map();
let embeddingsInitialized = false;

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? dot / denom : 0;
}

function lexicalScore(query: string, chunk: KnowledgeChunk): number {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  if (tokens.length === 0) return 0;
  const corpus = `${chunk.title} ${chunk.category} ${chunk.standard} ${chunk.content}`.toLowerCase();
  let hits = 0;
  for (const t of tokens) {
    if (corpus.includes(t)) hits += 1;
  }
  return Number(Math.min(0.95, 0.25 + (hits / tokens.length) * 0.7).toFixed(3));
}

async function ensureEmbeddings(): Promise<boolean> {
  if (embeddingsInitialized && chunkEmbeddings.size > 0) return true;
  const ai = getGeminiClient();
  if (!ai) return false;
  try {
    const texts = ENVIRONMENTAL_KNOWLEDGE_BASE.map((c) => `${c.title}. ${c.content}`);
    const res = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: texts,
    });
    const list = res.embeddings || [];
    for (let i = 0; i < Math.min(list.length, ENVIRONMENTAL_KNOWLEDGE_BASE.length); i++) {
      const vals = list[i]?.values;
      if (Array.isArray(vals) && vals.length > 0) {
        chunkEmbeddings.set(ENVIRONMENTAL_KNOWLEDGE_BASE[i].id, vals);
      }
    }
    embeddingsInitialized = chunkEmbeddings.size > 0;
    return embeddingsInitialized;
  } catch (err) {
    console.warn('[AIRWISE RAG] Embedding initialization fallback to lexical scoring:', (err as Error)?.message);
    return false;
  }
}

export async function retrieveEnvironmentalKnowledge(
  query: string,
  options?: { topK?: number; categoryFilter?: KnowledgeChunk['category']; minScore?: number },
): Promise<{ citations: RagCitation[]; method: 'gemini_embedding_2' | 'lexical_fallback' }> {
  const topK = options?.topK ?? 3;
  const minScore = options?.minScore ?? 0.38;
  const pool = options?.categoryFilter
    ? ENVIRONMENTAL_KNOWLEDGE_BASE.filter((c) => c.category === options.categoryFilter)
    : ENVIRONMENTAL_KNOWLEDGE_BASE;

  const ai = getGeminiClient();
  if (ai && (await ensureEmbeddings())) {
    try {
      const qRes = await ai.models.embedContent({
        model: 'gemini-embedding-2',
        contents: query,
      });
      const qVec = qRes.embeddings?.[0]?.values;
      if (Array.isArray(qVec) && qVec.length > 0) {
        const ranked = pool
          .map((chunk) => {
            const cVec = chunkEmbeddings.get(chunk.id);
            const sim = cVec ? cosineSimilarity(qVec, cVec) : 0;
            return { chunk, sim };
          })
          .filter((item) => item.sim >= minScore)
          .sort((a, b) => b.sim - a.sim)
          .slice(0, topK);

        if (ranked.length > 0) {
          return {
            method: 'gemini_embedding_2',
            citations: ranked.map(({ chunk, sim }) => ({
              id: chunk.id,
              title: chunk.title,
              source: `${chunk.source} (${chunk.year})`,
              category: chunk.category,
              similarity: Number(sim.toFixed(3)),
              excerpt: chunk.content,
            })),
          };
        }
      }
    } catch (err) {
      console.warn('[AIRWISE RAG] Query embedding fallback:', (err as Error)?.message);
    }
  }

  // Lexical fallback when embeddings are unavailable
  const lexical = pool
    .map((chunk) => ({ chunk, sim: lexicalScore(query, chunk) }))
    .filter((item) => item.sim >= 0.32)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, topK);

  return {
    method: 'lexical_fallback',
    citations: lexical.map(({ chunk, sim }) => ({
      id: chunk.id,
      title: chunk.title,
      source: `${chunk.source} (${chunk.year})`,
      category: chunk.category,
      similarity: sim,
      excerpt: chunk.content,
    })),
  };
}

export function listKnowledgeDocuments() {
  return ENVIRONMENTAL_KNOWLEDGE_BASE.map((c) => ({
    id: c.id,
    title: c.title,
    source: c.source,
    category: c.category,
    standard: c.standard,
    year: c.year,
  }));
}
