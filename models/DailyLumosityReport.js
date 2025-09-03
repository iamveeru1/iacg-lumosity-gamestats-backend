const mongoose = require('mongoose');
const { schema: lumosityStatSchema } = require('./LumosityStat'); // Import the schema, not the model

const dailyLumosityReportSchema = new mongoose.Schema({
  reportDate: { type: Date, required: true, unique: true, index: true },
  stats: [lumosityStatSchema], // Array of individual user stats for the day
  userCount: { type: Number, required: true },
});

const DailyLumosityReport = mongoose.model('DailyLumosityReport', dailyLumosityReportSchema);

module.exports = DailyLumosityReport;