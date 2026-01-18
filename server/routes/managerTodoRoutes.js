const express = require('express');
const router = express.Router();
const managerTodoController = require('../controllers/managerTodoController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

// All routes require authentication and manager role
router.use(authMiddleware);
router.use(requireManager);

// Get all todos for logged-in manager
router.get('/', managerTodoController.getMyTodos);

// Create new todo
router.post('/', managerTodoController.createTodo);

// Update todo
router.put('/:id', managerTodoController.updateTodo);

// Toggle todo status (pending <-> completed)
router.patch('/:id/toggle', managerTodoController.toggleTodoStatus);

// Delete todo
router.delete('/:id', managerTodoController.deleteTodo);

module.exports = router;
