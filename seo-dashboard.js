// SEO Reporting Dashboard
// This file contains the main React component for an SEO dashboard that integrates
// with Google Search Console and Google Analytics APIs

import React, { useState, useEffect } from 'react';
import { gapi } from 'gapi-script';
import { Chart } from 'chart.js/auto';

// Configuration values
const CLIENT_ID = 'http://304317893682-qmeahcel4glot961ed01e3dlr3751pv1.apps.googleusercontent.com/';
const API_KEY = 'AIzaSyDLflNMg3nVRVIBMXSq9jN-E1WMFcDTias';
const DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/webmasters/v3/rest',
  'https://www.googleapis.com/discovery/v1/apis/analyticsdata/v1beta/rest'
];
const SCOPES = [
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/analytics',
  'https://www.googleapis.com/auth/analytics.readonly'
];

function SEODashboard() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: getDateXDaysAgo(30),
    endDate: getDateXDaysAgo(1)
  });
  const [searchData, setSearchData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize the Google API client
  useEffect(() => {
    const loadGapiAndInitClient = async () => {
      try {
        await loadGapiScript();
        initClient();
      } catch (err) {
        setError('Failed to load Google API client: ' + err.message);
      }
    };

    loadGapiAndInitClient();
  }, []);

  // Helper function to load the gapi script
  const loadGapiScript = () => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  // Initialize Google API client
  const initClient = () => {
    gapi.load('client:auth2', async () => {
      try {
        await gapi.client.init({
          apiKey: API_KEY,
          clientId: CLIENT_ID,
          discoveryDocs: DISCOVERY_DOCS,
          scope: SCOPES.join(' ')
        });

        // Listen for sign-in state changes
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

        // Handle the initial sign-in state
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
      } catch (error) {
        setError('Error initializing Google API client: ' + error.message);
      }
    });
  };

  // Update sign-in status
  const updateSigninStatus = (isSignedIn) => {
    setIsSignedIn(isSignedIn);
    if (isSignedIn) {
      loadSiteList();
    }
  };

  // Sign in the user
  const handleSignIn = () => {
    gapi.auth2.getAuthInstance().signIn();
  };

  // Sign out the user
  const handleSignOut = () => {
    gapi.auth2.getAuthInstance().signOut();
  };

  // Load the list of properties from Search Console
  const loadSiteList = async () => {
    setIsLoading(true);
    try {
      const response = await gapi.client.webmasters.sites.list();
      setProperties(response.result.siteEntry || []);
      if (response.result.siteEntry && response.result.siteEntry.length > 0) {
        setSelectedProperty(response.result.siteEntry[0].siteUrl);
      }
      setIsLoading(false);
    } catch (error) {
      setError('Error loading site list: ' + error.message);
      setIsLoading(false);
    }
  };

  // Handle property selection change
  const handlePropertyChange = (event) => {
    setSelectedProperty(event.target.value);
  };

  // Handle date range change
  const handleDateChange = (event, type) => {
    setDateRange({
      ...dateRange,
      [type]: event.target.value
    });
  };

  // Fetch data from Google Search Console
  const fetchSearchConsoleData = async () => {
    if (!selectedProperty) return;

    setIsLoading(true);
    try {
      const response = await gapi.client.webmasters.searchanalytics.query({
        siteUrl: selectedProperty,
        requestBody: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          dimensions: ['query', 'page', 'device', 'country'],
          rowLimit: 500
        }
      });
      setSearchData(response.result.rows || []);
      createSearchDataCharts(response.result.rows || []);
      setIsLoading(false);
    } catch (error) {
      setError('Error fetching Search Console data: ' + error.message);
      setIsLoading(false);
    }
  };

  // Fetch data from Google Analytics
  const fetchAnalyticsData = async () => {
    if (!selectedProperty) return;

    setIsLoading(true);
    try {
      // Note: You'll need to replace 'PROPERTY_ID' with the actual GA4 property ID
      const propertyId = '293549621';
      
      const response = await gapi.client.analyticsdata.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [
            {
              startDate: dateRange.startDate,
              endDate: dateRange.endDate
            }
          ],
          dimensions: [
            {
              name: 'source'
            },
            {
              name: 'medium'
            }
          ],
          metrics: [
            {
              name: 'sessions'
            },
            {
              name: 'conversions'
            },
            {
              name: 'engagedSessions'
            }
          ]
        }
      });
      
      setAnalyticsData(response.result.rows || []);
      createAnalyticsCharts(response.result.rows || []);
      setIsLoading(false);
    } catch (error) {
      setError('Error fetching Analytics data: ' + error.message);
      setIsLoading(false);
    }
  };

  // Create charts for Search Console data
  const createSearchDataCharts = (data) => {
    if (!data || data.length === 0) return;

    // Group data by query
    const queryData = data.reduce((acc, row) => {
      if (!acc[row.keys[0]]) {
        acc[row.keys[0]] = {
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0,
          count: 0
        };
      }
      acc[row.keys[0]].clicks += row.clicks;
      acc[row.keys[0]].impressions += row.impressions;
      acc[row.keys[0]].ctr += row.ctr;
      acc[row.keys[0]].position += row.position;
      acc[row.keys[0]].count += 1;
      return acc;
    }, {});

    // Prepare data for charts
    const queries = Object.keys(queryData).slice(0, 10); // Top 10 queries
    const clicks = queries.map(q => queryData[q].clicks);
    const impressions = queries.map(q => queryData[q].impressions);
    const positions = queries.map(q => queryData[q].position / queryData[q].count);

    // Create charts
    createChart('clicksChart', 'Top Queries by Clicks', queries, clicks, 'bar', 'rgba(54, 162, 235, 0.6)');
    createChart('impressionsChart', 'Top Queries by Impressions', queries, impressions, 'bar', 'rgba(255, 206, 86, 0.6)');
    createChart('positionsChart', 'Average Position by Query', queries, positions, 'bar', 'rgba(75, 192, 192, 0.6)');
  };

  // Create charts for Analytics data
  const createAnalyticsCharts = (data) => {
    if (!data || data.length === 0) return;

    // Group data by source
    const sourceData = data.reduce((acc, row) => {
      const source = row.dimensionValues[0].value;
      if (!acc[source]) {
        acc[source] = {
          sessions: 0,
          conversions: 0,
          engagedSessions: 0
        };
      }
      acc[source].sessions += parseInt(row.metricValues[0].value);
      acc[source].conversions += parseInt(row.metricValues[1].value);
      acc[source].engagedSessions += parseInt(row.metricValues[2].value);
      return acc;
    }, {});

    // Prepare data for charts
    const sources = Object.keys(sourceData).slice(0, 10); // Top 10 sources
    const sessions = sources.map(s => sourceData[s].sessions);
    const conversions = sources.map(s => sourceData[s].conversions);
    const engagedSessions = sources.map(s => sourceData[s].engagedSessions);

    // Create charts
    createChart('sessionsChart', 'Sessions by Source', sources, sessions, 'bar', 'rgba(153, 102, 255, 0.6)');
    createChart('conversionsChart', 'Conversions by Source', sources, conversions, 'bar', 'rgba(255, 159, 64, 0.6)');
    createChart('engagementChart', 'Engaged Sessions by Source', sources, engagedSessions, 'bar', 'rgba(255, 99, 132, 0.6)');
  };

  // Helper function to create a chart
  const createChart = (canvasId, title, labels, data, type, backgroundColor) => {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (ctx.chart) {
      ctx.chart.destroy();
    }

    ctx.chart = new Chart(ctx, {
      type: type,
      data: {
        labels: labels,
        datasets: [{
          label: title,
          data: data,
          backgroundColor: backgroundColor,
          borderColor: backgroundColor.replace('0.6', '1'),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: title
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  };

  // Helper function to get date in YYYY-MM-DD format
  function getDateXDaysAgo(numDays) {
    const date = new Date();
    date.setDate(date.getDate() - numDays);
    return date.toISOString().split('T')[0];
  }

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    fetchSearchConsoleData();
    fetchAnalyticsData();
  };

  // Render dashboard
  return (
    <div className="seo-dashboard">
      <h1>SEO Reporting Dashboard</h1>
      
      {!isSignedIn ? (
        <div className="auth-section">
          <p>Please sign in with your Google account to access your data.</p>
          <button onClick={handleSignIn}>Sign In with Google</button>
        </div>
      ) : (
        <div className="dashboard-content">
          <div className="dashboard-header">
            <button onClick={handleSignOut} className="sign-out-btn">Sign Out</button>
          </div>
          
          <form onSubmit={handleSubmit} className="controls-form">
            <div className="form-group">
              <label htmlFor="property">Property:</label>
              <select 
                id="property" 
                value={selectedProperty} 
                onChange={handlePropertyChange}
                required
              >
                <option value="">Select a property</option>
                {properties.map(site => (
                  <option key={site.siteUrl} value={site.siteUrl}>
                    {site.siteUrl}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="startDate">Start Date:</label>
              <input 
                type="date" 
                id="startDate" 
                value={dateRange.startDate} 
                onChange={(e) => handleDateChange(e, 'startDate')}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="endDate">End Date:</label>
              <input 
                type="date" 
                id="endDate" 
                value={dateRange.endDate} 
                onChange={(e) => handleDateChange(e, 'endDate')}
                required
              />
            </div>
            
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Generate Report'}
            </button>
          </form>
          
          {error && <div className="error-message">{error}</div>}
          
          {searchData && analyticsData && (
            <div className="dashboard-widgets">
              <h2>Search Console Metrics</h2>
              <div className="chart-row">
                <div className="chart-container">
                  <canvas id="clicksChart"></canvas>
                </div>
                <div className="chart-container">
                  <canvas id="impressionsChart"></canvas>
                </div>
                <div className="chart-container">
                  <canvas id="positionsChart"></canvas>
                </div>
              </div>
              
              <h2>Analytics Metrics</h2>
              <div className="chart-row">
                <div className="chart-container">
                  <canvas id="sessionsChart"></canvas>
                </div>
                <div className="chart-container">
                  <canvas id="conversionsChart"></canvas>
                </div>
                <div className="chart-container">
                  <canvas id="engagementChart"></canvas>
                </div>
              </div>
              
              <div className="data-tables">
                <h2>Top Queries</h2>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Query</th>
                      <th>Clicks</th>
                      <th>Impressions</th>
                      <th>CTR</th>
                      <th>Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchData.slice(0, 20).map((row, index) => (
                      <tr key={index}>
                        <td>{row.keys[0]}</td>
                        <td>{row.clicks}</td>
                        <td>{row.impressions}</td>
                        <td>{(row.ctr * 100).toFixed(2)}%</td>
                        <td>{row.position.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SEODashboard;
