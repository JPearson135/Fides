const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { authMiddleware } = require('./auth');

const LOG_FILE = path.join(__dirname, '../logs.txt');

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { feedback } = req.body;
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] User: ${req.userId} | Feedback: ${feedback}\n`;
    
    fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;