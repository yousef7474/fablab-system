const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(authMiddleware);

// Get all tasks (accessible by all authenticated users)
router.get('/', taskController.getAllTasks);

// Get grouped assignments (multi-day tasks grouped together)
router.get('/grouped', taskController.getGroupedTasks);

// Get tasks formatted for calendar (accessible by all authenticated users)
router.get('/calendar', taskController.getTasksForCalendar);

// Get single task by ID
router.get('/:id', taskController.getTaskById);

// Create new task (manager or admin only)
router.post('/', requireManager, taskController.createTask);

// Update task (manager or admin only)
router.put('/:id', requireManager, taskController.updateTask);

// Update task status only (manager or admin only)
router.patch('/:id/status', requireManager, taskController.updateTaskStatus);

// Update group status (all tasks in assignment)
router.patch('/group/:groupId/status', requireManager, taskController.updateGroupStatus);

// Delete task (manager or admin only)
router.delete('/:id', requireManager, taskController.deleteTask);

// Delete entire group/assignment
router.delete('/group/:groupId', requireManager, taskController.deleteGroup);

module.exports = router;
