const express = require('express');
const ctrl = require('../controllers/workspaceRequestController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

// Public workspace registration page (/workspace). Never 401: the client
// sends any 401 to the sign-in page.
const publicRouter = express.Router();
publicRouter.get('/status', ctrl.publicStatus);
publicRouter.get('/availability', ctrl.publicAvailability);
publicRouter.post('/submit', ctrl.publicSubmit);

// Admin + manager boards: review the requests (accept / reject).
const adminRouter = express.Router();
adminRouter.use(authMiddleware, requireManager);
adminRouter.get('/', ctrl.list);
adminRouter.patch('/:id/decision', ctrl.decide);
adminRouter.delete('/:id', ctrl.remove);

module.exports = { publicRouter, adminRouter };
