const express = require('express');
const router = express.Router();
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

router.use(verifyToken, verifyAdmin);
router.use('/audit', require('./admin/audit'));
router.use('/drone-offers', require('./admin/droneOffers'));
router.use('/games', require('./admin/gameCatalog'));
router.use('/perks', require('./admin/perks'));
router.use(require('./admin/users'));
router.use(require('./admin/items'));
router.use(require('./admin/mapsKiosks'));

module.exports = router;
