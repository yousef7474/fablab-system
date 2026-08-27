// AI-facing read API. Everything here is READ-ONLY — no mutations,
// no destructive endpoints. Give the AI model an API key with these
// endpoints and it can answer any question about the system.
//
// Endpoints (all under /api/ai):
//   GET  /schema                 — list of every queryable resource
//   GET  /snapshot               — one-shot system-wide summary
//   GET  /resource/:name         — paginated list of a resource
//   GET  /resource/:name/:id     — single record by PK
//   GET  /search?q=...           — cross-resource text search
//
// Query params for /resource/:name:
//   limit    (default 50, max 500)
//   offset   (default 0)
//   from,to  ISO dates — filter by createdAt when the model has one
//   order    (default 'createdAt DESC')

const { Op, fn, col, literal } = require('sequelize');
const models = require('../models');

// ------------------- RESOURCE REGISTRY -------------------
// Every resource the AI can query. `model` is the Sequelize model
// name; `exclude` strips heavy / sensitive columns from the JSON
// payload. If a model isn't here, the AI can't touch it.

const RESOURCES = {
  // Core users + registrations
  'users':             { model: 'User' },
  'registrations':     { model: 'Registration' },
  'admins':            { model: 'Admin', exclude: ['password'] },
  'employees':         { model: 'Employee', exclude: ['password'] },

  // Employee productivity
  'tasks':             { model: 'Task' },
  'ratings':           { model: 'Rating' },
  'evaluations':       { model: 'EmployeeEvaluation' },
  'employee-activity': { model: 'EmployeeActivity' },
  'manager-todos':     { model: 'ManagerTodo' },

  // Volunteers / workers / interns / trainers
  'volunteers':                  { model: 'Volunteer' },
  'volunteer-opportunities':     { model: 'VolunteerOpportunity' },
  'volunteer-ratings':           { model: 'VolunteerRating' },
  'volunteer-attendance':        { model: 'VolunteerAttendance' },
  'volunteer-receipts':          { model: 'VolunteerReceipt' },
  'workers':                     { model: 'Worker' },
  'worker-opportunities':        { model: 'WorkerOpportunity' },
  'worker-ratings':              { model: 'WorkerRating' },
  'worker-receipts':             { model: 'WorkerReceipt' },
  'interns':                     { model: 'Intern' },
  'intern-trainings':            { model: 'InternTraining' },
  'intern-ratings':              { model: 'InternRating' },
  'intern-attendance':           { model: 'InternAttendance' },
  'trainer-assistants':          { model: 'TrainerAssistant' },
  'trainer-assignments':         { model: 'TrainerAssignment' },
  'trainer-attendance':          { model: 'TrainerAssistantAttendance' },
  'fablab-staff':                { model: 'FablabStaff' },
  'fablab-staff-attendance':     { model: 'FablabStaffAttendance' },
  'overtime-requests':           { model: 'OvertimeRequest' },

  // Bookings / visits
  'fablab-visits':               { model: 'FablabVisit' },
  'section-availability':        { model: 'SectionAvailability' },
  'registration-closures':       { model: 'RegistrationClosure' },
  'working-hours-overrides':     { model: 'WorkingHoursOverride' },

  // Programs — Mawhba
  'mawhba-students':             { model: 'MawhbaStudent' },
  'mawhba-attendance':           { model: 'MawhbaAttendance' },
  'mawhba-seasons':              { model: 'MawhbaSeason' },
  'mawhba-course-colors':        { model: 'MawhbaCourseColor' },

  // Programs — Summer
  'summer-programs':             { model: 'SummerProgram' },
  'summer-teachers':             { model: 'SummerTeacher' },
  'summer-teacher-ratings':      { model: 'SummerTeacherRating' },
  'summer-students':             { model: 'SummerStudent' },
  'summer-student-attendance':   { model: 'SummerStudentAttendance' },
  'summer-seasons':              { model: 'SummerSeason' },

  // Workshops
  'workshops':                   { model: 'Workshop' },
  'workshop-students':           { model: 'WorkshopStudent' },

  // School education program
  'education':                   { model: 'Education' },
  'education-ratings':           { model: 'EducationRating' },
  'education-students':          { model: 'EducationStudent' },
  'education-attendance':        { model: 'EducationAttendance' },

  // Borrowing
  'borrowings':                  { model: 'Borrowing' },

  // Contracts + external customers + workspaces
  'contracts':                   { model: 'Contract' },
  'customers':                   { model: 'Customer' },
  'workspaces':                  { model: 'Workspace' },
  'workspace-ratings':           { model: 'WorkspaceRating' },

  // Store
  'store-items':                 { model: 'StoreItem' },
  'store-orders':                { model: 'StoreOrder' },
  'store-coupons':               { model: 'DiscountCoupon' },
  'store-customers':             { model: 'StoreCustomer', exclude: ['password'] },

  // 3D printing — file payloads stripped
  'print3d-requests':            { model: 'Print3DRequest', exclude: ['fileData', 'files'] },

  // Institution support — heavy JSON blobs stripped
  'institution-projects':        {
    model: 'InstitutionProject',
    exclude: ['reportAr', 'reportEn', 'patentFile', 'images', 'invoices', 'registrationFiles', 'chatScreenshots', 'googleFormResults']
  },

  // Elite (advanced course platform)
  'elite-users':                 { model: 'EliteUser', exclude: ['password'] },
  'elite-ratings':               { model: 'EliteRating' },
  'elite-credits':               { model: 'EliteCredit' },
  'elite-tasks':                 { model: 'EliteTask' },
  'elite-works':                 { model: 'EliteWork' },
  'elite-schedule':              { model: 'EliteSchedule' },
  'elite-courses':               { model: 'EliteCourse' },
  'elite-course-lessons':        { model: 'EliteCourseLesson' },
  'elite-course-enrollments':    { model: 'EliteCourseEnrollment' },
  'elite-lesson-progress':       { model: 'EliteLessonProgress' },
  'elite-course-quizzes':        { model: 'EliteCourseQuiz' },
  'elite-quiz-questions':        { model: 'EliteQuizQuestion' },
  'elite-quiz-attempts':         { model: 'EliteQuizAttempt' },

  // Calendar + settings
  'calendar-events':             { model: 'CalendarEvent' },
  'settings':                    { model: 'Settings' }
};

// ------------------- HELPERS -------------------

const _resolveModel = (spec) => spec && models[spec.model];

const _paginate = (req) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  return { limit, offset };
};

const _dateWhere = (req, Model) => {
  const where = {};
  const { from, to } = req.query;
  if (Model.rawAttributes?.createdAt && (from || to)) {
    where.createdAt = {};
    if (from) where.createdAt[Op.gte] = new Date(from);
    if (to)   where.createdAt[Op.lte] = new Date(to);
  }
  return where;
};

const _order = (req, Model) => {
  const raw = String(req.query.order || 'createdAt DESC').trim();
  const [field, dirRaw] = raw.split(/\s+/);
  const dir = String(dirRaw || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  if (!field || !Model.rawAttributes?.[field]) {
    return Model.rawAttributes?.createdAt ? [['createdAt', dir]] : undefined;
  }
  return [[field, dir]];
};

// ------------------- ENDPOINTS -------------------

// GET /api/ai/schema
// Returns the list of queryable resources with their field names,
// so an AI model can discover what it can ask about.
exports.schema = async (req, res) => {
  try {
    const out = {};
    for (const [key, spec] of Object.entries(RESOURCES)) {
      const Model = _resolveModel(spec);
      if (!Model) continue;
      const attrs = Object.keys(Model.rawAttributes || {})
        .filter(a => !(spec.exclude || []).includes(a));
      out[key] = {
        model: spec.model,
        table: Model.getTableName(),
        primaryKey: Model.primaryKeyAttribute,
        fields: attrs,
        excluded: spec.exclude || []
      };
    }
    res.json({
      note: 'Every resource is read-only. Use /api/ai/resource/{name} to query.',
      count: Object.keys(out).length,
      resources: out
    });
  } catch (err) {
    console.error('ai/schema:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/ai/snapshot
// One-shot system-wide summary — counts, active season pointers,
// recent activity — enough for an AI to answer "how many X",
// "what's happening this week", "current state of Y" without
// making dozens of round trips.
exports.snapshot = async (req, res) => {
  try {
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(); startOfWeek.setDate(startOfWeek.getDate() - 7);
    const today = new Date().toISOString().slice(0, 10);

    // Safe count helper — one bad table shouldn't break the whole snapshot.
    const safeCount = async (Model, where) => {
      try { return await Model.count(where ? { where } : undefined); }
      catch { return null; }
    };
    const safeSum = async (Model, field, where) => {
      try {
        const row = await Model.findOne({
          attributes: [[fn('SUM', col(field)), 'total']],
          where: where || undefined, raw: true
        });
        return Number(row?.total) || 0;
      } catch { return null; }
    };
    const safeFindAll = async (Model, opts) => {
      try { return await Model.findAll(opts); } catch { return []; }
    };

    const {
      Registration, User, Employee, Task, Volunteer, Worker, Intern,
      TrainerAssistant, FablabStaff, OvertimeRequest, FablabVisit,
      MawhbaStudent, MawhbaSeason, SummerStudent, SummerProgram,
      SummerSeason, Workshop, WorkshopStudent, Contract, Customer,
      Workspace, Borrowing, StoreItem, StoreOrder, DiscountCoupon,
      StoreCustomer, Print3DRequest, InstitutionProject, CalendarEvent,
      Settings
    } = models;

    const [
      registrationsTotal, registrationsPending, registrationsApproved,
      usersTotal, employeesTotal,
      tasksTotal, tasksActive,
      volunteersTotal, workersTotal, internsTotal, trainersTotal, fablabStaffTotal,
      overtimeTotal, overtimePending,
      visitsTotal, visitsPending,
      mawhbaStudentsTotal, summerStudentsTotal, summerProgramsTotal,
      workshopsTotal, workshopStudentsTotal,
      contractsTotal, customersTotal, workspacesTotal, borrowingsTotal,
      storeItemsTotal, storeOrdersTotal, storeOrdersPending, storeOrdersCompleted,
      storeRevenueTotal, storeRevenueThisMonth,
      storeCustomersTotal, storeCouponsTotal,
      print3dTotal, print3dPending, print3dPrinting, print3dCompleted,
      print3dRevenueTotal,
      institutionProjectsTotal, institutionProjectsActive,
      calendarEventsTotal,
      activeMawhbaSeason, activeSummerSeason
    ] = await Promise.all([
      safeCount(Registration),
      safeCount(Registration, { status: 'pending' }),
      safeCount(Registration, { status: 'approved' }),
      safeCount(User),
      safeCount(Employee, { isActive: true }),
      safeCount(Task),
      safeCount(Task, { status: { [Op.ne]: 'completed' } }),
      safeCount(Volunteer, { isActive: true }),
      safeCount(Worker, { isActive: true }),
      safeCount(Intern, { isActive: true }),
      safeCount(TrainerAssistant, { isActive: true }),
      safeCount(FablabStaff, { isActive: true }),
      safeCount(OvertimeRequest),
      safeCount(OvertimeRequest, { approvalStatus: 'pending' }),
      safeCount(FablabVisit),
      safeCount(FablabVisit, { approvalStatus: 'pending' }),
      safeCount(MawhbaStudent, { isActive: true }),
      safeCount(SummerStudent, { isActive: true }),
      safeCount(SummerProgram, { isActive: true }),
      safeCount(Workshop),
      safeCount(WorkshopStudent),
      safeCount(Contract),
      safeCount(Customer),
      safeCount(Workspace),
      safeCount(Borrowing),
      safeCount(StoreItem, { isActive: true }),
      safeCount(StoreOrder),
      safeCount(StoreOrder, { status: 'pending' }),
      safeCount(StoreOrder, { status: 'completed' }),
      safeSum(StoreOrder, 'total', { paidAt: { [Op.ne]: null } }),
      safeSum(StoreOrder, 'total', {
        paidAt: { [Op.ne]: null },
        createdAt: { [Op.gte]: startOfMonth }
      }),
      safeCount(StoreCustomer, { isActive: true }),
      safeCount(DiscountCoupon, { isActive: true }),
      safeCount(Print3DRequest),
      safeCount(Print3DRequest, { status: 'submitted' }),
      safeCount(Print3DRequest, { status: 'printing' }),
      safeCount(Print3DRequest, { status: 'completed' }),
      safeSum(Print3DRequest, 'estimatedCost', { paidAt: { [Op.ne]: null } }),
      safeCount(InstitutionProject),
      safeCount(InstitutionProject, { isActive: true }),
      safeCount(CalendarEvent),
      safeFindAll(MawhbaSeason, { where: { isActive: true }, limit: 1 }),
      safeFindAll(SummerSeason, { where: { isActive: true }, limit: 1 })
    ]);

    // Recent items (small samples, no heavy fields)
    const [recentRegistrations, recentOrders, recentPrint3d, recentVisits] = await Promise.all([
      safeFindAll(Registration, { limit: 10, order: [['createdAt', 'DESC']] }),
      safeFindAll(StoreOrder, { limit: 10, order: [['createdAt', 'DESC']] }),
      safeFindAll(Print3DRequest, {
        limit: 10, order: [['createdAt', 'DESC']],
        attributes: { exclude: ['fileData', 'files'] }
      }),
      safeFindAll(FablabVisit, { limit: 10, order: [['createdAt', 'DESC']] })
    ]);

    // Current settings snapshot — high-signal admin toggles.
    const settingsKeys = [
      'working_hours_start', 'working_hours_end', 'working_days',
      'registration_disabled', 'registration_disabled_reason',
      'store_disabled', 'store_disabled_reason',
      'calendar_show_schedule_overlay'
    ];
    const settingsRows = await safeFindAll(Settings, { where: { key: { [Op.in]: settingsKeys } } });
    const currentSettings = {};
    for (const r of settingsRows) currentSettings[r.key] = r.value;

    res.json({
      generatedAt: new Date().toISOString(),
      today,
      counts: {
        registrations: { total: registrationsTotal, pending: registrationsPending, approved: registrationsApproved },
        users: usersTotal,
        employees_active: employeesTotal,
        tasks: { total: tasksTotal, active: tasksActive },
        team: {
          volunteers: volunteersTotal,
          workers: workersTotal,
          interns: internsTotal,
          trainer_assistants: trainersTotal,
          fablab_staff: fablabStaffTotal
        },
        overtime: { total: overtimeTotal, pending_approval: overtimePending },
        fablab_visits: { total: visitsTotal, pending_approval: visitsPending },
        mawhba: { active_students: mawhbaStudentsTotal, active_season: activeMawhbaSeason?.[0]?.toJSON?.() || null },
        summer: { active_students: summerStudentsTotal, active_programs: summerProgramsTotal, active_season: activeSummerSeason?.[0]?.toJSON?.() || null },
        workshops: { total: workshopsTotal, students: workshopStudentsTotal },
        contracts: contractsTotal,
        customers: customersTotal,
        workspaces: workspacesTotal,
        borrowings: borrowingsTotal,
        store: {
          items: storeItemsTotal,
          orders: { total: storeOrdersTotal, pending: storeOrdersPending, completed: storeOrdersCompleted },
          revenue_paid_total: storeRevenueTotal,
          revenue_this_month: storeRevenueThisMonth,
          customers: storeCustomersTotal,
          active_coupons: storeCouponsTotal
        },
        print3d: {
          total: print3dTotal,
          submitted: print3dPending,
          printing: print3dPrinting,
          completed: print3dCompleted,
          revenue_paid_total: print3dRevenueTotal
        },
        institution_support: { total: institutionProjectsTotal, active: institutionProjectsActive },
        calendar_events: calendarEventsTotal
      },
      current_settings: currentSettings,
      recent: {
        registrations: recentRegistrations,
        store_orders: recentOrders,
        print3d_requests: recentPrint3d,
        fablab_visits: recentVisits
      }
    });
  } catch (err) {
    console.error('ai/snapshot:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/ai/resource/:name
exports.listResource = async (req, res) => {
  try {
    const spec = RESOURCES[req.params.name];
    if (!spec) {
      return res.status(404).json({
        error: 'Unknown resource',
        available: Object.keys(RESOURCES).sort()
      });
    }
    const Model = _resolveModel(spec);
    if (!Model) return res.status(500).json({ error: `Model ${spec.model} not registered` });

    const { limit, offset } = _paginate(req);
    const where = _dateWhere(req, Model);
    const order = _order(req, Model);

    const opts = { limit, offset, where };
    if (order) opts.order = order;
    if (spec.exclude) opts.attributes = { exclude: spec.exclude };

    const { count, rows } = await Model.findAndCountAll(opts);
    res.json({
      resource: req.params.name,
      total: count,
      limit, offset,
      returned: rows.length,
      items: rows
    });
  } catch (err) {
    console.error(`ai/resource/${req.params.name}:`, err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/ai/resource/:name/:id
exports.getResource = async (req, res) => {
  try {
    const spec = RESOURCES[req.params.name];
    if (!spec) return res.status(404).json({ error: 'Unknown resource' });
    const Model = _resolveModel(spec);
    const opts = {};
    if (spec.exclude) opts.attributes = { exclude: spec.exclude };
    const row = await Model.findByPk(req.params.id, opts);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    console.error(`ai/resource/${req.params.name}/${req.params.id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/ai/search?q=...
// Best-effort text search across the highest-signal resources.
// Returns a small hit list per resource so the AI can dig further
// via /resource/:name/:id.
exports.search = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.status(400).json({ error: 'q must be at least 2 characters' });
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const like = { [Op.iLike]: `%${q}%` };

    const searches = [
      ['users', models.User, [
        { firstName: like }, { lastName: like }, { name: like },
        { email: like }, { phoneNumber: like }, { nationalId: like }
      ]],
      ['registrations', models.Registration, [
        { fablabSection: like }, { requiredServices: like }, { purpose: like }
      ]],
      ['employees', models.Employee, [{ name: like }, { email: like }, { section: like }, { position: like }]],
      ['tasks', models.Task, [{ title: like }, { description: like }]],
      ['volunteers', models.Volunteer, [{ name: like }, { email: like }, { phone: like }, { nationalId: like }]],
      ['fablab-staff', models.FablabStaff, [{ name: like }, { email: like }, { position: like }, { nationalId: like }]],
      ['store-items', models.StoreItem, [{ name: like }, { nameEn: like }, { description: like }, { category: like }, { sku: like }]],
      ['store-orders', models.StoreOrder, [{ customerName: like }, { customerPhone: like }, { customerEmail: like }]],
      ['store-customers', models.StoreCustomer, [{ name: like }, { email: like }, { phone: like }]],
      ['fablab-visits', models.FablabVisit, [{ entityName: like }, { personInCharge: like }, { email: like }, { phone: like }, { purpose: like }]],
      ['print3d-requests', models.Print3DRequest, [{ customerName: like }, { customerEmail: like }, { customerPhone: like }, { fileName: like }]],
      ['institution-projects', models.InstitutionProject, [{ projectName: like }, { supervisorName: like }, { evaluation: like }]],
      ['contracts', models.Contract, [{ customerName: like }, { customerEmail: like }, { customerPhone: like }]],
      ['workshops', models.Workshop, [{ title: like }, { section: like }, { instructorName: like }]],
      ['mawhba-students', models.MawhbaStudent, [{ studentName: like }, { studentId: like }, { fablabSection: like }]],
      ['summer-students', models.SummerStudent, [{ name: like }, { nationalId: like }]],
      ['summer-programs', models.SummerProgram, [{ name: like }, { teacherName: like }, { fablabSection: like }]],
      ['summer-teachers', models.SummerTeacher, [{ name: like }, { email: like }, { fablabSection: like }]]
    ];

    const hits = {};
    for (const [key, Model, orClauses] of searches) {
      if (!Model) continue;
      try {
        const spec = RESOURCES[key] || {};
        const attrs = spec.exclude ? { exclude: spec.exclude } : undefined;
        const rows = await Model.findAll({
          where: { [Op.or]: orClauses },
          attributes: attrs,
          limit,
          order: Model.rawAttributes?.createdAt ? [['createdAt', 'DESC']] : undefined
        });
        if (rows.length) hits[key] = rows;
      } catch (e) {
        // Skip resources that can't be searched (missing columns etc).
      }
    }

    res.json({
      query: q,
      totalResourcesWithHits: Object.keys(hits).length,
      results: hits
    });
  } catch (err) {
    console.error('ai/search:', err);
    res.status(500).json({ error: err.message });
  }
};
