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
const Customer = require('./Customer');
const Contract = require('./Contract');

MawhbaAttendance.belongsTo(MawhbaStudent, { foreignKey: 'studentId', as: 'student', constraints: false });
MawhbaStudent.hasMany(MawhbaAttendance, { foreignKey: 'studentId', as: 'attendance', constraints: false });

MawhbaStudent.belongsTo(MawhbaSeason, { foreignKey: 'seasonId', as: 'season', constraints: false });
MawhbaSeason.hasMany(MawhbaStudent, { foreignKey: 'seasonId', as: 'students', constraints: false });

VolunteerAttendance.belongsTo(Volunteer, { foreignKey: 'volunteerId', as: 'volunteer', constraints: false });
Volunteer.hasMany(VolunteerAttendance, { foreignKey: 'volunteerId', as: 'attendance', constraints: false });

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
  Customer,
  Contract,
  syncDatabase
};
