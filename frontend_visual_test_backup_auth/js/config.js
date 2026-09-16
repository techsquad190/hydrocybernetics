/**
 * HydroCybernetics Frontend Configuration
 * Modular constants, route definitions, and API configurations
 */

const CONFIG = {
  APP_NAME: 'HydroCybernetics',
  VERSION: 'v1.0.0 (Foundation)',

  // ============================================================
  // BACKEND
  // ============================================================
  API_BASE_URL:
    window.location.origin.includes(':5000')
      ? window.location.origin
      : 'http://localhost:5000',

  // ============================================================
  // BACKEND ENDPOINTS
  // ============================================================
  ENDPOINTS: {

    // General
    ROOT: '/',
    HEALTH: '/api/health',

    // ------------------------------------------------------------
    // IoT / Telemetry
    // ------------------------------------------------------------
    PRESSURE: '/api/pressure',
    FLOW: '/api/flow',
    TANK: '/api/tank',

    // ------------------------------------------------------------
    // Hydraulic Simulation
    // ------------------------------------------------------------
    SIMULATION_SCENARIOS: '/api/simulation/scenarios',
    SIMULATION_RESULTS: '/api/simulation/results',
    SIMULATION_COMPARISON: '/api/simulation/comparison',
    NETWORK: '/api/network',

    // ------------------------------------------------------------
    // AUTHENTICATION
    // ------------------------------------------------------------
    AUTH_LOGIN: '/api/auth/login',
    AUTH_REGISTER: '/api/auth/register',
    AUTH_ME: '/api/auth/me',
    AUTH_LOGOUT: '/api/auth/logout'
  },

  // ============================================================
  // FRONTEND ROUTES
  // ============================================================
  ROUTES: {

    // General
    HOME: '/',
    HOW_IT_WORKS: '#how-it-works',
    ABOUT: '#about',

    // ------------------------------------------------------------
    // Citizen
    // ------------------------------------------------------------
    CITIZEN_LOGIN: '/citizen/login',
    CITIZEN_REGISTER: '/citizen/register',
    CITIZEN_DASHBOARD: '/citizen/dashboard',

    // ------------------------------------------------------------
    // Municipal
    // ------------------------------------------------------------
    MUNICIPAL_LOGIN: '/municipal/login',
    MUNICIPAL_DASHBOARD: '/municipal/dashboard',
    MUNICIPAL_DIGITAL_TWIN: '/municipal/digital-twin',
    MUNICIPAL_SIMULATION: '/municipal/simulation',
    MUNICIPAL_LEAK_ANALYSIS: '/municipal/leak-analysis',
    MUNICIPAL_ALERTS: '/municipal/alerts',
    MUNICIPAL_REPORTS: '/municipal/reports',
    MUNICIPAL_ANALYTICS: '/municipal/analytics'
  }
};

CESIUM_ION_TOKEN:
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IkJYWDZHdVpyUlFjU1FTLWwiLCJqdGkiOiJjMDhkZTI5ZS0xMWRjLTQ0OGUtODEyNy1lNDUzYTBmMjQ5ODgiLCJpZCI6NDc4OTU5LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODgzNTY5MjB9.f1U1SsGC4-rFLopEd57-H5qPWV10fWNUqPwk8W8X80o'

// Make configuration globally available
window.CONFIG = CONFIG;