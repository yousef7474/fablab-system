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
const Intern = require('./Intern');
const InternTraining = require('./InternTraining');
const InternRating = require('./InternRating');
const ManagerTodo = require('./ManagerTodo');
const Workspace = require('./Workspace');
const WorkspaceRating = require('./WorkspaceRating');
const SectionAvailability = require('./SectionAvailability');
const EliteUser = require('./EliteUser');
const EliteRating = require('./EliteRating');
const EliteCredit = require('./EliteCredit');
const EliteTask = require('./EliteTask');
const EliteWork = require('./EliteWork');
const EliteSchedule = require('./EliteSchedule');
const Settings = require('./Settings');
const WorkingHoursOverride = require('./WorkingHoursOverride');

// Define relationships
User.hasMany(Registration, { foreignKey: 'userId', as: 'registrations' });
Registration.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Task relationships
Task.belongsTo(Employee, { foreignKey: 'employeeId', as: 'assignee' });
Employee.hasMany(Task, { foreignKey: 'employeeId', as: 'tasks' });

Task.belongsTo(Admin, { foreignKey: 'createdById', as: 'creator' });
Admin.hasMany(Task, { foreignKey: 'createdById', as: 'createdTasks' });

// Rating relationships
Rating.belongsTo(Employee, { foreignKey: 'employeeId', as: 'employee' });
Employee.hasMany(Rating, { foreignKey: 'employeeId', as: 'ratings' });

Rating.belongsTo(Admin, { foreignKey: 'createdById', as: 'ratedBy' });
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

// Manager Todo relationships
ManagerTodo.belongsTo(Admin, { foreignKey: 'managerId', as: 'manager' });
Admin.hasMany(ManagerTodo, { foreignKey: 'managerId', as: 'todos' });

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

// Working Hours Override relationships
WorkingHoursOverride.belongsTo(Admin, { foreignKey: 'createdById', as: 'creator' });
Admin.hasMany(WorkingHoursOverride, { foreignKey: 'createdById', as: 'createdOverrides' });

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

    await sequelize.sync({ alter: true });
    console.log('✅ Database synchronized successfully.');

    // Seed default settings
    await Settings.seedDefaults();
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
  Intern,
  InternTraining,
  InternRating,
  ManagerTodo,
  Workspace,
  WorkspaceRating,
  SectionAvailability,
  EliteUser,
  EliteRating,
  EliteCredit,
  EliteTask,
  EliteWork,
  EliteSchedule,
  Settings,
  WorkingHoursOverride,
  syncDatabase
};
