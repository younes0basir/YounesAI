const { Router } = require('express');
const { getPlanCatalog } = require('../plans/config');

const router = Router();

router.get('/', (_req, res) => {
  res.json({ plans: getPlanCatalog() });
});

module.exports = router;
