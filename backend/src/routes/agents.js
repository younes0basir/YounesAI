const express = require('express');
const multer = require('multer');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();
const agentCoordinator = require('../agents');
const voiceAgent = require('../agents/voiceAgent');
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { agentLimiter } = require('../middleware/rateLimiter');
const {
  enforceQuota,
  requirePlan,
  requirePremiumAgents,
  incrementUsageAfterSuccess,
} = require('../middleware/plan');
const { buildContext } = require('../agents/context');
const ConversationContext = require('../conversation/ConversationContext');
const {
  getAgentMetrics,
  getAgentSummary,
  getAgentBenchmarkMetrics,
  getAgentPerformanceTrends,
} = require('../agents/metricsLogger');

// Uploads go to the OS temp dir so file routes work on Vercel serverless too.
const upload = multer({ dest: os.tmpdir() });
const uploadVoice = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB audio cap
  fileFilter: (req, file, cb) => {
    const allowed = /audio\/(mp3|mp4|mpeg|mpga|wav|webm|m4a|ogg|flac)/.test(file.mimetype);
    cb(allowed ? null : new Error('Only audio files are allowed'), allowed);
  },
});

router.post('/chat', authMiddleware, agentLimiter, enforceQuota('ai_chat'), async (req, res) => {
  try {
    const context = await buildContext(req);
    const { message, sessionId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const sid = sessionId || crypto.randomUUID();
    context.sessionId = sid;
    context.conversationSession = await ConversationContext.load(context.userId, sid);

    const recent = await pool.query(
      `SELECT role, content FROM conversations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [context.userId]
    );
    context.recentMessages = recent.rows
      .reverse()
      .map((r) => ({ role: r.role, content: r.content }));

    await pool.query(
      `INSERT INTO conversations (user_id, role, content, created_at) VALUES ($1, 'user', $2, NOW())`,
      [context.userId, message]
    );

    const result = await agentCoordinator.processRequest(message, context);

    const responseText = result.response || result.message || '';
    const entitiesJson = result.entities ? JSON.stringify(result.entities) : null;

    await pool.query(
      `INSERT INTO conversations (user_id, role, content, intent, entities, created_at) VALUES ($1, 'assistant', $2, $3, $4, NOW())`,
      [context.userId, responseText, result.agents?.join(',') || 'general', entitiesJson]
    );

    await incrementUsageAfterSuccess(req, 'ai_chat');
    res.json({ ...result, sessionId: sid });
  } catch (error) {
    console.error('❌ Chat endpoint error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const context = await buildContext(req);
    const { archived } = req.query;
    let query = `SELECT id, role, content, intent, entities, created_at FROM conversations WHERE user_id = $1`;
    const params = [context.userId];

    if (archived === 'true') {
      query += ' AND archived = TRUE';
    } else if (archived === 'false') {
      query += ' AND (archived = FALSE OR archived IS NULL)';
    }

    query += ' ORDER BY created_at DESC LIMIT 100';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/conversations', authMiddleware, async (req, res) => {
  try {
    const context = await buildContext(req);
    const result = await pool.query(`DELETE FROM conversations WHERE user_id = $1`, [
      context.userId,
    ]);
    res.json({ success: true, deleted: result.rowCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/conversations/:id', authMiddleware, async (req, res) => {
  try {
    const context = await buildContext(req);
    const result = await pool.query(`DELETE FROM conversations WHERE id = $1 AND user_id = $2`, [
      req.params.id,
      context.userId,
    ]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    res.json({ success: true, deleted: result.rowCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/conversations/:id/archive', authMiddleware, async (req, res) => {
  try {
    const context = await buildContext(req);
    const { archived } = req.body;
    const result = await pool.query(
      `UPDATE conversations SET archived = $1 WHERE id = $2 AND user_id = $3`,
      [archived, req.params.id, context.userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    res.json({ success: true, updated: result.rowCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/task', authMiddleware, async (req, res) => {
  try {
    const context = await buildContext(req);
    if (!req.body.message)
      return res.status(400).json({ success: false, error: 'Message is required' });
    context.message = req.body.message;
    const result = await agentCoordinator.callAgent('task', 'run', context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/event', authMiddleware, async (req, res) => {
  try {
    const context = await buildContext(req);
    if (!req.body.message)
      return res.status(400).json({ success: false, error: 'Message is required' });
    context.message = req.body.message;
    const result = await agentCoordinator.callAgent('event', 'run', context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/place', authMiddleware, async (req, res) => {
  try {
    const context = await buildContext(req);
    const { message, latitude, longitude, source } = req.body;
    if (!message && (latitude == null || longitude == null)) {
      return res.status(400).json({
        success: false,
        error: 'Message or coordinates required',
      });
    }
    context.message =
      message || `User location update at ${latitude}, ${longitude}${source ? ` (${source})` : ''}`;
    if (latitude != null && longitude != null) {
      context.parameters = { ...(context.parameters || {}), latitude, longitude, source };
    }
    const result = await agentCoordinator.callAgent('place', 'run', context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/file', authMiddleware, async (req, res) => {
  try {
    const context = await buildContext(req);
    if (!req.body.message)
      return res.status(400).json({ success: false, error: 'Message is required' });
    context.message = req.body.message;
    const result = await agentCoordinator.callAgent('file', 'run', context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/gemma', authMiddleware, requirePremiumAgents, async (req, res) => {
  try {
    const context = await buildContext(req);
    if (!req.body.message)
      return res.status(400).json({ success: false, error: 'Message is required' });
    context.message = req.body.message;
    const result = await agentCoordinator.callAgent('gemma', 'run', context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/memory/store', authMiddleware, async (req, res) => {
  try {
    const context = await buildContext(req);
    const { text, metadata } = req.body;
    if (!text) return res.status(400).json({ success: false, error: 'Text is required' });
    const tools = require('../tools');
    const result = await tools.storeMemory(context, text, metadata || {});
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/memory/search', authMiddleware, async (req, res) => {
  try {
    const context = await buildContext(req);
    const { query, topK } = req.body;
    if (!query) return res.status(400).json({ success: false, error: 'Query is required' });
    const tools = require('../tools');
    const result = await tools.retrieveMemory(context, query, topK || 5);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/status', authMiddleware, async (req, res) => {
  try {
    const status = agentCoordinator.getStatus();
    let metrics = [];
    const hours = req.query.hours ? parseInt(req.query.hours, 10) : 24;
    try {
      metrics = await getAgentMetrics(100, { hours, userId: req.user.id });
    } catch {}
    res.json({ success: true, status, metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metrics', authMiddleware, async (req, res) => {
  try {
    const metrics = await getAgentMetrics(100);
    res.json({ success: true, metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metrics/summary', authMiddleware, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours || '24', 10);
    const summary = await getAgentSummary(Math.min(hours, 168), req.user.id); // max 7 days
    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metrics/benchmark', authMiddleware, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours || '24', 10);
    const benchmark = await getAgentBenchmarkMetrics(Math.min(hours, 168), req.user.id);
    res.json({ success: true, benchmark });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metrics/trends', authMiddleware, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours || '168', 10);
    const trends = await getAgentPerformanceTrends(Math.min(hours, 720));
    res.json({ success: true, trends });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/memory/clear', authMiddleware, async (req, res) => {
  try {
    const context = await buildContext(req);
    const pool = require('../db');
    const result = await pool.query(`DELETE FROM memory_embeddings WHERE user_id = $1`, [
      context.userId,
    ]);
    res.json({ success: true, deleted: result.rowCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/voice/transcribe', authMiddleware, uploadVoice.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Audio file is required' });
    const ext = path.extname(req.file.originalname) || '.m4a';
    const typedPath = req.file.path + ext;
    fs.renameSync(req.file.path, typedPath);
    const result = await voiceAgent.transcribe(typedPath, req.body);
    fs.unlink(typedPath, () => {});
    if (!result.success) return res.status(500).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post(
  '/voice/process',
  authMiddleware,
  requirePlan(['pro', 'platinum']),
  agentLimiter,
  enforceQuota('voice'),
  uploadVoice.single('audio'),
  async (req, res) => {
    try {
      if (!req.file)
        return res.status(400).json({ success: false, error: 'Audio file is required' });

      const ext = path.extname(req.file.originalname) || '.m4a';
      const typedPath = req.file.path + ext;
      try {
        fs.renameSync(req.file.path, typedPath);
      } catch {
        // already renamed or missing
      }

      const transcription = await voiceAgent.transcribe(typedPath, req.body);
      fs.unlink(typedPath, () => {});
      if (!transcription.success) return res.status(500).json(transcription);

      // Build full orchestrator context with session + conversation memory parity to /chat
      const context = await buildContext(req);
      const sid = req.body.sessionId || req.query.sessionId || crypto.randomUUID();
      context.sessionId = sid;
      context.conversationSession = await ConversationContext.load(context.userId, sid);

      const recent = await pool.query(
        `SELECT role, content FROM conversations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
        [context.userId]
      );
      context.recentMessages = recent.rows
        .reverse()
        .map((r) => ({ role: r.role, content: r.content }));

      // Persist user turn as transcribed audio
      await pool.query(
        `INSERT INTO conversations (user_id, role, content, created_at) VALUES ($1, 'user', $2, NOW())`,
        [context.userId, transcription.text]
      );

      const result = await agentCoordinator.processRequest(transcription.text, context);

      const responseText = result.response || result.message || '';
      const entitiesJson = result.entities ? JSON.stringify(result.entities) : null;
      await pool.query(
        `INSERT INTO conversations (user_id, role, content, intent, entities, created_at) VALUES ($1, 'assistant', $2, $3, $4, NOW())`,
        [context.userId, responseText, result.agents?.join(',') || 'general', entitiesJson]
      );

      await incrementUsageAfterSuccess(req, 'voice');
      // Flatten to same shape as /chat so mobile can handle voice == text identically, plus transcription
      res.json({ ...result, transcription: transcription.text, sessionId: sid });
    } catch (error) {
      console.error('❌ Voice process error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

module.exports = router;
