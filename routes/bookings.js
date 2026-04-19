const router = require('express').Router();
const Booking = require('../models/Booking');
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

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await Booking.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Booking cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;