const mongoose = require('mongoose');

const travelRequestSchema = new mongoose.Schema({
  employeeId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  managerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  tripName:    { type: String, required: true },
  dates:       { type: String, default: 'TBD' },
  totalCost:   { type: String, default: 'TBD' },
  notes:       { type: String, default: '' },
  managerNote: { type: String, default: '' },
  items: [
    {
      icon:  String,
      label: String,
      price: String
    }
  ],
  bookingData: {
    flight: { type: mongoose.Schema.Types.Mixed, default: null },
    hotel:  { type: mongoose.Schema.Types.Mixed, default: null },
    ground: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  hotelNights: { type: Number, default: 1 },
  mealDays:    { type: Number, default: 0 },
  mealsTotal:  { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied'],
    default: 'pending'
  },
  reimbursed: {
    type: Boolean,
    default: false
  },
  reimbursedDate: {
    type: Date,
    default: null
  },
  reimbursedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('TravelRequest', travelRequestSchema);