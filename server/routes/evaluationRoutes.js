const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

router.get('/structure', authMiddleware, evaluationController.getStructure);
router.get('/', authMiddleware, evaluationController.getAllEvaluations);
router.get('/employee/:employeeId', authMiddleware, evaluationController.getEmployeeEvaluations);
router.post('/', authMiddleware, requireManager, evaluationController.createEvaluation);
router.delete('/:id', authMiddleware, requireManager, evaluationController.deleteEvaluation);

module.exports = router;
