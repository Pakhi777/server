const express = require('express');
const { Task, ProjectMember, User, Project } = require('../models');
const authenticate = require('../middleware/auth');
const { requireProjectRole, requireTaskAccess } = require('../middleware/rbac');
const { createTaskSchema, updateTaskSchema } = require('../validations/task');

const router = express.Router();

router.use(authenticate);

router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const membership = await ProjectMember.findOne({
      where: { projectId, userId: req.user.id },
    });
    if (!membership && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    let tasks;
    if (req.user.role === 'admin') {
      tasks = await Task.findAll({
        where: { projectId },
        include: [
          { model: User, as: 'assignee', attributes: ['id', 'name', 'email'] },
          { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        ],
        order: [['createdAt', 'DESC']],
      });
    } else {
      tasks = await Task.findAll({
        where: { projectId, assignedTo: req.user.id },
        include: [
          { model: User, as: 'assignee', attributes: ['id', 'name', 'email'] },
          { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        ],
        order: [['createdAt', 'DESC']],
      });
    }

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireProjectRole('admin', 'member'), async (req, res) => {
  try {
    const { error, value } = createTaskSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    if (req.user.role === 'member' && value.assignedTo && value.assignedTo !== req.user.id) {
      return res.status(403).json({ error: 'Members can only create tasks for themselves' });
    }

    const task = await Task.create({
      ...value,
      assignedTo: value.assignedTo || req.user.id,
      createdBy: req.user.id,
    });

    const result = await Task.findByPk(task.id, {
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
      ],
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', requireTaskAccess, async (req, res) => {
  try {
    const { error, value } = updateTaskSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    if (req.user.role === 'member' && value.assignedTo && value.assignedTo !== req.user.id) {
      return res.status(403).json({ error: 'Cannot reassign task to another user' });
    }

    await req.task.update(value);

    const result = await Task.findByPk(req.task.id, {
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
      ],
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireTaskAccess, async (req, res) => {
  try {
    if (req.user.role === 'member') {
      return res.status(403).json({ error: 'Only admins can delete tasks' });
    }
    await req.task.destroy();
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
