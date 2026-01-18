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

// Sync database
const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ Database synchronized successfully.');
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
  syncDatabase
};
