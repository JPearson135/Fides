const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['employee', 'manager', 'hr'],
    default: 'employee'
  },
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  preferences: {
    darkMode: { type: Boolean, default: false },
    shareLocation: { type: Boolean, default: true },
    priceAlerts: { type: Boolean, default: true },
    approvalReminders: { type: Boolean, default: true },
    preferredRide: { type: String, default: 'No preference' },
    preferredHotel: { type: String, default: 'No preference' },
    preferredAirline: { type: String, default: 'No preference' }
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);