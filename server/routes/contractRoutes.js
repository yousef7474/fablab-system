const express = require('express');
const router = express.Router();
const contracts = require('../controllers/contractController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(requireManager);

router.get('/',        contracts.list);
router.get('/:id',     contracts.getOne);
router.post('/',       contracts.create);
router.put('/:id',     contracts.update);
router.delete('/:id',  contracts.remove);

module.exports = router;
