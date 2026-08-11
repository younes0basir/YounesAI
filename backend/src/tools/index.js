const createTask = require('./createTask');
const updateTask = require('./updateTask');
const deleteTask = require('./deleteTask');
const listTasks = require('./listTasks');
const createEvent = require('./createEvent');
const updateEvent = require('./updateEvent');
const deleteEvent = require('./deleteEvent');
const listEvents = require('./listEvents');
const searchPlaces = require('./searchPlaces');
const storeMemory = require('./storeMemory');
const retrieveMemory = require('./retrieveMemory');
const searchFiles = require('./searchFiles');
const retrieveDocuments = require('./retrieveDocuments');
const listIndexedFiles = require('./listIndexedFiles');
const generateImage = require('./generateImage');
const createReminder = require('./createReminder');
const deleteReminder = require('./deleteReminder');
const fileManagementTools = require('./fileManagementTools');
const listEmails = require('./listEmails');
const classifyEmail = require('./classifyEmail');
const archiveEmail = require('./archiveEmail');
const summarizeEmail = require('./summarizeEmail');
const createTaskFromEmail = require('./createTaskFromEmail');

module.exports = {
  createTask,
  updateTask,
  deleteTask,
  listTasks,
  createEvent,
  updateEvent,
  deleteEvent,
  listEvents,
  createReminder,
  deleteReminder,
  searchPlaces,
  storeMemory,
  retrieveMemory,
  searchFiles,
  retrieveDocuments,
  listIndexedFiles,
  generateImage,
  listEmails,
  classifyEmail,
  archiveEmail,
  summarizeEmail,
  createTaskFromEmail,
  ...fileManagementTools,
};
