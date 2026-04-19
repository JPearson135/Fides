const router = require('express').Router();
const Booking = require('../models/Booking');
const User = require('../models/User');
const { authMiddleware } = require('./auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.userId }).sort({ bookingDate: -1 });
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const booking = new Booking({
      userId: req.userId,
      ...req.body
    });
    await booking.save();
    res.json({ booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/from-approval', authMiddleware, async (req, res) => {
  try {
    const manager = await User.findById(req.userId).select('role');
    if (!manager || manager.role !== 'manager') {
      return res.status(403).json({ error: 'Only managers can create approved bookings.' });
    }

    const { employeeId, tripName, dates, bookingData, hotelNights = 1 } = req.body;
    if (!employeeId || !bookingData) {
      return res.status(400).json({ error: 'employeeId and bookingData are required.' });
    }

    const employee = await User.findById(employeeId).select('managerId');
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    if (employee.managerId && String(employee.managerId) !== String(req.userId)) {
      return res.status(403).json({ error: 'You can only approve bookings for your direct reports.' });
    }

    const notes = `Approved trip: ${tripName || 'Untitled trip'}${dates ? ` (${dates})` : ''}`;
    const records = [];

    if (bookingData.flight) {
      const f = bookingData.flight;
      records.push({
        userId: employeeId,
        type: 'flight',
        details: {
          flightId: f.id,
          airline: f.airline,
          flightNumber: f.flightNumber,
          departureDate: f.departsAt,
          arrivalDate: f.arrivesAt,
          price: parseFloat(f.price) || 0,
          currency: f.currency || 'USD',
          status: 'confirmed'
        },
        totalPrice: parseFloat(f.price) || 0,
        currency: f.currency || 'USD',
        notes
      });
    }

    if (bookingData.hotel) {
      const h = bookingData.hotel;
      const nights = Math.max(1, Number(hotelNights) || 1);
      const nightly = parseFloat(h.price) || 0;
      records.push({
        userId: employeeId,
        type: 'hotel',
        details: {
          hotelId: h.id,
          hotelName: h.name,
          checkIn: h.checkIn,
          checkOut: h.checkOut,
          price: nightly,
          currency: h.currency || 'USD',
          status: 'confirmed'
        },
        totalPrice: nightly * nights,
        currency: h.currency || 'USD',
        notes: `${notes} · ${nights} night${nights === 1 ? '' : 's'}`
      });
    }

    if (bookingData.ground) {
      const g = bookingData.ground;
      const parsed = String(g.price || '').match(/\d+(?:\.\d+)?/);
      records.push({
        userId: employeeId,
        type: 'ground',
        details: {
          groundType: g.name,
          company: g.note,
          status: 'confirmed'
        },
        totalPrice: parsed ? parseFloat(parsed[0]) : 0,
        currency: 'USD',
        notes
      });
    }

    if (!records.length) {
      return res.status(400).json({ error: 'No booking data to persist.' });
    }

    const bookings = await Booking.insertMany(records);
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { 'details.status': req.body.status } },
      { new: true }
    );
    res.json({ booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HR: update reimbursement status on any booking
router.patch('/:id/reimbursement', authMiddleware, async (req, res) => {
  try {
    const requester = await User.findById(req.userId).select('role');
    if (!requester || requester.role !== 'hr') {
      return res.status(403).json({ error: 'HR access only.' });
    }
    const { reimbursementStatus } = req.body;
    if (!['pending', 'paid', 'denied'].includes(reimbursementStatus)) {
      return res.status(400).json({ error: 'Invalid reimbursementStatus.' });
    }
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: { reimbursementStatus } },
      { new: true }
    ).populate('userId', 'email displayName');
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    res.json({ booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await Booking.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Booking cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;