require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const wardrobeRoutes = require('./routes/wardrobe');
const cartRoutes = require('./routes/cart');

const app = express();

app.use(cors()); // for a personal project, wide-open CORS is fine; lock to your frontend origin if you want
app.use(express.json({ limit: '15mb' })); // clothing photos are base64, so raise the default body size limit

app.get('/', (req, res) => res.send('Wardrobe API is running.'));
app.use('/api/auth', authRoutes);
app.use('/api/wardrobe', wardrobeRoutes);
app.use('/api/cart', cartRoutes);

const PORT = process.env.PORT || 4000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
