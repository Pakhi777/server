const Joi = require('joi');

const createTaskSchema = Joi.object({
  title: Joi.string().min(2).max(300).required(),
  description: Joi.string().max(2000).allow('', null),
  status: Joi.string().valid('todo', 'in_progress', 'done').default('todo'),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
  dueDate: Joi.date().iso().allow(null),
  assignedTo: Joi.string().uuid().allow(null),
  projectId: Joi.string().uuid().required(),
});

const updateTaskSchema = Joi.object({
  title: Joi.string().min(2).max(300),
  description: Joi.string().max(2000).allow('', null),
  status: Joi.string().valid('todo', 'in_progress', 'done'),
  priority: Joi.string().valid('low', 'medium', 'high'),
  dueDate: Joi.date().iso().allow(null),
  assignedTo: Joi.string().uuid().allow(null),
});

module.exports = { createTaskSchema, updateTaskSchema };
