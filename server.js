const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const app = express();
const results = require('./results.json');
const { runLumosityStats } = require('./runStats');

// Middleware
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/api/lumosity-stats', async (req, res) => {
  try {
    console.log('Starting lumosity stats collection...');
    // First run the stats collection
    await runLumosityStats();
    console.log('Stats collection completed');
    
    // Read the fresh data directly from file instead of require
    const data = await fs.readFile('./results.json', 'utf8');
    const freshResults = JSON.parse(data);
    console.log('Successfully read results from file');
    
    // Set headers to prevent caching
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    return res.json({ success: true, data: freshResults });
  } catch (err) {
    console.error('Error in lumosity stats:', err);
    return res.status(500).json({ 
      success: false, 
      message: err.message,
      error: err.stack 
    });
  }
});

app.get('/api/results', (req, res) => {
  try {
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


app.get('/api/user-streaks', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const data = await fs.readFile('./augResults.json', 'utf8');
    const users = JSON.parse(data);

    const user = users.find(u => u.accountInfo.email === email);

    if (user) {
      res.json({ success: true, data: user.streaks });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (err) {
    console.error('Error in user-streaks:', err);
    res.status(500).json({
      success: false,
      message: err.message,
      error: err.stack
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the Game Stats API' });
});

// Start the server


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});