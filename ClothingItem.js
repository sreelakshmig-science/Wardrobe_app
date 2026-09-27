const mongoose = require('mongoose');

const clothingItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  cat: { type: String, required: true },
  img: { type: String, required: true }, // base64 data URL
}, { timestamps: true });

module.exports = mongoose.model('ClothingItem', clothingItemSchema);
