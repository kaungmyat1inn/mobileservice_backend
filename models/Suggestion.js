const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['model', 'color', 'issue'],
    required: true
  },
  value: {
    type: String,
    required: true,
    trim: true,
  },
  frequency: {
    type: Number,
    default: 1
  }
}, { timestamps: true });

// Make it unique per type & value to increment frequency
suggestionSchema.index({ type: 1, value: 1 }, { unique: true });

module.exports = mongoose.model('Suggestion', suggestionSchema);
