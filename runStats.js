const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

function loadAccounts() {
  try {
    console.log('📁 Loading accounts from accounts.json...');
    const accountsPath = path.join(__dirname, 'accounts.json');
    const accountsData = fs.readFileSync(accountsPath, 'utf8');
    const accounts = JSON.parse(accountsData);
    console.log(`✅ Successfully loaded ${accounts.length} accounts`);
    return accounts;
  } catch (error) {
    console.error('❌ Failed to load accounts.json:', error.message);
    throw new Error(`Failed to load accounts.json: ${error.message}`);
  }
}

// Enhanced function to generate monthly streak calendar based on current date
function generateMonthlyStreaks(detailedStreaks, year = null, month = null) {
  // Default to current date if not specified
  const currentDate = new Date();
  const targetYear = year || currentDate.getFullYear();
  const targetMonth = month || (currentDate.getMonth() + 1); // JS months are 0-based
  
  // Get days in the target month
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison
  
  const monthlyStreaks = {};

  // Initialize all days based on current date
  for (let day = 1; day <= daysInMonth; day++) {
    const dayDate = new Date(targetYear, targetMonth - 1, day); // JS months are 0-based
    
    if (dayDate > today) {
      // Future dates get null (haven't occurred yet)
      monthlyStreaks[day] = null;
    } else {
      // Past and today get false initially (no activity unless proven otherwise)
      monthlyStreaks[day] = false;
    }
  }

  if (!detailedStreaks || detailedStreaks.length === 0) {
    return monthlyStreaks;
  }

  // Process each streak period and mark active days as true
  detailedStreaks.forEach(streak => {
    const startDate = new Date(streak.startDate);
    const endDate = new Date(streak.endDate);

    // Generate all dates in the streak range
    for (
      let date = new Date(startDate);
      date <= endDate;
      date.setDate(date.getDate() + 1)
    ) {
      const dateYear = date.getFullYear();
      const dateMonth = date.getMonth() + 1; // Convert to 1-based
      const dateDay = date.getDate();

      // Only mark days in the target month/year, and only if they're not future dates
      if (dateYear === targetYear && dateMonth === targetMonth) {
        const dayDate = new Date(targetYear, targetMonth - 1, dateDay);
        if (dayDate <= today) {
          monthlyStreaks[dateDay] = true;
        }
      }
    }
  });

  return monthlyStreaks;
}

function extractRelevantData(responses) {
  console.log(`🔍 Extracting relevant data from ${responses.length} API responses...`);
  
  const relevantData = {
    userInfo: null,
    lpiSummary: {},
    streakHistory: null,
    detailedStreaks: null,
    fitTestResults: null,
    gameRankings: null,
    comparisons: null,
    mostImprovedGames: null,
    trainingHistory: null,
    gameProgressHistory: null,
    dailyStats: null,
    achievements: null,
  };

  responses.forEach(({ body, url }, index) => {
    if (!body || !body.data) return;
    const data = body.data;

    // Extract user info (overwrite as it's static)
    if (data.me && data.me.id && data.me.firstName) {
      relevantData.userInfo = {
        id: data.me.id,
        firstName: data.me.firstName,
        lastName: data.me.lastName || '',
        email: data.me.email,
        ageCohort: data.me.ageCohort,
        hasPremium: data.me.hasPremium,
        memberSince: data.me.memberSince,
        timezone: data.me.timezone,
        profilePicture: data.me.profilePicture,
        accountType: data.me.accountType,
      };
    }

    // Merge LPI summary data conditionally
    if (data.me?.lpiSummary) {
      const lpiSummary = data.me.lpiSummary;

      if (lpiSummary.overallLpi !== undefined) relevantData.lpiSummary.overallLpi = lpiSummary.overallLpi;
      if (lpiSummary.bestOverallLpi !== undefined) relevantData.lpiSummary.bestOverallLpi = lpiSummary.bestOverallLpi;
      if (lpiSummary.firstOverallLpi !== undefined) relevantData.lpiSummary.firstOverallLpi = lpiSummary.firstOverallLpi;
      if (lpiSummary.updatedAt !== undefined) relevantData.lpiSummary.updatedAt = lpiSummary.updatedAt;

      if (lpiSummary.lpisByArea && (!relevantData.lpiSummary.lpisByArea || lpiSummary.lpisByArea.length > relevantData.lpiSummary.lpisByArea.length)) {
        relevantData.lpiSummary.lpisByArea = lpiSummary.lpisByArea.map(area => ({
          areaSlug: area.areaSlug,
          areaName: area.areaName || area.areaSlug,
          lpi: area.lpi,
          firstLpi: area.firstLpi,
          bestLpi: area.bestLpi,
          updatedAt: area.updatedAt,
          playCount: area.playCount,
          averageScore: area.averageScore,
        }));
      }

      // Game rankings
      if (lpiSummary.lpisByGame && (!relevantData.gameRankings || lpiSummary.lpisByGame.length > relevantData.gameRankings.length)) {
        relevantData.gameRankings = lpiSummary.lpisByGame
          .filter(game => game.lpi > 0)
          .map(game => ({
            gameSlug: game.game.slug,
            gameName: game.game.name || game.game.slug,
            areaSlug: game.game.areaSlug,
            areaName: game.game.areaName || game.game.areaSlug,
            lpi: game.lpi,
            firstLpi: game.firstLpi,
            bestLpi: game.bestLpi,
            playCount: game.playCount || 0,
            lastPlayedAt: game.lastPlayedAt,
            averageScore: game.averageScore,
            bestScore: game.bestScore,
            firstScore: game.firstScore,
            recentScores: game.recentScores || [],
            improvement: game.bestLpi && game.firstLpi ? game.bestLpi - game.firstLpi : 0,
          }))
          .sort((a, b) => b.lpi - a.lpi);
      }

      // Most improved games
      if (lpiSummary.mostImprovedGames && (!relevantData.mostImprovedGames || lpiSummary.mostImprovedGames.length > relevantData.mostImprovedGames.length)) {
        relevantData.mostImprovedGames = lpiSummary.mostImprovedGames
          .filter(game => game.lpiIncrease > 0)
          .map(game => ({
            gameSlug: game.game.slug,
            gameName: game.game.name || game.game.slug,
            areaSlug: game.game.areaSlug,
            areaName: game.game.areaName || game.game.areaSlug,
            lpiIncrease: game.lpiIncrease,
            percentIncrease: game.percentIncrease,
            bucket: game.bucket,
            playCount: game.playCount || 0,
            firstLpi: game.firstLpi,
            currentLpi: game.currentLpi,
          }))
          .sort((a, b) => b.lpiIncrease - a.lpiIncrease);
      }

      // Comparisons
      if (lpiSummary.ageCohortComparisons && (!relevantData.comparisons || lpiSummary.ageCohortComparisons.length > (relevantData.comparisons ? 1 : 0))) {
        const userAgeCohort = relevantData.userInfo?.ageCohort || '20-24';
        const userComparison = lpiSummary.ageCohortComparisons.find(c => c.ageCohortSlug === userAgeCohort);
        if (userComparison) {
          relevantData.comparisons = {
            ageCohort: userAgeCohort,
            overallPercentile: userComparison.overallPercentile,
            bestOverallPercentile: userComparison.bestOverallPercentile,
            percentileByArea: userComparison.percentileByArea?.map(area => ({
              areaSlug: area.areaSlug,
              areaName: area.areaName || area.areaSlug,
              percentile: area.percentile,
              bestPercentile: area.bestPercentile,
            })) || [],
            totalUsers: userComparison.totalUsers,
            rank: userComparison.rank,
            bestRank: userComparison.bestRank,
          };
        }
      }
    }

    // Streak history
    if (data.me?.streakHistory) {
      const streakHistory = data.me.streakHistory;
      
      relevantData.streakHistory = {
        currentStreak: streakHistory.streaks?.length > 0 ? streakHistory.streaks.slice(-1)[0] : null,
        bestStreak: streakHistory.bestStreak,
        totalStreaks: streakHistory.streaks?.length || 0,
        allStreaks: streakHistory.streaks || [],
        streakDays: streakHistory.streakDays || 0,
        longestStreakDays: streakHistory.longestStreakDays || 0,
      };

      // Detailed streaks
      if (streakHistory.streaks && streakHistory.streaks.length > 0 && (!relevantData.detailedStreaks || streakHistory.streaks.length > relevantData.detailedStreaks.length)) {
        relevantData.detailedStreaks = streakHistory.streaks.map(streak => ({
          startDate: streak.startDate,
          endDate: streak.endDate,
          length: streak.length,
          isActive: streak.isActive || false,
          trainingDays: streak.trainingDays?.map(day => ({
            date: day.date,
            gamesPlayed: day.gamesPlayed || 0,
            totalTime: day.totalTime || 0,
            lpiGained: day.lpiGained || 0,
            sessionCount: day.sessionCount || 0,
            gamesSummary: day.gamesSummary || [],
          })) || [],
        }));
      }
    }

    // Fit test results
    if (data.me?.fitTest && !relevantData.fitTestResults) {
      relevantData.fitTestResults = {
        completedAt: data.me.fitTest.completedAt,
        overallScore: data.me.fitTest.overallScore,
        overallPercentile: data.me.fitTest.overallPercentile,
        percentiles: data.me.fitTest.percentiles?.map(p => ({
          gameSlug: p.gameSlug,
          gameName: p.gameName || p.gameSlug,
          areaSlug: p.areaSlug,
          areaName: p.areaName || p.areaSlug,
          percentile: p.percentile,
          score: p.score,
          gamePlay: {
            score: p.gamePlay?.score,
            lpi: p.gamePlay?.lpi,
            finishedAt: p.gamePlay?.finishedAt,
            duration: p.gamePlay?.duration,
            accuracy: p.gamePlay?.accuracy,
          },
        })) || [],
      };
    }

    // Training history
    if (data.me?.trainingHistory && !relevantData.trainingHistory) {
      relevantData.trainingHistory = {
        totalSessions: data.me.trainingHistory.totalSessions || 0,
        totalTimeMinutes: data.me.trainingHistory.totalTimeMinutes || 0,
        averageSessionTime: data.me.trainingHistory.averageSessionTime || 0,
        totalGamesPlayed: data.me.trainingHistory.totalGamesPlayed || 0,
        recentSessions: data.me.trainingHistory.recentSessions?.map(session => ({
          date: session.date,
          gamesPlayed: session.gamesPlayed || 0,
          totalTime: session.totalTime || 0,
          lpiChange: session.lpiChange || 0,
          sessionType: session.sessionType,
          gamesDetails: session.games?.map(game => ({
            slug: game.slug,
            name: game.name || game.slug,
            score: game.score,
            lpi: game.lpi,
            timeSpent: game.timeSpent,
            accuracy: game.accuracy,
          })) || [],
        })) || [],
      };
    }

    // Game progress history
    if (data.me?.gameProgressHistory && (!relevantData.gameProgressHistory || data.me.gameProgressHistory.length > relevantData.gameProgressHistory.length)) {
      relevantData.gameProgressHistory = data.me.gameProgressHistory.map(game => ({
        gameSlug: game.gameSlug,
        gameName: game.gameName || game.gameSlug,
        areaSlug: game.areaSlug,
        areaName: game.areaName || game.areaSlug,
        progressData: game.progressData?.map(point => ({
          date: point.date,
          lpi: point.lpi,
          score: point.score,
          percentile: point.percentile,
          playNumber: point.playNumber,
        })) || [],
      }));
    }

    // Daily stats
    if (data.me?.dailyStats && !relevantData.dailyStats) {
      relevantData.dailyStats = {
        today: data.me.dailyStats.today,
        yesterday: data.me.dailyStats.yesterday,
        thisWeek: data.me.dailyStats.thisWeek,
        lastWeek: data.me.dailyStats.lastWeek,
        thisMonth: data.me.dailyStats.thisMonth,
        lastMonth: data.me.dailyStats.lastMonth,
      };
    }

    // Achievements
    if (data.me?.achievements && !relevantData.achievements) {
      relevantData.achievements = {
        total: data.me.achievements.total || 0,
        earned: data.me.achievements.earned?.map(achievement => ({
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          earnedAt: achievement.earnedAt,
          category: achievement.category,
        })) || [],
        available: data.me.achievements.available?.map(achievement => ({
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          category: achievement.category,
          progress: achievement.progress,
        })) || [],
      };
    }
  });

  return relevantData;
}

function formatStatsData(data, account) {
  // Generate monthly streaks for current month using current date
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const monthlyStreaks = generateMonthlyStreaks(data.detailedStreaks, currentYear, currentMonth);

  // Count different types of days for summary
  const daysPlayed = Object.values(monthlyStreaks).filter(day => day === true).length;
  const daysMissed = Object.values(monthlyStreaks).filter(day => day === false).length;
  const futureDays = Object.values(monthlyStreaks).filter(day => day === null).length;

  const formatted = {
    accountInfo: {
      email: account.email,
      study: account.study,
      extractedAt: new Date().toISOString(),
    },
    summary: {
      user: data.userInfo?.firstName || 'Unknown',
      fullName: `${data.userInfo?.firstName || ''} ${data.userInfo?.lastName || ''}`.trim(),
      premium: data.userInfo?.hasPremium || false,
      ageCohort: data.userInfo?.ageCohort || 'Unknown',
      memberSince: data.userInfo?.memberSince,
      accountType: data.userInfo?.accountType,
    },
    lpi: {
      overall: data.lpiSummary?.overallLpi || 'N/A',
      best: data.lpiSummary?.bestOverallLpi || 'N/A',
      first: data.lpiSummary?.firstOverallLpi || 'N/A',
      byArea: {},
    },
    rankings: {
      topGames: [],
      mostImproved: [],
    },
    streaks: {
      // Essential streak stats
      current: data.streakHistory?.currentStreak?.length || 0,
      best: data.streakHistory?.bestStreak?.length || 0,
      total: data.streakHistory?.totalStreaks || 0,
      // Monthly calendar with proper date handling
      monthlyStreaks: monthlyStreaks,
      // Enhanced metadata about the month
      monthInfo: {
        year: currentYear,
        month: currentMonth,
        monthName: new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' }),
        today: currentDate.getDate(),
        daysInMonth: Object.keys(monthlyStreaks).length,
        daysPlayed: daysPlayed,
        daysMissed: daysMissed,
        futureDays: futureDays,
        completionRate: daysMissed + daysPlayed > 0 ? `${Math.round((daysPlayed / (daysPlayed + daysMissed)) * 100)}%` : '0%'
      }
    },
    percentiles: {
      overall: data.comparisons?.overallPercentile || 'N/A',
      best: data.comparisons?.bestOverallPercentile || 'N/A',
      byArea: {},
    },
    training: {
      totalSessions: data.trainingHistory?.totalSessions || 0,
      totalTimeMinutes: data.trainingHistory?.totalTimeMinutes || 0,
      averageSessionTime: data.trainingHistory?.averageSessionTime || 0,
      totalGamesPlayed: data.trainingHistory?.totalGamesPlayed || 0,
      recentSessions: data.trainingHistory?.recentSessions || [],
    },
    fitTest: data.fitTestResults || null,
    gameProgress: data.gameProgressHistory || [],
    dailyStats: data.dailyStats || null,
    achievements: data.achievements || null,
    comparison: {
      ageCohort: data.comparisons?.ageCohort || 'N/A',
      rank: data.comparisons?.rank || 'N/A',
      bestRank: data.comparisons?.bestRank || 'N/A',
      totalUsers: data.comparisons?.totalUsers || 'N/A',
    },
  };

  // Process LPI by area with enhanced data
  if (data.lpiSummary?.lpisByArea) {
    data.lpiSummary.lpisByArea.forEach(area => {
      if (area.lpi !== null) {
        formatted.lpi.byArea[area.areaSlug] = {
          name: area.areaName,
          current: area.lpi,
          first: area.firstLpi,
          best: area.bestLpi,
          playCount: area.playCount,
          improvement: area.bestLpi && area.firstLpi ? area.bestLpi - area.firstLpi : 0,
        };
      }
    });
  }

  // Enhanced game rankings with more details
  if (data.gameRankings) {
    formatted.rankings.topGames = data.gameRankings.slice(0, 10).map((game, i) => ({
      rank: i + 1,
      game: game.gameSlug,
      name: game.gameName,
      area: game.areaSlug,
      areaName: game.areaName,
      lpi: game.lpi,
      firstLpi: game.firstLpi,
      bestLpi: game.bestLpi,
      playCount: game.playCount,
      improvement: game.improvement,
      lastPlayedAt: game.lastPlayedAt,
    }));
  }

  // Enhanced most improved with percentage
  if (data.mostImprovedGames) {
    formatted.rankings.mostImproved = data.mostImprovedGames.slice(0, 5).map((game, i) => ({
      rank: i + 1,
      game: game.gameSlug,
      name: game.gameName,
      area: game.areaSlug,
      areaName: game.areaName,
      improvement: game.lpiIncrease,
      percentIncrease: game.percentIncrease,
      playCount: game.playCount,
    }));
  }

  // Enhanced percentiles with area names
  if (data.comparisons?.percentileByArea) {
    data.comparisons.percentileByArea.forEach(area => {
      if (area.percentile > 0) {
        formatted.percentiles.byArea[area.areaSlug] = {
          name: area.areaName,
          current: `${area.percentile}%`,
          best: `${area.bestPercentile}%`,
        };
      }
    });
  }

  return formatted;
}

async function processAccountOptimized(browser, account, accountIndex, batchIndex) {
  const startTime = Date.now();
  const ACCOUNT_TIMEOUT = 120000; // Increased to 120 seconds for more data
  
  console.log(`🔄 [Batch ${batchIndex}] Processing account ${accountIndex}: ${account.email}`);
  
  let context = null;
  
  try {
    const accountPromise = async () => {
      context = await browser.createBrowserContext({
        ignoreHTTPSErrors: true,
      });
      
      const page = await context.newPage();
      
      // Set page timeout
      page.setDefaultTimeout(30000);
      
      // Optimize page settings for speed but allow some resources for API calls
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        const url = req.url();
        
        // Block images, fonts, and stylesheets but allow API calls
        if (resourceType === 'stylesheet' || resourceType === 'font' || resourceType === 'image') {
          req.abort();
        } else if (url.includes('gateway/graphql') || url.includes('lumosity.com/api') || resourceType === 'xhr' || resourceType === 'fetch') {
          req.continue();
        } else {
          req.continue();
        }
      });

      const responses = [];

      // Enhanced API response capture
      page.on('response', async response => {
        const url = response.url();
        const ct = response.headers()['content-type'] || '';
        
        if (ct.includes('application/json') && (url.includes('gateway/graphql') || url.includes('lumosity.com/api'))) {
          try {
            const body = await response.json();
            if (body.data && (body.data.me || body.data.user)) {
              console.log(`   📊 [${account.email}] Captured API response from ${url}`);
              responses.push({ url, body });
            }
          } catch (error) {
            // Ignore JSON parse errors
          }
        }
      });

      // Navigate to login page
      console.log(`   🌍 [${account.email}] Navigating to login...`);
      await page.goto('https://app.lumosity.com/login', { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });

      // Enhanced login process
      await page.waitForSelector('input#email-dummy', { timeout: 10000 });
      await page.click('input#email-dummy');
      await page.keyboard.type(account.email, { delay: 20 });

      // Try real email input
      try {
        await page.waitForSelector('input#email', { timeout: 3000 });
        await page.evaluate(() => (document.querySelector('#email').value = ''));
        await page.type('#email', account.email, { delay: 20 });
      } catch {
        // Real email field not found, continue
      }

      // Password field
      await page.waitForSelector('input#password', { timeout: 10000 });
      await page.click('input#password');
      await page.type('input#password', account.password, { delay: 20 });

      // Submit login and wait for navigation
      console.log(`   🔐 [${account.email}] Submitting login...`);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
        page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const loginButton = buttons.find(btn => 
            btn.innerText.toLowerCase().includes('log in') || btn.type === 'submit'
          );
          if (loginButton) {
            loginButton.click();
          } else {
            console.error('Login button not found');
          }
        })
      ]).catch(() => {
        console.log(`   ⚠️ [${account.email}] Navigation timeout (may be normal)`);
      });

      // Navigate to multiple pages to capture more data, with longer wait on stats
      const pagesToVisit = [
        { url: 'https://app.lumosity.com/stats', wait: 5000 },
        { url: 'https://app.lumosity.com/stats/training', wait: 3000 },
        { url: 'https://app.lumosity.com/stats/games', wait: 3000 },
        { url: 'https://app.lumosity.com/profile', wait: 3000 }
      ];

      for (const { url, wait } of pagesToVisit) {
        try {
          console.log(`   📊 [${account.email}] Loading ${url}...`);
          await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 15000 
          });
          
          // Wait for API calls to complete
          await new Promise(r => setTimeout(r, wait));
          
        } catch (err) {
          console.log(`   ⚠️ [${account.email}] Could not load ${url}: ${err.message}`);
        }
      }

      // Additional wait for any remaining API calls
      console.log(`   ⏳ [${account.email}] Final wait for data aggregation...`);
      await new Promise(r => setTimeout(r, 2000));

      // Process captured data
      console.log(`   🔍 [${account.email}] Processing ${responses.length} API responses...`);
      const relevantData = extractRelevantData(responses);
      const formattedData = formatStatsData(relevantData, account);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`   ✅ [${account.email}] Completed in ${duration}s with date-aware monthly streaks`);

      return formattedData;
    };

    // Race account processing against timeout
    return await Promise.race([
      accountPromise(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Account timeout: ${account.email}`)), ACCOUNT_TIMEOUT)
      )
    ]);

  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`   ❌ [${account.email}] Error after ${duration}s: ${err.message}`);
    
    return {
      accountInfo: { 
        email: account.email, 
        study: account.study, 
        extractedAt: new Date().toISOString() 
      },
      error: err.message,
      success: false,
    };
  } finally {
    // Always close context
    if (context) {
      await context.close().catch(console.error);
    }
  }
}

async function runLumosityStatsHeadlessParallel() {
  console.log('🚀 Starting DATE-AWARE Lumosity stats extraction...');
  console.log('📅 Using current date for accurate monthly streak calendars!');
  
  const overallStartTime = Date.now();
  const OVERALL_TIMEOUT = 12 * 60 * 1000; // Increased to 12 minutes for enhanced extraction
  
  // Create timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Overall extraction timeout (12 minutes)')), OVERALL_TIMEOUT);
  });
  
  // Wrap main logic in a promise
  const extractionPromise = async () => {
    let accounts;
    try {
      accounts = loadAccounts();
      if (!Array.isArray(accounts) || accounts.length === 0) {
        throw new Error('No accounts found');
      }
    } catch (err) {
      console.error('❌ Account loading failed:', err.message);
      throw new Error(err.message);
    }

    // Validate accounts
    console.log('🔍 Validating account data...');
    for (const acc of accounts) {
      if (!acc.email || !acc.password || !acc.study) {
        console.error('❌ Invalid account data:', acc);
        throw new Error('Each account must include email, password, and study.');
      }
    }
    console.log('✅ All accounts validated');

    // Launch optimized browser
    console.log('🌐 Launching optimized headless browser...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--disable-ipc-flooding-protection',
        '--no-first-run',
        '--no-default-browser-check',
        '--memory-pressure-off',
      ],
      defaultViewport: { width: 1280, height: 720 },
    });

    console.log('✅ Browser launched');

    try {
      // Process accounts in parallel batches (reduced concurrency for stability)
      const maxConcurrentTabs = Math.min(accounts.length, 3);
      const results = [];
      
      console.log(`📊 Processing ${accounts.length} accounts with ${maxConcurrentTabs} concurrent tabs`);
      
      for (let i = 0; i < accounts.length; i += maxConcurrentTabs) {
        const chunk = accounts.slice(i, i + maxConcurrentTabs);
        const batchIndex = Math.floor(i / maxConcurrentTabs) + 1;
        const totalBatches = Math.ceil(accounts.length / maxConcurrentTabs);
        
        console.log(`\n🔥 Processing batch ${batchIndex}/${totalBatches} (${chunk.length} accounts)`);
        const batchStartTime = Date.now();
        
        // Increased timeout for enhanced data extraction
        const batchTimeout = 180000; // 3 minutes per batch
        const batchPromises = chunk.map((account, index) => 
          Promise.race([
            processAccountOptimized(browser, account, i + index + 1, batchIndex),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Batch timeout for ${account.email}`)), batchTimeout)
            )
          ]).catch(error => ({
            accountInfo: { 
              email: account.email, 
              study: account.study, 
              extractedAt: new Date().toISOString() 
            },
            error: error.message,
            success: false,
          }))
        );
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(1);
        console.log(`✅ Batch ${batchIndex} completed in ${batchDuration}s`);
        
        if (i + maxConcurrentTabs < accounts.length) {
          console.log('⏳ Brief pause before next batch...');
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      // Save results to file
      console.log('\n💾 Saving date-aware results to results.json...');
      try {
        const resultsFile = path.join(__dirname, 'results.json');
        fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
        console.log(`✅ Results saved to ${resultsFile}`);
        console.log(`📄 File size: ${(fs.statSync(resultsFile).size / 1024 / 1024).toFixed(2)} MB`);
      } catch (err) {
        console.error('⚠️ Failed to save results file:', err.message);
      }

      // Performance summary
      const totalDuration = ((Date.now() - overallStartTime) / 1000).toFixed(1);
      const avgTimePerAccount = (totalDuration / accounts.length).toFixed(1);
      const successfulAccounts = results.filter(r => !r.error).length;
      
      console.log('\n🎉 DATE-AWARE processing completed!');
      console.log(`📊 Performance Summary:`);
      console.log(`   ⏱️ Total time: ${totalDuration}s (${(totalDuration/60).toFixed(1)} minutes)`);
      console.log(`   ⚡ Average per account: ${avgTimePerAccount}s`);
      console.log(`   ✅ Successful: ${successfulAccounts}/${accounts.length}`);
      console.log(`   📅 Date-aware monthly streak calendars generated`);
      console.log(`   💾 Results saved to: results.json`);
      
      return results;

    } finally {
      // Always close browser
      console.log('🔒 Closing browser...');
      await browser.close().catch(console.error);
    }
  };

  // Race between extraction and timeout
  try {
    return await Promise.race([extractionPromise(), timeoutPromise]);
  } catch (error) {
    console.error('❌ Date-aware extraction failed or timed out:', error.message);
    throw error;
  }
}

module.exports = { runLumosityStats: runLumosityStatsHeadlessParallel };