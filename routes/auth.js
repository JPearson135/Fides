const router = require('express').Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

router.post('/register', async (req, res) => {
  try {
    const hashed = await bcrypt.hash(req.body.password, 10);
    const userData = {
      email: req.body.email,
      password: hashed,
      role: req.body.role || 'employee'
    };
    if (req.body.managerId) userData.managerId = req.body.managerId;
    const user = await User.create(userData);
    res.json({ message: 'User created' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'That email has already been taken.' });
    }
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const valid = await bcrypt.compare(req.body.password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName || '',
        role: user.role || 'employee',
        managerId: user.managerId || null,
        preferences: user.preferences || {}
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password').populate('managerId', 'email displayName');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/me', authMiddleware, async (req, res) => {
  try {
    const updates = {};
    if (req.body.displayName !== undefined) updates.displayName = req.body.displayName;
    if (req.body.preferences !== undefined) updates.preferences = req.body.preferences;
    if (req.body.managerId !== undefined) updates.managerId = req.body.managerId || null;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true }
    ).select('-password').populate('managerId', 'email displayName');

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public — used on the registration page before the user has a token
router.get('/managers-public', async (req, res) => {
  try {
    const managers = await User.find({ role: 'manager' }).select('_id email displayName');
    res.json({ managers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Authenticated — used inside the app
router.get('/managers', authMiddleware, async (req, res) => {
  try {
    const managers = await User.find({ role: 'manager' }).select('_id email displayName');
    res.json({ managers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;