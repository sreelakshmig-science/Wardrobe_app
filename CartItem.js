const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  clothId: { type: String },
  name: { type: String, required: true },
  img: { type: String, required: true }, // base64 snapshot
}, { timestamps: true });

module.exports = mongoose.model('CartItem', cartItemSchema);
