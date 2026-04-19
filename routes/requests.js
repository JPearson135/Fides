const router = require('express').Router();
const TravelRequest = require('../models/TravelRequest');
const User = require('../models/User');
const { authMiddleware } = require('./auth');

// Employee: submit a new travel request
router.post('/', authMiddleware, async (req, res) => {
  try {
    const employee = await User.findById(req.userId).select('managerId role');
    if (!employee) return res.status(404).json({ error: 'User not found.' });

    const requestData = {
      employeeId: req.userId,
      managerId:  employee.managerId || null,
      tripName:   req.body.tripName,
      dates:      req.body.dates || 'TBD',
      totalCost:  req.body.totalCost || 'TBD',
      notes:      req.body.notes || '',
      items:      req.body.items || [],
      bookingData: req.body.bookingData || {},
      hotelNights: req.body.hotelNights || 1,
      mealDays:    req.body.mealDays || 0,
      mealsTotal:  req.body.mealsTotal || 0,
      status: 'pending'
    };

    const travelRequest = await TravelRequest.create(requestData);
    res.json({ request: travelRequest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === SPECIFIC ROUTES (must come before /:id routes) ===

// Get reimbursed requests visible to the current user:
//   - Employee: their own reimbursed requests
//   - Manager: requests where managerId === them (reimbursed) and their own reimbursed requests
//   - HR: all reimbursed requests organized by employee/manager
router.get('/reimbursed/list', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('role');
    if (!user) return res.status(404).json({ error: 'User not found.' });

    let query = { reimbursed: true };
    if (user.role === 'employee') {
      query.employeeId = req.userId;
    } else if (user.role === 'manager') {
      query.$or = [
        { managerId: req.userId },
        { employeeId: req.userId }
      ];
    }
    // HR sees all reimbursed (empty additional query)

    const requests = await TravelRequest.find(query)
      .sort({ reimbursedDate: -1 })
      .populate('employeeId', 'email displayName')
      .populate('managerId',  'email displayName')
      .populate('reimbursedBy', 'email displayName');

    // For HR, organize by employee/manager
    if (user.role === 'hr') {
      const organized = {};
      requests.forEach(req => {
        const entityId = req.managerId ? req.managerId._id : req.employeeId._id;
        const entityName = req.managerId ? `Manager: ${req.managerId.displayName || req.managerId.email}` : `${req.employeeId.displayName || req.employeeId.email}`;
        if (!organized[entityName]) {
          organized[entityName] = [];
        }
        organized[entityName].push(req);
      });
      return res.json({ reimbursedRequests: { organized, all: requests } });
    }

    res.json({ reimbursedRequests: requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HR: Get all reimbursement data for dashboard
router.get('/reimbursements/summary', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('role');
    if (!user || user.role !== 'hr') {
      return res.status(403).json({ error: 'HR access only.' });
    }

    const summary = await TravelRequest.aggregate([
      { $match: { reimbursed: true } },
      {
        $group: {
          _id: '$managerId',
          count: { $sum: 1 },
          employees: { $push: '$employeeId' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'manager'
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HR: Get reimbursed trips by employee/manager
router.get('/reimbursements/by-person/:personId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('role');
    if (!user || user.role !== 'hr') {
      return res.status(403).json({ error: 'HR access only.' });
    }

    const requests = await TravelRequest.find({
      reimbursed: true,
      $or: [
        { employeeId: req.params.personId },
        { managerId: req.params.personId }
      ]
    })
      .sort({ reimbursedDate: -1 })
      .populate('employeeId', 'email displayName')
      .populate('managerId', 'email displayName')
      .populate('reimbursedBy', 'email displayName');

    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HR: Mark a trip as reimbursed
router.patch('/:id/reimburse', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('role');
    if (!user || user.role !== 'hr') {
      return res.status(403).json({ error: 'Only HR can mark trips as reimbursed.' });
    }

    const travelRequest = await TravelRequest.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          reimbursed: true,
          reimbursedDate: new Date(),
          reimbursedBy: req.userId
        }
      },
      { new: true }
    ).populate('employeeId', 'email displayName')
     .populate('managerId', 'email displayName')
     .populate('reimbursedBy', 'email displayName');

    if (!travelRequest) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    res.json({ request: travelRequest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === GENERIC ROUTES (must come after specific routes) ===

// Get requests visible to the current user (non-reimbursed only):
//   - Employee: their own requests
//   - Manager: requests where managerId === them and their own requests
//   - HR: all requests
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('role');
    if (!user) return res.status(404).json({ error: 'User not found.' });

    let query = { reimbursed: false };
    if (user.role === 'employee') {
      query.employeeId = req.userId;
    } else if (user.role === 'manager') {
      query.$or = [
        { managerId: req.userId },
        { employeeId: req.userId }
      ];
    }
    // HR sees all non-reimbursed (empty additional query)

    const requests = await TravelRequest.find(query)
      .sort({ submittedAt: -1 })
      .populate('employeeId', 'email displayName')
      .populate('managerId',  'email displayName');

    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manager: approve or deny a request
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const manager = await User.findById(req.userId).select('role');
    if (!manager || manager.role !== 'manager') {
      return res.status(403).json({ error: 'Only managers can update request status.' });
    }

    const { status, managerNote } = req.body;
    if (!['approved', 'denied'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved or denied.' });
    }

    const travelRequest = await TravelRequest.findOneAndUpdate(
      { _id: req.params.id, managerId: req.userId },
      { $set: { status, managerNote: managerNote || '' } },
      { new: true }
    ).populate('employeeId', 'email displayName');

    if (!travelRequest) {
      return res.status(404).json({ error: 'Request not found or not assigned to you.' });
    }

    res.json({ request: travelRequest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete employee's own request (only if still pending)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const travelRequest = await TravelRequest.findOneAndDelete({
      _id: req.params.id,
      employeeId: req.userId,
      status: 'pending'
    });
    if (!travelRequest) {
      return res.status(404).json({ error: 'Request not found or cannot be deleted.' });
    }
    res.json({ message: 'Request deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Also delete requests when an employee's account is deleted (called internally)
module.exports = router;