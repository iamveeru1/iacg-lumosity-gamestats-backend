const mongoose = require('mongoose');

const lumosityStatSchema = new mongoose.Schema({
  accountInfo: {
    email: { type: String, required: true },
    study: { type: String },
    extractedAt: { type: Date, required: true },
  },
  date: { type: Date, required: true }, // Date of the data entry
  overallLPI: { type: Number },
  problemSolving: { type: Number },
  speed: { type: Number },
  memory: { type: Number },
  attention: { type: Number },
  flexibility: { type: Number },
  math: { type: Number },
});

// We no longer need to register this as a standalone model if it's only embedded.
// However, keeping it allows for flexibility if you ever need to query individual stats.
const LumosityStat = mongoose.model('LumosityStat', lumosityStatSchema);

// Export both the model and the schema
module.exports = { LumosityStat, schema: lumosityStatSchema };