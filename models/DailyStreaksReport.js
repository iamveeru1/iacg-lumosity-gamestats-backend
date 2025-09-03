const mongoose = require('mongoose');

// Schema for an individual user's streak data within the daily report
const userStreakSchema = new mongoose.Schema({
  email: { type: String, required: true },
  streaks: {
    current: Number,
    best: Number,
    total: Number,
    monthlyStreaks: mongoose.Schema.Types.Mixed, // Storing a dynamic object of days
    monthInfo: {
      year: Number,
      month: Number,
      monthName: String,
      today: Number,
    }
  }
}, { _id: false }); // No need for a separate _id on this sub-document

const dailyStreaksReportSchema = new mongoose.Schema({
  reportDate: { type: Date, required: true, unique: true, index: true },
  streaksData: [userStreakSchema],
  userCount: { type: Number, required: true },
});

const DailyStreaksReport = mongoose.model('DailyStreaksReport', dailyStreaksReportSchema);

module.exports = DailyStreaksReport;