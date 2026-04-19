const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { authMiddleware } = require('./auth');

const LOG_FILE = path.join(__dirname, '../log.txt');

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { feedback } = req.body;
    if (!feedback || !String(feedback).trim()) {
      return res.status(400).json({ error: 'Feedback is required.' });
    }
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] User: ${req.userId} | Feedback: ${String(feedback).trim()}\n`;

    await fs.promises.appendFile(LOG_FILE, logEntry, 'utf8');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;