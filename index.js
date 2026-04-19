require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/travel', require('./routes/travel'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/requests', require('./routes/requests'));

app.get('/api/config', (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GENERATIVE_LANGUAGE_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;
  const vertexAiKey = process.env.VERTEX_AI_API_KEY || null;
  const openAiKey = process.env.OPENAI_API_KEY || null;
  const groqKey = process.env.GROQ_API_KEY || null;
  res.json({
    googleMapsKey: process.env.GOOGLE_MAPS_KEY,
    geminiKey,
    vertexAiKey,
    openAiKey,
    groqKey
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Login.html'));
});

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected');
    // Auto-seed HR superuser (idempotent)
    try {
      const bcrypt = require('bcryptjs');
      const User = require('./models/User');
      const exists = await User.findOne({ email: 'hr@fides.com' });
      if (!exists) {
        const hashed = await bcrypt.hash('adminpw', 10);
        await User.create({ email: 'hr@fides.com', password: hashed, role: 'hr', displayName: 'HR Admin' });
        console.log('HR superuser seeded.');
      }
    } catch (e) { console.error('HR seed error:', e.message); }
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`API running on port ${port}`));
  })
  .catch(err => console.error(err));