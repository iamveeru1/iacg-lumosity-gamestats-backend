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

function extractRelevantData(responses) {
  console.log(`🔍 Extracting relevant data from ${responses.length} API responses...`);
  
  const relevantData = {
    userInfo: null,
    lpiSummary: null,
    streakHistory: null,
    fitTestResults: null,
    gameRankings: null,
    comparisons: null,
    mostImprovedGames: null,
  };

  responses.forEach(({ body, url }, index) => {
    if (!body || !body.data) return;
    const data = body.data;

    if (data.me && data.me.id && data.me.firstName) {
      relevantData.userInfo = {
        id: data.me.id,
        firstName: data.me.firstName,
        email: data.me.email,
        ageCohort: data.me.ageCohort,
        hasPremium: data.me.hasPremium,
      };
    }

    if (data.me?.lpiSummary) {
      const lpiSummary = data.me.lpiSummary;

      if (lpiSummary.overallLpi !== undefined || lpiSummary.lpisByArea) {
        relevantData.lpiSummary = {
          overallLpi: lpiSummary.overallLpi,
          bestOverallLpi: lpiSummary.bestOverallLpi,
          firstOverallLpi: lpiSummary.firstOverallLpi,
          lpisByArea: lpiSummary.lpisByArea?.map(area => ({
            areaSlug: area.areaSlug,
            lpi: area.lpi,
            firstLpi: area.firstLpi,
            bestLpi: area.bestLpi,
          })),
          updatedAt: lpiSummary.updatedAt,
        };
      }

      if (lpiSummary.lpisByGame) {
        relevantData.gameRankings = lpiSummary.lpisByGame
          .filter(game => game.lpi > 0)
          .map(game => ({
            gameSlug: game.game.slug,
            areaSlug: game.game.areaSlug,
            lpi: game.lpi,
          }))
          .sort((a, b) => b.lpi - a.lpi);
      }

      if (lpiSummary.mostImprovedGames) {
        relevantData.mostImprovedGames = lpiSummary.mostImprovedGames
          .filter(game => game.lpiIncrease > 0)
          .map(game => ({
            gameSlug: game.game.slug,
            areaSlug: game.game.areaSlug,
            lpiIncrease: game.lpiIncrease,
            bucket: game.bucket,
          }))
          .sort((a, b) => b.lpiIncrease - a.lpiIncrease);
      }

      if (lpiSummary.ageCohortComparisons) {
        const userAgeCohort = relevantData.userInfo?.ageCohort || '20-24';
        const userComparison = lpiSummary.ageCohortComparisons.find(c => c.ageCohortSlug === userAgeCohort);
        if (userComparison) {
          relevantData.comparisons = {
            ageCohort: userAgeCohort,
            overallPercentile: userComparison.overallPercentile,
            bestOverallPercentile: userComparison.bestOverallPercentile,
            percentileByArea: userComparison.percentileByArea.map(area => ({
              areaSlug: area.areaSlug,
              percentile: area.percentile,
            })),
          };
        }
      }
    }

    if (data.me?.streakHistory) {
      relevantData.streakHistory = {
        currentStreak: data.me.streakHistory.streaks?.length > 0 ? data.me.streakHistory.streaks.slice(-1)[0] : null,
        bestStreak: data.me.streakHistory.bestStreak,
        totalStreaks: data.me.streakHistory.streaks?.length || 0,
        allStreaks: data.me.streakHistory.streaks,
      };
    }

    if (data.me?.fitTest) {
      relevantData.fitTestResults = {
        percentiles: data.me.fitTest.percentiles.map(p => ({
          gameSlug: p.gameSlug,
          percentile: p.percentile,
          gamePlay: {
            score: p.gamePlay.score,
            lpi: p.gamePlay.lpi,
            finishedAt: p.gamePlay.finishedAt,
          },
        })),
      };
    }
  });

  return relevantData;
}

function formatStatsData(data, account) {
  const formatted = {
    accountInfo: {
      email: account.email,
      study: account.study,
      extractedAt: new Date().toISOString(),
    },
    summary: {
      user: data.userInfo?.firstName || 'Unknown',
      premium: data.userInfo?.hasPremium || false,
      ageCohort: data.userInfo?.ageCohort || 'Unknown',
    },
    lpi: {
      overall: data.lpiSummary?.overallLpi || 'N/A',
      best: data.lpiSummary?.bestOverallLpi || 'N/A',
      byArea: {},
    },
    rankings: {
      topGames: [],
      mostImproved: [],
    },
    streaks: {
      current: data.streakHistory?.currentStreak?.length || 0,
      best: data.streakHistory?.bestStreak?.length || 0,
      total: data.streakHistory?.totalStreaks || 0,
    },
    percentiles: {},
  };

  if (data.lpiSummary?.lpisByArea) {
    data.lpiSummary.lpisByArea.forEach(area => {
      if (area.lpi !== null) {
        formatted.lpi.byArea[area.areaSlug] = {
          current: area.lpi,
          first: area.firstLpi,
          best: area.bestLpi,
        };
      }
    });
  }

  if (data.gameRankings) {
    formatted.rankings.topGames = data.gameRankings.slice(0, 5).map((game, i) => ({
      rank: i + 1,
      game: game.gameSlug,
      area: game.areaSlug,
      lpi: game.lpi,
    }));
  }

  if (data.mostImprovedGames) {
    formatted.rankings.mostImproved = data.mostImprovedGames.slice(0, 3).map((game, i) => ({
      rank: i + 1,
      game: game.gameSlug,
      area: game.areaSlug,
      improvement: game.lpiIncrease,
    }));
  }

  if (data.comparisons?.percentileByArea) {
    data.comparisons.percentileByArea.forEach(area => {
      if (area.percentile > 0) {
        formatted.percentiles[area.areaSlug] = `${area.percentile}%`;
      }
    });
  }

  return formatted;
}

async function processAccountOptimized(browser, account, accountIndex, batchIndex) {
  const startTime = Date.now();
  const ACCOUNT_TIMEOUT = 90000; // 90 seconds per account
  
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
      
      // Optimize page settings for speed
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (req.resourceType() === 'stylesheet' || req.resourceType() === 'font' || req.resourceType() === 'image') {
          req.abort();
        } else {
          req.continue();
        }
      });

      const responses = [];

      // Capture GraphQL/API responses
      page.on('response', async response => {
        const url = response.url();
        const ct = response.headers()['content-type'] || '';
        
        if (ct.includes('application/json') && (url.includes('gateway/graphql') || url.includes('lumosity.com/api'))) {
          try {
            const body = await response.json();
            if (body.data && body.data.me) {
              console.log(`   📊 [${account.email}] Captured API response`);
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

      // Fill login form optimized
      await page.waitForSelector('input#email-dummy', { timeout: 8000 });
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
      await page.waitForSelector('input#password', { timeout: 8000 });
      await page.click('input#password');
      await page.type('input#password', account.password, { delay: 20 });

      // Submit login and wait for navigation
      console.log(`   🔐 [${account.email}] Submitting login...`);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 12000 }),
        page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const loginButton = buttons.find(btn => 
            btn.innerText.toLowerCase().includes('log in') || btn.type === 'submit'
          );
          if (loginButton) loginButton.click();
        })
      ]).catch(() => {
        console.log(`   ⚠️  [${account.email}] Navigation timeout (may be normal)`);
      });

      // Navigate to stats page
      console.log(`   📊 [${account.email}] Loading stats page...`);
      await page.goto('https://app.lumosity.com/stats', { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });

      // Optimized wait time
      console.log(`   ⏳ [${account.email}] Waiting for data load...`);
      await new Promise(r => setTimeout(r, 4000));

      // Process captured data
      console.log(`   🔍 [${account.email}] Processing ${responses.length} API responses...`);
      const relevantData = extractRelevantData(responses);
      const formattedData = formatStatsData(relevantData, account);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`   ✅ [${account.email}] Completed in ${duration}s`);

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
  console.log('🚀 Starting HEADLESS + PARALLEL Lumosity stats extraction...');
  console.log('⚡ Maximum speed mode enabled!');
  
  const overallStartTime = Date.now();
  const OVERALL_TIMEOUT = 8 * 60 * 1000; // 8 minutes maximum
  
  // Create timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Overall extraction timeout (8 minutes)')), OVERALL_TIMEOUT);
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
      ],
      defaultViewport: { width: 1280, height: 720 },
    });

    console.log('✅ Browser launched');

    try {
      // Process accounts in parallel batches
      const maxConcurrentTabs = Math.min(accounts.length, 4);
      const results = [];
      
      console.log(`📊 Processing ${accounts.length} accounts with ${maxConcurrentTabs} concurrent tabs`);
      
      for (let i = 0; i < accounts.length; i += maxConcurrentTabs) {
        const chunk = accounts.slice(i, i + maxConcurrentTabs);
        const batchIndex = Math.floor(i / maxConcurrentTabs) + 1;
        const totalBatches = Math.ceil(accounts.length / maxConcurrentTabs);
        
        console.log(`\n🔥 Processing batch ${batchIndex}/${totalBatches} (${chunk.length} accounts)`);
        const batchStartTime = Date.now();
        
        // Add timeout to each batch
        const batchTimeout = 150000; // 2.5 minutes per batch
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
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      // Save results to file
      console.log('\n💾 Saving results to results.json...');
      try {
        const resultsFile = path.join(__dirname, 'results.json');
        fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
        console.log(`✅ Results saved to ${resultsFile}`);
        console.log(`📄 File size: ${fs.statSync(resultsFile).size} bytes`);
      } catch (err) {
        console.error('⚠️  Failed to save results file:', err.message);
        // Don't throw here - we still want to return the results
      }

      // Performance summary
      const totalDuration = ((Date.now() - overallStartTime) / 1000).toFixed(1);
      const avgTimePerAccount = (totalDuration / accounts.length).toFixed(1);
      const successfulAccounts = results.filter(r => !r.error).length;
      
      console.log('\n🎉 HEADLESS + PARALLEL processing completed!');
      console.log(`📊 Performance Summary:`);
      console.log(`   ⏱️  Total time: ${totalDuration}s`);
      console.log(`   ⚡ Average per account: ${avgTimePerAccount}s`);
      console.log(`   ✅ Successful: ${successfulAccounts}/${accounts.length}`);
      console.log(`   💾 Results saved to: results.json`);
      console.log('🔄 Returning results to API...');
      
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
    console.error('❌ Extraction failed or timed out:', error.message);
    throw error;
  }
}

module.exports = { runLumosityStats: runLumosityStatsHeadlessParallel };