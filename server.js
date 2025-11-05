require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const app = express();
const { runLumosityStats } = require('./runStats');
const mongoose = require('mongoose');
const { LumosityStat } = require('./models/LumosityStat');
const DailyLumosityReport = require('./models/DailyLumosityReport');
const DailyStreaksReport = require('./models/DailyStreaksReport'); // Import the new model

// Middleware
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://veeru:veeru143@cluster0.wp0vcny.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI)
.then(() => console.log('MongoDB connected...'))
.catch(err => console.error(err));

// Helper function to transform scraped data to match the Mongoose schema
function transformDataForDb(data) {
  if (!data || !data.accountInfo || !data.lpi) {
    return null; // or throw an error if the data is invalid
  }

  const transformed = {
    accountInfo: {
      email: data.accountInfo.email,
      study: data.accountInfo.study,
      extractedAt: new Date(data.accountInfo.extractedAt),
    },
    date: new Date(), // Use current date for the entry
    overallLPI: data.lpi.overall,
    problemSolving: data.lpi.byArea?.['problem-solving']?.current,
    speed: data.lpi.byArea?.['speed']?.current,
    memory: data.lpi.byArea?.['memory']?.current,
    attention: data.lpi.byArea?.['attention']?.current,
    flexibility: data.lpi.byArea?.['flexibility']?.current,
    math: data.lpi.byArea?.['math']?.current,
  };
  return transformed;
}

/**
 * @route   POST /api/scrape-stats
 * @desc    Triggers the background scraping process to generate results.json
 */
app.get('/api/scrape-stats', (req, res) => {
  console.log('Received request to start scraping...');
  
  // Run the scraping process in the background and don't wait for it to finish
  runLumosityStats().catch(err => {
    console.error('Error during background scraping process:', err);
  });

  // Immediately respond to the client
  res.status(202).json({ 
    success: true, 
    message: 'Scraping process initiated. This may take several minutes. Check server logs for progress.' 
  });
});

/**
 * @route   POST /api/save-daily-report
 * @desc    Reads results.json and saves the data as a single report for today in MongoDB
 */
app.post('/api/save-daily-report', async (req, res) => {
  try {
    console.log('Reading data from results.json to save daily report...');
    const data = await fs.readFile('./results.json', 'utf8');
    const resultsFromFile = JSON.parse(data);
    console.log(`Successfully read ${resultsFromFile.length} user records from file.`);

    const transformedStats = resultsFromFile.map(transformDataForDb).filter(d => d !== null);

    if (transformedStats.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid stats found in results.json to save.' });
    }

    // Create a date for the start of today to use as a unique key
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Use findOneAndUpdate with upsert to either create a new report or update today's existing one
    const report = await DailyLumosityReport.findOneAndUpdate(
      { reportDate: today },
      { 
        $set: {
          stats: transformedStats,
          userCount: transformedStats.length,
        }
      },
      { new: true, upsert: true } // `upsert: true` creates the document if it doesn't exist
    );

    console.log(`Successfully saved or updated daily report for ${today.toDateString()}`);
    return res.json({ success: true, message: `Daily report for ${today.toDateString()} saved successfully.`, data: report });
  } catch (err) {
    console.error('Error saving daily report:', err);
    return res.status(500).json({ 
      success: false, 
      message: err.message,
      error: err.stack 
    });
  }
}); 

app.get('/api/results', async (req, res) => {
  try {
    // Read the results from the JSON file
    const data = await fs.readFile('./results.json', 'utf8');
    const results = JSON.parse(data);
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error reading results file', error: err.message });
  }
});

/**
 * @route   GET /api/user-streaks
 * @desc    Reads results.json and saves the user streaks data as a single report for today in MongoDB.
 */
app.get('/api/user-streaks', async (req, res) => {
  try {
    const { email, month } = req.query;
    if (!email || !month) {
      return res.status(400).json({ success: false, message: 'Email and month are required' });
    }

    const fileName = `./${month.toLowerCase()}Results.json`;
    const data = await fs.readFile(fileName, 'utf8');
    const users = JSON.parse(data);

    const user = users.find(u => u.accountInfo.email === email);

    if (user) {
      res.json({ success: true, data: user.streaks });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (err) {
    console.error('Error in user-streaks:', err);
    if (err.code === 'ENOENT') {
      return res.status(404).json({ success: false, message: `No data found for the month: ${month}` });
    }
    res.status(500).json({
      success: false,
      message: err.message,
      error: err.stack
    });
  }
});

// New endpoint to get all stats from the database
app.get('/api/db/stats', async (req, res) => {
  try {
    // Fetch all daily reports and sort by date descending
    const stats = await DailyLumosityReport.find({}).sort({ reportDate: -1 });
    res.json({ success: true, count: stats.length, data: stats });
  } catch (err) {
    console.error('Error fetching stats from DB:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve stats from database', error: err.message });
  }
});

app.get('/api/user-stats', async (req, res) => {
  const { date, email } = req.query;

  if (!date || !email) {
    return res.status(400).json({ success: false, message: 'Please provide both date and email query parameters.' });
  }

  try {
    const reportDate = new Date(date);
    reportDate.setHours(0, 0, 0, 0);

    const report = await DailyLumosityReport.findOne({ reportDate });

    if (!report) {
      return res.status(404).json({ success: false, message: 'No report found for the given date.' });
    }

    const userStat = report.stats.find(stat => stat.accountInfo.email === email);

    if (!userStat) {
      return res.status(404).json({ success: false, message: 'No stats found for the given email in this report.' });
    }

    res.json({ success: true, data: userStat });
  } catch (err) {
    console.error('Error fetching user stats:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve user stats', error: err.message });
  }
});

app.use('/api/udemy', require('./udemyApi'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});