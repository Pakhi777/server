const express = require('express');
const { Project, ProjectMember, User, Task } = require('../models');
const authenticate = require('../middleware/auth');
const { requireRole, requireProjectRole } = require('../middleware/rbac');
const { createProjectSchema, addMemberSchema } = require('../validations/project');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    let projects;
    if (req.user.role === 'admin') {
      projects = await Project.findAll({
        where: { status: 'active' },
        include: [{
          model: User,
          attributes: ['id', 'name', 'email'],
          through: { attributes: ['role'] },
        }],
      });
    } else {
      const memberships = await ProjectMember.findAll({
        where: { userId: req.user.id },
        include: [{
          model: Project,
          where: { status: 'active' },
          include: [{
            model: User,
            attributes: ['id', 'name', 'email'],
            through: { attributes: ['role'] },
          }],
        }],
      });
      projects = memberships.map(m => m.Project).filter(Boolean);
    }
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { error, value } = createProjectSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const project = await Project.create({ ...value, createdBy: req.user.id });
    await ProjectMember.create({
      projectId: project.id,
      userId: req.user.id,
      role: 'admin',
    });

    const result = await Project.findByPk(project.id, {
      include: [{
        model: User,
        attributes: ['id', 'name', 'email'],
        through: { attributes: ['role'] },
      }],
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id, {
      include: [{
        model: User,
        attributes: ['id', 'name', 'email'],
        through: { attributes: ['role'] },
      }],
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const membership = await ProjectMember.findOne({
      where: { projectId: project.id, userId: req.user.id },
    });
    if (!membership && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', requireProjectRole('admin'), async (req, res) => {
  try {
    const { error, value } = createProjectSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    await req.membership.getProject().then(p => p.update(value));
    const project = await Project.findByPk(req.params.id, {
      include: [{
        model: User,
        attributes: ['id', 'name', 'email'],
        through: { attributes: ['role'] },
      }],
    });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireProjectRole('admin'), async (req, res) => {
  try {
    await Project.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/members', requireProjectRole('admin'), async (req, res) => {
  try {
    const { error, value } = addMemberSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const user = await User.findOne({ where: { email: value.email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existing = await ProjectMember.findOne({
      where: { projectId: req.params.id, userId: user.id },
    });
    if (existing) return res.status(409).json({ error: 'User already a member' });

    const member = await ProjectMember.create({
      projectId: req.params.id,
      userId: user.id,
      role: value.role,
    });

    const result = await User.findByPk(user.id, {
      attributes: ['id', 'name', 'email'],
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/members/:userId', requireProjectRole('admin'), async (req, res) => {
  try {
    await ProjectMember.destroy({
      where: { projectId: req.params.id, userId: req.params.userId },
    });
    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/members', async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const membership = await ProjectMember.findOne({
      where: { projectId: project.id, userId: req.user.id },
    });
    if (!membership && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const members = await ProjectMember.findAll({
      where: { projectId: req.params.id },
      include: [{
        model: User,
        attributes: ['id', 'name', 'email'],
      }],
    });

    res.json(members.map(m => ({
      id: m.User.id,
      name: m.User.name,
      email: m.User.email,
      role: m.role,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
