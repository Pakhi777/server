const express = require('express');
const { Op } = require('sequelize');
const { Task, Project, ProjectMember } = require('../models');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/stats', async (req, res) => {
  try {
    let projects, taskFilter;

    if (req.user.role === 'admin') {
      projects = await Project.findAll({ where: { status: 'active' }, attributes: ['id'] });
      const projectIds = projects.map(p => p.id);
      taskFilter = { projectId: { [Op.in]: projectIds } };
    } else {
      const memberships = await ProjectMember.findAll({
        where: { userId: req.user.id },
        include: [{ model: Project, where: { status: 'active' }, attributes: ['id'] }],
      });
      const projectIds = memberships.map(m => m.Project.id);
      taskFilter = { projectId: { [Op.in]: projectIds }, assignedTo: req.user.id };
    }

    const totalTasks = await Task.count({ where: taskFilter });
    const todoTasks = await Task.count({ where: { ...taskFilter, status: 'todo' } });
    const inProgressTasks = await Task.count({ where: { ...taskFilter, status: 'in_progress' } });
    const doneTasks = await Task.count({ where: { ...taskFilter, status: 'done' } });
    const overdueTasks = await Task.count({
      where: {
        ...taskFilter,
        dueDate: { [Op.lt]: new Date().toISOString().split('T')[0] },
        status: { [Op.ne]: 'done' },
      },
    });

    const totalProjects = req.user.role === 'admin'
      ? projects.length
      : memberships.length;

    const recentTasks = await Task.findAll({
      where: taskFilter,
      include: [
        { association: 'assignee', attributes: ['id', 'name'] },
        { association: 'creator', attributes: ['id', 'name'] },
      ],
      order: [['updatedAt', 'DESC']],
      limit: 10,
    });

    res.json({
      totalTasks,
      todoTasks,
      inProgressTasks,
      doneTasks,
      overdueTasks,
      totalProjects,
      recentTasks,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
