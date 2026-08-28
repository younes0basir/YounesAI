/**
 * Document Processor — Full understanding pipeline
 *
 * Pipeline:
 *   Read file → Extract text → Chunk → Extract entities (people, orgs, dates, locations, action items)
 *   → Generate embedding → Store in document_embeddings → Register in knowledge graph
 *
 * Supports: PDF, DOCX, TXT, CSV
 * Inspired by NVIDIA NeMo Retriever document ingestion patterns.
 */
const path = require('path');
const pool = require('../db');
const fallbackManager = require('../agents/fallbackManager');
const { createDocumentNode } = require('../knowledge/graphBuilder');

const ENTITY_EXTRACTION_PROMPT = `Extract structured information from this document excerpt.
Return ONLY valid JSON with no markdown:
{
  "people": ["name1", "name2"],
  "organizations": ["org1", "org2"],
  "dates": ["date1", "date2"],
  "locations": ["location1", "location2"],
  "actionItems": ["action1", "action2"],
  "summary": "1-2 sentence summary of the content"
}
Rules:
- Return empty arrays if no entities of that type found
- Keep summary concise
- Extract only explicit mentions, no inferences`;

/**
 * Extract text content from a file using the existing fileReader.
 * Returns the raw text or null if unsupported.
 */
async function extractText(filePath) {
  try {
    const fileReader = require('./fileReader');
    const result = await fileReader.readFile(filePath);
    return result.success ? result.content : null;
  } catch (err) {
    console.error('[documentProcessor] extractText error:', err.message);
    return null;
  }
}

/**
 * Chunk text into overlapping segments for better retrieval coverage.
 * @param {string} text
 * @param {number} chunkSize — characters per chunk
 * @param {number} overlap   — character overlap between chunks
 */
function chunkText(text, chunkSize = 1500, overlap = 200) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
    if (i + overlap >= text.length) break;
  }
  // Always include the last segment
  if (i < text.length) chunks.push(text.slice(i));
  return chunks.filter((c) => c.trim().length > 50);
}

/**
 * Extract entities and summary from a text excerpt using LLM.
 * @param {string} textExcerpt — first 3000 chars of the document
 * @returns {Promise<object>}
 */
async function extractEntities(textExcerpt) {
  try {
    const result = await fallbackManager.generateText(
      'general',
      [
        { role: 'system', content: ENTITY_EXTRACTION_PROMPT },
        { role: 'user', content: textExcerpt.slice(0, 3000) },
      ],
      { temperature: 0.1, maxTokens: 600 }
    );

    if (!result.success)
      return {
        people: [],
        organizations: [],
        dates: [],
        locations: [],
        actionItems: [],
        summary: '',
      };

    const m = result.content.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch (err) {
    console.error('[documentProcessor] extractEntities error:', err.message);
  }
  return { people: [], organizations: [], dates: [], locations: [], actionItems: [], summary: '' };
}

/**
 * Generate and store embeddings for a single text chunk.
 * @returns {Promise<string|null>} — inserted document_embeddings.id or null
 */
async function storeChunk({
  userId,
  filePath,
  chunk,
  chunkIndex,
  chunkTotal,
  entities,
  summary,
  fileType,
  wordCount,
}) {
  try {
    // Generate embedding
    const embResult = await fallbackManager.generateEmbedding(chunk);
    const embeddingVector = embResult.success ? embResult.embedding : null;
    const embeddingJson = embeddingVector ? JSON.stringify(embeddingVector) : null;
    const embeddingLiteral = embeddingVector ? `[${embeddingVector.join(',')}]` : null;

    const res = await pool.query(
      `INSERT INTO document_embeddings
         (user_id, file_path, content, embedding, embedding_json, entities, summary, file_type,
          word_count, chunk_index, chunk_total, created_at)
       VALUES ($1,$2,$3,$4::vector,$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        userId,
        filePath,
        chunk,
        embeddingLiteral,
        embeddingJson,
        JSON.stringify(entities),
        summary,
        fileType,
        wordCount,
        chunkIndex,
        chunkTotal,
      ]
    );
    return res.rows[0]?.id || null;
  } catch (err) {
    console.error('[documentProcessor] storeChunk error:', err.message);
    return null;
  }
}

/**
 * Full document processing pipeline.
 *
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.filePath — absolute path to the file
 * @returns {Promise<{ success: boolean, chunks: number, entities: object, docIds: string[] }>}
 */
async function processDocument({ userId, filePath }) {
  console.log(`[documentProcessor] Processing: ${filePath}`);

  // Step 1: Extract text
  const text = await extractText(filePath);
  if (!text || text.trim().length < 10) {
    return { success: false, reason: 'Could not extract text or file is empty' };
  }

  // Step 2: Extract entities (from first 3000 chars only for efficiency)
  const entities = await extractEntities(text);
  const fileType = path.extname(filePath).toLowerCase().slice(1);
  const wordCount = text.split(/\s+/).length;

  // Step 3: Chunk the text
  const chunks = chunkText(text);

  // Step 4: Store chunks with embeddings
  const docIds = [];
  for (let i = 0; i < chunks.length; i++) {
    const docId = await storeChunk({
      userId,
      filePath,
      chunk: chunks[i],
      chunkIndex: i,
      chunkTotal: chunks.length,
      entities:
        i === 0
          ? entities
          : { people: [], organizations: [], dates: [], locations: [], actionItems: [] },
      summary: i === 0 ? entities.summary : null,
      fileType,
      wordCount,
    });
    if (docId) docIds.push(docId);
  }

  // Step 5: Register in knowledge graph (use first chunk's ID as the document node)
  if (docIds.length > 0) {
    await createDocumentNode({
      userId,
      documentId: docIds[0],
      filePath,
      entities,
    });
  }

  console.log(
    `[documentProcessor] Done: ${filePath} → ${chunks.length} chunks, ${docIds.length} stored`
  );
  return {
    success: true,
    chunks: chunks.length,
    stored: docIds.length,
    entities,
    docIds,
  };
}

module.exports = { processDocument, extractEntities, chunkText, extractText };
