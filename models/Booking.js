const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['flight', 'hotel', 'ground'], required: true },
  details: {
    flightId: String,
    airline: String,
    flightNumber: String,
    origin: String,
    destination: String,
    departureDate: Date,
    arrivalDate: Date,
    price: Number,
    currency: String,
    
    hotelId: String,
    hotelName: String,
    checkIn: Date,
    checkOut: Date,
    roomType: String,
    
    groundType: String,
    company: String,
    
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
    bookingReference: String
  },
  totalPrice: Number,
  currency: String,
  bookingDate: { type: Date, default: Date.now },
  notes: String,
  reimbursementStatus: { type: String, enum: ['pending', 'paid', 'denied'], default: 'pending' }
});

module.exports = mongoose.model('Booking', bookingSchema);