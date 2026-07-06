const express = require('express');
const router = express.Router();

router.use(require('./publicModules/basic'));
router.use(require('./publicModules/users'));
router.use(require('./publicModules/hub'));
router.use(require('./publicModules/activity'));
router.use(require('./publicModules/discovery'));
router.use(require('./publicModules/data'));

module.exports = router;
