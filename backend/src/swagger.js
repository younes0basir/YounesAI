const express = require('express');
const router = express.Router();
const swaggerUi = require('swagger-ui-express');

// Resources exposed by the CRUD router
const resources = [
  'users','devices','tasks','places','calendar_events','reminders','geofences','files','agent_actions','conversations','ai_memories'
];

function makeOpenApi(req) {
  const host = req.get('host');
  const scheme = req.protocol;
  const paths = {};

  for (const r of resources) {
    const base = `/api/${r}`;
    paths[base] = {
      get: {
        summary: `List ${r}`,
        responses: { '200': { description: 'OK' } }
      },
      post: {
        summary: `Create ${r}`,
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Created' } }
      }
    };

    paths[`${base}/{id}`] = {
      get: {
        summary: `Get ${r} by id`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } }
      },
      put: {
        summary: `Update ${r} by id`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '200': { description: 'Updated' }, '404': { description: 'Not found' } }
      },
      delete: {
        summary: `Delete ${r} by id`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Deleted' }, '404': { description: 'Not found' } }
      }
    };
  }

  return {
    openapi: '3.0.1',
    info: { title: 'Personal Assistant API', version: '1.0.0', description: 'Auto-generated CRUD endpoints for DB resources' },
    servers: [{ url: `${scheme}://${host}` }],
    paths
  };
}

// Serve Swagger UI (serve static assets then setup with dynamic spec)
router.use('/', swaggerUi.serve, (req, res, next) => {
  try {
    const spec = makeOpenApi(req);
    return swaggerUi.setup(spec)(req, res, next);
  } catch (err) {
    next(err);
  }
});

// serve JSON spec at /api/docs.json
router.get('/json', (req, res) => {
  res.json(makeOpenApi(req));
});

module.exports = router;
