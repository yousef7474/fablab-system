const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

router.get('/structure', authMiddleware, evaluationController.getStructure);
router.get('/', authMiddleware, evaluationController.getAllEvaluations);
router.get('/export', authMiddleware, evaluationController.exportCSV);
router.get('/employee/:employeeId', authMiddleware, evaluationController.getEmployeeEvaluation);
router.post('/', authMiddleware, requireManager, evaluationController.upsertEvaluation);
router.delete('/:id', authMiddleware, requireManager, evaluationController.deleteEvaluation);

module.exports = router;
