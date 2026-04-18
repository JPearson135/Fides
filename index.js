require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use('/api/auth', require('./routes/auth'));

const path = require('path');
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Login.html'));
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(process.env.PORT, () => console.log(`API running on port ${process.env.PORT}`));
  })
  .catch(err => console.error(err));