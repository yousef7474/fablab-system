const { sequelize, testConnection } = require('../config/database');
const User = require('./User');
const Registration = require('./Registration');
const Admin = require('./Admin');
const Employee = require('./Employee');
const Task = require('./Task');
const Rating = require('./Rating');
const Volunteer = require('./Volunteer');
const VolunteerOpportunity = require('./VolunteerOpportunity');
const VolunteerRating = require('./VolunteerRating');
const Worker = require('./Worker');
const WorkerOpportunity = require('./WorkerOpportunity');
const WorkerRating = require('./WorkerRating');
const VolunteerReceipt = require('./VolunteerReceipt');
const WorkerReceipt = require('./WorkerReceipt');
const SummerProgram = require('./SummerProgram');
const SummerTeacher = require('./SummerTeacher');
const SummerTeacherRating = require('./SummerTeacherRating');
const SummerStudent = require('./SummerStudent');
const Intern = require('./Intern');
const InternTraining = require('./InternTraining');
const InternRating = require('./InternRating');
const InternAttendance = require('./InternAttendance');
const ManagerTodo = require('./ManagerTodo');
const ManagerTodoHistory = require('./ManagerTodoHistory');
const Workspace = require('./Workspace');
const WorkspaceRating = require('./WorkspaceRating');
const SectionAvailability = require('./SectionAvailability');
const EliteUser = require('./EliteUser');
const EliteRating = require('./EliteRating');
const EliteCredit = require('./EliteCredit');
const EliteTask = require('./EliteTask');
const EliteWork = require('./EliteWork');
const EliteSchedule = require('./EliteSchedule');
const EliteCourse = require('./EliteCourse');
const EliteCourseLesson = require('./EliteCourseLesson');
const EliteCourseEnrollment = require('./EliteCourseEnrollment');
const EliteLessonProgress = require('./EliteLessonProgress');
const EliteCourseQuiz = require('./EliteCourseQuiz');
const EliteQuizQuestion = require('./EliteQuizQuestion');
const EliteQuizAttempt = require('./EliteQuizAttempt');
const Settings = require('./Settings');
const WorkingHoursOverride = require('./WorkingHoursOverride');
const Borrowing = require('./Borrowing');
const Education = require('./Education');
const EducationRating = require('./EducationRating');
const EducationStudent = require('./EducationStudent');
const EducationAttendance = require('./EducationAttendance');
const EmployeeEvaluation = require('./EmployeeEvaluation');
const EmployeeActivity = require('./EmployeeActivity');
const Workshop = require('./Workshop');
const WorkshopStudent = require('./WorkshopStudent');
const RegistrationClosure = require('./RegistrationClosure');
const MawhbaStudent = require('./MawhbaStudent');
const MawhbaCourseColor = require('./MawhbaCourseColor');
const MawhbaAttendance = require('./MawhbaAttendance');
const MawhbaSeason = require('./MawhbaSeason');
const VolunteerAttendance = require('./VolunteerAttendance');
const FablabStaff = require('./FablabStaff');
const FablabStaffAttendance = require('./FablabStaffAttendance');
const OvertimeRequest = require('./OvertimeRequest');
const TrainerAssistant = require('./TrainerAssistant');
const TrainerAssignment = require('./TrainerAssignment');
const TrainerAssistantAttendance = require('./TrainerAssistantAttendance');
const Customer = require('./Customer');
const Contract = require('./Contract');
const SummerStudentAttendance = require('./SummerStudentAttendance');
const FablabVisit = require('./FablabVisit');
const CalendarEvent = require('./CalendarEvent');

MawhbaAttendance.belongsTo(MawhbaStudent, { foreignKey: 'studentId', as: 'student', constraints: false });
MawhbaStudent.hasMany(MawhbaAttendance, { foreignKey: 'studentId', as: 'attendance', constraints: false });

SummerStudentAttendance.belongsTo(SummerStudent, { foreignKey: 'studentId', as: 'student', constraints: false });
SummerStudent.hasMany(SummerStudentAttendance, { foreignKey: 'studentId', as: 'attendance', constraints: false });

MawhbaStudent.belongsTo(MawhbaSeason, { foreignKey: 'seasonId', as: 'season', constraints: false });
MawhbaSeason.hasMany(MawhbaStudent, { foreignKey: 'seasonId', as: 'students', constraints: false });

VolunteerAttendance.belongsTo(Volunteer, { foreignKey: 'volunteerId', as: 'volunteer', constraints: false });
Volunteer.hasMany(VolunteerAttendance, { foreignKey: 'volunteerId', as: 'attendance', constraints: false });

TrainerAssistantAttendance.belongsTo(TrainerAssistant, { foreignKey: 'trainerId', as: 'trainer', constraints: false });
TrainerAssistant.hasMany(TrainerAssistantAttendance, { foreignKey: 'trainerId', as: 'attendance', constraints: false });

FablabStaffAttendance.belongsTo(FablabStaff, { foreignKey: 'staffId', as: 'staff', constraints: false });
FablabStaff.hasMany(FablabStaffAttendance, { foreignKey: 'staffId', as: 'attendance', constraints: false });

// Assistant trainer ↔ per-chance assignments
TrainerAssignment.belongsTo(TrainerAssistant, { foreignKey: 'trainerId', as: 'trainer', constraints: false });
TrainerAssistant.hasMany(TrainerAssignment, { foreignKey: 'trainerId', as: 'assignments', constraints: false });

// Define relationships
User.hasMany(Registration, { foreignKey: 'userId', as: 'registrations' });
Registration.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Task relationships
Task.belongsTo(Employee, { foreignKey: 'employeeId', as: 'assignee' });
Employee.hasMany(Task, { foreignKey: 'employeeId', as: 'tasks' });

Task.belongsTo(Admin, { foreignKey: { name: 'createdById', allowNull: true }, as: 'creator', constraints: false });
Admin.hasMany(Task, { foreignKey: 'createdById', as: 'createdTasks' });

Task.belongsTo(Employee, { foreignKey: 'createdByEmployeeId', as: 'employeeCreator' });
Employee.hasMany(Task, { foreignKey: 'createdByEmployeeId', as: 'selfCreatedTasks' });

// Rating relationships
Rating.belongsTo(Employee, { foreignKey: 'employeeId', as: 'employee' });
Employee.hasMany(Rating, { foreignKey: 'employeeId', as: 'ratings' });

Rating.belongsTo(Admin, { foreignKey: { name: 'createdById', allowNull: true }, as: 'ratedBy', constraints: false });
Admin.hasMany(Rating, { foreignKey: 'createdById', as: 'givenRatings' });

// Volunteer relationships
VolunteerOpportunity.belongsTo(Volunteer, { foreignKey: 'volunteerId', as: 'volunteer' });
Volunteer.hasMany(VolunteerOpportunity, { foreignKey: 'volunteerId', as: 'opportunities' });

VolunteerOpportunity.belongsTo(Admin, { foreignKey: 'createdById', as: 'creator' });
Admin.hasMany(VolunteerOpportunity, { foreignKey: 'createdById', as: 'createdOpportunities' });

// Volunteer Rating relationships
VolunteerRating.belongsTo(Volunteer, { foreignKey: 'volunteerId', as: 'volunteer' });
Volunteer.hasMany(VolunteerRating, { foreignKey: 'volunteerId', as: 'ratings' });

VolunteerRating.belongsTo(VolunteerOpportunity, { foreignKey: 'opportunityId', as: 'opportunity' });
VolunteerOpportunity.hasMany(VolunteerRating, { foreignKey: 'opportunityId', as: 'ratings' });

VolunteerRating.belongsTo(Admin, { foreignKey: 'createdById', as: 'ratedBy' });
Admin.hasMany(VolunteerRating, { foreignKey: 'createdById', as: 'givenVolunteerRatings' });

// Worker relationships (parallel to volunteer)
WorkerOpportunity.belongsTo(Worker, { foreignKey: 'workerId', as: 'worker' });
Worker.hasMany(WorkerOpportunity, { foreignKey: 'workerId', as: 'opportunities' });

WorkerOpportunity.belongsTo(Admin, { foreignKey: 'createdById', as: 'creator' });
Admin.hasMany(WorkerOpportunity, { foreignKey: 'createdById', as: 'createdWorkerOpportunities' });

WorkerRating.belongsTo(Worker, { foreignKey: 'workerId', as: 'worker' });
Worker.hasMany(WorkerRating, { foreignKey: 'workerId', as: 'ratings' });

WorkerRating.belongsTo(WorkerOpportunity, { foreignKey: 'opportunityId', as: 'opportunity' });
WorkerOpportunity.hasMany(WorkerRating, { foreignKey: 'opportunityId', as: 'ratings' });

WorkerRating.belongsTo(Admin, { foreignKey: 'createdById', as: 'ratedBy' });
Admin.hasMany(WorkerRating, { foreignKey: 'createdById', as: 'givenWorkerRatings' });

// Receipt relationships
VolunteerReceipt.belongsTo(Volunteer, { foreignKey: 'volunteerId', as: 'volunteer' });
Volunteer.hasMany(VolunteerReceipt, { foreignKey: 'volunteerId', as: 'receipts' });
VolunteerReceipt.belongsTo(Admin, { foreignKey: 'createdById', as: 'creator', constraints: false });

WorkerReceipt.belongsTo(Worker, { foreignKey: 'workerId', as: 'worker' });
Worker.hasMany(WorkerReceipt, { foreignKey: 'workerId', as: 'receipts' });
WorkerReceipt.belongsTo(Admin, { foreignKey: 'createdById', as: 'creator', constraints: false });

// Summer FabLab relationships
SummerProgram.belongsTo(SummerTeacher, { foreignKey: 'teacherId', as: 'teacher', constraints: false });
SummerTeacher.hasMany(SummerProgram,   { foreignKey: 'teacherId', as: 'programs', constraints: false });

SummerTeacherRating.belongsTo(SummerTeacher, { foreignKey: 'teacherId', as: 'teacher', constraints: false });
SummerTeacher.hasMany(SummerTeacherRating,   { foreignKey: 'teacherId', as: 'ratings', constraints: false });
SummerTeacherRating.belongsTo(SummerProgram, { foreignKey: 'programId', as: 'program', constraints: false });

SummerStudent.belongsTo(SummerProgram, { foreignKey: 'programId', as: 'program', constraints: false });
SummerProgram.hasMany(SummerStudent,   { foreignKey: 'programId', as: 'students', constraints: false });

// Summer Volunteers are just Volunteers with a summerProgramId set.
Volunteer.belongsTo(SummerProgram,    { foreignKey: 'summerProgramId', as: 'summerProgram', constraints: false });
SummerProgram.hasMany(Volunteer,      { foreignKey: 'summerProgramId', as: 'summerVolunteers', constraints: false });

// Intern relationships
InternTraining.belongsTo(Intern, { foreignKey: 'internId', as: 'intern' });
Intern.hasMany(InternTraining, { foreignKey: 'internId', as: 'trainings' });

InternTraining.belongsTo(Admin, { foreignKey: 'createdById', as: 'creator' });
Admin.hasMany(InternTraining, { foreignKey: 'createdById', as: 'createdTrainings' });

// Intern Rating relationships
InternRating.belongsTo(Intern, { foreignKey: 'internId', as: 'intern' });
Intern.hasMany(InternRating, { foreignKey: 'internId', as: 'ratings' });

InternRating.belongsTo(InternTraining, { foreignKey: 'trainingId', as: 'training' });
InternTraining.hasMany(InternRating, { foreignKey: 'trainingId', as: 'ratings' });

InternRating.belongsTo(Admin, { foreignKey: 'createdById', as: 'ratedBy' });
Admin.hasMany(InternRating, { foreignKey: 'createdById', as: 'givenInternRatings' });

// Intern ↔ attendance (mirror of VolunteerAttendance relation)
InternAttendance.belongsTo(Intern, { foreignKey: 'internId', as: 'intern', constraints: false });
Intern.hasMany(InternAttendance, { foreignKey: 'internId', as: 'attendance', constraints: false });

// Manager Todo relationships
ManagerTodo.belongsTo(Admin, { foreignKey: 'managerId', as: 'manager' });
Admin.hasMany(ManagerTodo, { foreignKey: 'managerId', as: 'todos' });

// Manager Todo History relationships
ManagerTodo.hasMany(ManagerTodoHistory, { foreignKey: 'todoId', as: 'history' });
ManagerTodoHistory.belongsTo(ManagerTodo, { foreignKey: 'todoId', as: 'todo' });

// Workspace relationships
Workspace.belongsTo(Admin, { foreignKey: 'createdById', as: 'creator' });
Admin.hasMany(Workspace, { foreignKey: 'createdById', as: 'workspaces' });

// Workspace Rating relationships
WorkspaceRating.belongsTo(Workspace, { foreignKey: 'workspaceId', as: 'workspace' });
Workspace.hasMany(WorkspaceRating, { foreignKey: 'workspaceId', as: 'ratings' });

WorkspaceRating.belongsTo(Admin, { foreignKey: 'createdById', as: 'ratedBy' });
Admin.hasMany(WorkspaceRating, { foreignKey: 'createdById', as: 'givenWorkspaceRatings' });

// Section Availability relationships
SectionAvailability.belongsTo(Admin, { foreignKey: 'createdById', as: 'creator' });
Admin.hasMany(SectionAvailability, { foreignKey: 'createdById', as: 'createdDeactivations' });

SectionAvailability.belongsTo(Admin, { foreignKey: 'reactivatedById', as: 'reactivatedBy' });

// Elite Rating relationships
EliteRating.belongsTo(EliteUser, { foreignKey: 'eliteId', as: 'eliteUser' });
EliteUser.hasMany(EliteRating, { foreignKey: 'eliteId', as: 'ratings' });

EliteRating.belongsTo(Admin, { foreignKey: 'ratedById', as: 'ratedBy' });
Admin.hasMany(EliteRating, { foreignKey: 'ratedById', as: 'givenEliteRatings' });

// Elite Credit relationships
EliteCredit.belongsTo(EliteUser, { foreignKey: 'eliteId', as: 'eliteUser' });
EliteUser.hasMany(EliteCredit, { foreignKey: 'eliteId', as: 'credits' });

EliteCredit.belongsTo(Admin, { foreignKey: 'createdById', as: 'createdBy' });
Admin.hasMany(EliteCredit, { foreignKey: 'createdById', as: 'givenEliteCredits' });

// Elite Task relationships
EliteTask.belongsTo(EliteUser, { foreignKey: 'eliteId', as: 'eliteUser' });
EliteUser.hasMany(EliteTask, { foreignKey: 'eliteId', as: 'tasks' });

EliteTask.belongsTo(Admin, { foreignKey: 'createdById', as: 'creator' });
Admin.hasMany(EliteTask, { foreignKey: 'createdById', as: 'createdEliteTasks' });

// Elite Work relationships
EliteWork.belongsTo(EliteUser, { foreignKey: 'eliteId', as: 'eliteUser' });
EliteUser.hasMany(EliteWork, { foreignKey: 'eliteId', as: 'works' });

EliteWork.belongsTo(EliteTask, { foreignKey: 'taskId', as: 'task' });
EliteTask.hasMany(EliteWork, { foreignKey: 'taskId', as: 'submissions' });

EliteWork.belongsTo(Admin, { foreignKey: 'reviewedById', as: 'reviewer' });
Admin.hasMany(EliteWork, { foreignKey: 'reviewedById', as: 'reviewedWorks' });

// Elite Schedule relationships
EliteSchedule.belongsTo(EliteUser, { foreignKey: 'eliteId', as: 'eliteUser' });
EliteUser.hasMany(EliteSchedule, { foreignKey: 'eliteId', as: 'schedules' });

EliteSchedule.belongsTo(Admin, { foreignKey: 'createdById', as: 'creator' });
Admin.hasMany(EliteSchedule, { foreignKey: 'createdById', as: 'createdSchedules' });

// Elite Course relationships
EliteCourse.belongsTo(Admin, { foreignKey: 'createdById', as: 'courseCreator' });
Admin.hasMany(EliteCourse, { foreignKey: 'createdById', as: 'createdCourses' });

EliteCourse.hasMany(EliteCourseLesson, { foreignKey: 'courseId', as: 'lessons' });
EliteCourseLesson.belongsTo(EliteCourse, { foreignKey: 'courseId', as: 'course' });

EliteCourse.hasMany(EliteCourseEnrollment, { foreignKey: 'courseId', as: 'enrollments' });
EliteCourseEnrollment.belongsTo(EliteCourse, { foreignKey: 'courseId', as: 'course' });

EliteCourseEnrollment.belongsTo(EliteUser, { foreignKey: 'eliteId', as: 'eliteUser' });
EliteUser.hasMany(EliteCourseEnrollment, { foreignKey: 'eliteId', as: 'courseEnrollments' });

EliteCourseEnrollment.hasMany(EliteLessonProgress, { foreignKey: 'enrollmentId', as: 'lessonProgress' });
EliteLessonProgress.belongsTo(EliteCourseEnrollment, { foreignKey: 'enrollmentId', as: 'enrollment' });

EliteLessonProgress.belongsTo(EliteCourseLesson, { foreignKey: 'lessonId', as: 'lesson' });
EliteCourseLesson.hasMany(EliteLessonProgress, { foreignKey: 'lessonId', as: 'progress' });

EliteCourse.hasOne(EliteCourseQuiz, { foreignKey: 'courseId', as: 'quiz' });
EliteCourseQuiz.belongsTo(EliteCourse, { foreignKey: 'courseId', as: 'course' });

EliteCourseQuiz.hasMany(EliteQuizQuestion, { foreignKey: 'quizId', as: 'questions' });
EliteQuizQuestion.belongsTo(EliteCourseQuiz, { foreignKey: 'quizId', as: 'quiz' });

EliteCourseQuiz.hasMany(EliteQuizAttempt, { foreignKey: 'quizId', as: 'attempts' });
EliteQuizAttempt.belongsTo(EliteCourseQuiz, { foreignKey: 'quizId', as: 'quiz' });

EliteQuizAttempt.belongsTo(EliteUser, { foreignKey: 'eliteId', as: 'eliteUser' });
EliteUser.hasMany(EliteQuizAttempt, { foreignKey: 'eliteId', as: 'quizAttempts' });

EliteQuizAttempt.belongsTo(EliteCourseEnrollment, { foreignKey: 'enrollmentId', as: 'enrollment' });
EliteCourseEnrollment.hasMany(EliteQuizAttempt, { foreignKey: 'enrollmentId', as: 'quizAttempts' });

// Working Hours Override relationships
WorkingHoursOverride.belongsTo(Admin, { foreignKey: 'createdById', as: 'creator' });
Admin.hasMany(WorkingHoursOverride, { foreignKey: 'createdById', as: 'createdOverrides' });

// Borrowing relationships
Borrowing.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Borrowing, { foreignKey: 'userId', as: 'borrowings' });

Borrowing.belongsTo(Admin, { foreignKey: 'approvedById', as: 'approvedBy' });
Admin.hasMany(Borrowing, { foreignKey: 'approvedById', as: 'approvedBorrowings' });

Borrowing.belongsTo(Admin, { foreignKey: 'returnedById', as: 'returnProcessor' });
Admin.hasMany(Borrowing, { foreignKey: 'returnedById', as: 'processedReturns' });

// Education relationships
Education.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Education, { foreignKey: 'userId', as: 'educations' });

Education.belongsTo(Admin, { foreignKey: 'approvedById', as: 'approvedBy' });
Admin.hasMany(Education, { foreignKey: 'approvedById', as: 'approvedEducations' });

// Education Rating relationships
EducationRating.belongsTo(Education, { foreignKey: 'educationId', as: 'education' });
Education.hasMany(EducationRating, { foreignKey: 'educationId', as: 'ratings' });

EducationRating.belongsTo(Admin, { foreignKey: 'createdById', as: 'ratedBy' });
Admin.hasMany(EducationRating, { foreignKey: 'createdById', as: 'givenEducationRatings' });

// Education Student relationships
EducationStudent.belongsTo(Education, { foreignKey: 'educationId', as: 'education' });
Education.hasMany(EducationStudent, { foreignKey: 'educationId', as: 'students' });

// Education Attendance relationships
EducationAttendance.belongsTo(Education, { foreignKey: 'educationId', as: 'education' });
Education.hasMany(EducationAttendance, { foreignKey: 'educationId', as: 'attendance' });

EducationAttendance.belongsTo(EducationStudent, { foreignKey: 'studentId', as: 'student' });
EducationStudent.hasMany(EducationAttendance, { foreignKey: 'studentId', as: 'attendance' });

// Employee Evaluation relationships
EmployeeEvaluation.belongsTo(Employee, { foreignKey: 'employeeId', as: 'employee' });
Employee.hasMany(EmployeeEvaluation, { foreignKey: 'employeeId', as: 'evaluations' });

EmployeeEvaluation.belongsTo(Admin, { foreignKey: 'createdById', as: 'evaluator' });
Admin.hasMany(EmployeeEvaluation, { foreignKey: 'createdById', as: 'createdEvaluations' });

// Employee Activity relationships
EmployeeActivity.belongsTo(Employee, { foreignKey: 'employeeId', as: 'employee' });
Employee.hasMany(EmployeeActivity, { foreignKey: 'employeeId', as: 'activities' });

// Workshop relationships
Workshop.belongsTo(Admin, { foreignKey: 'createdById', as: 'creator', constraints: false });
Workshop.belongsTo(Employee, { foreignKey: 'assignedEmployeeId', as: 'assignedEmployee' });
Employee.hasMany(Workshop, { foreignKey: 'assignedEmployeeId', as: 'assignedWorkshops' });
Workshop.hasMany(WorkshopStudent, { foreignKey: 'workshopId', as: 'students' });
WorkshopStudent.belongsTo(Workshop, { foreignKey: 'workshopId', as: 'workshop' });

// Registration Closure relationships
RegistrationClosure.belongsTo(Admin, { foreignKey: 'createdById', as: 'creator', constraints: false });
Admin.hasMany(RegistrationClosure, { foreignKey: 'createdById', as: 'createdClosures' });

// Sync database
const syncDatabase = async () => {
  try {
    // Run migrations for ENUM to VARCHAR conversions
    try {
      // Check if tasks table exists and section column is ENUM, then convert to VARCHAR
      const [taskColumns] = await sequelize.query(
        "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'section'"
      );
      if (taskColumns.length > 0 && taskColumns[0].DATA_TYPE === 'enum') {
        console.log('🔄 Migrating tasks.section from ENUM to VARCHAR...');
        await sequelize.query('ALTER TABLE tasks MODIFY COLUMN section VARCHAR(255)');
        console.log('✅ tasks.section migrated to VARCHAR successfully.');
      }
    } catch (migrationError) {
      // Table might not exist yet, that's okay
      if (!migrationError.message.includes("doesn't exist")) {
        console.log('Migration note:', migrationError.message);
      }
    }

    // Migrate tasks.status ENUM to include 'uncompleted'
    try {
      const [taskStatusCol] = await sequelize.query(
        "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'status'"
      );
      if (taskStatusCol.length > 0 && !taskStatusCol[0].COLUMN_TYPE.includes('uncompleted')) {
        console.log('🔄 Migrating tasks.status ENUM to include uncompleted...');
        await sequelize.query("ALTER TABLE tasks MODIFY COLUMN status ENUM('pending','in_progress','completed','cancelled','uncompleted') DEFAULT 'pending'");
        console.log('✅ tasks.status ENUM updated successfully.');
      }
    } catch (migrationError) {
      if (!migrationError.message.includes("doesn't exist")) {
        console.log('Migration note:', migrationError.message);
      }
    }

    // Migrate tasks.status ENUM to include 'pending_review'
    try {
      await sequelize.query("ALTER TYPE \"enum_tasks_status\" ADD VALUE IF NOT EXISTS 'pending_review'");
      console.log('✅ tasks.status ENUM includes pending_review.');
    } catch (migrationError) {
      if (!migrationError.message.includes("doesn't exist") && !migrationError.message.includes('already exists')) {
        console.log('Migration note:', migrationError.message);
      }
    }

    // FabLab visits: ensure the sequential visitNumber column exists and
    // backfill any pre-existing rows so every visit has a number.
    try {
      await sequelize.query(
        `ALTER TABLE fablab_visits ADD COLUMN IF NOT EXISTS "visitNumber" INTEGER`
      );
      await sequelize.query(
        `UPDATE fablab_visits fv
            SET "visitNumber" = sub.rn
           FROM (
             SELECT "visitId",
                    ROW_NUMBER() OVER (ORDER BY "createdAt") AS rn
               FROM fablab_visits
              WHERE "visitNumber" IS NULL
           ) sub
          WHERE fv."visitId" = sub."visitId"`
      );
      try {
        await sequelize.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS fablab_visits_number_uniq ON fablab_visits ("visitNumber")`
        );
      } catch (_) { /* index may already exist */ }
    } catch (migrationError) {
      if (!/does not exist/i.test(migrationError.message)) {
        console.log('fablab_visits.visitNumber migration note:', migrationError.message);
      }
    }

    // Add the two new FabLab sections to every ENUM that hard-codes the
    // section list: registrations, section_availabilities, summer_programs.
    // Idempotent thanks to IF NOT EXISTS.
    try {
      await sequelize.query("ALTER TYPE \"enum_registrations_fablabSection\" ADD VALUE IF NOT EXISTS 'CNC Metal'");
      await sequelize.query("ALTER TYPE \"enum_registrations_fablabSection\" ADD VALUE IF NOT EXISTS 'UV Printing and Sticker Making'");
    } catch (migrationError) {
      if (!migrationError.message.includes("doesn't exist") && !migrationError.message.includes('already exists')) {
        console.log('registrations.fablabSection ENUM migration note:', migrationError.message);
      }
    }
    try {
      await sequelize.query("ALTER TYPE \"enum_section_availabilities_section\" ADD VALUE IF NOT EXISTS 'CNC Metal'");
      await sequelize.query("ALTER TYPE \"enum_section_availabilities_section\" ADD VALUE IF NOT EXISTS 'UV Printing and Sticker Making'");
    } catch (migrationError) {
      if (!migrationError.message.includes("doesn't exist") && !migrationError.message.includes('already exists')) {
        console.log('SectionAvailabilities.section ENUM migration note:', migrationError.message);
      }
    }
    try {
      await sequelize.query("ALTER TYPE \"enum_summer_programs_fablabSection\" ADD VALUE IF NOT EXISTS 'CNC Metal'");
      await sequelize.query("ALTER TYPE \"enum_summer_programs_fablabSection\" ADD VALUE IF NOT EXISTS 'UV Printing and Sticker Making'");
    } catch (migrationError) {
      if (!migrationError.message.includes("doesn't exist") && !migrationError.message.includes('already exists')) {
        console.log('summer_programs.fablabSection ENUM migration note:', migrationError.message);
      }
    }

    // Migrate manager_todos.status ENUM to include 'in_progress' and 'cancelled'
    try {
      const [todoStatusCol] = await sequelize.query(
        "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'manager_todos' AND COLUMN_NAME = 'status'"
      );
      if (todoStatusCol.length > 0 && !todoStatusCol[0].COLUMN_TYPE.includes('in_progress')) {
        console.log('🔄 Migrating manager_todos.status ENUM to include in_progress and cancelled...');
        await sequelize.query("ALTER TABLE manager_todos MODIFY COLUMN status ENUM('pending','in_progress','completed','cancelled') DEFAULT 'pending'");
        console.log('✅ manager_todos.status ENUM updated successfully.');
      }
    } catch (migrationError) {
      if (!migrationError.message.includes("doesn't exist")) {
        console.log('Migration note:', migrationError.message);
      }
    }

    // Sequelize's sync({ alter: true }) is unreliable at adding JSON
    // columns on Postgres, so we explicitly add SummerProgram.teacherIds
    // if it's missing. Idempotent — safe to run on every boot.
    try {
      await sequelize.query(
        `ALTER TABLE summer_programs ADD COLUMN IF NOT EXISTS "teacherIds" JSON DEFAULT '[]'::json`
      );
    } catch (migrationError) {
      if (!/does not exist/i.test(migrationError.message)) {
        console.log('summer_programs.teacherIds migration note:', migrationError.message);
      }
    }

    // Same story for the per-program color column.
    try {
      await sequelize.query(
        `ALTER TABLE summer_programs ADD COLUMN IF NOT EXISTS "color" VARCHAR(20)`
      );
    } catch (migrationError) {
      if (!/does not exist/i.test(migrationError.message)) {
        console.log('summer_programs.color migration note:', migrationError.message);
      }
    }

    // Employees can now work in multiple FabLab sections. Add the JSON
    // array column + backfill it from the legacy single `section`.
    try {
      await sequelize.query(
        `ALTER TABLE employees ADD COLUMN IF NOT EXISTS "sections" JSON DEFAULT '[]'::json`
      );
    } catch (migrationError) {
      if (!/does not exist/i.test(migrationError.message)) {
        console.log('employees.sections migration note:', migrationError.message);
      }
    }
    try {
      const [rows] = await sequelize.query(
        `UPDATE employees
            SET "sections" = json_build_array("section")
          WHERE "section" IS NOT NULL
            AND ("sections" IS NULL OR "sections"::text = '[]')
        RETURNING "employeeId"`
      );
      if (Array.isArray(rows) && rows.length > 0) {
        console.log(`👥 Backfilled sections[] on ${rows.length} employee(s).`);
      }
    } catch (backfillError) {
      if (!/does not exist/i.test(backfillError.message)) {
        console.log('employees.sections backfill note:', backfillError.message);
      }
    }

    // One-shot backfill: link volunteers whose names appear in some
    // program's sectionVolunteers JSON array but whose summerProgramId
    // is still NULL. Idempotent — only touches unlinked volunteers, so
    // it never clobbers a manual link done via the Volunteers tab.
    // Runs every boot but is a no-op once the data is aligned.
    try {
      const [rows] = await sequelize.query(
        `UPDATE volunteers v
            SET "summerProgramId" = sub.program_id
           FROM (
             SELECT p."programId" AS program_id,
                    jsonb_array_elements_text(p."sectionVolunteers"::jsonb) AS vname
               FROM summer_programs p
              WHERE p."isActive" = true
                AND p."sectionVolunteers" IS NOT NULL
                AND jsonb_typeof(p."sectionVolunteers"::jsonb) = 'array'
           ) sub
          WHERE v.name = sub.vname
            AND v."summerProgramId" IS NULL
        RETURNING v."volunteerId"`
      );
      if (Array.isArray(rows) && rows.length > 0) {
        console.log(`👥 Backfilled ${rows.length} volunteer link(s) from sectionVolunteers.`);
      }
    } catch (backfillError) {
      if (!/does not exist/i.test(backfillError.message)) {
        console.log('volunteers.summerProgramId backfill note:', backfillError.message);
      }
    }

    // Profile photo + national-ID photo columns for the three types
    // that carry a printable QR ID card. Adds both fields on every
    // boot so an admin can upload the ID scan and the portrait
    // separately.
    try {
      await sequelize.query(
        `ALTER TABLE trainer_assistants ADD COLUMN IF NOT EXISTS "nationalIdPhoto" TEXT`
      );
      await sequelize.query(
        `ALTER TABLE trainer_assistants ADD COLUMN IF NOT EXISTS "profilePhoto" TEXT`
      );
      await sequelize.query(
        `ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS "profilePhoto" TEXT`
      );
      await sequelize.query(
        `ALTER TABLE fablab_staff ADD COLUMN IF NOT EXISTS "profilePhoto" TEXT`
      );
      // FabLab staff attendance gets overtime annotation fields —
      // reason (why they stayed late) + approvedBy (which manager
      // signed off). Both are set later via the overtime admin UI.
      await sequelize.query(
        `ALTER TABLE fablab_staff_attendance ADD COLUMN IF NOT EXISTS "reason" TEXT`
      );
      await sequelize.query(
        `ALTER TABLE fablab_staff_attendance ADD COLUMN IF NOT EXISTS "approvedBy" VARCHAR(255)`
      );
      // Overtime approval workflow. Existing rows default to
      // 'approved' so anything historical stays printable — only
      // NEW requests go through the manager approval flow.
      await sequelize.query(
        `ALTER TABLE overtime_requests ADD COLUMN IF NOT EXISTS "approvalStatus" VARCHAR(16) DEFAULT 'approved'`
      );
      await sequelize.query(
        `ALTER TABLE overtime_requests ADD COLUMN IF NOT EXISTS "approvalToken" UUID`
      );
      await sequelize.query(
        `ALTER TABLE overtime_requests ADD COLUMN IF NOT EXISTS "managerEmail" VARCHAR(255)`
      );
      await sequelize.query(
        `ALTER TABLE overtime_requests ADD COLUMN IF NOT EXISTS "sentForApprovalAt" TIMESTAMP WITH TIME ZONE`
      );
      await sequelize.query(
        `ALTER TABLE overtime_requests ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP WITH TIME ZONE`
      );
      await sequelize.query(
        `ALTER TABLE overtime_requests ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP WITH TIME ZONE`
      );
      await sequelize.query(
        `ALTER TABLE overtime_requests ADD COLUMN IF NOT EXISTS "managerNote" TEXT`
      );
      try {
        await sequelize.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS overtime_approval_token_uniq ON overtime_requests ("approvalToken")`
        );
      } catch (_) { /* index may already exist */ }
      // Workshop student per-scan timestamps so the unified attendance
      // board can render the actual scan time next to each student.
      await sequelize.query(
        `ALTER TABLE workshop_students ADD COLUMN IF NOT EXISTS "attendanceScans" JSONB DEFAULT '[]'::jsonb`
      );
    } catch (migrationError) {
      if (!/does not exist/i.test(migrationError.message)) {
        console.log('profilePhoto columns migration note:', migrationError.message);
      }
    }

    // Volunteer opportunities gain an optional daily time window so
    // the QR check-out can auto-mark attendance across a volunteer's
    // multiple chances on the same day.
    try {
      await sequelize.query(
        `ALTER TABLE volunteer_opportunities ADD COLUMN IF NOT EXISTS "dailyStartTime" VARCHAR(5)`
      );
      await sequelize.query(
        `ALTER TABLE volunteer_opportunities ADD COLUMN IF NOT EXISTS "dailyEndTime" VARCHAR(5)`
      );
    } catch (migrationError) {
      if (!/does not exist/i.test(migrationError.message)) {
        console.log('volunteer_opportunities.dailyTime migration note:', migrationError.message);
      }
    }

    // Public share fields on volunteers. Sequelize's sync({ alter: true })
    // won't add a UNIQUE UUID column reliably, so we add the columns
    // ourselves and backfill shareToken for any existing rows before
    // enforcing NOT NULL / UNIQUE.
    try {
      await sequelize.query(
        `ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS "driveUrl" TEXT`
      );
      await sequelize.query(
        `ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS "shareEnabled" BOOLEAN DEFAULT false`
      );
      await sequelize.query(
        `ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS "shareToken" UUID`
      );
      await sequelize.query(
        `ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS "shareFromDate" DATE`
      );
      await sequelize.query(
        `ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS "shareToDate" DATE`
      );
      await sequelize.query(
        `UPDATE volunteers SET "shareToken" = gen_random_uuid() WHERE "shareToken" IS NULL`
      );
      // Best-effort — index/constraint may already exist from a prior boot.
      try {
        await sequelize.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS volunteers_share_token_uniq ON volunteers ("shareToken")`
        );
      } catch (_) { /* ignore duplicate-index race */ }
    } catch (migrationError) {
      if (!/does not exist/i.test(migrationError.message)) {
        console.log('volunteers.share fields migration note:', migrationError.message);
      }
    }

    // Backfill: for any program that still has the legacy single
    // teacherId set but an empty teacherIds array, seed the array from
    // the single field so existing programs render correctly under the
    // new multi-teacher UI.
    try {
      await sequelize.query(
        `UPDATE summer_programs
            SET "teacherIds" = json_build_array("teacherId")
          WHERE "teacherId" IS NOT NULL
            AND ("teacherIds" IS NULL OR "teacherIds"::text = '[]')`
      );
    } catch (backfillError) {
      if (!/does not exist/i.test(backfillError.message)) {
        console.log('summer_programs.teacherIds backfill note:', backfillError.message);
      }
    }

    await sequelize.sync({ alter: true });
    console.log('✅ Database synchronized successfully.');

    // Seed default settings
    await Settings.seedDefaults();

    // Ensure every Mawhba deployment has at least one season. If no
    // seasons exist we create the first season as active and back-fill
    // every existing student to it so nothing loses its roster context
    // after the upgrade.
    try {
      const seasonCount = await MawhbaSeason.count();
      if (seasonCount === 0) {
        const season = await MawhbaSeason.create({
          name: 'موهبة 2026',
          year: 2026,
          isActive: true
        });
        await MawhbaStudent.update(
          { seasonId: season.seasonId },
          { where: { seasonId: null } }
        );
        console.log('Seeded default Mawhba season 2026 and back-filled existing students.');
      }
    } catch (e) {
      console.log('Mawhba season seed note:', e.message);
    }
  } catch (error) {
    console.error('❌ Error synchronizing database:', error);
  }
};

module.exports = {
  sequelize,
  testConnection,
  User,
  Registration,
  Admin,
  Employee,
  Task,
  Rating,
  Volunteer,
  VolunteerOpportunity,
  VolunteerRating,
  Worker,
  WorkerOpportunity,
  WorkerRating,
  VolunteerReceipt,
  WorkerReceipt,
  SummerProgram,
  SummerTeacher,
  SummerTeacherRating,
  SummerStudent,
  Intern,
  InternTraining,
  InternRating,
  InternAttendance,
  ManagerTodo,
  ManagerTodoHistory,
  Workspace,
  WorkspaceRating,
  SectionAvailability,
  EliteUser,
  EliteRating,
  EliteCredit,
  EliteTask,
  EliteWork,
  EliteSchedule,
  EliteCourse,
  EliteCourseLesson,
  EliteCourseEnrollment,
  EliteLessonProgress,
  EliteCourseQuiz,
  EliteQuizQuestion,
  EliteQuizAttempt,
  Settings,
  WorkingHoursOverride,
  Borrowing,
  Education,
  EducationRating,
  EducationStudent,
  EducationAttendance,
  EmployeeEvaluation,
  EmployeeActivity,
  Workshop,
  WorkshopStudent,
  RegistrationClosure,
  MawhbaStudent,
  MawhbaCourseColor,
  MawhbaAttendance,
  MawhbaSeason,
  VolunteerAttendance,
  FablabStaff,
  FablabStaffAttendance,
  OvertimeRequest,
  TrainerAssistant,
  TrainerAssignment,
  TrainerAssistantAttendance,
  Customer,
  Contract,
  SummerStudentAttendance,
  FablabVisit,
  CalendarEvent,
  syncDatabase
};
