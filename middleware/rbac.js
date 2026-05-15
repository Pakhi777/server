const { ProjectMember } = require('../models');

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

const requireProjectRole = (...roles) => {
  return async (req, res, next) => {
    try {
      const projectId = req.params.projectId || req.params.id || req.body.projectId;
      if (!projectId) {
        return res.status(400).json({ error: 'Project ID required' });
      }
      const membership = await ProjectMember.findOne({
        where: { projectId, userId: req.user.id },
      });
      if (!membership || !roles.includes(membership.role)) {
        return res.status(403).json({ error: 'Insufficient project permissions' });
      }
      req.membership = membership;
      next();
    } catch (err) {
      return res.status(500).json({ error: 'Server error' });
    }
  };
};

const requireTaskAccess = async (req, res, next) => {
  try {
    const { Task, ProjectMember } = require('../models');
    const task = await Task.findByPk(req.params.id || req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (req.user.role === 'admin') {
      req.task = task;
      return next();
    }
    const membership = await ProjectMember.findOne({
      where: { projectId: task.projectId, userId: req.user.id },
    });
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }
    if (task.assignedTo !== req.user.id) {
      return res.status(403).json({ error: 'You can only access your own tasks' });
    }
    req.task = task;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { requireRole, requireProjectRole, requireTaskAccess };
