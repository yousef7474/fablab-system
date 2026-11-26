const express = require('express');
const ctrl = require('../controllers/fabFormController');
const adminAuth = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

// Public form behind the shared link (/forms/:slug). Never 401: the
// client sends any 401 to the sign-in page.
const publicRouter = express.Router();
// "Will you attend?" from the event reminder email.
publicRouter.get('/attend/:token', ctrl.getAttendance);
publicRouter.post('/attend/:token', ctrl.setAttendance);
publicRouter.get('/:slug', ctrl.getPublicForm);
publicRouter.post('/:slug', ctrl.submitForm);

// Admin "نماذج فاب لاب" tab. Any admin can view forms, answers and export
// them; building, switching on / off and deleting needs a manager.
const adminRouter = express.Router();
adminRouter.use(adminAuth);
adminRouter.get('/', ctrl.listForms);
adminRouter.post('/', requireManager, ctrl.createForm);
adminRouter.delete('/responses/:responseId', requireManager, ctrl.deleteResponse);
adminRouter.get('/:id', ctrl.getForm);
adminRouter.get('/:id/responses', ctrl.listResponses);
adminRouter.put('/:id', requireManager, ctrl.updateForm);
adminRouter.patch('/:id/active', requireManager, ctrl.setActive);
adminRouter.post('/:id/duplicate', requireManager, ctrl.duplicateForm);
adminRouter.delete('/:id', requireManager, ctrl.deleteForm);

module.exports = { publicRouter, adminRouter };
