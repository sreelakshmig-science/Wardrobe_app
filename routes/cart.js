const express = require('express');
const CartItem = require('../models/CartItem');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const items = await CartItem.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json(items);
});

router.post('/', async (req, res) => {
  const { clothId, name, img } = req.body;
  if (!name || !img) return res.status(400).json({ error: 'name and img are required' });
  const item = await CartItem.create({ userId: req.userId, clothId, name, img });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await CartItem.deleteOne({ _id: req.params.id, userId: req.userId });
  res.json({ ok: true });
});

module.exports = router;
