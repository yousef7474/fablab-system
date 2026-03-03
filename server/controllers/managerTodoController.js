const { ManagerTodo, ManagerTodoHistory, Admin } = require('../models');

/**
 * Get all todos for the logged-in manager
 */
exports.getMyTodos = async (req, res) => {
  try {
    const todos = await ManagerTodo.findAll({
      where: { managerId: req.admin.adminId },
      order: [['dueDate', 'ASC'], ['priority', 'DESC'], ['createdAt', 'DESC']]
    });

    res.json(todos);
  } catch (error) {
    console.error('Error fetching todos:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Create a new todo
 */
exports.createTodo = async (req, res) => {
  try {
    const { title, description, dueDate, priority } = req.body;

    if (!title) {
      return res.status(400).json({
        message: 'Title is required',
        messageAr: 'العنوان مطلوب'
      });
    }

    const todo = await ManagerTodo.create({
      managerId: req.admin.adminId,
      title,
      description: description || null,
      dueDate: dueDate || null,
      priority: priority || 'medium',
      status: 'pending'
    });

    res.status(201).json(todo);
  } catch (error) {
    console.error('Error creating todo:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Update a todo
 */
exports.updateTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, dueDate, priority, status } = req.body;

    const todo = await ManagerTodo.findOne({
      where: { todoId: id, managerId: req.admin.adminId }
    });

    if (!todo) {
      return res.status(404).json({
        message: 'Todo not found',
        messageAr: 'المهمة غير موجودة'
      });
    }

    await todo.update({
      title: title !== undefined ? title : todo.title,
      description: description !== undefined ? description : todo.description,
      dueDate: dueDate !== undefined ? dueDate : todo.dueDate,
      priority: priority !== undefined ? priority : todo.priority,
      status: status !== undefined ? status : todo.status
    });

    res.json(todo);
  } catch (error) {
    console.error('Error updating todo:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Update todo status with history tracking
 */
exports.updateTodoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', '),
        messageAr: 'حالة غير صالحة'
      });
    }

    const todo = await ManagerTodo.findOne({
      where: { todoId: id, managerId: req.admin.adminId }
    });

    if (!todo) {
      return res.status(404).json({
        message: 'Todo not found',
        messageAr: 'المهمة غير موجودة'
      });
    }

    const previousStatus = todo.status;
    await todo.update({ status });

    const historyEntry = await ManagerTodoHistory.create({
      todoId: id,
      previousStatus,
      newStatus: status
    });

    res.json({
      message: 'Todo status updated',
      messageAr: 'تم تحديث حالة المهمة',
      todo,
      historyEntry
    });
  } catch (error) {
    console.error('Error updating todo status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get status change history for a todo
 */
exports.getTodoHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const todo = await ManagerTodo.findOne({
      where: { todoId: id, managerId: req.admin.adminId }
    });

    if (!todo) {
      return res.status(404).json({
        message: 'Todo not found',
        messageAr: 'المهمة غير موجودة'
      });
    }

    const history = await ManagerTodoHistory.findAll({
      where: { todoId: id },
      order: [['changedAt', 'DESC']]
    });

    res.json(history);
  } catch (error) {
    console.error('Error fetching todo history:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Delete a todo
 */
exports.deleteTodo = async (req, res) => {
  try {
    const { id } = req.params;

    const todo = await ManagerTodo.findOne({
      where: { todoId: id, managerId: req.admin.adminId }
    });

    if (!todo) {
      return res.status(404).json({
        message: 'Todo not found',
        messageAr: 'المهمة غير موجودة'
      });
    }

    await todo.destroy();

    res.json({
      message: 'Todo deleted successfully',
      messageAr: 'تم حذف المهمة بنجاح'
    });
  } catch (error) {
    console.error('Error deleting todo:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = exports;
