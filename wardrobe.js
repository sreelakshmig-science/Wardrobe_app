const express = require('express');
const ClothingItem = require('../models/ClothingItem');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// List this user's wardrobe
router.get('/', async (req, res) => {
  const items = await ClothingItem.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json(items);
});

// Add a clothing item
router.post('/', async (req, res) => {
  const { name, cat, img } = req.body;
  if (!name || !cat || !img) return res.status(400).json({ error: 'name, cat and img are required' });
  const item = await ClothingItem.create({ userId: req.userId, name, cat, img });
  res.json(item);
});

// Delete a clothing item (only if it belongs to this user)
router.delete('/:id', async (req, res) => {
  await ClothingItem.deleteOne({ _id: req.params.id, userId: req.userId });
  res.json({ ok: true });
});

module.exports = router;
