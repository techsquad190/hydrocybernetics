/**
 * HydroCybernetics Frontend Application Controller
 * Client Router, Navigation Controller, and Role-Based View Switcher
 * 
 * Note on Authentication & Role Protection:
 * This frontend controller manages the UI view states and transitions for the
 * Citizen and Municipal portals. Real authentication, token validation, and
 * server-side authorization will be connected to the Flask backend endpoints.
 */

class AppController {
  constructor() {
    this.appContainer = document.getElementById('app-root');
    this.currentRoute = '/';
    this.currentRole = this.getSavedRole(); // 'citizen' | 'municipal' | null
    this.currentUser = null;
    this.authReady = false;
    this.init();
  }

  getSavedRole() {
    try {
      return localStorage.getItem('hc_user_role') || null;
    } catch (e) {
      return null;
    }
  }

  setSavedRole(role) {
    this.currentRole = role;
    try {
      if (role) {
        localStorage.setItem('hc_user_role', role);
      } else {
        localStorage.removeItem('hc_user_role');
      }
    } catch (e) {
      console.warn('LocalStorage error', e);
    }
  }

  async init() {
    window.addEventListener('hashchange', () => this.handleRouting());
    document.addEventListener('click', (e) => this.handleLinkClicks(e));

    await this.bootstrapAuthentication();
    this.handleRouting();
  }

  async bootstrapAuthentication() {
    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.AUTH_ME}`,
        {
          method: 'GET',
          credentials: 'include'
        }
      );

      if (response.ok) {
        const data = await response.json();
        this.currentUser = data.user || null;
        this.currentRole = data.user ? data.user.role : null;
        this.setSavedRole(this.currentRole);
      } else {
        this.currentUser = null;
        this.currentRole = null;
        this.setSavedRole(null);
      }
    } catch (error) {
      console.warn('Authentication bootstrap unavailable:', error);
      this.currentUser = null;
      this.currentRole = null;
      this.setSavedRole(null);
    } finally {
      this.authReady = true;
    }
  }

  handleLinkClicks(e) {
    const routeLink = e.target.closest('[data-route]');
    if (routeLink) {
      const targetRoute = routeLink.getAttribute('data-route');
      if (targetRoute && targetRoute.startsWith('/')) {
        e.preventDefault();
        window.location.hash = `#${targetRoute}`;
      }
    }
  }

  parseHash() {
    const hash = window.location.hash || '#/';
    if (hash.startsWith('#/')) {
      return hash.slice(1); // Returns e.g. '/citizen/login' or '/'
    }
    return '/';
  }

  async handleAuthSubmit(role, targetHash, credentials = null) {
    if (!credentials) {
      return {
        ok: false,
        message: 'Please use the authentication form.'
      };
    }

    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.AUTH_LOGIN}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            role,
            ...credentials
          })
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          ok: false,
          message: data.message || 'Authentication failed.'
        };
      }

      this.currentUser = data.user || null;
      this.setSavedRole(data.user ? data.user.role : role);

      window.location.hash = targetHash;

      return {
        ok: true,
        user: data.user
      };
    } catch (error) {
      console.error('Authentication request failed:', error);

      return {
        ok: false,
        message: 'Unable to reach the authentication server. Make sure the Flask backend is running on port 5000.'
      };
    }
  }

  async handleSignOut() {
    try {
      await fetch(
        `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.AUTH_LOGOUT}`,
        {
          method: 'POST',
          credentials: 'include'
        }
      );
    } catch (error) {
      console.warn('Logout request failed:', error);
    }

    this.currentUser = null;
    this.setSavedRole(null);
    window.location.hash = '#/';
  }

  handleRouting() {
    const route = this.parseHash();
    this.currentRoute = route;

    // Determine layout type: 'public', 'citizen', or 'municipal'
    const isMunicipalDashboard =
      route.startsWith('/municipal/') &&
      route !== '/municipal/login';

    const isCitizenDashboard =
      route.startsWith('/citizen/dashboard');

    // Citizen dashboard is protected by the backend session.
    // Municipal authentication is intentionally left for the next phase.
    if (isCitizenDashboard) {
      if (!this.authReady) {
        this.appContainer.innerHTML = `
          <main class="main-content">
            <div class="auth-page-container">
              <div class="container">
                <div class="auth-card">
                  <div class="auth-card-header">
                    <div class="icon-box icon-box-lg">
                      ${Icons.citizen('icon')}
                    </div>
                    <h1 class="auth-card-title">Checking Session</h1>
                    <p class="auth-card-subtitle">
                      Verifying your Citizen Portal session...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </main>
        `;
        return;
      }

      if (this.currentRole !== 'citizen') {
        window.location.hash = '#/citizen/login';
        return;
      }

      this.renderCitizenLayout(route);
    } else if (isMunicipalDashboard) {
      this.renderMunicipalLayout(route);
    } else {
      this.renderPublicLayout(route);
    }

    // Handle in-page smooth anchors if needed
    if (window.location.hash === '#how-it-works' || window.location.hash === '#about' || window.location.hash === '#portals') {
      const targetEl = document.querySelector(window.location.hash);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  // 1. Public Layout (Landing, Sign In, Register)
  renderPublicLayout(route) {
    this.appContainer.innerHTML = `
      <!-- Public Header -->
      <header class="app-header">
        <div class="container">
          <div class="header-inner">
            
            <a href="#/" class="brand-wrapper" data-route="/">
              ${Icons.brandLogo('brand-icon')}
              <div class="brand-title">Hydro<span>Cybernetics</span></div>
            </a>

            <nav>
              <ul class="nav-links">
                <li><a href="#/" class="nav-link ${route === '/' ? 'active' : ''}" data-route="/">Home</a></li>
                <li><a href="#how-it-works" class="nav-link">How It Works</a></li>
                <li><a href="#about" class="nav-link">About</a></li>
              </ul>
            </nav>

            <div class="nav-actions">
              <a href="#/citizen/login" class="btn btn-secondary btn-sm" data-route="/citizen/login">
                ${Icons.citizen('icon')}
                <span>Citizen Sign In</span>
              </a>
              <a href="#/municipal/login" class="btn btn-primary btn-sm" data-route="/municipal/login">
                ${Icons.shield('icon')}
                <span>Municipal Access</span>
              </a>
            </div>

          </div>
        </div>
      </header>

      <!-- Main Content Container -->
      <main class="main-content" id="router-view"></main>

      <!-- Minimal Professional Public Footer -->
      <footer class="app-footer">
        <div class="container">
          <div class="footer-top">
            
            <div class="footer-brand">
              <a href="#/" class="brand-wrapper" data-route="/">
                ${Icons.brandLogo('brand-icon')}
                <div class="brand-title">Hydro<span>Cybernetics</span></div>
              </a>
              <p class="footer-brand-desc">
                HydroCybernetics — Urban water network digital twin and decision-support platform.
              </p>
            </div>

            <div>
              <div class="footer-col-title">Portals</div>
              <ul class="footer-links">
                <li><a href="#/citizen/login" class="footer-link" data-route="/citizen/login">Citizen Portal</a></li>
                <li><a href="#/municipal/login" class="footer-link" data-route="/municipal/login">Municipal Authority</a></li>
              </ul>
            </div>

            <div>
              <div class="footer-col-title">Platform Framework</div>
              <ul class="footer-links">
                <li><a href="#how-it-works" class="footer-link">Cyber-Physical Architecture</a></li>
                <li><a href="#about" class="footer-link">Platform Capabilities</a></li>
              </ul>
            </div>

            <div>
              <div class="footer-col-title">System Specs</div>
              <ul class="footer-links">
                <li><span class="footer-link font-mono">${CONFIG.VERSION}</span></li>
                <li><span class="footer-link text-xs text-muted">Digital Twin & Decision Support</span></li>
              </ul>
            </div>

          </div>

          <div class="footer-bottom">
            <div>
              &copy; ${new Date().getFullYear()} HydroCybernetics. Urban water network digital twin and decision-support platform.
            </div>
            <div>
              Water Network Intelligence Framework
            </div>
          </div>
        </div>
      </footer>
    `;

    const viewContainer = document.getElementById('router-view');
    if (!viewContainer) return;

    if (route === '/' || route === '') {
      viewContainer.innerHTML = LandingView.render();
      LandingView.init();
      window.scrollTo(0, 0);
    } else if (route === '/citizen/login') {
      viewContainer.innerHTML = AuthCitizenView.renderLogin();
      AuthCitizenView.init();
      window.scrollTo(0, 0);
    } else if (route === '/citizen/register') {
      viewContainer.innerHTML = AuthCitizenView.renderRegister();
      AuthCitizenView.init();
      window.scrollTo(0, 0);
    } else if (route === '/municipal/login') {
      viewContainer.innerHTML = AuthMunicipalView.renderLogin();
      AuthMunicipalView.init();
      window.scrollTo(0, 0);
    } else {
      viewContainer.innerHTML = LandingView.render();
      LandingView.init();
      window.scrollTo(0, 0);
    }
  }

  // 2. Citizen Portal Layout
  renderCitizenLayout(route) {
    this.appContainer.innerHTML = `
      <!-- Citizen Portal Header -->
      <header class="app-header">
        <div class="container">
          <div class="header-inner">
            
            <a href="#/" class="brand-wrapper" data-route="/">
              ${Icons.brandLogo('brand-icon')}
              <div class="brand-title">Hydro<span>Cybernetics</span></div>
            </a>

            <nav>
              <ul class="nav-links">
                <li><a href="#/" class="nav-link" data-route="/">Home</a></li>
                <li><a href="#/citizen/dashboard" class="nav-link active" data-route="/citizen/dashboard">Citizen Dashboard</a></li>
              </ul>
            </nav>

            <div class="nav-actions">
              <span class="text-xs text-secondary font-mono mr-2">Citizen Session</span>
              <button class="btn btn-secondary btn-sm" onclick="window.app.handleSignOut();">
                ${Icons.logOut('icon')}
                <span>Sign Out</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      <!-- Main Citizen Content -->
      <main class="main-content" id="router-view">
        ${DashboardCitizenView.render()}
      </main>

      <!-- Footer -->
      <footer class="app-footer">
        <div class="container">
          <div class="footer-bottom">
            <div>
              HydroCybernetics Citizen Water Portal
            </div>
            <div>
              Municipal Water Board Community Gateway
            </div>
          </div>
        </div>
      </footer>
    `;

    DashboardCitizenView.init();
    window.scrollTo(0, 0);
  }

  // 3. Municipal Operations Layout (Sidebar + Topbar)
  renderMunicipalLayout(route) {
    let activeSubTab = 'overview';
    if (route === '/municipal/digital-twin') activeSubTab = 'digital-twin';
    if (route === '/municipal/simulation') activeSubTab = 'simulation';
    if (route === '/municipal/leak-analysis') activeSubTab = 'leak-analysis';
    if (route === '/municipal/alerts') activeSubTab = 'alerts';
    if (route === '/municipal/reports') activeSubTab = 'reports';
    if (route === '/municipal/analytics') activeSubTab = 'analytics';

    this.appContainer.innerHTML = DashboardMunicipalView.render(activeSubTab);
    DashboardMunicipalView.init();
    window.scrollTo(0, 0);
  }
}

// Instantiate on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});
