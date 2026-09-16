/*
 * ============================================================
 * HYDROCYBERNETICS
 * MUNICIPAL OPERATIONS DASHBOARD
 * ============================================================
 *
 * Modules
 *  1. Overview
 *  2. Digital Twin
 *  3. Hydraulic Simulation
 *  4. Leak Analysis
 *  5. Alerts
 *  6. Operational Analytics
 *  7. Reports
 *
 * DigitalTwinView is provided by digital-twin.js.
 * It is NOT redefined here.
 *
 * Backend hydraulic endpoint:
 *   /api/simulation/results?scenario=baseline
 *   /api/simulation/results?scenario=j4_leak
 *   /api/simulation/results?scenario=j6_leak
 *
 * ============================================================
 */

const DashboardMunicipalView = {

  /* ==========================================================
     STATE
     ========================================================== */

  analyticsState: {
    scenario: 'baseline',

    baseline: null,

    current: null,

    loading: false,

    error: null,

    lastUpdated: null,

    charts: {
      pressure: null,
      flow: null,
      divergence: null
    }
  },


  simulationState: {
    scenarios: [
      'baseline',
      'j4_leak',
      'j6_leak'
    ],

    currentScenario: 'baseline',

    results: null,

    comparison: null,

    loading: false,

    error: null
  },


  leakState: {
    scenario: 'j4_leak',

    baseline: null,

    current: null,

    loading: false,

    error: null
  },


  alertsState: {
    loading: false,

    error: null,

    baseline: null,

    j4: null,

    j6: null
  },


  reportsState: {
    loading: false,

    error: null,

    baseline: null,

    j4: null,

    j6: null,

    citizenReports: [],

    citizenReportsLoading: false,

    citizenReportsError: null
  },


  /* ==========================================================
     CONFIGURATION
     ========================================================== */

  getConfig() {

    const config =
      window.CONFIG || {};

    const endpoints =
      config.ENDPOINTS || {};

    return {

      baseUrl:
        config.API_BASE_URL ||
        'http://localhost:5000',

      results:
        endpoints.SIMULATION_RESULTS ||
        '/api/simulation/results',

      pressure:
        endpoints.PRESSURE ||
        '/api/pressure',

      flow:
        endpoints.FLOW ||
        '/api/flow',

      tank:
        endpoints.TANK ||
        '/api/tank'

    };

  },


  /* ==========================================================
     GENERAL HELPERS
     ========================================================== */

  escapeHtml(value) {

    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  },


  number(value, fallback = 0) {

    const n =
      Number(value);

    return Number.isFinite(n)
      ? n
      : fallback;

  },


  format(value, digits = 2) {

    return this
      .number(value)
      .toFixed(digits);

  },


  signed(value, digits = 2) {

    const n =
      this.number(value);

    return (
      `${n >= 0 ? '+' : ''}${n.toFixed(digits)}`
    );

  },


  average(values) {

    const valid =
      values
        .map(Number)
        .filter(
          value =>
            Number.isFinite(value)
        );

    if (!valid.length) {
      return 0;
    }

    return (
      valid.reduce(
        (sum, value) =>
          sum + value,
        0
      ) / valid.length
    );

  },


  nodeId(value) {

    const id =
      String(value ?? '');

    return id.startsWith('J')
      ? id
      : `J${id}`;

  },


  pipeId(value) {

    const id =
      String(value ?? '');

    return id.startsWith('P')
      ? id
      : `P${id}`;

  },


  scenarioLabel(scenario) {

    if (scenario === 'j4_leak') {
      return 'J4 DISRUPTION';
    }

    if (scenario === 'j6_leak') {
      return 'J6 DISRUPTION';
    }

    return 'BASELINE';

  },


  scenarioTitle(scenario) {

    if (scenario === 'j4_leak') {
      return 'Junction J4 Disruption Scenario';
    }

    if (scenario === 'j6_leak') {
      return 'Junction J6 Disruption Scenario';
    }

    return 'Baseline Network Operation';

  },


  getContainer() {

    return document.getElementById(
      'municipal-subview-container'
    );

  },


  updateContainer(html) {

    const container =
      this.getContainer();

    if (container) {
      container.innerHTML = html;
    }

  },


  icon(name, className = 'icon') {

    if (
      typeof Icons !== 'undefined' &&
      Icons &&
      typeof Icons[name] === 'function'
    ) {

      return Icons[name](className);

    }

    return '';

  },


  /* ==========================================================
     API HELPERS
     ========================================================== */

  async fetchJson(url) {

    const response =
      await fetch(
        url,
        {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
          headers: {
            Accept: 'application/json'
          }
        }
      );

    if (!response.ok) {

      throw new Error(
        `HTTP ${response.status}`
      );

    }

    return await response.json();

  },


  /*
   * Converts the backend response:
   *
   * {
   *   source: "EPANET/WNTR",
   *   scenario: "...",
   *   results: [...]
   * }
   *
   * into:
   *
   * {
   *   nodes: [...],
   *   pipes: [...]
   * }
   */

  normalizeScenario(raw) {

    const payload =
      raw &&
        typeof raw === 'object'
        ? raw
        : {};

    const rawResults =
      Array.isArray(payload.results)
        ? payload.results
        : [];


    const nodes =
      rawResults
        .filter(
          item =>
            item &&
            (
              item.element_type === 'junction' ||
              item.type === 'junction' ||
              item.element_type === 'node'
            )
        )
        .map(item => ({

          id:
            this.nodeId(
              item.element_id ??
              item.id
            ),

          pressure:
            this.number(
              item.pressure
            ),

          demand:
            this.number(
              item.demand
            )

        }));


    const pipes =
      rawResults
        .filter(
          item =>
            item &&
            (
              item.element_type === 'pipe' ||
              item.type === 'pipe' ||
              item.element_type === 'link'
            )
        )
        .map(item => ({

          id:
            this.pipeId(
              item.element_id ??
              item.id
            ),

          flow:
            this.number(
              item.flow
            )

        }));


    return {

      ...payload,

      nodes,

      pipes

    };

  },


  async getScenario(scenario) {

    const config =
      this.getConfig();


    const url =
      `${config.baseUrl}${config.results}` +
      `?scenario=${encodeURIComponent(scenario)}`;


    const raw =
      await this.fetchJson(url);


    return this.normalizeScenario(
      raw
    );

  },


  /* ==========================================================
     COMPARISON ENGINE
     ========================================================== */

  buildComparison(
    baseline,
    current
  ) {

    if (
      !baseline ||
      !current
    ) {

      return {

        nodes: [],

        pipes: []

      };

    }


    const baselineNodes =
      new Map(
        baseline.nodes.map(
          node => [
            node.id,
            node
          ]
        )
      );


    const baselinePipes =
      new Map(
        baseline.pipes.map(
          pipe => [
            pipe.id,
            pipe
          ]
        )
      );


    const nodes =
      current.nodes.map(
        node => {

          const base =
            baselineNodes.get(
              node.id
            );


          const baselineValue =
            base
              ? this.number(
                base.pressure
              )
              : 0;


          const currentValue =
            this.number(
              node.pressure
            );


          const delta =
            currentValue -
            baselineValue;


          const percentage =
            baselineValue !== 0
              ? (
                delta /
                baselineValue
              ) * 100
              : 0;


          return {

            id:
              node.id,

            baseline:
              baselineValue,

            current:
              currentValue,

            value:
              currentValue,

            delta,

            baseline_value:
              baselineValue,

            delta_percentage:
              percentage

          };

        }
      );


    const pipes =
      current.pipes.map(
        pipe => {

          const base =
            baselinePipes.get(
              pipe.id
            );


          const baselineValue =
            base
              ? this.number(
                base.flow
              )
              : 0;


          const currentValue =
            this.number(
              pipe.flow
            );


          const delta =
            currentValue -
            baselineValue;


          const percentage =
            baselineValue !== 0
              ? (
                delta /
                baselineValue
              ) * 100
              : 0;


          return {

            id:
              pipe.id,

            baseline:
              baselineValue,

            current:
              currentValue,

            value:
              currentValue,

            delta,

            baseline_value:
              baselineValue,

            delta_percentage:
              percentage

          };

        }
      );


    return {

      nodes,

      pipes

    };

  },


  /* ==========================================================
     MAIN SHELL
     ========================================================== */

  render(activeSubTab = 'overview') {

    return `

      <div class="municipal-layout">

        <!-- ==================================================
             SIDEBAR
             ================================================== -->

        <aside class="municipal-sidebar">

          <div class="sidebar-header">

            <a
              href="#/municipal/dashboard"
              class="sidebar-brand"
              data-route="/municipal/dashboard"
            >

              ${this.icon(
      'brandLogo',
      'brand-icon'
    )}

              <div>

                <div class="sidebar-brand-title">
                  Hydro<span>Cybernetics</span>
                </div>

                <div class="sidebar-brand-badge">
                  MUNICIPAL CONTROL
                </div>

              </div>

            </a>

          </div>


          <div class="sidebar-nav-section">

            <div class="sidebar-section-label">
              OPERATIONS &amp; CONTROL
            </div>


            <ul class="sidebar-menu">

              ${this.navItem(
      'overview',
      '/municipal/dashboard',
      'Overview',
      'overview',
      activeSubTab
    )}

              ${this.navItem(
      'digital-twin',
      '/municipal/digital-twin',
      'Digital Twin',
      'map',
      activeSubTab
    )}

              ${this.navItem(
      'simulation',
      '/municipal/simulation',
      'Simulation',
      'simulate',
      activeSubTab
    )}

              ${this.navItem(
      'leak-analysis',
      '/municipal/leak-analysis',
      'Leak Analysis',
      'leakAlert',
      activeSubTab
    )}

            </ul>


            <div class="sidebar-section-label mt-6">
              MONITORING &amp; AUDIT
            </div>


            <ul class="sidebar-menu">

              ${this.navItem(
      'alerts',
      '/municipal/alerts',
      'Alerts',
      'alertCircle',
      activeSubTab
    )}

              ${this.navItem(
      'analytics',
      '/municipal/analytics',
      'Operational Analytics',
      'chart',
      activeSubTab
    )}

              ${this.navItem(
      'reports',
      '/municipal/reports',
      'Reports',
      'fileText',
      activeSubTab
    )}

            </ul>

          </div>


          <div class="sidebar-footer">

            <div class="sidebar-operator-info">

              <div class="operator-avatar">
                ${this.icon(
      'user',
      'icon'
    )}
              </div>

              <div>

                <div class="operator-name">
                  Municipal Operator
                </div>

                <div class="operator-role font-mono">
                  ROLE: ENGINEER
                </div>

              </div>

            </div>


            <button
              class="sidebar-logout-btn"
              onclick="
                if (
                  window.app &&
                  typeof window.app.handleSignOut === 'function'
                ) {
                  window.app.handleSignOut();
                }
              "
              title="Sign Out"
            >

              ${this.icon(
      'logOut',
      'icon'
    )}

            </button>

          </div>

        </aside>


        <!-- ==================================================
             MAIN AREA
             ================================================== -->

        <div class="municipal-main">

          <header class="municipal-topbar">

            <div class="topbar-context">

              <span class="context-zone-pill">

                <span class="context-dot"></span>

                ZONE:
                <strong>Sadashiv Nagar DMA</strong>

              </span>


              <span class="context-divider">
                /
              </span>


              <span class="context-title">

                ${this.escapeHtml(
      activeSubTab
        .toUpperCase()
        .replace(/-/g, ' ')
    )}

              </span>

            </div>


            <div class="topbar-actions">

              <span class="topbar-tag font-mono">
                HYDRAULIC ANALYSIS ENGINE
              </span>


              <button
                class="btn btn-secondary btn-sm"
                onclick="
                  if (
                    window.app &&
                    typeof window.app.handleSignOut === 'function'
                  ) {
                    window.app.handleSignOut();
                  }
                "
              >

                ${this.icon(
      'logOut',
      'icon'
    )}

                <span>
                  Sign Out
                </span>

              </button>

            </div>

          </header>


          <div
            class="municipal-content"
            id="municipal-subview-container"
          >

            ${this.renderSubView(
      activeSubTab
    )}

          </div>

        </div>

      </div>

    `;

  },


  navItem(
    tab,
    route,
    label,
    iconName,
    activeTab
  ) {

    return `

      <li>

        <a
          href="#${route}"
          class="sidebar-link ${activeTab === tab
        ? 'active'
        : ''
      }"
          data-route="${route}"
        >

          ${this.icon(
        iconName,
        'icon'
      )}

          <span>
            ${this.escapeHtml(label)}
          </span>

        </a>

      </li>

    `;

  },


  /* ==========================================================
     SUBVIEW ROUTER
     ========================================================== */

  renderSubView(tab) {

    let content = '';

    switch (tab) {

      case 'overview':
        content = this.renderOverview();
        break;

      case 'digital-twin':
        content = this.renderDigitalTwin();
        break;

      case 'simulation':
        content = this.renderSimulation();
        break;

      case 'leak-analysis':
        content = this.renderLeakAnalysis();
        break;

      case 'alerts':
        content = this.renderAlerts();
        break;

      case 'analytics':
        content = this.renderAnalytics();
        break;

      case 'reports':
        content = this.renderReports();
        break;

      default:
        content = this.renderOverview();
        break;

    }

    return this.renderModuleFrame(
      tab,
      content
    );

  },


  /* ==========================================================
     CONSISTENT MUNICIPAL MODULE FRAME
     ========================================================== */

  renderModuleFrame(
    tab,
    content
  ) {

    const modules = {

      'digital-twin': {
        title: 'Digital Twin',
        subtitle: 'Live network model and spatial hydraulic context',
        icon: 'network',
        mode: 'NETWORK MODEL'
      },

      simulation: {
        title: 'Hydraulic Simulation',
        subtitle: 'EPANET/WNTR scenario execution and hydraulic state analysis',
        icon: 'simulate',
        mode: 'EPANET / WNTR'
      },

      'leak-analysis': {
        title: 'Leak Analysis',
        subtitle: 'Hydraulic divergence, anomaly localization and affected elements',
        icon: 'leakAlert',
        mode: 'ANOMALY ANALYSIS'
      },

      alerts: {
        title: 'Operational Alerts',
        subtitle: 'Scenario-derived hydraulic advisories for municipal operations',
        icon: 'alertCircle',
        mode: 'EVENT ADVISORY'
      },

      analytics: {
        title: 'Operational Analytics',
        subtitle: 'Telemetry trends and hydraulic operating indicators',
        icon: 'chart',
        mode: 'LIVE TELEMETRY'
      },

      reports: {
        title: 'Reports',
        subtitle: 'Hydraulic scenario analysis and citizen water-service reporting',
        icon: 'fileText',
        mode: 'MUNICIPAL REPORTING'
      },

      overview: {
        title: 'Municipal Overview',
        subtitle: 'Sadashiv Nagar DMA network operations command view',
        icon: 'monitor',
        mode: 'COMMAND OVERVIEW'
      }

    };

    const meta =
      modules[tab] ||
      modules.overview;

    return `

      <style>

        .hc-module-frame {
          display: flex;
          flex-direction: column;
          gap: 18px;
          width: 100%;
        }

        .hc-module-hero {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(148,163,184,.18);
          border-radius: 18px;
          padding: 20px 22px;
          background:
            linear-gradient(135deg, rgba(15,23,42,.98), rgba(15,23,42,.88)),
            radial-gradient(circle at top right, rgba(59,130,246,.12), transparent 42%);
          box-shadow: 0 12px 30px rgba(15,23,42,.10);
        }

        .hc-module-hero::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(96,165,250,.72), transparent);
        }

        .hc-module-hero-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .hc-module-title-wrap {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }

        .hc-module-icon {
          width: 46px;
          height: 46px;
          flex: 0 0 46px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          border: 1px solid rgba(96,165,250,.28);
          background: rgba(59,130,246,.10);
          color: #93c5fd;
        }

        .hc-module-title {
          margin: 0;
          color: #f8fafc;
          font-size: 1.15rem;
          font-weight: 700;
          letter-spacing: -.01em;
        }

        .hc-module-subtitle {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: .78rem;
          line-height: 1.5;
        }

        .hc-module-badge {
          flex: 0 0 auto;
          padding: 7px 10px;
          border-radius: 999px;
          border: 1px solid rgba(148,163,184,.22);
          background: rgba(15,23,42,.58);
          color: #cbd5e1;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: .67rem;
          font-weight: 700;
          letter-spacing: .08em;
        }

        .hc-module-meta {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 16px;
        }

        .hc-module-meta-item {
          min-width: 0;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid rgba(148,163,184,.12);
          background: rgba(2,6,23,.22);
        }

        .hc-module-meta-label {
          color: #64748b;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: .61rem;
          letter-spacing: .08em;
        }

        .hc-module-meta-value {
          margin-top: 4px;
          color: #e2e8f0;
          font-size: .72rem;
          font-weight: 600;
        }

        .hc-module-content {
          width: 100%;
        }

        .hc-module-content > .dash-card:first-child {
          margin-top: 0 !important;
        }

        .hc-module-content .dash-card {
          border-radius: 16px;
        }

        .hc-module-content .dash-card-header {
          min-height: 68px;
        }

        .hc-module-content .overview-cards-grid {
          align-items: stretch;
        }

        .hc-module-content .metric-card,
        .hc-module-content .small-metric,
        .hc-module-content .overview-metric-card {
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
        }

        .hc-module-content .metric-card:hover,
        .hc-module-content .small-metric:hover,
        .hc-module-content .overview-metric-card:hover {
          transform: translateY(-2px);
        }

        .hc-module-content table {
          border-radius: 12px;
          overflow: hidden;
        }

        .hc-module-content .analytics-toolbar {
          border-radius: 14px;
        }

        .hc-state-card {
          border: 1px solid rgba(148,163,184,.18);
          border-radius: 16px;
          box-shadow: 0 12px 28px rgba(15,23,42,.08);
        }

        @media (max-width: 760px) {
          .hc-module-hero-main {
            align-items: flex-start;
            flex-direction: column;
          }

          .hc-module-badge {
            align-self: flex-start;
          }

          .hc-module-meta {
            grid-template-columns: 1fr;
          }
        }

      </style>

      <div class="hc-module-frame">

        <div class="hc-module-hero">

          <div class="hc-module-hero-main">

            <div class="hc-module-title-wrap">

              <div class="hc-module-icon">
                ${this.icon(
      meta.icon,
      'icon'
    )}
              </div>

              <div>
                <h1 class="hc-module-title">
                  ${this.escapeHtml(meta.title)}
                </h1>

                <p class="hc-module-subtitle">
                  ${this.escapeHtml(meta.subtitle)}
                </p>
              </div>

            </div>

            <div class="hc-module-badge">
              ${this.escapeHtml(meta.mode)}
            </div>

          </div>

          <div class="hc-module-meta">

            <div class="hc-module-meta-item">
              <div class="hc-module-meta-label">MODULE</div>
              <div class="hc-module-meta-value">
                ${this.escapeHtml(meta.title.toUpperCase())}
              </div>
            </div>

            <div class="hc-module-meta-item">
              <div class="hc-module-meta-label">NETWORK</div>
              <div class="hc-module-meta-value">
                SADASHIV NAGAR DMA · BELAGAVI
              </div>
            </div>

            <div class="hc-module-meta-item">
              <div class="hc-module-meta-label">PLATFORM</div>
              <div class="hc-module-meta-value">
                HYDROCYBERNETICS MUNICIPAL OPERATIONS
              </div>
            </div>

          </div>

        </div>

        <div class="hc-module-content">
          ${content}
        </div>

      </div>

    `;

  },


  /* ==========================================================
     OVERVIEW
     ========================================================== */

  renderOverview() {

    return `

      <div class="dashboard-overview-container">

        <div class="overview-cards-grid">

          <div class="metric-card">

            <div class="metric-card-header">

              <span class="metric-label">
                NETWORK STATUS
              </span>

              ${this.icon(
      'monitor',
      'icon'
    )}

            </div>

            <div class="metric-val text-accent">
              TOPOLOGY MODEL
            </div>

            <div class="metric-meta text-xs text-muted">
              9 Junctions • 9 Mains • 1 Storage Unit
            </div>

            <div class="metric-tag-subtle mt-2 font-mono text-xs">
              [NETWORK MODEL CONFIGURED]
            </div>

          </div>


          <div class="metric-card">

            <div class="metric-card-header">

              <span class="metric-label">
                HYDRAULIC INDICATORS
              </span>

              ${this.icon(
      'gauge',
      'icon'
    )}

            </div>

            <div class="metric-val">
              ANALYSIS READY
            </div>

            <div class="metric-meta text-xs text-muted">
              Baseline · J4 · J6 scenarios
            </div>

            <div class="metric-tag-subtle mt-2 font-mono text-xs">
              [EPANET / WNTR]
            </div>

          </div>


          <div class="metric-card">

            <div class="metric-card-header">

              <span class="metric-label">
                LEAK ANALYSIS
              </span>

              ${this.icon(
      'leakAlert',
      'icon'
    )}

            </div>

            <div class="metric-val">
              DIVERGENCE ENGINE
            </div>

            <div class="metric-meta text-xs text-muted">
              Nodal residual pressure comparison
            </div>

            <div class="metric-tag-subtle mt-2 font-mono text-xs">
              [DISRUPTION ANALYSIS]
            </div>

          </div>


          <div class="metric-card">

            <div class="metric-card-header">

              <span class="metric-label">
                ALERTS &amp; DISPATCH
              </span>

              ${this.icon(
      'alertCircle',
      'icon'
    )}

            </div>

            <div class="metric-val">
              ADVISORY ACTIVE
            </div>

            <div class="metric-meta text-xs text-muted">
              Hydraulic event monitoring
            </div>

            <div class="metric-tag-subtle mt-2 font-mono text-xs">
              [INCIDENT MONITORING]
            </div>

          </div>

        </div>


        <div class="dashboard-grid-2col mt-8">

          <div class="dash-card">

            <div class="dash-card-header">

              <div class="dash-card-title-wrap">

                <div class="icon-box">
                  ${this.icon(
      'map',
      'icon'
    )}
                </div>

                <div>

                  <h2 class="dash-card-title">
                    Geographic Digital Twin
                  </h2>

                  <p class="dash-card-subtitle">
                    Geographic network and hydraulic state visualization
                  </p>

                </div>

              </div>


              <a
                href="#/municipal/digital-twin"
                class="btn btn-secondary btn-sm"
                data-route="/municipal/digital-twin"
              >
                Open Digital Twin
                ${this.icon(
      'arrowRight',
      'icon'
    )}
              </a>

            </div>


            <div class="dash-card-body">

              <div class="placeholder-map-box">

                <div class="placeholder-map-inner">

                  ${this.icon(
      'map',
      'placeholder-big-icon'
    )}

                  <div class="font-semibold text-sm mt-3">
                    Interactive Geographic Digital Twin
                  </div>

                  <p class="text-xs text-secondary mt-1 max-w-sm text-center">
                    Open the Digital Twin module to view
                    the Cesium-based geographic hydraulic network.
                  </p>

                  <div class="map-badge font-mono text-xs mt-3">
                    GEOGRAPHIC_NETWORK_VIEW
                  </div>

                </div>

              </div>

            </div>

          </div>


          <div class="dash-card">

            <div class="dash-card-header">

              <div class="dash-card-title-wrap">

                <div class="icon-box">
                  ${this.icon(
      'simulate',
      'icon'
    )}
                </div>

                <div>

                  <h2 class="dash-card-title">
                    Hydraulic Scenarios
                  </h2>

                  <p class="dash-card-subtitle">
                    EPANET/WNTR scenario framework
                  </p>

                </div>

              </div>

            </div>


            <div class="dash-card-body">

              <div class="scenario-list">

                ${this.overviewScenario(
      'Baseline',
      'Normal hydraulic operating condition',
      'REFERENCE'
    )}

                ${this.overviewScenario(
      'J4 Disruption',
      'Hydraulic disruption at junction J4',
      'TEST CASE'
    )}

                ${this.overviewScenario(
      'J6 Disruption',
      'Hydraulic disruption at junction J6',
      'TEST CASE'
    )}

              </div>

            </div>

          </div>

        </div>


        <div class="dash-card mt-8">

          <div class="dash-card-header">

            <div class="dash-card-title-wrap">

              <div class="icon-box">
                ${this.icon(
      'chart',
      'icon'
    )}
              </div>

              <div>

                <h2 class="dash-card-title">
                  Municipal Operations
                </h2>

                <p class="dash-card-subtitle">
                  Monitoring, simulation, anomaly analysis and reporting
                </p>

              </div>

            </div>

          </div>


          <div class="dash-card-body">

            <div class="overview-module-grid">

              ${this.moduleCard(
      'Simulation',
      'Run and compare EPANET hydraulic scenarios.',
      '#/municipal/simulation',
      'simulate'
    )}

              ${this.moduleCard(
      'Leak Analysis',
      'Analyse hydraulic divergence and affected elements.',
      '#/municipal/leak-analysis',
      'leakAlert'
    )}

              ${this.moduleCard(
      'Alerts',
      'Review hydraulic event advisories.',
      '#/municipal/alerts',
      'alertCircle'
    )}

              ${this.moduleCard(
      'Operational Analytics',
      'View live telemetry and operational trends.',
      '#/municipal/analytics',
      'chart'
    )}

              ${this.moduleCard(
      'Reports',
      'Review stored scenario analysis and reporting.',
      '#/municipal/reports',
      'fileText'
    )}

            </div>

          </div>

        </div>

      </div>

    `;

  },


  overviewScenario(
    title,
    description,
    tag
  ) {

    return `

      <div class="scenario-item">

        <div class="scenario-item-header">

          <div class="font-semibold text-sm">
            ${this.escapeHtml(title)}
          </div>

          <span class="status-tag status-tag-normal">
            ${this.escapeHtml(tag)}
          </span>

        </div>

        <div class="text-xs text-secondary mt-2">
          ${this.escapeHtml(description)}
        </div>

      </div>

    `;

  },


  moduleCard(
    title,
    description,
    route,
    iconName
  ) {

    return `

      <a
        href="${route}"
        class="module-card"
        data-route="${route.replace('#', '')}"
      >

        <div class="module-card-icon">

          ${this.icon(
      iconName,
      'icon'
    )}

        </div>

        <div>

          <div class="font-semibold text-sm">
            ${this.escapeHtml(title)}
          </div>

          <div class="text-xs text-secondary mt-1">
            ${this.escapeHtml(description)}
          </div>

        </div>

      </a>

    `;

  },


  /* ==========================================================
     DIGITAL TWIN
     ========================================================== */

  renderDigitalTwin() {

    if (
      typeof DigitalTwinView !== 'undefined' &&
      DigitalTwinView &&
      typeof DigitalTwinView.render === 'function'
    ) {

      try {

        return DigitalTwinView.render();

      } catch (error) {

        console.error(
          'Digital Twin render error:',
          error
        );

        return this.errorCard(
          'Digital Twin unavailable',
          error.message
        );

      }

    }


    return `

      <div class="dash-card">

        <div class="dash-card-header">

          <div class="dash-card-title-wrap">

            <div class="icon-box">
              ${this.icon(
      'map',
      'icon'
    )}
            </div>

            <div>

              <h2 class="dash-card-title">
                Geographic Digital Twin
              </h2>

              <p class="dash-card-subtitle">
                Cesium geographic hydraulic network
              </p>

            </div>

          </div>

        </div>


        <div class="dash-card-body">

          <div class="notice-box-subtle">

            <strong>
              Digital Twin module is not loaded.
            </strong>

            <div class="text-xs text-secondary mt-2">
              Ensure digital-twin.js is loaded before this dashboard.
            </div>

          </div>

        </div>

      </div>

    `;

  },


  /* ==========================================================
     SIMULATION
     ========================================================== */

  renderSimulation() {

    const state =
      this.simulationState;


    if (state.loading) {

      return `

        <div class="loading-state-card hc-state-card">

          <div class="loading-spinner"></div>

          <h3 class="text-base font-semibold mb-1">
            Loading Hydraulic Simulation Results
          </h3>

          <p class="text-xs text-muted">
            Fetching EPANET/WNTR scenario calculations...
          </p>

        </div>

      `;

    }


    if (state.error) {

      return this.errorCard(
        'Simulation Data Unavailable',
        state.error,
        `
          <button
            class="btn btn-secondary btn-sm"
            onclick="
              DashboardMunicipalView.loadSimulationData(
                '${this.escapeHtml(
          state.currentScenario
        )}'
              );
            "
          >
            Retry
          </button>
        `
      );

    }


    const result =
      state.results;


    const nodes =
      result &&
        Array.isArray(result.nodes)
        ? result.nodes
        : [];


    const pipes =
      result &&
        Array.isArray(result.pipes)
        ? result.pipes
        : [];


    /*
     * IMPORTANT:
     *
     * Average pressure is supplied directly by the
     * EPANET/WNTR backend response.
     *
     * We intentionally do NOT calculate the official
     * hydraulic average in the frontend.
     */

    const avgPressure =
      result &&
        result.average_pressure != null
        ? this.number(
          result.average_pressure,
          null
        )
        : null;


    /*
     * P1 is displayed explicitly rather than assuming
     * that the first array element represents source flow.
     *
     * This is still the actual EPANET/WNTR pipe result.
     */

    const p1Flow =
      result &&
        Array.isArray(result.pipes)
        ? (
          result.pipes.find(
            pipe => pipe.id === 'P1'
          )?.flow ?? null
        )
        : null;


    return `

      <div class="simulation-dashboard-view">

        <div class="dash-card">

          <div class="dash-card-header">

            <div class="dash-card-title-wrap">

              <div class="icon-box">
                ${this.icon(
      'simulate',
      'icon'
    )}
              </div>

              <div>

                <h2 class="dash-card-title">
                  Hydraulic Simulation
                </h2>

                <p class="dash-card-subtitle">
                  EPANET/WNTR hydraulic model results
                </p>

              </div>

            </div>


            <span class="status-tag status-tag-normal">
              ${this.escapeHtml(
      this.scenarioLabel(
        state.currentScenario
      )
    )}
            </span>

          </div>


          <div class="dash-card-body">

            <div class="analytics-toolbar">

              <div>

                <div class="analytics-section-label">
                  HYDRAULIC SCENARIO
                </div>

                <div class="text-xs text-secondary">
                  Select the scenario to run.
                </div>

              </div>


              <div class="analytics-scenario-group">

                ${this.scenarioButton(
      'baseline',
      'Baseline'
    )}

                ${this.scenarioButton(
      'j4_leak',
      'J4 Disruption'
    )}

                ${this.scenarioButton(
      'j6_leak',
      'J6 Disruption'
    )}

              </div>

            </div>


            <div class="overview-cards-grid mt-6">

              ${this.smallMetric(
      'AVERAGE PRESSURE',
      avgPressure == null
        ? '—'
        : `${this.format(avgPressure)} m`
    )}

              ${this.smallMetric(
      'P1 FLOW',
      p1Flow == null
        ? '—'
        : `${this.format(p1Flow)} L/s`
    )}

              ${this.smallMetric(
      'JUNCTIONS',
      String(nodes.length)
    )}

              ${this.smallMetric(
      'PIPES',
      String(pipes.length)
    )}

            </div>


            <div class="dashboard-grid-2col mt-8">

              <div class="dash-card">

                <div class="dash-card-header">

                  <div class="dash-card-title-wrap">

                    <div class="icon-box">
                      ${this.icon(
      'gauge',
      'icon'
    )}
                    </div>

                    <div>

                      <h3 class="dash-card-title">
                        Junction Pressures
                      </h3>

                      <p class="dash-card-subtitle">
                        Hydraulic head pressure output
                      </p>

                    </div>

                  </div>

                </div>


                <div class="dash-card-body">

                  ${this.renderNodeTable(
      nodes
    )}

                </div>

              </div>


              <div class="dash-card">

                <div class="dash-card-header">

                  <div class="dash-card-title-wrap">

                    <div class="icon-box">
                      ${this.icon(
      'chart',
      'icon'
    )}
                    </div>

                    <div>

                      <h3 class="dash-card-title">
                        Pipe Flows
                      </h3>

                      <p class="dash-card-subtitle">
                        Hydraulic flow output
                      </p>

                    </div>

                  </div>

                </div>


                <div class="dash-card-body">

                  ${this.renderPipeTable(
      pipes
    )}

                </div>

              </div>

            </div>


            ${state.currentScenario !== 'baseline'
        ? this.renderScenarioComparison(
          state.comparison
        )
        : ''
      }


            <div class="notice-box-subtle mt-6">

              ${this.icon(
        'info',
        'icon'
      )}

              <span class="text-xs text-secondary">

                Hydraulic pressure values are reported as
                EPANET pressure head in metres of water.
                Flow values are reported in L/s.
                Scenario values shown above are returned by
                the EPANET/WNTR hydraulic simulation backend.

              </span>

            </div>

          </div>

        </div>

      </div>

    `;

  },


  scenarioButton(
    scenario,
    label
  ) {

    return `

      <button
        type="button"
        class="analytics-scenario-btn ${this.simulationState.currentScenario === scenario
        ? 'active'
        : ''
      }"
        onclick="
          DashboardMunicipalView.switchScenario(
            '${scenario}'
          );
        "
      >

        ${this.escapeHtml(label)}

      </button>

    `;

  },


  smallMetric(
    label,
    value
  ) {

    return `

      <div class="metric-card">

        <div class="metric-label">
          ${this.escapeHtml(label)}
        </div>

        <div class="metric-val">
          ${this.escapeHtml(value)}
        </div>

      </div>

    `;

  },


  renderNodeTable(nodes) {

    if (!nodes.length) {

      return this.emptyState(
        'No junction results returned for this scenario.'
      );

    }


    return `

      <div class="table-responsive">

        <table class="data-table">

          <thead>

            <tr>

              <th>
                JUNCTION
              </th>

              <th>
                PRESSURE HEAD
              </th>

              <th>
                DEMAND
              </th>

            </tr>

          </thead>


          <tbody>

            ${nodes.map(
      node => `

                <tr>

                  <td class="font-mono text-accent font-semibold">
                    ${this.escapeHtml(
        node.id
      )}
                  </td>

                  <td class="font-mono">
                    ${this.format(
        node.pressure
      )} m
                  </td>

                  <td class="font-mono">
                    ${this.format(
        node.demand
      )} L/s
                  </td>

                </tr>

              `
    ).join('')}

          </tbody>

        </table>

      </div>

    `;

  },


  renderPipeTable(pipes) {

    if (!pipes.length) {

      return this.emptyState(
        'No pipe results returned for this scenario.'
      );

    }


    return `

      <div class="table-responsive">

        <table class="data-table">

          <thead>

            <tr>

              <th>
                PIPE
              </th>

              <th>
                FLOW
              </th>

            </tr>

          </thead>


          <tbody>

            ${pipes.map(
      pipe => `

                <tr>

                  <td class="font-mono text-accent font-semibold">
                    ${this.escapeHtml(
        pipe.id
      )}
                  </td>

                  <td class="font-mono">
                    ${this.format(
        pipe.flow
      )} L/s
                  </td>

                </tr>

              `
    ).join('')}

          </tbody>

        </table>

      </div>

    `;

  },


  renderScenarioComparison(
    comparison
  ) {

    if (!comparison) {

      return '';

    }


    const nodes =
      Array.isArray(
        comparison.nodes
      )
        ? comparison.nodes
        : [];


    const pipes =
      Array.isArray(
        comparison.pipes
      )
        ? comparison.pipes
        : [];


    return `

      <div class="dash-card mt-8">

        <div class="dash-card-header">

          <div class="dash-card-title-wrap">

            <div class="icon-box">

              ${this.icon(
      'alertCircle',
      'icon'
    )}

            </div>

            <div>

              <h3 class="dash-card-title">
                Scenario Divergence
              </h3>

              <p class="dash-card-subtitle">
                Comparison against the baseline hydraulic state
              </p>

            </div>

          </div>

        </div>


        <div class="dash-card-body">

          <div class="dashboard-grid-2col">

            <div>

              <div class="analytics-section-label mb-3">
                NODAL PRESSURE CHANGES
              </div>


              <div class="table-responsive">

                <table class="data-table">

                  <thead>

                    <tr>

                      <th>
                        NODE
                      </th>

                      <th>
                        BASELINE
                      </th>

                      <th>
                        CURRENT
                      </th>

                      <th>
                        Δ
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    ${nodes.map(
      item => `

                        <tr>

                          <td class="font-mono">
                            ${this.escapeHtml(
        item.id
      )}
                          </td>

                          <td>
                            ${this.format(
        item.baseline
      )} m
                          </td>

                          <td>
                            ${this.format(
        item.current
      )} m
                          </td>

                          <td class="font-mono">

                            ${this.signed(
        item.delta
      )} m

                          </td>

                        </tr>

                      `
    ).join('')}

                  </tbody>

                </table>

              </div>

            </div>


            <div>

              <div class="analytics-section-label mb-3">
                PIPE FLOW CHANGES
              </div>


              <div class="table-responsive">

                <table class="data-table">

                  <thead>

                    <tr>

                      <th>
                        PIPE
                      </th>

                      <th>
                        BASELINE
                      </th>

                      <th>
                        CURRENT
                      </th>

                      <th>
                        Δ
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    ${pipes.map(
      item => `

                        <tr>

                          <td class="font-mono">
                            ${this.escapeHtml(
        item.id
      )}
                          </td>

                          <td>
                            ${this.format(
        item.baseline
      )} L/s
                          </td>

                          <td>
                            ${this.format(
        item.current
      )} L/s
                          </td>

                          <td class="font-mono">

                            ${this.signed(
        item.delta
      )} L/s

                          </td>

                        </tr>

                      `
    ).join('')}

                  </tbody>

                </table>

              </div>

            </div>

          </div>

        </div>

      </div>

    `;

  },


  /* ==========================================================
     LOAD SIMULATION
     ========================================================== */

  async loadSimulationData(
    scenario = 'baseline'
  ) {

    const allowed = [
      'baseline',
      'j4_leak',
      'j6_leak'
    ];


    if (
      !allowed.includes(
        scenario
      )
    ) {

      scenario =
        'baseline';

    }


    const state =
      this.simulationState;


    state.currentScenario =
      scenario;

    state.loading =
      true;

    state.error =
      null;


    this.updateContainer(
      this.renderSimulation()
    );


    try {

      const current =
        await this.getScenario(
          scenario
        );


      state.results =
        current;


      if (
        scenario !== 'baseline'
      ) {

        const baseline =
          await this.getScenario(
            'baseline'
          );


        state.comparison =
          this.buildComparison(
            baseline,
            current
          );

      } else {

        state.comparison =
          null;

      }


      state.error =
        null;

    } catch (error) {

      console.error(
        'Hydraulic simulation error:',
        error
      );

      state.results =
        null;

      state.comparison =
        null;

      state.error =
        `Unable to load hydraulic results: ${error.message}`;

    }


    state.loading =
      false;


    this.updateContainer(
      this.renderSimulation()
    );

  },


  switchScenario(
    scenario
  ) {

    this.loadSimulationData(
      scenario
    );

  },


  /* ==========================================================
     LEAK ANALYSIS
     ========================================================== */

  renderLeakAnalysis() {

    const state =
      this.leakState;


    if (state.loading) {

      return this.loadingCard(
        'LEAK ANALYSIS',
        'Comparing baseline and disruption hydraulic states...'
      );

    }


    if (state.error) {

      return this.errorCard(
        'Leak Analysis Unavailable',
        state.error,
        `
          <button
            class="btn btn-secondary btn-sm"
            onclick="
              DashboardMunicipalView.loadLeakAnalysis(
                '${state.scenario}'
              );
            "
          >
            Retry
          </button>
        `
      );

    }


    if (
      !state.baseline ||
      !state.current
    ) {

      return `

        <div class="dash-card">

          <div class="dash-card-header">

            <div class="dash-card-title-wrap">

              <div class="icon-box">
                ${this.icon(
        'leakAlert',
        'icon'
      )}
              </div>

              <div>

                <h2 class="dash-card-title">
                  Leakage Anomaly &amp; Localization
                </h2>

                <p class="dash-card-subtitle">
                  Hydraulic divergence analysis
                </p>

              </div>

            </div>

          </div>


          <div class="dash-card-body">

            <button
              class="btn btn-primary"
              onclick="
                DashboardMunicipalView.loadLeakAnalysis(
                  'j4_leak'
                );
              "
            >
              Run J4 Analysis
            </button>

            <button
              class="btn btn-secondary"
              style="margin-left:8px;"
              onclick="
                DashboardMunicipalView.loadLeakAnalysis(
                  'j6_leak'
                );
              "
            >
              Run J6 Analysis
            </button>

          </div>

        </div>

      `;

    }


    const comparison =
      this.buildComparison(
        state.baseline,
        state.current
      );


    const nodeChanges =
      comparison.nodes
        .slice()
        .sort(
          (a, b) =>
            Math.abs(b.delta) -
            Math.abs(a.delta)
        );


    const pipeChanges =
      comparison.pipes
        .slice()
        .sort(
          (a, b) =>
            Math.abs(b.delta) -
            Math.abs(a.delta)
        );


    const largestNode =
      nodeChanges[0] || null;


    const largestPipe =
      pipeChanges[0] || null;


    return `

      <div class="dash-card">

        <div class="dash-card-header">

          <div class="dash-card-title-wrap">

            <div class="icon-box">
              ${this.icon(
      'leakAlert',
      'icon'
    )}
            </div>

            <div>

              <h2 class="dash-card-title">
                Leakage Anomaly &amp; Localization
              </h2>

              <p class="dash-card-subtitle">
                Residual hydraulic divergence from baseline
              </p>

            </div>

          </div>


          <div class="analytics-scenario-group">

            <button
              class="analytics-scenario-btn ${state.scenario === 'j4_leak'
        ? 'active'
        : ''
      }"
              onclick="
                DashboardMunicipalView.loadLeakAnalysis(
                  'j4_leak'
                );
              "
            >
              J4 Disruption
            </button>


            <button
              class="analytics-scenario-btn ${state.scenario === 'j6_leak'
        ? 'active'
        : ''
      }"
              onclick="
                DashboardMunicipalView.loadLeakAnalysis(
                  'j6_leak'
                );
              "
            >
              J6 Disruption
            </button>

          </div>

        </div>


        <div class="dash-card-body">

          <div class="overview-cards-grid">

            ${this.smallMetric(
        'SCENARIO',
        this.scenarioLabel(
          state.scenario
        )
      )}

            ${this.smallMetric(
        'LARGEST PRESSURE CHANGE',
        largestNode
          ? `${this.signed(
            largestNode.delta
          )} m`
          : '0.00 m'
      )}

            ${this.smallMetric(
        'PRESSURE CANDIDATE',
        largestNode
          ? largestNode.id
          : '—'
      )}

            ${this.smallMetric(
        'FLOW CHANGE',
        largestPipe
          ? `${this.signed(
            largestPipe.delta
          )} L/s`
          : '0.00 L/s'
      )}

          </div>


          <div class="dashboard-grid-2col mt-8">

            <div class="dash-card">

              <div class="dash-card-header">

                <div>

                  <h3 class="dash-card-title">
                    Nodal Pressure Residuals
                  </h3>

                  <p class="dash-card-subtitle">
                    Current pressure head compared with baseline
                  </p>

                </div>

              </div>


              <div class="dash-card-body">

                <div class="table-responsive">

                  <table class="data-table">

                    <thead>

                      <tr>

                        <th>
                          NODE
                        </th>

                        <th>
                          BASELINE
                        </th>

                        <th>
                          CURRENT
                        </th>

                        <th>
                          ΔH
                        </th>

                        <th>
                          STATUS
                        </th>

                      </tr>

                    </thead>


                    <tbody>

                      ${nodeChanges.map(
        item => {

          const significant =
            Math.abs(
              item.delta
            ) >= 0.05;


          return `

                            <tr>

                              <td class="font-mono">
                                ${this.escapeHtml(
            item.id
          )}
                              </td>

                              <td>
                                ${this.format(
            item.baseline
          )} m
                              </td>

                              <td>
                                ${this.format(
            item.current
          )} m
                              </td>

                              <td>
                                ${this.signed(
            item.delta
          )} m
                              </td>

                              <td>

                                <span class="status-tag ${significant
              ? 'status-tag-warning'
              : 'status-tag-normal'
            }">

                                  ${significant
              ? 'DIVERGENCE'
              : 'STABLE'
            }

                                </span>

                              </td>

                            </tr>

                          `;

        }
      ).join('')}

                    </tbody>

                  </table>

                </div>

              </div>

            </div>


            <div class="dash-card">

              <div class="dash-card-header">

                <div>

                  <h3 class="dash-card-title">
                    Pipe Flow Residuals
                  </h3>

                  <p class="dash-card-subtitle">
                    Current flow compared with baseline
                  </p>

                </div>

              </div>


              <div class="dash-card-body">

                <div class="table-responsive">

                  <table class="data-table">

                    <thead>

                      <tr>

                        <th>
                          PIPE
                        </th>

                        <th>
                          BASELINE
                        </th>

                        <th>
                          CURRENT
                        </th>

                        <th>
                          ΔQ
                        </th>

                      </tr>

                    </thead>


                    <tbody>

                      ${pipeChanges.map(
        item => `

                          <tr>

                            <td class="font-mono">
                              ${this.escapeHtml(
          item.id
        )}
                            </td>

                            <td>
                              ${this.format(
          item.baseline
        )} L/s
                            </td>

                            <td>
                              ${this.format(
          item.current
        )} L/s
                            </td>

                            <td>
                              ${this.signed(
          item.delta
        )} L/s
                            </td>

                          </tr>

                        `
      ).join('')}

                    </tbody>

                  </table>

                </div>

              </div>

            </div>

          </div>


          <div class="notice-box-subtle mt-8">

            ${this.icon(
        'info',
        'icon'
      )}

            <span class="text-xs text-secondary">

              This module identifies hydraulic divergence between
              stored scenarios. It does not claim a measured physical
              leak probability. The J4/J6 scenarios represent the
              configured hydraulic disruption test cases.

            </span>

          </div>

        </div>

      </div>

    `;

  },


  async loadLeakAnalysis(
    scenario = 'j4_leak'
  ) {

    if (
      ![
        'j4_leak',
        'j6_leak'
      ].includes(
        scenario
      )
    ) {

      scenario =
        'j4_leak';

    }


    const state =
      this.leakState;


    state.scenario =
      scenario;

    state.loading =
      true;

    state.error =
      null;


    this.updateContainer(
      this.renderLeakAnalysis()
    );


    try {

      const [
        baseline,
        current
      ] = await Promise.all([

        this.getScenario(
          'baseline'
        ),

        this.getScenario(
          scenario
        )

      ]);


      state.baseline =
        baseline;

      state.current =
        current;

    } catch (error) {

      console.error(
        'Leak analysis error:',
        error
      );

      state.error =
        `Unable to load leak analysis: ${error.message}`;

    }


    state.loading =
      false;


    this.updateContainer(
      this.renderLeakAnalysis()
    );

  },


  /* ==========================================================
     ALERTS
     ========================================================== */

  renderAlerts() {

    const state =
      this.alertsState;


    if (state.loading) {

      return this.loadingCard(
        'OPERATIONAL ALERTS',
        'Analysing hydraulic scenarios for event conditions...'
      );

    }


    if (state.error) {

      return this.errorCard(
        'Alerts Unavailable',
        state.error,
        `
          <button
            class="btn btn-secondary btn-sm"
            onclick="
              DashboardMunicipalView.loadAlerts();
            "
          >
            Retry
          </button>
        `
      );

    }


    if (
      !state.baseline ||
      !state.j4 ||
      !state.j6
    ) {

      return `

        <div class="dash-card">

          <div class="dash-card-body">

            <div class="text-center py-10">

              <div class="font-mono text-xs text-accent mb-2">
                // OPERATIONAL ALERT ENGINE
              </div>

              <h3 class="text-lg font-semibold mb-2">
                Loading hydraulic event analysis
              </h3>

              <p class="text-sm text-secondary">
                Scenario comparison will appear here.
              </p>

            </div>

          </div>

        </div>

      `;

    }


    const j4 =
      this.buildComparison(
        state.baseline,
        state.j4
      );


    const j6 =
      this.buildComparison(
        state.baseline,
        state.j6
      );


    const j4Node =
      this.largestChange(
        j4.nodes
      );


    const j6Node =
      this.largestChange(
        j6.nodes
      );


    const j4Pipe =
      this.largestChange(
        j4.pipes
      );


    const j6Pipe =
      this.largestChange(
        j6.pipes
      );


    const alerts = [

      {

        scenario:
          'J4 DISRUPTION',

        node:
          j4Node,

        pipe:
          j4Pipe

      },

      {

        scenario:
          'J6 DISRUPTION',

        node:
          j6Node,

        pipe:
          j6Pipe

      }

    ];


    return `

      <div class="dash-card">

        <div class="dash-card-header">

          <div class="dash-card-title-wrap">

            <div class="icon-box">

              ${this.icon(
      'alertCircle',
      'icon'
    )}

            </div>

            <div>

              <h2 class="dash-card-title">
                Operational Alerts &amp; Incident Dispatch
              </h2>

              <p class="dash-card-subtitle">
                Hydraulic scenario event advisories
              </p>

            </div>

          </div>


          <span class="status-tag status-tag-warning">
            ${alerts.length} ADVISORY EVENTS
          </span>

        </div>


        <div class="dash-card-body">

          <div class="overview-cards-grid">

            ${this.smallMetric(
      'SCENARIOS ANALYSED',
      '2'
    )}

            ${this.smallMetric(
      'J4 PRESSURE Δ',
      j4Node
        ? `${this.signed(
          j4Node.delta
        )} m`
        : '0.00 m'
    )}

            ${this.smallMetric(
      'J6 PRESSURE Δ',
      j6Node
        ? `${this.signed(
          j6Node.delta
        )} m`
        : '0.00 m'
    )}

            ${this.smallMetric(
      'STATUS',
      'ADVISORY'
    )}

          </div>


          <div class="dash-card mt-8">

            <div class="dash-card-header">

              <div>

                <h3 class="dash-card-title">
                  Active Hydraulic Advisories
                </h3>

                <p class="dash-card-subtitle">
                  Differences from the baseline hydraulic state
                </p>

              </div>

            </div>


            <div class="dash-card-body">

              <div class="table-responsive">

                <table class="data-table">

                  <thead>

                    <tr>

                      <th>
                        EVENT
                      </th>

                      <th>
                        NODE
                      </th>

                      <th>
                        PRESSURE Δ
                      </th>

                      <th>
                        PIPE
                      </th>

                      <th>
                        FLOW Δ
                      </th>

                      <th>
                        STATUS
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    ${alerts.map(
      alert => `

                        <tr>

                          <td class="font-semibold">
                            ${this.escapeHtml(
        alert.scenario
      )}
                          </td>

                          <td class="font-mono">

                            ${alert.node
          ? alert.node.id
          : '—'
        }

                          </td>

                          <td>

                            ${alert.node
          ? this.signed(
            alert.node.delta
          ) + ' m'
          : '—'
        }

                          </td>

                          <td class="font-mono">

                            ${alert.pipe
          ? alert.pipe.id
          : '—'
        }

                          </td>

                          <td>

                            ${alert.pipe
          ? this.signed(
            alert.pipe.delta
          ) + ' L/s'
          : '—'
        }

                          </td>

                          <td>

                            <span class="status-tag status-tag-warning">
                              ADVISORY
                            </span>

                          </td>

                        </tr>

                      `
    ).join('')}

                  </tbody>

                </table>

              </div>

            </div>

          </div>


          <div class="notice-box-subtle mt-8">

            ${this.icon(
      'info',
      'icon'
    )}

            <span class="text-xs text-secondary">

              Alerts are generated from hydraulic scenario
              divergence. They are advisory model events and
              are not SCADA alarms.

            </span>

          </div>

        </div>

      </div>

    `;

  },


  largestChange(
    items
  ) {

    if (
      !Array.isArray(items) ||
      !items.length
    ) {

      return null;

    }


    return items
      .slice()
      .sort(
        (a, b) =>
          Math.abs(b.delta) -
          Math.abs(a.delta)
      )[0];

  },


  async loadAlerts() {

    const state =
      this.alertsState;


    state.loading =
      true;

    state.error =
      null;


    this.updateContainer(
      this.renderAlerts()
    );


    try {

      const [
        baseline,
        j4,
        j6
      ] = await Promise.all([

        this.getScenario(
          'baseline'
        ),

        this.getScenario(
          'j4_leak'
        ),

        this.getScenario(
          'j6_leak'
        )

      ]);


      state.baseline =
        baseline;

      state.j4 =
        j4;

      state.j6 =
        j6;

    } catch (error) {

      console.error(
        'Alerts error:',
        error
      );

      state.error =
        `Unable to load alert data: ${error.message}`;

    }


    state.loading =
      false;


    this.updateContainer(
      this.renderAlerts()
    );

  },


  /* ==========================================================
    OPERATIONAL ANALYTICS
    ========================================================== */

  destroyAnalyticsCharts() {

    const charts =
      this.analyticsState.charts || {};

    Object.keys(charts).forEach(
      key => {

        const chart =
          charts[key];

        if (
          chart &&
          typeof chart.destroy === 'function'
        ) {

          try {

            chart.destroy();

          } catch (error) {

            console.warn(
              `Unable to destroy analytics ${key} chart:`,
              error
            );

          }

        }

        charts[key] =
          null;

      }
    );

  },


  stopAnalyticsTelemetryPolling() {

    /*
     * Hydraulic Analytics is scenario-based.
     *
     * We intentionally do not poll the old
     * /api/pressure, /api/flow and /api/tank
     * telemetry endpoints here because those values
     * belong to the future ESP32 field telemetry stream.
     */

    if (
      this.analyticsTelemetryTimer
    ) {

      clearInterval(
        this.analyticsTelemetryTimer
      );

      this.analyticsTelemetryTimer =
        null;

    }

  },


  startAnalyticsTelemetryPolling() {

    /*
     * Intentionally disabled for the current phase.
     *
     * The Analytics module now visualizes the actual
     * EPANET/WNTR scenario state.
     *
     * ESP32 telemetry will be integrated later as a
     * separate live telemetry subsystem.
     */

    this.stopAnalyticsTelemetryPolling();

  },


  analyticsScenarioButton(
    scenario,
    label
  ) {

    return `

      <button
        type="button"
        class="analytics-scenario-btn ${this.analyticsState.scenario === scenario
        ? 'active'
        : ''
      }"
        onclick="
          DashboardMunicipalView.setAnalyticsScenario(
            '${scenario}'
          );
        "
      >
        ${this.escapeHtml(label)}
      </button>

    `;

  },


  analyticsChartCard(
    title,
    subtitle,
    unit,
    canvasId,
    extraClass = ''
  ) {

    return `

      <div
        class="analytics-engine-card ${extraClass}"
      >

        <div class="analytics-engine-card-header">

          <div>

            <div class="analytics-engine-card-title">
              ${this.escapeHtml(title)}
            </div>

            <div class="analytics-engine-card-subtitle">
              ${this.escapeHtml(subtitle)}
            </div>

          </div>

          <span class="analytics-engine-unit">
            ${this.escapeHtml(unit)}
          </span>

        </div>

        <div class="analytics-engine-chart-wrap">

          <canvas id="${this.escapeHtml(canvasId)}"></canvas>

        </div>

      </div>

    `;

  },


  renderAnalytics() {

    const state =
      this.analyticsState;


    const result =
      state.current;


    const baseline =
      state.baseline;


    const scenarioLabel =
      this.scenarioLabel(
        state.scenario
      );


    const nodes =
      result &&
        Array.isArray(result.nodes)
        ? result.nodes
        : [];


    const pipes =
      result &&
        Array.isArray(result.pipes)
        ? result.pipes
        : [];


    const baselineNodes =
      baseline &&
        Array.isArray(baseline.nodes)
        ? baseline.nodes
        : [];


    const avgPressure =
      result &&
        result.average_pressure != null
        ? this.number(
          result.average_pressure,
          null
        )
        : null;


    const p1Flow =
      pipes.find(
        pipe =>
          String(pipe.id) === 'P1'
      );


    const p1FlowValue =
      p1Flow &&
        p1Flow.flow != null
        ? this.number(
          p1Flow.flow,
          null
        )
        : null;


    const totalFlow =
      result &&
        result.total_abs_flow != null
        ? this.number(
          result.total_abs_flow,
          null
        )
        : pipes.length
          ? pipes.reduce(
            (sum, pipe) =>
              sum +
              Math.abs(
                this.number(
                  pipe.flow,
                  0
                )
              ),
            0
          )
          : null;


    const baselineAverage =
      baseline &&
        baseline.average_pressure != null
        ? this.number(
          baseline.average_pressure,
          null
        )
        : null;


    const pressureDelta =
      avgPressure != null &&
        baselineAverage != null
        ? avgPressure -
        baselineAverage
        : null;


    const timestep =
      result &&
        result.timestep != null
        ? result.timestep
        : 0;


    const runTimestamp =
      state.lastUpdated
        ? new Date(
          state.lastUpdated
        ).toLocaleTimeString(
          [],
          {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }
        )
        : '—';


    if (state.loading) {

      return this.loadingCard(
        'OPERATIONAL ANALYTICS',
        'Loading EPANET/WNTR hydraulic scenario...'
      );

    }


    if (state.error) {

      return this.errorCard(
        'Operational Analytics Unavailable',
        state.error,
        `
          <button
            class="btn btn-secondary btn-sm"
            onclick="
              DashboardMunicipalView.loadAnalyticsScenario(
                '${this.escapeHtml(
          state.scenario
        )}'
              );
            "
          >
            Retry
          </button>
        `
      );

    }


    if (!result) {

      return `

        <div class="dash-card">

          <div class="dash-card-header">

            <div class="dash-card-title-wrap">

              <div class="icon-box">

                ${this.icon(
        'chart',
        'icon'
      )}

              </div>

              <div>

                <h2 class="dash-card-title">
                  Operational Analytics
                </h2>

                <p class="dash-card-subtitle">
                  EPANET/WNTR hydraulic scenario analytics
                </p>

              </div>

            </div>

          </div>


          <div class="dash-card-body">

            <div class="text-center py-10">

              <div class="font-mono text-xs text-accent mb-2">
                // HYDRAULIC ANALYTICS ENGINE
              </div>

              <h3 class="text-lg font-semibold mb-2">
                Loading scenario analytics
              </h3>

              <p class="text-sm text-secondary">
                Fetching the selected EPANET/WNTR hydraulic state.
              </p>

            </div>

          </div>

        </div>

      `;

    }


    return `

      <style>

        .analytics-engine-shell {
          width: 100%;
        }

        .analytics-engine-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
          padding: 2px 0 20px;
        }

        .analytics-engine-context {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .analytics-engine-kicker {
          font-family: monospace;
          font-size: 9px;
          letter-spacing: .14em;
          color: #5ee7ff;
          text-transform: uppercase;
        }

        .analytics-engine-context-title {
          font-size: 13px;
          font-weight: 600;
          color: #dbeafe;
        }

        .analytics-engine-context-subtitle {
          font-size: 10px;
          color: #7f94ad;
        }

        .analytics-engine-scenario-group {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .analytics-engine-meta {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          padding: 11px 14px;
          margin-bottom: 18px;
          border: 1px solid rgba(92, 210, 255, .10);
          border-radius: 8px;
          background: rgba(7, 24, 43, .48);
        }

        .analytics-engine-meta-item {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 9px;
          color: #7f94ad;
          font-family: monospace;
          text-transform: uppercase;
          letter-spacing: .05em;
        }

        .analytics-engine-meta-value {
          color: #c9d9ea;
        }

        .analytics-engine-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #35d0ff;
          box-shadow: 0 0 8px rgba(53, 208, 255, .55);
        }

        .analytics-engine-kpi-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 18px;
        }

        .analytics-engine-kpi {
          position: relative;
          overflow: hidden;
          min-height: 84px;
          padding: 14px 15px;
          border: 1px solid rgba(92, 210, 255, .10);
          border-radius: 9px;
          background:
            linear-gradient(
              145deg,
              rgba(18, 48, 76, .82),
              rgba(8, 27, 48, .88)
            );
        }

        .analytics-engine-kpi::after {
          content: '';
          position: absolute;
          right: -22px;
          bottom: -30px;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(53, 208, 255, .055);
        }

        .analytics-engine-kpi-label {
          font-family: monospace;
          font-size: 8px;
          letter-spacing: .10em;
          color: #71869e;
          text-transform: uppercase;
          margin-bottom: 9px;
        }

        .analytics-engine-kpi-value {
          position: relative;
          z-index: 1;
          font-family: monospace;
          font-size: 20px;
          line-height: 1;
          font-weight: 700;
          color: #e2f4ff;
        }

        .analytics-engine-kpi-unit {
          margin-left: 4px;
          font-size: 10px;
          font-weight: 500;
          color: #6f91aa;
        }

        .analytics-engine-kpi-note {
          margin-top: 7px;
          font-size: 8px;
          color: #597189;
        }

        .analytics-engine-kpi-note-positive {
          color: #58d9a6;
        }

        .analytics-engine-kpi-note-warning {
          color: #ffb86b;
        }

        .analytics-engine-chart-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .analytics-engine-card {
          min-width: 0;
          border: 1px solid rgba(92, 210, 255, .10);
          border-radius: 10px;
          overflow: hidden;
          background:
            linear-gradient(
              145deg,
              rgba(16, 39, 64, .92),
              rgba(8, 25, 45, .96)
            );
          box-shadow:
            0 12px 30px rgba(0, 0, 0, .10);
        }

        .analytics-engine-card-wide {
          grid-column: 1 / -1;
        }

        .analytics-engine-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 15px 17px 10px;
          border-bottom:
            1px solid rgba(92, 210, 255, .07);
        }

        .analytics-engine-card-title {
          font-size: 12px;
          font-weight: 700;
          color: #dbeafe;
        }

        .analytics-engine-card-subtitle {
          margin-top: 4px;
          font-size: 9px;
          color: #71869e;
        }

        .analytics-engine-unit {
          padding: 4px 7px;
          border:
            1px solid rgba(92, 210, 255, .12);
          border-radius: 5px;
          font-family: monospace;
          font-size: 8px;
          color: #5ee7ff;
          background: rgba(53, 208, 255, .045);
        }

        .analytics-engine-chart-wrap {
          position: relative;
          height: 285px;
          padding: 12px 14px 14px;
        }

        .analytics-engine-chart-wrap canvas {
          width: 100% !important;
          height: 100% !important;
        }

        .analytics-engine-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 14px;
          padding: 12px 14px;
          border:
            1px solid rgba(92, 210, 255, .08);
          border-radius: 8px;
          background: rgba(5, 19, 35, .55);
          font-size: 9px;
          color: #71869e;
        }

        .analytics-engine-footer strong {
          color: #a9bfd4;
          font-weight: 600;
        }

        @media (max-width: 1000px) {

          .analytics-engine-kpi-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .analytics-engine-chart-grid {
            grid-template-columns: 1fr;
          }

          .analytics-engine-card-wide {
            grid-column: auto;
          }

        }

        @media (max-width: 620px) {

          .analytics-engine-kpi-grid {
            grid-template-columns: 1fr;
          }

          .analytics-engine-chart-wrap {
            height: 245px;
          }

        }

      </style>


      <div class="analytics-engine-shell">

        <div class="dash-card">

          <div class="dash-card-header">

            <div class="dash-card-title-wrap">

              <div class="icon-box">

                ${this.icon(
      'chart',
      'icon'
    )}

              </div>

              <div>

                <h2 class="dash-card-title">
                  Operational Analytics
                </h2>

                <p class="dash-card-subtitle">
                  EPANET/WNTR hydraulic scenario intelligence
                </p>

              </div>

            </div>

            <span class="status-tag status-tag-normal">
              ${this.escapeHtml(
      scenarioLabel
    )}
            </span>

          </div>


          <div class="dash-card-body">

            <div class="analytics-engine-toolbar">

              <div class="analytics-engine-context">

                <div class="analytics-engine-kicker">
                  HYDRAULIC SCENARIO
                </div>

                <div class="analytics-engine-context-title">
                  ${this.escapeHtml(
      this.scenarioTitle(
        state.scenario
      )
    )}
                </div>

                <div class="analytics-engine-context-subtitle">
                  Scenario values are supplied directly by the
                  EPANET/WNTR hydraulic engine.
                </div>

              </div>


              <div class="analytics-engine-scenario-group">

                ${this.analyticsScenarioButton(
      'baseline',
      'Baseline'
    )}

                ${this.analyticsScenarioButton(
      'j4_leak',
      'J4 Disruption'
    )}

                ${this.analyticsScenarioButton(
      'j6_leak',
      'J6 Disruption'
    )}

              </div>

            </div>


            <div class="analytics-engine-meta">

              <div class="analytics-engine-meta-item">

                <span class="analytics-engine-dot"></span>

                MODEL SOURCE:

                <span class="analytics-engine-meta-value">
                  EPANET / WNTR
                </span>

              </div>

              <div class="analytics-engine-meta-item">

                TIMESTEP:

                <span class="analytics-engine-meta-value">
                  ${this.escapeHtml(
      timestep
    )}
                </span>

              </div>

              <div class="analytics-engine-meta-item">

                ANALYSIS RUN:

                <span class="analytics-engine-meta-value">
                  ${this.escapeHtml(
      runTimestamp
    )}
                </span>

              </div>

              <div class="analytics-engine-meta-item">

                NETWORK:

                <span class="analytics-engine-meta-value">
                  9 JUNCTIONS · 9 PIPES
                </span>

              </div>

            </div>


            <div class="analytics-engine-kpi-grid">

              <div class="analytics-engine-kpi">

                <div class="analytics-engine-kpi-label">
                  Average Pressure
                </div>

                <div class="analytics-engine-kpi-value">

                  ${avgPressure == null
        ? '—'
        : this.format(
          avgPressure
        )}

                  <span class="analytics-engine-kpi-unit">
                    m
                  </span>

                </div>

                <div class="analytics-engine-kpi-note">
                  EPANET hydraulic average
                </div>

              </div>


              <div class="analytics-engine-kpi">

                <div class="analytics-engine-kpi-label">
                  P1 Flow
                </div>

                <div class="analytics-engine-kpi-value">

                  ${p1FlowValue == null
        ? '—'
        : this.format(
          p1FlowValue
        )}

                  <span class="analytics-engine-kpi-unit">
                    L/s
                  </span>

                </div>

                <div class="analytics-engine-kpi-note">
                  Source pipe P1
                </div>

              </div>


              <div class="analytics-engine-kpi">

                <div class="analytics-engine-kpi-label">
                  Total Network Flow
                </div>

                <div class="analytics-engine-kpi-value">

                  ${totalFlow == null
        ? '—'
        : this.format(
          totalFlow
        )}

                  <span class="analytics-engine-kpi-unit">
                    L/s
                  </span>

                </div>

                <div class="analytics-engine-kpi-note">
                  Sum of absolute pipe flows
                </div>

              </div>


              <div class="analytics-engine-kpi">

                <div class="analytics-engine-kpi-label">
                  Pressure vs Baseline
                </div>

                <div class="analytics-engine-kpi-value">

                  ${pressureDelta == null
        ? '—'
        : this.signed(
          pressureDelta
        )}

                  <span class="analytics-engine-kpi-unit">
                    m
                  </span>

                </div>

                <div class="
                  analytics-engine-kpi-note
                  ${pressureDelta != null &&
        pressureDelta < -0.001
        ? 'analytics-engine-kpi-note-warning'
        : 'analytics-engine-kpi-note-positive'
      }
                ">
                  ${state.scenario === 'baseline'
        ? 'Reference hydraulic state'
        : 'Change from baseline'
      }
                </div>

              </div>

            </div>


            <div class="analytics-engine-chart-grid">

              ${this.analyticsChartCard(
        'Nodal Pressure Profile',
        'Pressure head across junctions J1–J9',
        'm',
        'analyticsPressureChart'
      )}

              ${this.analyticsChartCard(
        'Pipe Flow Profile',
        'Absolute hydraulic flow across P1–P9',
        'L/s',
        'analyticsFlowChart'
      )}

              ${this.analyticsChartCard(
        'Pressure Divergence',
        'Selected scenario relative to the baseline',
        'Δ m',
        'analyticsDivergenceChart',
        'analytics-engine-card-wide'
      )}

            </div>


            <div class="analytics-engine-footer">

              <span>
                <strong>
                  FIELD TELEMETRY
                </strong>
                is intentionally separated from this scenario
                analysis and will be supplied by the ESP32 sensor
                stream in the hardware integration phase.
              </span>

              <span class="font-mono">
                ${this.escapeHtml(
        scenarioLabel
      )}
              </span>

            </div>

          </div>

        </div>

      </div>

    `;

  },


  async loadAnalyticsScenario(
    scenario = 'baseline'
  ) {

    if (
      ![
        'baseline',
        'j4_leak',
        'j6_leak'
      ].includes(
        scenario
      )
    ) {

      scenario =
        'baseline';

    }


    const state =
      this.analyticsState;


    this.destroyAnalyticsCharts();


    state.scenario =
      scenario;

    state.loading =
      true;

    state.error =
      null;


    this.updateContainer(
      this.renderAnalytics()
    );


    try {

      const current =
        await this.getScenario(
          scenario
        );


      let baseline;


      if (
        scenario === 'baseline'
      ) {

        baseline =
          current;

      } else {

        baseline =
          await this.getScenario(
            'baseline'
          );

      }


      state.current =
        current;

      state.baseline =
        baseline;

      state.lastUpdated =
        new Date().toISOString();

      state.error =
        null;


    } catch (error) {

      console.error(
        'Operational Analytics scenario error:',
        error
      );


      state.current =
        null;

      state.baseline =
        null;

      state.error =
        `Unable to load analytics scenario: ${error.message}`;

    }


    state.loading =
      false;


    this.updateContainer(
      this.renderAnalytics()
    );


    if (
      !state.error
    ) {

      setTimeout(
        () => {

          this.renderAnalyticsCharts();

        },
        0
      );

    }

  },


  async setAnalyticsScenario(
    scenario
  ) {

    if (
      ![
        'baseline',
        'j4_leak',
        'j6_leak'
      ].includes(
        scenario
      )
    ) {

      return;

    }


    await this.loadAnalyticsScenario(
      scenario
    );

  },


  renderAnalyticsCharts() {

    const state =
      this.analyticsState;


    const result =
      state.current;


    const baseline =
      state.baseline;


    if (
      !result ||
      typeof Chart === 'undefined'
    ) {

      if (
        typeof Chart === 'undefined'
      ) {

        console.error(
          'Operational Analytics: Chart.js is not loaded.'
        );

      }

      return;

    }


    this.destroyAnalyticsCharts();


    const nodes =
      Array.isArray(result.nodes)
        ? result.nodes
        : [];


    const pipes =
      Array.isArray(result.pipes)
        ? result.pipes
        : [];


    const baselineNodes =
      baseline &&
        Array.isArray(baseline.nodes)
        ? baseline.nodes
        : [];


    const pressureCanvas =
      document.getElementById(
        'analyticsPressureChart'
      );


    const flowCanvas =
      document.getElementById(
        'analyticsFlowChart'
      );


    const divergenceCanvas =
      document.getElementById(
        'analyticsDivergenceChart'
      );


    if (
      !pressureCanvas ||
      !flowCanvas ||
      !divergenceCanvas
    ) {

      return;

    }


    const chartFont =
    {
      family:
        'monospace',
      size:
        9
    };


    const gridColor =
      'rgba(112, 145, 170, 0.12)';


    const tickColor =
      '#71869e';


    const textColor =
      '#a9bfd4';


    const accentColor =
      '#35d0ff';


    const accentFill =
      'rgba(53, 208, 255, 0.12)';


    const warningColor =
      '#ffb86b';


    const warningFill =
      'rgba(255, 184, 107, 0.14)';


    const pressureLabels =
      nodes.map(
        node =>
          String(node.id)
      );


    const pressureValues =
      nodes.map(
        node =>
          this.number(
            node.pressure,
            0
          )
      );


    const flowLabels =
      pipes.map(
        pipe =>
          String(pipe.id)
      );


    const flowValues =
      pipes.map(
        pipe =>
          Math.abs(
            this.number(
              pipe.flow,
              0
            )
          )
      );


    const baselineMap =
      new Map(
        baselineNodes.map(
          node => [
            String(node.id),
            this.number(
              node.pressure,
              0
            )
          ]
        )
      );


    const divergenceValues =
      nodes.map(
        node => {

          const id =
            String(node.id);

          const current =
            this.number(
              node.pressure,
              0
            );

          const reference =
            baselineMap.has(id)
              ? baselineMap.get(id)
              : current;

          return current -
            reference;

        }
      );


    const commonScales = {

      x: {

        grid: {
          color:
            gridColor,
          drawBorder:
            false
        },

        ticks: {
          color:
            tickColor,
          font:
            chartFont
        }

      },

      y: {

        grid: {
          color:
            gridColor,
          drawBorder:
            false
        },

        ticks: {
          color:
            tickColor,
          font:
            chartFont,
          padding:
            7
        },

        beginAtZero:
          false

      }

    };


    this.analyticsState.charts.pressure =
      new Chart(
        pressureCanvas.getContext('2d'),
        {
          type:
            'line',

          data: {

            labels:
              pressureLabels,

            datasets: [

              {

                label:
                  'Pressure',

                data:
                  pressureValues,

                borderColor:
                  accentColor,

                backgroundColor:
                  accentFill,

                borderWidth:
                  2,

                pointRadius:
                  3,

                pointHoverRadius:
                  5,

                pointBackgroundColor:
                  accentColor,

                pointBorderWidth:
                  0,

                tension:
                  0.28,

                fill:
                  true

              }

            ]

          },

          options: {

            responsive:
              true,

            maintainAspectRatio:
              false,

            animation: {
              duration:
                450
            },

            interaction: {
              mode:
                'index',
              intersect:
                false
            },

            plugins: {

              legend: {
                display:
                  false
              },

              tooltip: {

                backgroundColor:
                  'rgba(4, 16, 30, .96)',

                borderColor:
                  'rgba(53, 208, 255, .28)',

                borderWidth:
                  1,

                titleColor:
                  '#e2f4ff',

                bodyColor:
                  textColor,

                titleFont:
                {
                  family:
                    'monospace',
                  size:
                    10
                },

                bodyFont:
                  chartFont,

                displayColors:
                  false,

                callbacks: {

                  label:
                    context =>
                      `Pressure: ${this.format(
                        context.parsed.y
                      )} m`

                }

              }

            },

            scales:
              commonScales

          }

        }
      );


    this.analyticsState.charts.flow =
      new Chart(
        flowCanvas.getContext('2d'),
        {
          type:
            'bar',

          data: {

            labels:
              flowLabels,

            datasets: [

              {

                label:
                  'Flow',

                data:
                  flowValues,

                backgroundColor:
                  accentFill,

                borderColor:
                  accentColor,

                borderWidth:
                  1,

                borderRadius:
                  4,

                borderSkipped:
                  false

              }

            ]

          },

          options: {

            responsive:
              true,

            maintainAspectRatio:
              false,

            animation: {
              duration:
                450
            },

            plugins: {

              legend: {
                display:
                  false
              },

              tooltip: {

                backgroundColor:
                  'rgba(4, 16, 30, .96)',

                borderColor:
                  'rgba(53, 208, 255, .28)',

                borderWidth:
                  1,

                titleColor:
                  '#e2f4ff',

                bodyColor:
                  textColor,

                displayColors:
                  false,

                callbacks: {

                  label:
                    context =>
                      `Flow: ${this.format(
                        context.parsed.y
                      )} L/s`

                }

              }

            },

            scales: {

              x: {

                grid: {
                  display:
                    false
                },

                ticks: {
                  color:
                    tickColor,
                  font:
                    chartFont
                }

              },

              y: {

                beginAtZero:
                  true,

                grid: {
                  color:
                    gridColor,
                  drawBorder:
                    false
                },

                ticks: {
                  color:
                    tickColor,
                  font:
                    chartFont
                }

              }

            }

          }

        }
      );


    this.analyticsState.charts.divergence =
      new Chart(
        divergenceCanvas.getContext('2d'),
        {
          type:
            'bar',

          data: {

            labels:
              pressureLabels,

            datasets: [

              {

                label:
                  'Pressure Δ',

                data:
                  divergenceValues,

                backgroundColor:
                  divergenceValues.map(
                    value =>
                      value < 0
                        ? warningFill
                        : accentFill
                  ),

                borderColor:
                  divergenceValues.map(
                    value =>
                      value < 0
                        ? warningColor
                        : accentColor
                  ),

                borderWidth:
                  1,

                borderRadius:
                  4,

                borderSkipped:
                  false

              }

            ]

          },

          options: {

            responsive:
              true,

            maintainAspectRatio:
              false,

            animation: {
              duration:
                450
            },

            plugins: {

              legend: {
                display:
                  false
              },

              tooltip: {

                backgroundColor:
                  'rgba(4, 16, 30, .96)',

                borderColor:
                  'rgba(53, 208, 255, .28)',

                borderWidth:
                  1,

                titleColor:
                  '#e2f4ff',

                bodyColor:
                  textColor,

                displayColors:
                  false,

                callbacks: {

                  label:
                    context =>
                      `Δ Pressure: ${this.signed(
                        context.parsed.y
                      )} m`

                }

              }

            },

            scales: {

              x: {

                grid: {
                  display:
                    false
                },

                ticks: {
                  color:
                    tickColor,
                  font:
                    chartFont
                }

              },

              y: {

                grid: {
                  color:
                    gridColor,
                  drawBorder:
                    false
                },

                ticks: {

                  color:
                    tickColor,

                  font:
                    chartFont,

                  callback:
                    value =>
                      `${value} m`

                }

              }

            }

          }

        }
      );

  },


  async loadAnalyticsTelemetry() {

    /*
     * Compatibility wrapper.
     *
     * The old Analytics page fetched the latest SQLite
     * sensor_data record here. That record is not a live
     * ESP32 feed and must not be presented as scenario data.
     *
     * Analytics now loads the actual EPANET/WNTR scenario.
     */

    await this.loadAnalyticsScenario(
      this.analyticsState.scenario ||
      'baseline'
    );

  },
  /* ==========================================================
     REPORTS
     ========================================================== */


  renderReports() {

    const state =
      this.reportsState;


    if (state.loading) {

      return this.loadingCard(
        'HYDRAULIC REPORTS',
        'Loading EPANET/WNTR scenario analysis...'
      );

    }


    if (state.error) {

      return this.errorCard(
        'Reports Unavailable',
        state.error,
        `
          <button
            class="btn btn-secondary btn-sm"
            onclick="
              DashboardMunicipalView.loadReports();
            "
          >
            Retry
          </button>
        `
      );

    }


    if (
      !state.baseline ||
      !state.j4 ||
      !state.j6
    ) {

      return `

        <div class="dash-card">

          <div class="dash-card-header">

            <div class="dash-card-title-wrap">

              <div class="icon-box">

                ${this.icon(
        'fileText',
        'icon'
      )}

              </div>

              <div>

                <h2 class="dash-card-title">
                  Hydraulic &amp; Compliance Reports
                </h2>

                <p class="dash-card-subtitle">
                  EPANET/WNTR scenario analysis and operational reporting
                </p>

              </div>

            </div>

          </div>


          <div class="dash-card-body">

            <div class="text-center py-10">

              <div class="font-mono text-xs text-accent mb-2">
                // REPORTING ENGINE
              </div>

              <h3 class="text-lg font-semibold mb-2">
                Hydraulic Report Generator
              </h3>

              <p class="text-sm text-secondary mb-6">
                Generate a consolidated report from the configured
                EPANET/WNTR hydraulic scenarios.
              </p>

              <button
                class="btn btn-primary"
                onclick="
                  DashboardMunicipalView.loadReports();
                "
              >

                ${this.icon(
        'fileText',
        'icon'
      )}

                Load Report Data

              </button>

            </div>

          </div>

        </div>

      `;

    }


    /*
     * ----------------------------------------------------------
     * SOURCE-OF-TRUTH VALUES
     *
     * Average pressure comes directly from the backend
     * EPANET/WNTR response.
     *
     * We intentionally do NOT calculate it again from
     * the node array here.
     * ----------------------------------------------------------
     */

    const baselinePressure =
      state.baseline.average_pressure != null
        ? this.number(
          state.baseline.average_pressure,
          null
        )
        : null;


    const j4Pressure =
      state.j4.average_pressure != null
        ? this.number(
          state.j4.average_pressure,
          null
        )
        : null;


    const j6Pressure =
      state.j6.average_pressure != null
        ? this.number(
          state.j6.average_pressure,
          null
        )
        : null;


    const baselineFlow =
      state.baseline.total_abs_flow != null
        ? this.number(
          state.baseline.total_abs_flow,
          null
        )
        : null;


    const j4Flow =
      state.j4.total_abs_flow != null
        ? this.number(
          state.j4.total_abs_flow,
          null
        )
        : null;


    const j6Flow =
      state.j6.total_abs_flow != null
        ? this.number(
          state.j6.total_abs_flow,
          null
        )
        : null;


    /*
     * ----------------------------------------------------------
     * P1 SOURCE FLOWS
     * ----------------------------------------------------------
     */

    const getP1Flow =
      scenario => {

        if (
          !scenario ||
          !Array.isArray(
            scenario.pipes
          )
        ) {

          return null;

        }


        const p1 =
          scenario.pipes.find(
            pipe =>
              String(
                pipe.id
              ) === 'P1'
          );


        return p1 &&
          p1.flow != null
          ? this.number(
            p1.flow,
            null
          )
          : null;

      };


    const baselineP1 =
      getP1Flow(
        state.baseline
      );


    const j4P1 =
      getP1Flow(
        state.j4
      );


    const j6P1 =
      getP1Flow(
        state.j6
      );


    /*
     * ----------------------------------------------------------
     * SCENARIO COMPARISONS
     * ----------------------------------------------------------
     */

    const j4Comparison =
      this.buildComparison(
        state.baseline,
        state.j4
      );


    const j6Comparison =
      this.buildComparison(
        state.baseline,
        state.j6
      );


    const j4Largest =
      this.largestChange(
        j4Comparison.nodes
      );


    const j6Largest =
      this.largestChange(
        j6Comparison.nodes
      );


    const j4PipeLargest =
      this.largestChange(
        j4Comparison.pipes
      );


    const j6PipeLargest =
      this.largestChange(
        j6Comparison.pipes
      );


    const j4PressureDelta =
      baselinePressure != null &&
        j4Pressure != null
        ? j4Pressure -
        baselinePressure
        : null;


    const j6PressureDelta =
      baselinePressure != null &&
        j6Pressure != null
        ? j6Pressure -
        baselinePressure
        : null;


    const j4FlowDelta =
      baselineFlow != null &&
        j4Flow != null
        ? j4Flow -
        baselineFlow
        : null;


    const j6FlowDelta =
      baselineFlow != null &&
        j6Flow != null
        ? j6Flow -
        baselineFlow
        : null;


    /*
     * ----------------------------------------------------------
     * REPORT TIMESTAMP
     * ----------------------------------------------------------
     */

    const reportTimestamp =
      new Date().toLocaleString(
        [],
        {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }
      );


    return `

      <style>

        .reports-engine-shell {
          width: 100%;
        }

        .reports-engine-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 18px;
          padding: 11px 14px;
          border:
            1px solid rgba(92, 210, 255, .10);
          border-radius: 8px;
          background:
            rgba(7, 24, 43, .48);
        }

        .reports-engine-meta-left {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .reports-engine-meta-item {
          display: flex;
          align-items: center;
          gap: 7px;
          font-family: monospace;
          font-size: 8px;
          letter-spacing: .06em;
          color: #71869e;
          text-transform: uppercase;
        }

        .reports-engine-meta-value {
          color: #b8cde0;
        }

        .reports-engine-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #35d0ff;
          box-shadow:
            0 0 8px rgba(53, 208, 255, .55);
        }

        .reports-engine-kpi-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 18px;
        }

        .reports-engine-kpi {
          position: relative;
          overflow: hidden;
          min-height: 94px;
          padding: 15px;
          border:
            1px solid rgba(92, 210, 255, .10);
          border-radius: 9px;
          background:
            linear-gradient(
              145deg,
              rgba(18, 48, 76, .82),
              rgba(8, 27, 48, .92)
            );
        }

        .reports-engine-kpi::after {
          content: '';
          position: absolute;
          width: 82px;
          height: 82px;
          right: -30px;
          bottom: -34px;
          border-radius: 50%;
          background:
            rgba(53, 208, 255, .055);
        }

        .reports-engine-kpi-label {
          position: relative;
          z-index: 1;
          margin-bottom: 10px;
          font-family: monospace;
          font-size: 8px;
          letter-spacing: .10em;
          color: #71869e;
          text-transform: uppercase;
        }

        .reports-engine-kpi-value {
          position: relative;
          z-index: 1;
          font-family: monospace;
          font-size: 20px;
          line-height: 1;
          font-weight: 700;
          color: #e2f4ff;
        }

        .reports-engine-kpi-unit {
          margin-left: 4px;
          font-size: 10px;
          font-weight: 500;
          color: #6f91aa;
        }

        .reports-engine-kpi-note {
          position: relative;
          z-index: 1;
          margin-top: 8px;
          font-size: 8px;
          color: #597189;
        }

        .reports-engine-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .reports-engine-card {
          min-width: 0;
          border:
            1px solid rgba(92, 210, 255, .10);
          border-radius: 10px;
          overflow: hidden;
          background:
            linear-gradient(
              145deg,
              rgba(16, 39, 64, .92),
              rgba(8, 25, 45, .96)
            );
          box-shadow:
            0 12px 30px rgba(0, 0, 0, .10);
        }

        .reports-engine-card-wide {
          grid-column: 1 / -1;
        }

        .reports-engine-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 15px 17px 11px;
          border-bottom:
            1px solid rgba(92, 210, 255, .07);
        }

        .reports-engine-card-title {
          font-size: 12px;
          font-weight: 700;
          color: #dbeafe;
        }

        .reports-engine-card-subtitle {
          margin-top: 4px;
          font-size: 9px;
          color: #71869e;
        }

        .reports-engine-card-body {
          padding: 15px 17px;
        }

        .reports-engine-badge {
          padding: 4px 7px;
          border:
            1px solid rgba(92, 210, 255, .12);
          border-radius: 5px;
          background:
            rgba(53, 208, 255, .045);
          color: #5ee7ff;
          font-family: monospace;
          font-size: 8px;
          white-space: nowrap;
        }

        .reports-engine-scenario-list {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .reports-engine-scenario {
          display: grid;
          grid-template-columns:
            1.4fr
            1fr
            1fr
            1fr;
          align-items: center;
          gap: 10px;
          padding: 12px;
          border:
            1px solid rgba(92, 210, 255, .07);
          border-radius: 7px;
          background:
            rgba(6, 22, 39, .55);
        }

        .reports-engine-scenario-name {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .reports-engine-scenario-dot {
          width: 6px;
          height: 6px;
          flex: 0 0 auto;
          border-radius: 50%;
          background: #35d0ff;
          box-shadow:
            0 0 8px rgba(53, 208, 255, .45);
        }

        .reports-engine-scenario-name strong {
          font-size: 10px;
          color: #dbeafe;
        }

        .reports-engine-scenario-name span {
          display: block;
          margin-top: 3px;
          font-size: 8px;
          color: #61778f;
        }

        .reports-engine-cell-label {
          font-family: monospace;
          font-size: 7px;
          color: #60758c;
          text-transform: uppercase;
          letter-spacing: .05em;
        }

        .reports-engine-cell-value {
          margin-top: 4px;
          font-family: monospace;
          font-size: 11px;
          color: #bcd1e3;
        }

        .reports-engine-cell-value.warning {
          color: #ffb86b;
        }

        .reports-engine-cell-value.normal {
          color: #65d9ae;
        }

        .reports-engine-impact {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .reports-engine-impact-item {
          padding: 13px;
          border:
            1px solid rgba(92, 210, 255, .07);
          border-radius: 7px;
          background:
            rgba(6, 22, 39, .55);
        }

        .reports-engine-impact-title {
          font-size: 9px;
          font-weight: 700;
          color: #a9bfd4;
        }

        .reports-engine-impact-value {
          margin-top: 8px;
          font-family: monospace;
          font-size: 16px;
          font-weight: 700;
          color: #e2f4ff;
        }

        .reports-engine-impact-note {
          margin-top: 5px;
          font-size: 8px;
          color: #61778f;
        }

        .reports-engine-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 14px;
          padding: 12px 14px;
          border:
            1px solid rgba(92, 210, 255, .08);
          border-radius: 8px;
          background:
            rgba(5, 19, 35, .55);
          font-size: 9px;
          color: #71869e;
        }

        .reports-engine-footer strong {
          color: #a9bfd4;
        }

        @media (max-width: 1050px) {

          .reports-engine-kpi-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .reports-engine-grid {
            grid-template-columns: 1fr;
          }

          .reports-engine-card-wide {
            grid-column: auto;
          }

        }

        @media (max-width: 720px) {

          .reports-engine-scenario {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .reports-engine-impact {
            grid-template-columns: 1fr;
          }

        }

        @media (max-width: 520px) {

          .reports-engine-kpi-grid {
            grid-template-columns: 1fr;
          }

          .reports-engine-scenario {
            grid-template-columns: 1fr;
          }

        }

      </style>


      <div class="reports-engine-shell">

        <div class="dash-card">

          <div class="dash-card-header">

            <div class="dash-card-title-wrap">

              <div class="icon-box">

                ${this.icon(
      'fileText',
      'icon'
    )}

              </div>

              <div>

                <h2 class="dash-card-title">
                  Hydraulic &amp; Compliance Reports
                </h2>

                <p class="dash-card-subtitle">
                  EPANET/WNTR scenario analysis and operational reporting
                </p>

              </div>

            </div>


            <button
              class="btn btn-secondary btn-sm"
              onclick="
                DashboardMunicipalView.printReport();
              "
            >

              ${this.icon(
      'fileText',
      'icon'
    )}

              Print Report

            </button>

          </div>


          <div class="dash-card-body">


            <div class="reports-engine-meta">

              <div class="reports-engine-meta-left">

                <div class="reports-engine-meta-item">

                  <span class="reports-engine-dot"></span>

                  SOURCE:

                  <span class="reports-engine-meta-value">
                    EPANET / WNTR
                  </span>

                </div>


                <div class="reports-engine-meta-item">

                  NETWORK:

                  <span class="reports-engine-meta-value">
                    9 JUNCTIONS · 9 PIPES
                  </span>

                </div>


                <div class="reports-engine-meta-item">

                  SCENARIOS:

                  <span class="reports-engine-meta-value">
                    3
                  </span>

                </div>

              </div>


              <div class="reports-engine-meta-item">

                GENERATED:

                <span class="reports-engine-meta-value">
                  ${this.escapeHtml(
      reportTimestamp
    )}
                </span>

              </div>

            </div>


            <div class="reports-engine-kpi-grid">

              <div class="reports-engine-kpi">

                <div class="reports-engine-kpi-label">
                  Baseline Pressure
                </div>

                <div class="reports-engine-kpi-value">

                  ${baselinePressure == null
        ? '—'
        : this.format(
          baselinePressure
        )}

                  <span class="reports-engine-kpi-unit">
                    m
                  </span>

                </div>

                <div class="reports-engine-kpi-note">
                  Reference hydraulic state
                </div>

              </div>


              <div class="reports-engine-kpi">

                <div class="reports-engine-kpi-label">
                  J4 Pressure Change
                </div>

                <div class="reports-engine-kpi-value">

                  ${j4PressureDelta == null
        ? '—'
        : this.signed(
          j4PressureDelta
        )}

                  <span class="reports-engine-kpi-unit">
                    m
                  </span>

                </div>

                <div class="reports-engine-kpi-note">
                  J4 disruption vs baseline
                </div>

              </div>


              <div class="reports-engine-kpi">

                <div class="reports-engine-kpi-label">
                  J6 Pressure Change
                </div>

                <div class="reports-engine-kpi-value">

                  ${j6PressureDelta == null
        ? '—'
        : this.signed(
          j6PressureDelta
        )}

                  <span class="reports-engine-kpi-unit">
                    m
                  </span>

                </div>

                <div class="reports-engine-kpi-note">
                  J6 disruption vs baseline
                </div>

              </div>


              <div class="reports-engine-kpi">

                <div class="reports-engine-kpi-label">
                  P1 Baseline Flow
                </div>

                <div class="reports-engine-kpi-value">

                  ${baselineP1 == null
        ? '—'
        : this.format(
          baselineP1
        )}

                  <span class="reports-engine-kpi-unit">
                    L/s
                  </span>

                </div>

                <div class="reports-engine-kpi-note">
                  Source pipe P1
                </div>

              </div>

            </div>


            <div class="reports-engine-grid">


              <div class="reports-engine-card reports-engine-card-wide">

                <div class="reports-engine-card-header">

                  <div>

                    <div class="reports-engine-card-title">
                      Scenario Summary
                    </div>

                    <div class="reports-engine-card-subtitle">
                      Consolidated hydraulic state across all configured scenarios
                    </div>

                  </div>

                  <span class="reports-engine-badge">
                    HYDRAULIC MODEL
                  </span>

                </div>


                <div class="reports-engine-card-body">

                  <div class="reports-engine-scenario-list">


                    <div class="reports-engine-scenario">

                      <div class="reports-engine-scenario-name">

                        <span class="reports-engine-scenario-dot"></span>

                        <div>

                          <strong>
                            Baseline
                          </strong>

                          <span>
                            Normal hydraulic reference state
                          </span>

                        </div>

                      </div>


                      <div>

                        <div class="reports-engine-cell-label">
                          Avg Pressure
                        </div>

                        <div class="reports-engine-cell-value normal">

                          ${baselinePressure == null
        ? '—'
        : `${this.format(
          baselinePressure
        )} m`
      }

                        </div>

                      </div>


                      <div>

                        <div class="reports-engine-cell-label">
                          Total Flow
                        </div>

                        <div class="reports-engine-cell-value">

                          ${baselineFlow == null
        ? '—'
        : `${this.format(
          baselineFlow
        )} L/s`
      }

                        </div>

                      </div>


                      <div>

                        <div class="reports-engine-cell-label">
                          Change
                        </div>

                        <div class="reports-engine-cell-value normal">
                          0.00 m
                        </div>

                      </div>

                    </div>


                    <div class="reports-engine-scenario">

                      <div class="reports-engine-scenario-name">

                        <span
                          class="reports-engine-scenario-dot"
                        ></span>

                        <div>

                          <strong>
                            J4 Disruption
                          </strong>

                          <span>
                            Hydraulic disruption at junction J4
                          </span>

                        </div>

                      </div>


                      <div>

                        <div class="reports-engine-cell-label">
                          Avg Pressure
                        </div>

                        <div class="
                          reports-engine-cell-value
                          ${j4PressureDelta != null &&
        j4PressureDelta < 0
        ? 'warning'
        : 'normal'
      }
                        ">

                          ${j4Pressure == null
        ? '—'
        : `${this.format(
          j4Pressure
        )} m`
      }

                        </div>

                      </div>


                      <div>

                        <div class="reports-engine-cell-label">
                          Total Flow
                        </div>

                        <div class="reports-engine-cell-value">

                          ${j4Flow == null
        ? '—'
        : `${this.format(
          j4Flow
        )} L/s`
      }

                        </div>

                      </div>


                      <div>

                        <div class="reports-engine-cell-label">
                          Change
                        </div>

                        <div class="
                          reports-engine-cell-value
                          ${j4PressureDelta != null &&
        j4PressureDelta < 0
        ? 'warning'
        : 'normal'
      }
                        ">

                          ${j4PressureDelta == null
        ? '—'
        : `${this.signed(
          j4PressureDelta
        )} m`
      }

                        </div>

                      </div>

                    </div>


                    <div class="reports-engine-scenario">

                      <div class="reports-engine-scenario-name">

                        <span
                          class="reports-engine-scenario-dot"
                        ></span>

                        <div>

                          <strong>
                            J6 Disruption
                          </strong>

                          <span>
                            Hydraulic disruption at junction J6
                          </span>

                        </div>

                      </div>


                      <div>

                        <div class="reports-engine-cell-label">
                          Avg Pressure
                        </div>

                        <div class="
                          reports-engine-cell-value
                          ${j6PressureDelta != null &&
        j6PressureDelta < 0
        ? 'warning'
        : 'normal'
      }
                        ">

                          ${j6Pressure == null
        ? '—'
        : `${this.format(
          j6Pressure
        )} m`
      }

                        </div>

                      </div>


                      <div>

                        <div class="reports-engine-cell-label">
                          Total Flow
                        </div>

                        <div class="reports-engine-cell-value">

                          ${j6Flow == null
        ? '—'
        : `${this.format(
          j6Flow
        )} L/s`
      }

                        </div>

                      </div>


                      <div>

                        <div class="reports-engine-cell-label">
                          Change
                        </div>

                        <div class="
                          reports-engine-cell-value
                          ${j6PressureDelta != null &&
        j6PressureDelta < 0
        ? 'warning'
        : 'normal'
      }
                        ">

                          ${j6PressureDelta == null
        ? '—'
        : `${this.signed(
          j6PressureDelta
        )} m`
      }

                        </div>

                      </div>

                    </div>


                  </div>

                </div>

              </div>


              <div class="reports-engine-card">

                <div class="reports-engine-card-header">

                  <div>

                    <div class="reports-engine-card-title">
                      Disruption Impact
                    </div>

                    <div class="reports-engine-card-subtitle">
                      Largest hydraulic deviations from baseline
                    </div>

                  </div>

                  <span class="reports-engine-badge">
                    Δ ANALYSIS
                  </span>

                </div>


                <div class="reports-engine-card-body">

                  <div class="reports-engine-impact">


                    <div class="reports-engine-impact-item">

                      <div class="reports-engine-impact-title">
                        J4 Pressure Candidate
                      </div>

                      <div class="reports-engine-impact-value">

                        ${j4Largest
        ? this.escapeHtml(
          j4Largest.id
        )
        : '—'
      }

                      </div>

                      <div class="reports-engine-impact-note">

                        ${j4Largest
        ? `${this.signed(
          j4Largest.delta
        )} m pressure change`
        : 'No pressure divergence'
      }

                      </div>

                    </div>


                    <div class="reports-engine-impact-item">

                      <div class="reports-engine-impact-title">
                        J6 Pressure Candidate
                      </div>

                      <div class="reports-engine-impact-value">

                        ${j6Largest
        ? this.escapeHtml(
          j6Largest.id
        )
        : '—'
      }

                      </div>

                      <div class="reports-engine-impact-note">

                        ${j6Largest
        ? `${this.signed(
          j6Largest.delta
        )} m pressure change`
        : 'No pressure divergence'
      }

                      </div>

                    </div>


                    <div class="reports-engine-impact-item">

                      <div class="reports-engine-impact-title">
                        J4 Flow Candidate
                      </div>

                      <div class="reports-engine-impact-value">

                        ${j4PipeLargest
        ? this.escapeHtml(
          j4PipeLargest.id
        )
        : '—'
      }

                      </div>

                      <div class="reports-engine-impact-note">

                        ${j4PipeLargest
        ? `${this.signed(
          j4PipeLargest.delta
        )} L/s flow change`
        : 'No flow divergence'
      }

                      </div>

                    </div>


                    <div class="reports-engine-impact-item">

                      <div class="reports-engine-impact-title">
                        J6 Flow Candidate
                      </div>

                      <div class="reports-engine-impact-value">

                        ${j6PipeLargest
        ? this.escapeHtml(
          j6PipeLargest.id
        )
        : '—'
      }

                      </div>

                      <div class="reports-engine-impact-note">

                        ${j6PipeLargest
        ? `${this.signed(
          j6PipeLargest.delta
        )} L/s flow change`
        : 'No flow divergence'
      }

                      </div>

                    </div>


                  </div>

                </div>

              </div>


              <div class="reports-engine-card">

                <div class="reports-engine-card-header">

                  <div>

                    <div class="reports-engine-card-title">
                      Source Flow Analysis
                    </div>

                    <div class="reports-engine-card-subtitle">
                      P1 flow response across disruption scenarios
                    </div>

                  </div>

                  <span class="reports-engine-badge">
                    P1 · L/s
                  </span>

                </div>


                <div class="reports-engine-card-body">

                  <div class="reports-engine-impact">


                    <div class="reports-engine-impact-item">

                      <div class="reports-engine-impact-title">
                        Baseline
                      </div>

                      <div class="reports-engine-impact-value">

                        ${baselineP1 == null
        ? '—'
        : `${this.format(
          baselineP1
        )} L/s`
      }

                      </div>

                      <div class="reports-engine-impact-note">
                        Reference P1 flow
                      </div>

                    </div>


                    <div class="reports-engine-impact-item">

                      <div class="reports-engine-impact-title">
                        J4 Disruption
                      </div>

                      <div class="reports-engine-impact-value">

                        ${j4P1 == null
        ? '—'
        : `${this.format(
          j4P1
        )} L/s`
      }

                      </div>

                      <div class="reports-engine-impact-note">

                        ${baselineP1 != null &&
        j4P1 != null
        ? `${this.signed(
          j4P1 - baselineP1
        )} L/s vs baseline`
        : 'P1 comparison unavailable'
      }

                      </div>

                    </div>


                    <div class="reports-engine-impact-item">

                      <div class="reports-engine-impact-title">
                        J6 Disruption
                      </div>

                      <div class="reports-engine-impact-value">

                        ${j6P1 == null
        ? '—'
        : `${this.format(
          j6P1
        )} L/s`
      }

                      </div>

                      <div class="reports-engine-impact-note">

                        ${baselineP1 != null &&
        j6P1 != null
        ? `${this.signed(
          j6P1 - baselineP1
        )} L/s vs baseline`
        : 'P1 comparison unavailable'
      }

                      </div>

                    </div>


                    <div class="reports-engine-impact-item">

                      <div class="reports-engine-impact-title">
                        Flow Response
                      </div>

                      <div class="reports-engine-impact-value">

                        ${j4FlowDelta == null ||
        j6FlowDelta == null
        ? '—'
        : `${this.signed(
          j4FlowDelta
        )} / ${this.signed(
          j6FlowDelta
        )}`
      }

                      </div>

                      <div class="reports-engine-impact-note">
                        J4 / J6 total-network-flow change
                      </div>

                    </div>


                  </div>

                </div>

              </div>


              <div class="reports-engine-card reports-engine-card-wide">

                <div class="reports-engine-card-header">

                  <div>

                    <div class="reports-engine-card-title">
                      Model Configuration
                    </div>

                    <div class="reports-engine-card-subtitle">
                      Hydraulic network represented by the configured EPANET model
                    </div>

                  </div>

                  <span class="reports-engine-badge">
                    NETWORK CONFIG
                  </span>

                </div>


                <div class="reports-engine-card-body">

                  <div class="overview-cards-grid">

                    ${this.smallMetric(
        'JUNCTIONS',
        '9'
      )}

                    ${this.smallMetric(
        'PIPES',
        '9'
      )}

                    ${this.smallMetric(
        'STORAGE UNITS',
        '1'
      )}

                    ${this.smallMetric(
        'FLOW UNIT',
        'L/s'
      )}

                  </div>

                </div>

              </div>


            </div>


            <div class="notice-box-subtle mt-8">

              ${this.icon(
        'info',
        'icon'
      )}

              <span class="text-xs text-secondary">

                This report is generated from the configured
                EPANET/WNTR hydraulic scenarios. Hydraulic
                values are read from the backend simulation
                response; no physical leak measurements,
                sensor readings, or non-revenue-water values
                are fabricated.

              </span>

            </div>


          </div>

        </div>

      </div>

    `;

  },
  async loadCitizenReports() {

    const state =
      this.reportsState;

    state.citizenReportsLoading =
      true;

    state.citizenReportsError =
      null;

    /*
     * The municipal endpoint is protected by the Flask
     * municipal session. Always send the session cookie.
     */

    try {

      const config =
        this.getConfig();

      const baseUrl =
        String(
          config.baseUrl || ''
        ).replace(
          /\/$/,
          ''
        );

      const endpoint =
        `${baseUrl}/api/municipal/citizen-reports`;

      console.log(
        'HydroCybernetics: Loading municipal citizen reports:',
        endpoint
      );

      const response =
        await fetch(
          endpoint,
          {
            method: 'GET',
            cache: 'no-store',
            credentials: 'include',
            headers: {
              Accept: 'application/json'
            }
          }
        );

      let data = {};

      try {
        data =
          await response.json();
      } catch (jsonError) {
        data = {};
      }

      if (!response.ok) {

        const message =
          data.message ||
          (
            response.status === 401
              ? 'Municipal login session is not available.'
              : response.status === 403
                ? 'Municipal authority access is required.'
                : `Server returned HTTP ${response.status}.`
          );

        throw new Error(
          message
        );

      }

      state.citizenReports =
        Array.isArray(
          data.reports
        )
          ? data.reports
          : [];

      state.citizenReportsError =
        null;

      console.log(
        'HydroCybernetics: Municipal citizen reports loaded successfully.',
        {
          count:
            state.citizenReports.length
        }
      );

    } catch (error) {

      console.error(
        'HydroCybernetics: Municipal citizen reports failed:',
        error
      );

      state.citizenReports =
        [];

      state.citizenReportsError =
        error.message ||
        'Unable to load citizen reports.';

    } finally {

      state.citizenReportsLoading =
        false;

    }

  },


  renderCitizenReports() {

    const state =
      this.reportsState;

    const reports =
      Array.isArray(
        state.citizenReports
      )
        ? state.citizenReports
        : [];

    const activeReports =
      reports.filter(
        report =>
          String(
            report.status || ''
          ).toLowerCase() !== 'resolved'
      );

    const resolvedReports =
      reports.filter(
        report =>
          String(
            report.status || ''
          ).toLowerCase() === 'resolved'
      );

    const reportsWithEvidence =
      reports.filter(
        report =>
          !!report.evidence_image
      );

    const escape =
      value =>
        this.escapeHtml(
          value == null
            ? ''
            : value
        );

    const formatDate =
      value => {

        if (!value) {
          return '—';
        }

        const date =
          new Date(
            value
          );

        if (
          Number.isNaN(
            date.getTime()
          )
        ) {
          return escape(value);
        }

        return escape(
          date.toLocaleString(
            'en-IN',
            {
              dateStyle: 'medium',
              timeStyle: 'short'
            }
          )
        );

      };

    const reportStatus =
      report =>
        String(
          report.status ||
          'Submitted'
        );

    const statusBadge =
      status => {

        const normalized =
          String(
            status || ''
          ).toLowerCase();

        const isResolved =
          normalized === 'resolved';

        return `
          <span
            class="citizen-report-status ${isResolved
            ? 'resolved'
            : 'active'
          }"
          >
            <span class="citizen-report-status-dot"></span>
            ${escape(status)}
          </span>
        `;

      };

    if (
      state.citizenReportsLoading
    ) {

      return `

        <style>
          .citizen-reports-shell {
            width: 100%;
          }

          .citizen-reports-loading {
            min-height: 150px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 10px;
            color: #71869e;
            font-family: monospace;
            font-size: 9px;
            letter-spacing: .07em;
            text-transform: uppercase;
          }

          .citizen-reports-loading-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #35d0ff;
            box-shadow:
              0 0 12px rgba(53, 208, 255, .55);
          }
        </style>

        <div
          class="dash-card"
          id="municipal-citizen-reports"
        >

          <div class="dash-card-header">

            <div class="dash-card-title-wrap">

              <div class="icon-box">
                ${this.icon(
        'fileText',
        'icon'
      )}
              </div>

              <div>

                <h2 class="dash-card-title">
                  Citizen Water-Service Reports
                </h2>

                <p class="dash-card-subtitle">
                  Community-submitted service issues received by municipal operations
                </p>

              </div>

            </div>

          </div>

          <div class="dash-card-body">

            <div class="citizen-reports-loading">

              <div class="citizen-reports-loading-dot"></div>

              Loading citizen reports from municipal database

            </div>

          </div>

        </div>

      `;

    }

    if (
      state.citizenReportsError
    ) {

      return `

        <style>
          #municipal-citizen-reports
          .citizen-report-error {
            border:
              1px solid rgba(239, 68, 68, .20);
            border-radius: 9px;
            padding: 18px;
            background:
              rgba(239, 68, 68, .045);
          }

          #municipal-citizen-reports
          .citizen-report-error-label {
            margin-bottom: 7px;
            font-family: monospace;
            font-size: 8px;
            letter-spacing: .10em;
            color: #ef8585;
            text-transform: uppercase;
          }

          #municipal-citizen-reports
          .citizen-report-error-text {
            font-size: 12px;
            line-height: 1.6;
            color: #aabed1;
          }
        </style>

        <div
          class="dash-card"
          id="municipal-citizen-reports"
        >

          <div class="dash-card-header">

            <div class="dash-card-title-wrap">

              <div class="icon-box">
                ${this.icon(
        'fileText',
        'icon'
      )}
              </div>

              <div>

                <h2 class="dash-card-title">
                  Citizen Water-Service Reports
                </h2>

                <p class="dash-card-subtitle">
                  Community-submitted service issues received by municipal operations
                </p>

              </div>

            </div>

            <button
              type="button"
              class="btn btn-secondary btn-sm"
              onclick="
                DashboardMunicipalView.loadReports();
              "
            >
              Retry
              ${this.icon(
        'refresh',
        'icon'
      )}
            </button>

          </div>

          <div class="dash-card-body">

            <div class="citizen-report-error">

              <div class="citizen-report-error-label">
                CITIZEN REPORT API
              </div>

              <div class="citizen-report-error-text">
                ${escape(
        state.citizenReportsError
      )}
              </div>

            </div>

          </div>

        </div>

      `;

    }

    let reportCards = '';

    if (
      reports.length === 0
    ) {

      reportCards = `

        <div
          class="citizen-reports-empty"
        >

          <div class="citizen-reports-empty-icon">
            ${this.icon(
        'fileText',
        'icon'
      )}
          </div>

          <div class="citizen-reports-empty-title">
            No citizen reports received
          </div>

          <div class="citizen-reports-empty-text">
            Reports submitted through the Citizen Dashboard will appear here automatically.
          </div>

        </div>

      `;

    } else {

      reportCards =
        reports.map(
          report => {

            const status =
              reportStatus(
                report
              );

            const gpsAvailable =
              report.latitude != null &&
              report.longitude != null;

            const evidenceAvailable =
              !!report.evidence_image;

            const category =
              String(
                report.category ||
                'Water-Service Issue'
              );

            const location =
              String(
                report.location ||
                'Location not provided'
              );

            const citizenName =
              String(
                report.citizen_name ||
                'Citizen'
              );

            const reportId =
              String(
                report.id
              );

            return `

              <article
                class="citizen-report-row"
              >

                <div
                  class="citizen-report-row-top"
                >

                  <div
                    class="citizen-report-row-title-wrap"
                  >

                    <div
                      class="citizen-report-category-icon"
                    >
                      ${this.icon(
              'alertCircle',
              'icon'
            )}
                    </div>

                    <div>

                      <div
                        class="citizen-report-row-title"
                      >
                        ${escape(category)}
                      </div>

                      <div
                        class="citizen-report-row-subtitle"
                      >
                        REPORT #${escape(reportId)}
                        <span class="citizen-report-divider">•</span>
                        ${formatDate(
              report.created_at
            )}
                      </div>

                    </div>

                  </div>

                  ${statusBadge(status)}

                </div>


                <div
                  class="citizen-report-row-grid"
                >

                  <div
                    class="citizen-report-info"
                  >

                    <div class="citizen-report-info-label">
                      CITIZEN
                    </div>

                    <div class="citizen-report-info-value">
                      ${escape(citizenName)}
                    </div>

                    ${report.citizen_email
                ? `
                          <div
                            class="citizen-report-info-secondary"
                          >
                            ${escape(
                  report.citizen_email
                )}
                          </div>
                        `
                : ''
              }

                  </div>


                  <div
                    class="citizen-report-info"
                  >

                    <div class="citizen-report-info-label">
                      LOCATION
                    </div>

                    <div class="citizen-report-info-value">
                      ${escape(location)}
                    </div>

                  </div>


                  <div
                    class="citizen-report-info"
                  >

                    <div class="citizen-report-info-label">
                      GPS
                    </div>

                    <div class="citizen-report-info-value">
                      ${gpsAvailable
                ? 'Captured'
                : 'Not available'
              }
                    </div>

                    ${gpsAvailable
                ? `
                          <div
                            class="citizen-report-info-secondary"
                          >
                            ${escape(
                  this.format(
                    report.latitude,
                    5
                  )
                )},
                            ${escape(
                  this.format(
                    report.longitude,
                    5
                  )
                )}
                          </div>
                        `
                : ''
              }

                  </div>


                  <div
                    class="citizen-report-info"
                  >

                    <div class="citizen-report-info-label">
                      EVIDENCE
                    </div>

                    <div class="citizen-report-info-value">
                      ${evidenceAvailable
                ? 'Image attached'
                : 'No image'
              }
                    </div>

                  </div>

                </div>


                <div
                  class="citizen-report-description"
                >

                  <div class="citizen-report-info-label">
                    ISSUE DESCRIPTION
                  </div>

                  <div
                    class="citizen-report-description-text"
                  >
                    ${escape(
                report.description ||
                'No description provided.'
              )}
                  </div>

                </div>


                <div
                  class="citizen-report-row-footer"
                >

                  <div
                    class="citizen-report-source"
                  >

                    <span class="citizen-report-source-dot"></span>

                    <span>
                      CITIZEN DASHBOARD
                    </span>

                    <span class="citizen-report-divider">
                      •
                    </span>

                    <span>
                      SQLITE PERSISTED
                    </span>

                  </div>

                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    onclick="
                      DashboardMunicipalView.downloadCitizenReport(
                        '${escape(reportId)}'
                      );
                    "
                  >
                    ${this.icon(
                'download',
                'icon'
              )}
                    Download / Print PDF
                  </button>

                </div>

              </article>

            `;

          }
        ).join('');

    }

    return `

      <style>

        .citizen-reports-shell {
          width: 100%;
        }

        .citizen-reports-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 18px;
          padding: 11px 14px;
          border:
            1px solid rgba(92, 210, 255, .10);
          border-radius: 8px;
          background:
            rgba(7, 24, 43, .48);
        }

        .citizen-reports-meta-left {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .citizen-reports-meta-item {
          display: flex;
          align-items: center;
          gap: 7px;
          font-family: monospace;
          font-size: 8px;
          letter-spacing: .06em;
          color: #71869e;
          text-transform: uppercase;
        }

        .citizen-reports-meta-value {
          color: #b8cde0;
        }

        .citizen-reports-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #35d0ff;
          box-shadow:
            0 0 8px rgba(53, 208, 255, .55);
        }

        .citizen-reports-kpi-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 18px;
        }

        .citizen-reports-kpi {
          position: relative;
          overflow: hidden;
          min-height: 94px;
          padding: 15px;
          border:
            1px solid rgba(92, 210, 255, .10);
          border-radius: 9px;
          background:
            linear-gradient(
              145deg,
              rgba(18, 48, 76, .82),
              rgba(8, 27, 48, .92)
            );
        }

        .citizen-reports-kpi::after {
          content: '';
          position: absolute;
          width: 82px;
          height: 82px;
          right: -30px;
          bottom: -34px;
          border-radius: 50%;
          background:
            rgba(53, 208, 255, .055);
        }

        .citizen-reports-kpi-label {
          position: relative;
          z-index: 1;
          margin-bottom: 10px;
          font-family: monospace;
          font-size: 8px;
          letter-spacing: .10em;
          color: #71869e;
          text-transform: uppercase;
        }

        .citizen-reports-kpi-value {
          position: relative;
          z-index: 1;
          font-family: monospace;
          font-size: 20px;
          line-height: 1;
          font-weight: 700;
          color: #e2f4ff;
        }

        .citizen-reports-kpi-note {
          position: relative;
          z-index: 1;
          margin-top: 8px;
          font-size: 9px;
          color: #6f91aa;
        }

        .citizen-reports-section-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 4px;
          margin-bottom: 10px;
        }

        .citizen-reports-section-title-main {
          font-family: monospace;
          font-size: 9px;
          letter-spacing: .10em;
          color: #8ea8bf;
          text-transform: uppercase;
        }

        .citizen-reports-section-title-count {
          font-family: monospace;
          font-size: 8px;
          color: #60788f;
        }

        .citizen-report-row {
          position: relative;
          overflow: hidden;
          margin-top: 10px;
          padding: 17px;
          border:
            1px solid rgba(92, 210, 255, .085);
          border-radius: 9px;
          background:
            linear-gradient(
              145deg,
              rgba(14, 39, 64, .68),
              rgba(7, 24, 43, .72)
            );
        }

        .citizen-report-row:first-child {
          margin-top: 0;
        }

        .citizen-report-row::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          width: 2px;
          background: rgba(53, 208, 255, .65);
        }

        .citizen-report-row-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 15px;
        }

        .citizen-report-row-title-wrap {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
        }

        .citizen-report-category-icon {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border:
            1px solid rgba(53, 208, 255, .16);
          border-radius: 8px;
          background:
            rgba(53, 208, 255, .055);
          color: #75dfff;
        }

        .citizen-report-row-title {
          color: #dcecf8;
          font-size: 13px;
          font-weight: 650;
        }

        .citizen-report-row-subtitle {
          margin-top: 4px;
          font-family: monospace;
          font-size: 8px;
          letter-spacing: .04em;
          color: #617a91;
          text-transform: uppercase;
        }

        .citizen-report-divider {
          margin: 0 5px;
          color: #38536b;
        }

        .citizen-report-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex: 0 0 auto;
          padding: 5px 9px;
          border-radius: 999px;
          font-family: monospace;
          font-size: 8px;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .citizen-report-status-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
        }

        .citizen-report-status.active {
          color: #f5c96a;
          border:
            1px solid rgba(245, 180, 60, .22);
          background:
            rgba(245, 180, 60, .055);
        }

        .citizen-report-status.active
        .citizen-report-status-dot {
          background: #f5c96a;
          box-shadow:
            0 0 7px rgba(245, 201, 106, .55);
        }

        .citizen-report-status.resolved {
          color: #68ddb2;
          border:
            1px solid rgba(40, 210, 150, .20);
          background:
            rgba(40, 210, 150, .055);
        }

        .citizen-report-status.resolved
        .citizen-report-status-dot {
          background: #68ddb2;
          box-shadow:
            0 0 7px rgba(104, 221, 178, .50);
        }

        .citizen-report-row-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .citizen-report-info {
          min-width: 0;
          padding: 11px 12px;
          border:
            1px solid rgba(92, 210, 255, .055);
          border-radius: 7px;
          background:
            rgba(3, 15, 28, .24);
        }

        .citizen-report-info-label {
          margin-bottom: 6px;
          font-family: monospace;
          font-size: 7px;
          letter-spacing: .10em;
          color: #5e7890;
          text-transform: uppercase;
        }

        .citizen-report-info-value {
          overflow: hidden;
          color: #b9cddd;
          font-size: 10px;
          font-weight: 600;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .citizen-report-info-secondary {
          overflow: hidden;
          margin-top: 4px;
          color: #617d94;
          font-family: monospace;
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .citizen-report-description {
          margin-top: 8px;
          padding: 12px;
          border:
            1px solid rgba(92, 210, 255, .055);
          border-radius: 7px;
          background:
            rgba(3, 15, 28, .20);
        }

        .citizen-report-description-text {
          color: #a9bfd1;
          font-size: 11px;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        .citizen-report-row-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 13px;
          padding-top: 12px;
          border-top:
            1px solid rgba(92, 210, 255, .055);
        }

        .citizen-report-source {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 4px;
          font-family: monospace;
          font-size: 7px;
          letter-spacing: .07em;
          color: #526c82;
        }

        .citizen-report-source-dot {
          width: 5px;
          height: 5px;
          margin-right: 3px;
          border-radius: 50%;
          background: #35d0ff;
          box-shadow:
            0 0 7px rgba(53, 208, 255, .45);
        }

        .citizen-reports-empty {
          padding: 42px 20px;
          text-align: center;
          border:
            1px dashed rgba(92, 210, 255, .12);
          border-radius: 9px;
          background:
            rgba(7, 24, 43, .25);
        }

        .citizen-reports-empty-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          color: #4e7089;
        }

        .citizen-reports-empty-title {
          margin-bottom: 5px;
          color: #a8bfd1;
          font-size: 12px;
          font-weight: 600;
        }

        .citizen-reports-empty-text {
          max-width: 520px;
          margin: 0 auto;
          color: #60798f;
          font-size: 10px;
          line-height: 1.5;
        }

        @media (max-width: 1000px) {

          .citizen-reports-kpi-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .citizen-report-row-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

        }

        @media (max-width: 640px) {

          .citizen-reports-kpi-grid {
            grid-template-columns:
              1fr;
          }

          .citizen-report-row-grid {
            grid-template-columns:
              1fr;
          }

          .citizen-report-row-top {
            align-items: flex-start;
            flex-direction: column;
          }

          .citizen-report-row-footer {
            align-items: flex-start;
            flex-direction: column;
          }

        }

      </style>


      <div
        class="dash-card"
        id="municipal-citizen-reports"
      >

        <div class="dash-card-header">

          <div class="dash-card-title-wrap">

            <div class="icon-box">
              ${this.icon(
      'fileText',
      'icon'
    )}
            </div>

            <div>

              <h2 class="dash-card-title">
                Citizen Water-Service Reports
              </h2>

              <p class="dash-card-subtitle">
                Community-submitted service issues received by municipal operations
              </p>

            </div>

          </div>


          <button
            type="button"
            class="btn btn-secondary btn-sm"
            onclick="
              DashboardMunicipalView.loadReports();
            "
          >
            ${this.icon(
      'refresh',
      'icon'
    )}
            Refresh
          </button>

        </div>


        <div class="dash-card-body">

          <div
            class="citizen-reports-shell"
          >

            <div
              class="citizen-reports-meta"
            >

              <div
                class="citizen-reports-meta-left"
              >

                <div
                  class="citizen-reports-meta-item"
                >

                  <span
                    class="citizen-reports-dot"
                  ></span>

                  SOURCE

                  <span
                    class="citizen-reports-meta-value"
                  >
                    MUNICIPAL CITIZEN API
                  </span>

                </div>

                <div
                  class="citizen-reports-meta-item"
                >

                  DATABASE

                  <span
                    class="citizen-reports-meta-value"
                  >
                    SQLITE
                  </span>

                </div>

                <div
                  class="citizen-reports-meta-item"
                >

                  AREA

                  <span
                    class="citizen-reports-meta-value"
                  >
                    SADASHIV NAGAR DMA
                  </span>

                </div>

              </div>

              <div
                class="citizen-reports-meta-item"
              >

                LIVE RECORDS

                <span
                  class="citizen-reports-meta-value"
                >
                  ${reports.length}
                </span>

              </div>

            </div>


            <div
              class="citizen-reports-kpi-grid"
            >

              <div
                class="citizen-reports-kpi"
              >

                <div
                  class="citizen-reports-kpi-label"
                >
                  TOTAL REPORTS
                </div>

                <div
                  class="citizen-reports-kpi-value"
                >
                  ${reports.length}
                </div>

                <div
                  class="citizen-reports-kpi-note"
                >
                  all submitted records
                </div>

              </div>


              <div
                class="citizen-reports-kpi"
              >

                <div
                  class="citizen-reports-kpi-label"
                >
                  ACTIVE ISSUES
                </div>

                <div
                  class="citizen-reports-kpi-value"
                >
                  ${activeReports.length}
                </div>

                <div
                  class="citizen-reports-kpi-note"
                >
                  requiring municipal consideration
                </div>

              </div>


              <div
                class="citizen-reports-kpi"
              >

                <div
                  class="citizen-reports-kpi-label"
                >
                  RESOLVED
                </div>

                <div
                  class="citizen-reports-kpi-value"
                >
                  ${resolvedReports.length}
                </div>

                <div
                  class="citizen-reports-kpi-note"
                >
                  marked resolved
                </div>

              </div>


              <div
                class="citizen-reports-kpi"
              >

                <div
                  class="citizen-reports-kpi-label"
                >
                  EVIDENCE ATTACHED
                </div>

                <div
                  class="citizen-reports-kpi-value"
                >
                  ${reportsWithEvidence.length}
                </div>

                <div
                  class="citizen-reports-kpi-note"
                >
                  reports containing images
                </div>

              </div>

            </div>


            <div
              class="citizen-reports-section-title"
            >

              <div
                class="citizen-reports-section-title-main"
              >
                Individual Citizen Reports
              </div>

              <div
                class="citizen-reports-section-title-count"
              >
                ${reports.length}
                RECORD${reports.length === 1 ? '' : 'S'}
              </div>

            </div>


            ${reportCards}

          </div>

        </div>

      </div>

    `;

  },


  appendCitizenReportsToPage() {

    const container =
      this.getContainer();

    if (!container) {
      return;
    }

    const existing =
      document.getElementById(
        'municipal-citizen-reports'
      );

    if (existing) {

      const existingCard =
        existing.closest(
          '#municipal-citizen-reports'
        ) ||
        existing;

      if (
        existingCard &&
        existingCard.parentNode
      ) {
        existingCard.parentNode.removeChild(
          existingCard
        );
      }

    }

    const section =
      document.createElement(
        'div'
      );

    section.id =
      'municipal-citizen-reports-section';

    section.innerHTML =
      this.renderCitizenReports();

    container.appendChild(
      section
    );

  },


  downloadCitizenReport(
    reportId
  ) {

    const report =
      (
        this.reportsState
          .citizenReports || []
      ).find(
        item =>
          String(
            item.id
          ) === String(
            reportId
          )
      );

    if (!report) {

      alert(
        'Citizen report could not be found.'
      );

      return;

    }

    const esc =
      value =>
        this.escapeHtml(
          value == null
            ? ''
            : value
        );

    const status =
      String(
        report.status ||
        'Submitted'
      );

    const submitted =
      report.created_at
        ? new Date(
          report.created_at
        )
        : null;

    const submittedText =
      submitted &&
        !Number.isNaN(
          submitted.getTime()
        )
        ? submitted.toLocaleString(
          'en-IN',
          {
            dateStyle: 'long',
            timeStyle: 'short'
          }
        )
        : (
          report.created_at ||
          'Not available'
        );

    const gpsText =
      report.latitude != null &&
        report.longitude != null
        ? `${esc(
          this.format(
            report.latitude,
            6
          )
        )}, ${esc(
          this.format(
            report.longitude,
            6
          )
        )}`
        : 'Not available';

    const evidence =
      report.evidence_image
        ? `
          <div class="section">

            <h2>
              Visual Evidence
            </h2>

            <img
              src="${esc(
          report.evidence_image
        )}"
              alt="Citizen submitted evidence"
              class="evidence"
            />

            ${report.evidence_filename
          ? `
                  <div class="muted">
                    File:
                    ${esc(
            report.evidence_filename
          )}
                  </div>
                `
          : ''
        }

          </div>
        `
        : `
          <div class="section">

            <h2>
              Visual Evidence
            </h2>

            <div class="empty">
              No image evidence was attached to this report.
            </div>

          </div>
        `;

    const reportHtml = `

      <!DOCTYPE html>

      <html>

        <head>

          <meta charset="UTF-8">

          <title>
            HydroCybernetics Citizen Report #${esc(
      report.id
    )}
          </title>

          <style>

            * {
              box-sizing:border-box;
            }

            body {

              margin:0;

              padding:32px;

              background:#ffffff;

              color:#111827;

              font-family:
                Arial,
                Helvetica,
                sans-serif;

              line-height:1.55;

            }

            .report {

              max-width:850px;

              margin:0 auto;

            }

            .header {

              border-bottom:
                2px solid
                #111827;

              padding-bottom:18px;

              margin-bottom:24px;

            }

            .brand {

              font-size:22px;

              font-weight:700;

              letter-spacing:.04em;

            }

            .subtitle {

              margin-top:5px;

              font-size:12px;

              color:#6b7280;

            }

            .title {

              font-size:25px;

              font-weight:700;

              margin-top:22px;

            }

            .meta {

              display:grid;

              grid-template-columns:
                repeat(
                  2,
                  minmax(0,1fr)
                );

              gap:12px;

              margin-top:18px;

            }

            .meta-box {

              border:
                1px solid
                #d1d5db;

              border-radius:8px;

              padding:12px;

            }

            .label {

              font-size:9px;

              color:#6b7280;

              text-transform:uppercase;

              letter-spacing:.08em;

            }

            .value {

              margin-top:4px;

              font-size:13px;

              font-weight:600;

            }

            .section {

              margin-top:26px;

              page-break-inside:avoid;

            }

            h2 {

              font-size:14px;

              margin:0 0 10px;

            }

            .description {

              border:
                1px solid
                #d1d5db;

              border-radius:8px;

              padding:14px;

              white-space:pre-wrap;

              font-size:13px;

            }

            .evidence {

              display:block;

              max-width:100%;

              max-height:650px;

              object-fit:contain;

              border:
                1px solid
                #d1d5db;

              border-radius:8px;

              margin-top:10px;

            }

            .empty {

              border:
                1px solid
                #d1d5db;

              padding:14px;

              border-radius:8px;

              color:#6b7280;

              font-size:12px;

            }

            .muted {

              color:#6b7280;

              font-size:11px;

              margin-top:7px;

            }

            .footer {

              margin-top:36px;

              padding-top:12px;

              border-top:
                1px solid
                #d1d5db;

              color:#6b7280;

              font-size:10px;

            }

            .print-button {

              position:fixed;

              top:18px;

              right:18px;

              padding:9px 14px;

              border:0;

              border-radius:6px;

              background:#111827;

              color:white;

              cursor:pointer;

            }

            @media print {

              body {
                padding:0;
              }

              .print-button {
                display:none;
              }

            }

          </style>

        </head>

        <body>

          <button
            class="print-button"
            onclick="window.print();"
          >
            Save / Print PDF
          </button>

          <main class="report">

            <div class="header">

              <div class="brand">
                HYDROCYBERNETICS
              </div>

              <div class="subtitle">
                Municipal Operations • Belagavi
              </div>

              <div class="title">
                Citizen Water-Service Report
              </div>

              <div class="subtitle">
                Community-submitted issue record
              </div>

            </div>


            <div class="meta">

              <div class="meta-box">

                <div class="label">
                  Report ID
                </div>

                <div class="value">
                  ${esc(
      report.id
    )}
                </div>

              </div>


              <div class="meta-box">

                <div class="label">
                  Status
                </div>

                <div class="value">
                  ${esc(
      status
    )}
                </div>

              </div>


              <div class="meta-box">

                <div class="label">
                  Issue Category
                </div>

                <div class="value">
                  ${esc(
      report.category ||
      'Water-service issue'
    )}
                </div>

              </div>


              <div class="meta-box">

                <div class="label">
                  Submitted
                </div>

                <div class="value">
                  ${esc(
      submittedText
    )}
                </div>

              </div>


              <div class="meta-box">

                <div class="label">
                  Location
                </div>

                <div class="value">
                  ${esc(
      report.location ||
      'Not specified'
    )}
                </div>

              </div>


              <div class="meta-box">

                <div class="label">
                  Citizen
                </div>

                <div class="value">
                  ${esc(
      report.citizen_name ||
      'Citizen'
    )}
                </div>

                ${report.citizen_email
        ? `
                      <div
                        class="muted"
                      >
                        ${esc(
          report.citizen_email
        )}
                      </div>
                    `
        : ''
      }

              </div>


              <div class="meta-box">

                <div class="label">
                  GPS Coordinates
                </div>

                <div class="value">
                  ${gpsText}
                </div>

              </div>


              <div class="meta-box">

                <div class="label">
                  Location Accuracy
                </div>

                <div class="value">
                  ${report.location_accuracy != null
        ? `${esc(
          this.format(
            report.location_accuracy,
            1
          )
        )} m`
        : 'Not available'
      }
                </div>

              </div>

            </div>


            <div class="section">

              <h2>
                Issue Description
              </h2>

              <div class="description">
                ${esc(
        report.description ||
        'No description provided.'
      )}
              </div>

            </div>


            ${evidence}


            <div class="footer">

              Generated from the HydroCybernetics
              Municipal Operations Dashboard.
              This document reproduces the citizen-submitted
              record stored by the application.

            </div>

          </main>

        </body>

      </html>

    `;

    const reportWindow =
      window.open(
        '',
        '_blank',
        'width=1000,height=850'
      );

    if (!reportWindow) {

      alert(
        'Please allow pop-ups for this site to generate the report.'
      );

      return;

    }

    reportWindow.document.open();

    reportWindow.document.write(
      reportHtml
    );

    reportWindow.document.close();

    reportWindow.onload =
      () => {

        reportWindow.focus();

      };

  },


  async loadReports() {

    const state =
      this.reportsState;

    state.loading =
      true;

    state.error =
      null;

    state.citizenReportsLoading =
      true;

    state.citizenReportsError =
      null;


    this.updateContainer(
      this.renderReports()
    );


    try {

      const [
        baseline,
        j4,
        j6
      ] = await Promise.all([

        this.getScenario(
          'baseline'
        ),

        this.getScenario(
          'j4_leak'
        ),

        this.getScenario(
          'j6_leak'
        )

      ]);


      state.baseline =
        baseline;

      state.j4 =
        j4;

      state.j6 =
        j6;


    } catch (error) {

      console.error(
        'Reports error:',
        error
      );

      state.error =
        `Unable to load report data: ${error.message}`;

    }


    state.loading =
      false;


    this.updateContainer(
      this.renderReports()
    );


    /*
     * Citizen reports are loaded separately so that
     * a citizen-report authentication/API issue does
     * not destroy the hydraulic reporting section.
     */

    await this.loadCitizenReports();


    /*
     * Re-render the existing hydraulic report first.
     */

    this.updateContainer(
      this.renderReports()
    );


    /*
     * Append citizen reports BELOW the existing
     * hydraulic report on the SAME Reports page.
     */

    this.appendCitizenReportsToPage();

  },

  printReport() {

    const state =
      this.reportsState;

    if (
      !state.baseline ||
      !state.j4 ||
      !state.j6
    ) {

      alert(
        'Hydraulic report data is still loading.'
      );

      return;

    }

    const esc =
      value =>
        this.escapeHtml(
          value == null
            ? ''
            : value
        );

    const scenarioRows = [
      {
        name: 'Baseline',
        data: state.baseline
      },
      {
        name: 'J4 Leak',
        data: state.j4
      },
      {
        name: 'J6 Leak',
        data: state.j6
      }
    ];

    const getP1Flow =
      data => {

        if (
          !data ||
          !Array.isArray(
            data.pipes
          )
        ) {
          return null;
        }

        const pipe =
          data.pipes.find(
            item =>
              String(
                item.id
              ).toUpperCase() === 'P1'
          );

        return pipe
          ? this.number(
            pipe.flow,
            null
          )
          : null;

      };

    const avgPressure =
      data =>
        data &&
          data.average_pressure != null
          ? this.number(
            data.average_pressure,
            null
          )
          : null;

    const totalFlow =
      data =>
        data &&
          data.total_abs_flow != null
          ? this.number(
            data.total_abs_flow,
            null
          )
          : null;

    const baselinePressure =
      avgPressure(
        state.baseline
      );

    const rows =
      scenarioRows.map(
        row => {

          const pressure =
            avgPressure(
              row.data
            );

          const pressureChange =
            baselinePressure != null &&
              pressure != null
              ? pressure -
              baselinePressure
              : null;

          return `

            <tr>

              <td>
                ${esc(
            row.name
          )}
              </td>

              <td>
                ${pressure != null
              ? `${pressure.toFixed(3)} m`
              : '—'
            }
              </td>

              <td>
                ${totalFlow(
              row.data
            ) != null
              ? `${totalFlow(
                row.data
              ).toFixed(3)} L/s`
              : '—'
            }
              </td>

              <td>
                ${getP1Flow(
              row.data
            ) != null
              ? `${getP1Flow(
                row.data
              ).toFixed(3)} L/s`
              : '—'
            }
              </td>

              <td>
                ${pressureChange != null
              ? `${pressureChange >= 0
                ? '+'
                : ''
              }${pressureChange.toFixed(3)} m`
              : '—'
            }
              </td>

            </tr>

          `;

        }
      ).join('');

    const generatedAt =
      new Date().toLocaleString(
        'en-IN',
        {
          dateStyle: 'long',
          timeStyle: 'short'
        }
      );

    const hydraulicReportHtml = `

      <!DOCTYPE html>

      <html>

        <head>

          <meta charset="UTF-8">

          <title>
            HydroCybernetics Hydraulic Report
          </title>

          <style>

            * {
              box-sizing:border-box;
            }

            body {

              margin:0;

              padding:32px;

              background:#fff;

              color:#111827;

              font-family:
                Arial,
                Helvetica,
                sans-serif;

              line-height:1.5;

            }

            .report {

              max-width:900px;

              margin:0 auto;

            }

            .header {

              border-bottom:
                2px solid
                #111827;

              padding-bottom:18px;

              margin-bottom:26px;

            }

            .brand {

              font-size:22px;

              font-weight:700;

              letter-spacing:.04em;

            }

            .subtitle {

              color:#6b7280;

              font-size:12px;

              margin-top:4px;

            }

            h1 {

              font-size:25px;

              margin:
                22px 0 4px;

            }

            h2 {

              font-size:15px;

              margin:
                28px 0 10px;

            }

            .kpis {

              display:grid;

              grid-template-columns:
                repeat(
                  3,
                  1fr
                );

              gap:12px;

            }

            .kpi {

              border:
                1px solid
                #d1d5db;

              border-radius:8px;

              padding:14px;

            }

            .label {

              color:#6b7280;

              font-size:9px;

              text-transform:uppercase;

              letter-spacing:.08em;

            }

            .value {

              font-size:20px;

              font-weight:700;

              margin-top:5px;

            }

            .unit {

              color:#6b7280;

              font-size:10px;

            }

            table {

              width:100%;

              border-collapse:collapse;

              font-size:12px;

            }

            th,
            td {

              border:
                1px solid
                #d1d5db;

              padding:9px;

              text-align:left;

            }

            th {

              background:#f3f4f6;

              font-size:10px;

              text-transform:uppercase;

            }

            .notice {

              border:
                1px solid
                #d1d5db;

              border-radius:8px;

              padding:13px;

              color:#4b5563;

              font-size:11px;

            }

            .footer {

              margin-top:34px;

              padding-top:12px;

              border-top:
                1px solid
                #d1d5db;

              color:#6b7280;

              font-size:10px;

            }

            .print-button {

              position:fixed;

              top:18px;

              right:18px;

              padding:9px 14px;

              border:0;

              border-radius:6px;

              background:#111827;

              color:#fff;

              cursor:pointer;

            }

            @media print {

              body {
                padding:0;
              }

              .print-button {
                display:none;
              }

              .report {
                max-width:none;
              }

            }

            @media (
              max-width:700px
            ) {

              body {
                padding:16px;
              }

              .kpis {
                grid-template-columns:1fr;
              }

            }

          </style>

        </head>

        <body>

          <button
            class="print-button"
            onclick="window.print();"
          >
            Save / Print PDF
          </button>

          <main class="report">

            <div class="header">

              <div class="brand">
                HYDROCYBERNETICS
              </div>

              <div class="subtitle">
                Municipal Operations • Belagavi
              </div>

              <h1>
                Hydraulic &amp; Compliance Report
              </h1>

              <div class="subtitle">
                EPANET / WNTR scenario analysis
              </div>

            </div>


            <div class="kpis">

              <div class="kpi">

                <div class="label">
                  Baseline Pressure
                </div>

                <div class="value">
                  ${baselinePressure != null
        ? baselinePressure.toFixed(3)
        : '—'
      }
                </div>

                <div class="unit">
                  metres
                </div>

              </div>


              <div class="kpi">

                <div class="label">
                  Baseline Flow
                </div>

                <div class="value">
                  ${totalFlow(
        state.baseline
      ) != null
        ? totalFlow(
          state.baseline
        ).toFixed(3)
        : '—'
      }
                </div>

                <div class="unit">
                  L/s total absolute flow
                </div>

              </div>


              <div class="kpi">

                <div class="label">
                  P1 Baseline Flow
                </div>

                <div class="value">
                  ${getP1Flow(
        state.baseline
      ) != null
        ? getP1Flow(
          state.baseline
        ).toFixed(3)
        : '—'
      }
                </div>

                <div class="unit">
                  L/s
                </div>

              </div>

            </div>


            <h2>
              Scenario Summary
            </h2>

            <table>

              <thead>

                <tr>

                  <th>
                    Scenario
                  </th>

                  <th>
                    Average Pressure
                  </th>

                  <th>
                    Total Flow
                  </th>

                  <th>
                    P1 Flow
                  </th>

                  <th>
                    Pressure Change vs Baseline
                  </th>

                </tr>

              </thead>

              <tbody>

                ${rows}

              </tbody>

            </table>


            <h2>
              Model Configuration
            </h2>

            <div class="notice">

              Hydraulic source:
              EPANET / WNTR.
              Scenarios:
              baseline, J4 leak and J6 leak.
              Leak scenarios are represented by the configured
              EPANET emitter conditions.
              This report does not fabricate physical leak
              measurements or non-revenue-water values.

            </div>


            <div class="footer">

              Generated:
              ${esc(
        generatedAt
      )}

              <br>

              HydroCybernetics Municipal Operations Dashboard

            </div>

          </main>

        </body>

      </html>

    `;

    const reportWindow =
      window.open(
        '',
        '_blank',
        'width=1050,height=900'
      );

    if (!reportWindow) {

      alert(
        'Please allow pop-ups for this site to generate the hydraulic report.'
      );

      return;

    }

    reportWindow.document.open();

    reportWindow.document.write(
      hydraulicReportHtml
    );

    reportWindow.document.close();

    reportWindow.onload =
      () => {

        reportWindow.focus();

      };

  },


  /* ==========================================================
     COMMON UI
     ========================================================== */

  loadingCard(
    title,
    message
  ) {

    return `

      <div class="loading-state-card hc-state-card">

        <div class="loading-spinner"></div>

        <div class="font-mono text-xs text-accent mb-2">
          // ${this.escapeHtml(title)}
        </div>

        <h3 class="text-base font-semibold mb-1">
          Loading...
        </h3>

        <p class="text-xs text-muted">
          ${this.escapeHtml(message)}
        </p>

      </div>

    `;

  },


  errorCard(
    title,
    message,
    action = ''
  ) {

    return `

      <div class="error-state-card hc-state-card">

        <div
          class="icon-box mx-auto mb-3"
          style="
            color:#ef4444;
            border-color:rgba(239,68,68,.3);
          "
        >

          ${this.icon(
      'alertCircle',
      'icon'
    )}

        </div>


        <h3 class="text-base font-semibold mb-2">
          ${this.escapeHtml(title)}
        </h3>


        <p class="text-xs text-secondary max-w-md mx-auto mb-4">
          ${this.escapeHtml(message)}
        </p>


        ${action}

      </div>

    `;

  },


  emptyState(
    message
  ) {

    return `

      <div class="notice-box-subtle">

        <span class="text-xs text-secondary">
          ${this.escapeHtml(message)}
        </span>

      </div>

    `;

  },


  /* ==========================================================
     INITIALIZATION
     ========================================================== */

  init() {

    this.stopAnalyticsTelemetryPolling();

    this.destroyAnalyticsCharts();


    /*
     * Stop the old conceptual network canvas if one exists.
     */

    if (
      window.currentNetworkCanvas
    ) {

      try {

        if (
          typeof window.currentNetworkCanvas.stop ===
          'function'
        ) {

          window.currentNetworkCanvas.stop();

        }

      } catch (error) {

        console.warn(
          'Unable to stop previous network canvas:',
          error
        );

      }


      window.currentNetworkCanvas =
        null;

    }


    const hash =
      window.location.hash || '';


    /*
     * DIGITAL TWIN
     */

    if (
      hash.includes(
        '/municipal/digital-twin'
      )
    ) {

      setTimeout(
        () => {

          if (
            typeof DigitalTwinView !== 'undefined' &&
            DigitalTwinView &&
            typeof DigitalTwinView.init === 'function'
          ) {

            try {

              DigitalTwinView.init();

            } catch (error) {

              console.error(
                'Digital Twin initialization error:',
                error
              );

            }

          }

        },
        50
      );

    }


    /*
     * SIMULATION
     */

    if (
      hash.includes(
        '/municipal/simulation'
      )
    ) {

      setTimeout(
        () => {

          this.loadSimulationData(
            this.simulationState.currentScenario
          );

        },
        0
      );

    }


    /*
     * LEAK ANALYSIS
     */

    if (
      hash.includes(
        '/municipal/leak-analysis'
      )
    ) {

      setTimeout(
        () => {

          this.loadLeakAnalysis(
            this.leakState.scenario
          );

        },
        0
      );

    }


    /*
     * ALERTS
     */

    if (
      hash.includes(
        '/municipal/alerts'
      )
    ) {

      setTimeout(
        () => {

          this.loadAlerts();

        },
        0
      );

    }


    /*
     * ANALYTICS
     */

    if (
      hash.includes(
        '/municipal/analytics'
      )
    ) {

      setTimeout(
        () => {

          this.loadAnalyticsTelemetry();

        },
        0
      );

    }


    /*
     * REPORTS
     */

    if (
      hash.includes(
        '/municipal/reports'
      )
    ) {

      setTimeout(
        () => {

          this.loadReports();

        },
        0
      );

    }

  }


};


/* ============================================================
   GLOBAL EXPORT
   ============================================================ */

window.DashboardMunicipalView =
  DashboardMunicipalView;


console.log(
  'HydroCybernetics: Municipal Dashboard loaded successfully.'
);

/* ============================================================
   HYDROCYBERNETICS — MODERN MUNICIPAL VISUAL LAYER
   ============================================================
   This layer upgrades the visual presentation of:
     - Hydraulic Simulation
     - Leak Analysis
     - Operational Alerts
     - Digital Twin
   without changing their data sources or hydraulic calculations.
   Operational Analytics and Reports remain intact.
   ============================================================ */

(function () {

  'use strict';

  const DM = window.DashboardMunicipalView;

  if (!DM) {
    console.error(
      'HydroCybernetics: modern municipal visual layer could not load.'
    );
    return;
  }


  /* ==========================================================
     SHARED VISUAL LANGUAGE
     ========================================================== */

  DM.renderModernMetric = function (
    label,
    value,
    unit = '',
    iconName = 'gauge',
    tone = 'normal',
    meta = ''
  ) {

    const toneClass =
      tone === 'warning'
        ? 'hc-modern-kpi-warning'
        : tone === 'critical'
          ? 'hc-modern-kpi-critical'
          : tone === 'info'
            ? 'hc-modern-kpi-info'
            : 'hc-modern-kpi-normal';

    return `

      <div class="analytics-engine-kpi hc-modern-kpi ${toneClass}">

        <div class="hc-modern-kpi-top">

          <div class="analytics-engine-kpi-label">
            ${this.escapeHtml(label)}
          </div>

          <div class="hc-modern-kpi-icon">
            ${this.icon(iconName, 'icon')}
          </div>

        </div>

        <div class="analytics-engine-kpi-value">

          ${this.escapeHtml(
      value == null ? '—' : String(value)
    )}

          ${unit
        ? `
                <span class="hc-modern-kpi-unit">
                  ${this.escapeHtml(unit)}
                </span>
              `
        : ''
      }

        </div>

        ${meta
        ? `
              <div class="hc-modern-kpi-meta">
                ${this.escapeHtml(meta)}
              </div>
            `
        : ''
      }

      </div>

    `;

  };


  DM.renderModernPanel = function (
    title,
    subtitle,
    body,
    iconName = 'chart',
    badge = ''
  ) {

    return `

      <section class="analytics-engine-card hc-modern-panel">

        <div class="analytics-engine-card-header">

          <div class="hc-modern-panel-title-wrap">

            <div class="icon-box hc-modern-panel-icon">
              ${this.icon(iconName, 'icon')}
            </div>

            <div>

              <div class="analytics-engine-card-title">
                ${this.escapeHtml(title)}
              </div>

              <div class="analytics-engine-card-subtitle">
                ${this.escapeHtml(subtitle)}
              </div>

            </div>

          </div>

          ${badge
        ? `
                <span class="analytics-engine-unit">
                  ${this.escapeHtml(badge)}
                </span>
              `
        : ''
      }

        </div>

        <div class="hc-modern-panel-body">
          ${body}
        </div>

      </section>

    `;

  };


  DM.modernScenarioControls = function (
    activeScenario,
    handlerName,
    includeBaseline = true
  ) {

    const buttons = [];

    if (includeBaseline) {
      buttons.push(
        `
          <button
            type="button"
            class="analytics-scenario-btn ${activeScenario === 'baseline'
          ? 'active'
          : ''
        }"
            onclick="
              DashboardMunicipalView.${handlerName}(
                'baseline'
              );
            "
          >
            Baseline
          </button>
        `
      );
    }

    buttons.push(
      `
        <button
          type="button"
          class="analytics-scenario-btn ${activeScenario === 'j4_leak'
        ? 'active'
        : ''
      }"
          onclick="
            DashboardMunicipalView.${handlerName}(
              'j4_leak'
            );
          "
        >
          J4 Disruption
        </button>
      `
    );

    buttons.push(
      `
        <button
          type="button"
          class="analytics-scenario-btn ${activeScenario === 'j6_leak'
        ? 'active'
        : ''
      }"
          onclick="
            DashboardMunicipalView.${handlerName}(
              'j6_leak'
            );
          "
        >
          J6 Disruption
        </button>
      `
    );

    return `
      <div class="analytics-scenario-group hc-modern-scenario-group">
        ${buttons.join('')}
      </div>
    `;

  };


  /* ==========================================================
     MODERN HYDRAULIC SIMULATION
     ========================================================== */

  DM.renderSimulation = function () {

    const state =
      this.simulationState;

    if (state.loading) {

      return this.loadingCard(
        'HYDRAULIC SIMULATION',
        'Fetching EPANET/WNTR scenario calculations...'
      );

    }

    if (state.error) {

      return this.errorCard(
        'Simulation Data Unavailable',
        state.error,
        `
          <button
            class="btn btn-secondary btn-sm"
            onclick="
              DashboardMunicipalView.loadSimulationData(
                '${this.escapeHtml(
          state.currentScenario
        )}'
              );
            "
          >
            Retry
          </button>
        `
      );

    }

    const result =
      state.results;

    const nodes =
      result &&
        Array.isArray(result.nodes)
        ? result.nodes
        : [];

    const pipes =
      result &&
        Array.isArray(result.pipes)
        ? result.pipes
        : [];

    const avgPressure =
      result &&
        result.average_pressure != null
        ? this.number(
          result.average_pressure,
          null
        )
        : null;

    const p1 =
      pipes.find(
        pipe =>
          String(pipe.id) === 'P1'
      );

    const p1Flow =
      p1 &&
        p1.flow != null
        ? this.number(
          p1.flow,
          null
        )
        : null;

    const totalFlow =
      result &&
        result.total_abs_flow != null
        ? this.number(
          result.total_abs_flow,
          null
        )
        : null;

    const scenarioLabel =
      this.scenarioLabel(
        state.currentScenario
      );

    return `

      <div class="hc-modern-module-content">

        <div class="hc-modern-toolbar">

          <div>

            <div class="analytics-section-label">
              HYDRAULIC SCENARIO CONTROL
            </div>

            <div class="hc-modern-toolbar-title">
              ${this.escapeHtml(scenarioLabel)}
            </div>

            <div class="hc-modern-toolbar-subtitle">
              Select a scenario to execute and inspect the
              corresponding EPANET/WNTR hydraulic state.
            </div>

          </div>

          ${this.modernScenarioControls(
      state.currentScenario,
      'switchScenario'
    )}

        </div>


        <div class="analytics-engine-kpi-grid hc-modern-kpi-grid">

          ${this.renderModernMetric(
      'AVERAGE PRESSURE',
      avgPressure == null
        ? '—'
        : this.format(avgPressure),
      'm',
      'gauge',
      'normal',
      'EPANET/WNTR result'
    )}

          ${this.renderModernMetric(
      'P1 FLOW',
      p1Flow == null
        ? '—'
        : this.format(p1Flow),
      'L/s',
      'flow',
      'info',
      'Reference source pipe'
    )}

          ${this.renderModernMetric(
      'TOTAL ABSOLUTE FLOW',
      totalFlow == null
        ? '—'
        : this.format(totalFlow),
      'L/s',
      'chart',
      'info',
      'Network hydraulic output'
    )}

          ${this.renderModernMetric(
      'NETWORK ELEMENTS',
      `${nodes.length} / ${pipes.length}`,
      '',
      'network',
      'normal',
      'Junctions / pipes'
    )}

        </div>


        <div class="hc-modern-section-heading">

          <div>

            <div class="analytics-section-label">
              HYDRAULIC STATE
            </div>

            <h3>
              Scenario Results
            </h3>

            <p>
              Node pressure and pipe-flow outputs returned directly
              by the hydraulic simulation backend.
            </p>

          </div>

          <span class="analytics-engine-unit">
            ${this.escapeHtml(scenarioLabel)}
          </span>

        </div>


        <div class="hc-modern-two-column">

          ${this.renderModernPanel(
      'Junction Pressures',
      'Hydraulic pressure head at each modeled junction.',
      this.renderNodeTable(nodes),
      'gauge',
      'NODE STATE'
    )}

          ${this.renderModernPanel(
      'Pipe Flows',
      'Hydraulic flow output across modeled pipes.',
      this.renderPipeTable(pipes),
      'flow',
      'PIPE STATE'
    )}

        </div>


        ${state.currentScenario !== 'baseline'
        ? `
              <div class="hc-modern-comparison-wrap">
                ${this.renderScenarioComparison(
          state.comparison
        )}
              </div>
            `
        : ''
      }


        <div class="hc-modern-source-strip">

          <div class="hc-modern-source-icon">
            ${this.icon('checkCircle', 'icon')}
          </div>

          <div>

            <strong>
              Hydraulic source verified
            </strong>

            <span>
              Values shown in this module are returned by
              EPANET/WNTR through the Flask simulation API.
            </span>

          </div>

        </div>

      </div>

    `;

  };


  /* ==========================================================
     MODERN LEAK ANALYSIS
     ========================================================== */

  DM.renderLeakAnalysis = function () {

    const state =
      this.leakState;

    if (state.loading) {

      return this.loadingCard(
        'LEAK ANALYSIS',
        'Comparing baseline and disruption hydraulic states...'
      );

    }

    if (state.error) {

      return this.errorCard(
        'Leak Analysis Unavailable',
        state.error,
        `
          <button
            class="btn btn-secondary btn-sm"
            onclick="
              DashboardMunicipalView.loadLeakAnalysis(
                '${this.escapeHtml(
          state.scenario
        )}'
              );
            "
          >
            Retry
          </button>
        `
      );

    }

    if (
      !state.baseline ||
      !state.current
    ) {

      return `

        <div class="hc-modern-empty-module">

          <div class="hc-modern-empty-icon">
            ${this.icon('leakAlert', 'icon')}
          </div>

          <div class="analytics-section-label">
            LEAK ANALYSIS ENGINE
          </div>

          <h3>
            Hydraulic Divergence Analysis
          </h3>

          <p>
            Select a disruption scenario to compare its hydraulic
            state against the EPANET/WNTR baseline.
          </p>

          <div class="hc-modern-action-row">

            <button
              class="btn btn-primary"
              onclick="
                DashboardMunicipalView.loadLeakAnalysis(
                  'j4_leak'
                );
              "
            >
              Analyse J4
            </button>

            <button
              class="btn btn-secondary"
              onclick="
                DashboardMunicipalView.loadLeakAnalysis(
                  'j6_leak'
                );
              "
            >
              Analyse J6
            </button>

          </div>

        </div>

      `;

    }

    const comparison =
      this.buildComparison(
        state.baseline,
        state.current
      );

    const nodeChanges =
      comparison.nodes
        .slice()
        .sort(
          (a, b) =>
            Math.abs(b.delta) -
            Math.abs(a.delta)
        );

    const pipeChanges =
      comparison.pipes
        .slice()
        .sort(
          (a, b) =>
            Math.abs(b.delta) -
            Math.abs(a.delta)
        );

    const largestNode =
      nodeChanges[0] || null;

    const largestPipe =
      pipeChanges[0] || null;

    const significantNodes =
      nodeChanges.filter(
        item =>
          Math.abs(
            this.number(
              item.delta
            )
          ) >= 0.05
      );

    const significantPipes =
      pipeChanges.filter(
        item =>
          Math.abs(
            this.number(
              item.delta
            )
          ) >= 0.05
      );

    return `

      <div class="hc-modern-module-content">

        <div class="hc-modern-toolbar">

          <div>

            <div class="analytics-section-label">
              ANOMALY LOCALIZATION ENGINE
            </div>

            <div class="hc-modern-toolbar-title">
              ${this.escapeHtml(
      this.scenarioLabel(
        state.scenario
      )
    )}
            </div>

            <div class="hc-modern-toolbar-subtitle">
              Residual pressure and flow divergence relative to
              the baseline hydraulic state.
            </div>

          </div>

          ${this.modernScenarioControls(
      state.scenario,
      'loadLeakAnalysis',
      false
    )}

        </div>


        <div class="analytics-engine-kpi-grid hc-modern-kpi-grid">

          ${this.renderModernMetric(
      'PRESSURE DIVERGENCE',
      largestNode
        ? this.signed(
          largestNode.delta
        )
        : '0.00',
      'm',
      'gauge',
      Math.abs(
        this.number(
          largestNode?.delta
        )
      ) >= 0.05
        ? 'warning'
        : 'normal',
      largestNode
        ? `Largest change at ${largestNode.id}`
        : 'No divergence'
    )}

          ${this.renderModernMetric(
      'AFFECTED NODE',
      largestNode
        ? largestNode.id
        : '—',
      '',
      'network',
      significantNodes.length
        ? 'warning'
        : 'normal',
      `${significantNodes.length} significant node changes`
    )}

          ${this.renderModernMetric(
      'FLOW DIVERGENCE',
      largestPipe
        ? this.signed(
          largestPipe.delta
        )
        : '0.00',
      'L/s',
      'flow',
      Math.abs(
        this.number(
          largestPipe?.delta
        )
      ) >= 0.05
        ? 'warning'
        : 'normal',
      largestPipe
        ? `Largest change on ${largestPipe.id}`
        : 'No divergence'
    )}

          ${this.renderModernMetric(
      'AFFECTED PIPES',
      String(
        significantPipes.length
      ),
      '',
      'chart',
      significantPipes.length
        ? 'warning'
        : 'normal',
      'Threshold: |Δ| ≥ 0.05'
    )}

        </div>


        <div class="hc-modern-section-heading">

          <div>

            <div class="analytics-section-label">
              RESIDUAL ANALYSIS
            </div>

            <h3>
              Hydraulic Divergence Map
            </h3>

            <p>
              The largest deviations are surfaced first so an
              operator can immediately identify affected elements.
            </p>

          </div>

          <span class="analytics-engine-unit">
            BASELINE → ${this.escapeHtml(
      this.scenarioLabel(
        state.scenario
      )
    )}
          </span>

        </div>


        <div class="hc-modern-two-column">

          ${this.renderModernPanel(
      'Nodal Pressure Residuals',
      'Current pressure head compared with baseline.',
      this.renderModernNodeResiduals(
        nodeChanges
      ),
      'gauge',
      'PRESSURE'
    )}

          ${this.renderModernPanel(
      'Pipe Flow Residuals',
      'Current pipe flow compared with baseline.',
      this.renderModernPipeResiduals(
        pipeChanges
      ),
      'flow',
      'FLOW'
    )}

        </div>


        <div class="hc-modern-source-strip">

          <div class="hc-modern-source-icon">
            ${this.icon('info', 'icon')}
          </div>

          <div>

            <strong>
              Interpretation
            </strong>

            <span>
              Divergence indicates a modeled difference from the
              baseline state. It is an analytical signal and does
              not by itself constitute a confirmed physical leak.
            </span>

          </div>

        </div>

      </div>

    `;

  };


  DM.renderModernNodeResiduals = function (
    items
  ) {

    if (!items.length) {
      return this.emptyState(
        'No junction comparison data is available.'
      );
    }

    return `

      <div class="hc-residual-list">

        ${items.map(item => {

      const delta =
        this.number(
          item.delta
        );

      const significant =
        Math.abs(delta) >= 0.05;

      const direction =
        delta < 0
          ? 'PRESSURE DROP'
          : delta > 0
            ? 'PRESSURE RISE'
            : 'STABLE';

      return `

            <div class="hc-residual-row">

              <div class="hc-residual-main">

                <div class="hc-residual-id">
                  ${this.escapeHtml(
        item.id
      )}
                </div>

                <div class="hc-residual-label">
                  ${direction}
                </div>

              </div>

              <div class="hc-residual-values">

                <span>
                  ${this.format(
        item.baseline
      )} m
                </span>

                <span>
                  →
                </span>

                <strong>
                  ${this.format(
        item.current
      )} m
                </strong>

                <span class="${significant
          ? 'hc-residual-delta-warning'
          : 'hc-residual-delta-normal'
        }">
                  ${this.signed(
          delta
        )} m
                </span>

              </div>

            </div>

          `;

    }).join('')}

      </div>

    `;

  };


  DM.renderModernPipeResiduals = function (
    items
  ) {

    if (!items.length) {
      return this.emptyState(
        'No pipe comparison data is available.'
      );
    }

    return `

      <div class="hc-residual-list">

        ${items.map(item => {

      const delta =
        this.number(
          item.delta
        );

      const significant =
        Math.abs(delta) >= 0.05;

      const direction =
        delta < 0
          ? 'FLOW DECREASE'
          : delta > 0
            ? 'FLOW INCREASE'
            : 'STABLE';

      return `

            <div class="hc-residual-row">

              <div class="hc-residual-main">

                <div class="hc-residual-id">
                  ${this.escapeHtml(
        item.id
      )}
                </div>

                <div class="hc-residual-label">
                  ${direction}
                </div>

              </div>

              <div class="hc-residual-values">

                <span>
                  ${this.format(
        item.baseline
      )} L/s
                </span>

                <span>
                  →
                </span>

                <strong>
                  ${this.format(
        item.current
      )} L/s
                </strong>

                <span class="${significant
          ? 'hc-residual-delta-warning'
          : 'hc-residual-delta-normal'
        }">
                  ${this.signed(
          delta
        )} L/s
                </span>

              </div>

            </div>

          `;

    }).join('')}

      </div>

    `;

  };


  /* ==========================================================
     MODERN ALERTS
     ========================================================== */

  DM.renderAlerts = function () {

    const state =
      this.alertsState;

    if (state.loading) {

      return this.loadingCard(
        'OPERATIONAL ALERTS',
        'Analysing hydraulic scenarios for event conditions...'
      );

    }

    if (state.error) {

      return this.errorCard(
        'Alerts Unavailable',
        state.error,
        `
          <button
            class="btn btn-secondary btn-sm"
            onclick="
              DashboardMunicipalView.loadAlerts();
            "
          >
            Retry
          </button>
        `
      );

    }

    if (
      !state.baseline ||
      !state.j4 ||
      !state.j6
    ) {

      return this.loadingCard(
        'OPERATIONAL ALERT ENGINE',
        'Preparing hydraulic event advisories...'
      );

    }

    const j4 =
      this.buildComparison(
        state.baseline,
        state.j4
      );

    const j6 =
      this.buildComparison(
        state.baseline,
        state.j6
      );

    const j4Node =
      this.largestChange(
        j4.nodes
      );

    const j6Node =
      this.largestChange(
        j6.nodes
      );

    const j4Pipe =
      this.largestChange(
        j4.pipes
      );

    const j6Pipe =
      this.largestChange(
        j6.pipes
      );

    const scenarios = [
      {
        key: 'J4',
        title: 'J4 DISRUPTION',
        node: j4Node,
        pipe: j4Pipe
      },
      {
        key: 'J6',
        title: 'J6 DISRUPTION',
        node: j6Node,
        pipe: j6Pipe
      }
    ];

    const totalPressureChange =
      scenarios.filter(
        item =>
          item.node
      ).length;

    return `

      <div class="hc-modern-module-content">

        <div class="hc-modern-toolbar">

          <div>

            <div class="analytics-section-label">
              OPERATIONAL ALERT ENGINE
            </div>

            <div class="hc-modern-toolbar-title">
              Hydraulic Event Advisories
            </div>

            <div class="hc-modern-toolbar-subtitle">
              Scenario-derived alerts highlighting the strongest
              modeled hydraulic deviations from baseline.
            </div>

          </div>

          <button
            class="btn btn-secondary btn-sm"
            onclick="
              DashboardMunicipalView.loadAlerts();
            "
          >
            ${this.icon('refresh', 'icon')}
            Refresh Analysis
          </button>

        </div>


        <div class="analytics-engine-kpi-grid hc-modern-kpi-grid">

          ${this.renderModernMetric(
      'ADVISORY EVENTS',
      '2',
      '',
      'alertCircle',
      'warning',
      'J4 and J6 scenarios'
    )}

          ${this.renderModernMetric(
      'J4 PRESSURE Δ',
      j4Node
        ? this.signed(
          j4Node.delta
        )
        : '0.00',
      'm',
      'gauge',
      'warning',
      j4Node
        ? `Largest at ${j4Node.id}`
        : 'No change'
    )}

          ${this.renderModernMetric(
      'J6 PRESSURE Δ',
      j6Node
        ? this.signed(
          j6Node.delta
        )
        : '0.00',
      'm',
      'gauge',
      'warning',
      j6Node
        ? `Largest at ${j6Node.id}`
        : 'No change'
    )}

          ${this.renderModernMetric(
      'MONITORING MODE',
      'ADVISORY',
      '',
      'shield',
      'info',
      'Model-derived event layer'
    )}

        </div>


        <div class="hc-modern-section-heading">

          <div>

            <div class="analytics-section-label">
              EVENT DISPATCH
            </div>

            <h3>
              Active Hydraulic Advisories
            </h3>

            <p>
              Each advisory summarizes the strongest pressure and
              flow divergence detected in its disruption scenario.
            </p>

          </div>

          <span class="analytics-engine-unit">
            ${totalPressureChange} SCENARIOS WITH SIGNALS
          </span>

        </div>


        <div class="hc-alert-grid">

          ${scenarios.map(
      alert => {

        const nodeDelta =
          alert.node
            ? this.number(
              alert.node.delta
            )
            : 0;

        const pipeDelta =
          alert.pipe
            ? this.number(
              alert.pipe.delta
            )
            : 0;

        return `

                <article class="analytics-engine-card hc-alert-card">

                  <div class="hc-alert-card-top">

                    <div>

                      <div class="hc-alert-eyebrow">
                        ${this.escapeHtml(
          alert.key
        )} · HYDRAULIC EVENT
                      </div>

                      <h3 class="hc-alert-title">
                        ${this.escapeHtml(
          alert.title
        )}
                      </h3>

                    </div>

                    <span class="hc-alert-badge">
                      ADVISORY
                    </span>

                  </div>


                  <div class="hc-alert-primary">

                    <div>

                      <div class="hc-alert-metric-label">
                        PRESSURE RESPONSE
                      </div>

                      <div class="hc-alert-primary-value">
                        ${alert.node
            ? this.signed(
              nodeDelta
            )
            : '0.00'
          }
                        <span>m</span>
                      </div>

                    </div>

                    <div class="hc-alert-node">

                      <div class="hc-alert-metric-label">
                        AFFECTED NODE
                      </div>

                      <strong>
                        ${alert.node
            ? this.escapeHtml(
              alert.node.id
            )
            : '—'
          }
                      </strong>

                    </div>

                  </div>


                  <div class="hc-alert-detail-grid">

                    <div class="hc-alert-detail">

                      <span>
                        BASELINE PRESSURE
                      </span>

                      <strong>
                        ${alert.node
            ? `${this.format(
              alert.node.baseline
            )} m`
            : '—'
          }
                      </strong>

                    </div>

                    <div class="hc-alert-detail">

                      <span>
                        CURRENT PRESSURE
                      </span>

                      <strong>
                        ${alert.node
            ? `${this.format(
              alert.node.current
            )} m`
            : '—'
          }
                      </strong>

                    </div>

                    <div class="hc-alert-detail">

                      <span>
                        AFFECTED PIPE
                      </span>

                      <strong class="font-mono">
                        ${alert.pipe
            ? this.escapeHtml(
              alert.pipe.id
            )
            : '—'
          }
                      </strong>

                    </div>

                    <div class="hc-alert-detail">

                      <span>
                        FLOW Δ
                      </span>

                      <strong>
                        ${alert.pipe
            ? `${this.signed(
              pipeDelta
            )} L/s`
            : '—'
          }
                      </strong>

                    </div>

                  </div>


                  <div class="hc-alert-footer">

                    <span>
                      ${this.icon(
            'info',
            'icon'
          )}
                      Model-derived advisory
                    </span>

                    <span>
                      Baseline comparison
                    </span>

                  </div>

                </article>

              `;

      }
    ).join('')}

        </div>


        <div class="hc-modern-source-strip">

          <div class="hc-modern-source-icon">
            ${this.icon('shield', 'icon')}
          </div>

          <div>

            <strong>
              Advisory classification
            </strong>

            <span>
              These events are generated from hydraulic scenario
              divergence and are not live SCADA alarms or confirmed
              field incidents.
            </span>

          </div>

        </div>

      </div>

    `;

  };


  /* ==========================================================
     DIGITAL TWIN VISUAL INTEGRATION
     ========================================================== */

  DM.installDigitalTwinVisualLayer = function () {

    if (
      typeof DigitalTwinView === 'undefined' ||
      !DigitalTwinView ||
      typeof DigitalTwinView.render !== 'function'
    ) {
      return;
    }

    if (
      DigitalTwinView.__hydroModernRenderInstalled
    ) {
      return;
    }

    const originalRender =
      DigitalTwinView.render.bind(
        DigitalTwinView
      );

    DigitalTwinView.__hydroOriginalRender =
      originalRender;

    DigitalTwinView.render =
      function () {

        const s =
          DigitalTwinView.state || {};

        const network =
          s.network || {};

        const nodes =
          Array.isArray(
            network.nodes
          )
            ? network.nodes
            : [];

        const pipes =
          Array.isArray(
            network.pipes
          )
            ? network.pipes
            : Array.isArray(
              network.links
            )
              ? network.links
              : [];

        const source =
          network.source
            ? 'CONNECTED'
            : 'MODEL';

        const scenarioLabel =
          (
            DigitalTwinView.scenarioLabels &&
            DigitalTwinView.scenarioLabels[
            s.scenario
            ]
          ) ||
          s.scenario ||
          'Baseline Network Operation';

        let original;

        try {
          original =
            originalRender();
        } catch (error) {
          original = `
            <div class="error-state-card">
              <h3>
                Digital Twin Data Unavailable
              </h3>
              <p class="text-xs text-secondary">
                ${DM.escapeHtml(
            error.message
          )}
              </p>
            </div>
          `;
        }

        return `

          <div class="hc-digital-twin-modern">

            <div class="analytics-engine-kpi-grid hc-modern-kpi-grid">

              ${DM.renderModernMetric(
          'NETWORK NODES',
          String(nodes.length),
          '',
          'network',
          'normal',
          'Modeled junctions'
        )}

              ${DM.renderModernMetric(
          'NETWORK LINKS',
          String(pipes.length),
          '',
          'flow',
          'normal',
          'Modeled hydraulic pipes'
        )}

              ${DM.renderModernMetric(
          'ACTIVE SCENARIO',
          String(
            s.scenario || 'baseline'
          ).replace(
            '_',
            ' '
          ).toUpperCase(),
          '',
          'simulate',
          s.scenario === 'baseline'
            ? 'normal'
            : 'warning',
          scenarioLabel
        )}

              ${DM.renderModernMetric(
          'MODEL STATUS',
          s.loading
            ? 'LOADING'
            : source,
          '',
          'checkCircle',
          s.error
            ? 'critical'
            : 'normal',
          s.error
            ? 'Attention required'
            : 'Geographic + hydraulic model'
        )}

            </div>

            <div class="hc-modern-section-heading">

              <div>

                <div class="analytics-section-label">
                  SPATIAL HYDRAULIC MODEL
                </div>

                <h3>
                  Geographic Network State
                </h3>

                <p>
                  Interactive network visualization with scenario
                  context and selected-element inspection.
                </p>

              </div>

              <span class="analytics-engine-unit">
                ${DM.escapeHtml(
          String(
            s.scenario || 'baseline'
          ).replace(
            '_',
            ' '
          ).toUpperCase()
        )}
              </span>

            </div>

            <div class="hc-dt-original-wrap">
              ${original}
            </div>

          </div>

        `;

      };

    DigitalTwinView.__hydroModernRenderInstalled =
      true;

  };


  const originalRenderDigitalTwin =
    DM.renderDigitalTwin.bind(
      DM
    );

  DM.renderDigitalTwin = function () {

    this.installDigitalTwinVisualLayer();

    if (
      typeof DigitalTwinView !== 'undefined' &&
      DigitalTwinView &&
      typeof DigitalTwinView.render === 'function'
    ) {

      try {

        return DigitalTwinView.render();

      } catch (error) {

        console.error(
          'Digital Twin render error:',
          error
        );

        return this.errorCard(
          'Digital Twin unavailable',
          error.message
        );

      }

    }

    return originalRenderDigitalTwin();

  };


  /* ==========================================================
     VISUAL CSS
     ========================================================== */

  const styleId =
    'hydro-modern-municipal-ui';

  if (
    !document.getElementById(
      styleId
    )
  ) {

    const style =
      document.createElement(
        'style'
      );

    style.id =
      styleId;

    style.textContent = `

      .hc-modern-module-content {
        width:100%;
      }


      .hc-modern-toolbar {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:18px;
        margin-bottom:18px;
        padding:15px 17px;
        border:1px solid rgba(92,210,255,.08);
        border-radius:10px;
        background:
          linear-gradient(
            145deg,
            rgba(14,37,62,.72),
            rgba(7,24,43,.82)
          );
      }


      .hc-modern-toolbar-title {
        margin-top:4px;
        color:#dbeafe;
        font-size:15px;
        font-weight:700;
      }


      .hc-modern-toolbar-subtitle {
        margin-top:5px;
        max-width:620px;
        color:#71869e;
        font-size:10px;
        line-height:1.55;
      }


      .hc-modern-scenario-group {
        flex-shrink:0;
      }


      .hc-modern-kpi-grid {
        margin-bottom:20px;
      }


      .hc-modern-kpi {
        min-height:105px;
        transition:
          transform .18s ease,
          border-color .18s ease,
          box-shadow .18s ease;
      }


      .hc-modern-kpi:hover {
        transform:translateY(-2px);
        border-color:rgba(92,210,255,.20);
        box-shadow:
          0 14px 34px rgba(0,0,0,.16);
      }


      .hc-modern-kpi-top {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
      }


      .hc-modern-kpi-icon {
        display:flex;
        align-items:center;
        justify-content:center;
        width:27px;
        height:27px;
        border:1px solid rgba(92,210,255,.10);
        border-radius:7px;
        color:#6fdcff;
        background:rgba(53,208,255,.055);
      }


      .hc-modern-kpi-icon .icon {
        width:14px;
        height:14px;
      }


      .hc-modern-kpi-value {
        white-space:nowrap;
      }


      .hc-modern-kpi-unit {
        margin-left:3px;
        color:#71869e;
        font-family:monospace;
        font-size:10px;
        font-weight:500;
      }


      .hc-modern-kpi-meta {
        position:relative;
        z-index:1;
        margin-top:7px;
        color:#71869e;
        font-size:8px;
        line-height:1.4;
      }


      .hc-modern-kpi-warning {
        border-color:rgba(255,184,107,.14);
      }


      .hc-modern-kpi-warning .hc-modern-kpi-icon {
        color:#ffbe78;
        border-color:rgba(255,184,107,.16);
        background:rgba(255,184,107,.07);
      }


      .hc-modern-kpi-critical {
        border-color:rgba(239,68,68,.16);
      }


      .hc-modern-kpi-critical .hc-modern-kpi-icon {
        color:#ff7474;
        border-color:rgba(239,68,68,.18);
        background:rgba(239,68,68,.07);
      }


      .hc-modern-kpi-info .hc-modern-kpi-icon {
        color:#73d9ff;
      }


      .hc-modern-panel {
        min-width:0;
      }


      .hc-modern-panel-title-wrap {
        display:flex;
        align-items:center;
        gap:10px;
        min-width:0;
      }


      .hc-modern-panel-icon {
        flex-shrink:0;
        width:29px;
        height:29px;
      }


      .hc-modern-panel-icon .icon {
        width:14px;
        height:14px;
      }


      .hc-modern-panel-body {
        padding:16px;
      }


      .hc-modern-two-column {
        display:grid;
        grid-template-columns:
          repeat(2,minmax(0,1fr));
        gap:12px;
      }


      .hc-modern-section-heading {
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:15px;
        margin:23px 0 11px;
      }


      .hc-modern-section-heading h3 {
        margin:4px 0 0;
        color:#dbeafe;
        font-size:14px;
        font-weight:700;
      }


      .hc-modern-section-heading p {
        margin:4px 0 0;
        max-width:680px;
        color:#71869e;
        font-size:9px;
        line-height:1.5;
      }


      .hc-modern-comparison-wrap {
        margin-top:12px;
      }


      .hc-modern-source-strip {
        display:flex;
        align-items:flex-start;
        gap:10px;
        margin-top:18px;
        padding:12px 14px;
        border:
          1px solid
          rgba(92,210,255,.08);
        border-radius:9px;
        background:
          rgba(7,24,43,.55);
      }


      .hc-modern-source-icon {
        display:flex;
        align-items:center;
        justify-content:center;
        flex-shrink:0;
        width:26px;
        height:26px;
        border:
          1px solid
          rgba(92,210,255,.10);
        border-radius:7px;
        color:#6fdcff;
      }


      .hc-modern-source-icon .icon {
        width:13px;
        height:13px;
      }


      .hc-modern-source-strip strong {
        display:block;
        color:#bfe9ff;
        font-size:9px;
      }


      .hc-modern-source-strip span {
        display:block;
        margin-top:3px;
        color:#71869e;
        font-size:8px;
        line-height:1.5;
      }


      .hc-modern-empty-module {
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        min-height:310px;
        padding:40px 24px;
        text-align:center;
        border:
          1px solid
          rgba(92,210,255,.09);
        border-radius:12px;
        background:
          linear-gradient(
            145deg,
            rgba(16,39,64,.82),
            rgba(7,24,43,.90)
          );
      }


      .hc-modern-empty-icon {
        display:flex;
        align-items:center;
        justify-content:center;
        width:48px;
        height:48px;
        margin-bottom:15px;
        border:
          1px solid
          rgba(92,210,255,.12);
        border-radius:12px;
        color:#6fdcff;
        background:
          rgba(53,208,255,.055);
      }


      .hc-modern-empty-icon .icon {
        width:23px;
        height:23px;
      }


      .hc-modern-empty-module h3 {
        margin:6px 0;
        color:#dbeafe;
        font-size:16px;
      }


      .hc-modern-empty-module p {
        max-width:520px;
        margin:0;
        color:#71869e;
        font-size:10px;
        line-height:1.6;
      }


      .hc-modern-action-row {
        display:flex;
        gap:8px;
        margin-top:20px;
      }


      .hc-residual-list {
        display:flex;
        flex-direction:column;
        gap:7px;
      }


      .hc-residual-row {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        min-height:48px;
        padding:9px 10px;
        border:
          1px solid
          rgba(92,210,255,.06);
        border-radius:7px;
        background:
          rgba(7,24,43,.42);
      }


      .hc-residual-main {
        min-width:90px;
      }


      .hc-residual-id {
        color:#9edfff;
        font-family:monospace;
        font-size:10px;
        font-weight:700;
      }


      .hc-residual-label {
        margin-top:3px;
        color:#536b82;
        font-family:monospace;
        font-size:7px;
        letter-spacing:.08em;
      }


      .hc-residual-values {
        display:flex;
        align-items:center;
        justify-content:flex-end;
        gap:7px;
        color:#71869e;
        font-family:monospace;
        font-size:8px;
        white-space:nowrap;
      }


      .hc-residual-values strong {
        color:#dbeafe;
        font-size:9px;
      }


      .hc-residual-delta-normal {
        color:#83d8ad;
      }


      .hc-residual-delta-warning {
        color:#ffbe78;
      }


      .hc-alert-grid {
        display:grid;
        grid-template-columns:
          repeat(2,minmax(0,1fr));
        gap:12px;
      }


      .hc-alert-card {
        min-width:0;
        padding:0;
      }


      .hc-alert-card-top {
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
        padding:16px 17px 12px;
        border-bottom:
          1px solid
          rgba(255,184,107,.07);
      }


      .hc-alert-eyebrow {
        color:#71869e;
        font-family:monospace;
        font-size:7px;
        letter-spacing:.12em;
      }


      .hc-alert-title {
        margin:5px 0 0;
        color:#dbeafe;
        font-size:13px;
        font-weight:700;
      }


      .hc-alert-badge {
        flex-shrink:0;
        padding:5px 7px;
        border:
          1px solid
          rgba(255,184,107,.18);
        border-radius:5px;
        color:#ffbe78;
        background:
          rgba(255,184,107,.07);
        font-family:monospace;
        font-size:7px;
        letter-spacing:.08em;
      }


      .hc-alert-primary {
        display:grid;
        grid-template-columns:
          1fr .8fr;
        gap:12px;
        padding:16px 17px;
        border-bottom:
          1px solid
          rgba(92,210,255,.06);
      }


      .hc-alert-metric-label {
        color:#71869e;
        font-family:monospace;
        font-size:7px;
        letter-spacing:.10em;
      }


      .hc-alert-primary-value {
        margin-top:5px;
        color:#ffbe78;
        font-family:monospace;
        font-size:25px;
        font-weight:700;
        line-height:1;
      }


      .hc-alert-primary-value span {
        color:#71869e;
        font-size:9px;
        font-weight:500;
      }


      .hc-alert-node strong {
        display:block;
        margin-top:8px;
        color:#dbeafe;
        font-family:monospace;
        font-size:15px;
      }


      .hc-alert-detail-grid {
        display:grid;
        grid-template-columns:
          repeat(2,minmax(0,1fr));
        gap:1px;
        background:
          rgba(92,210,255,.05);
      }


      .hc-alert-detail {
        min-width:0;
        padding:11px 13px;
        background:
          rgba(7,24,43,.64);
      }


      .hc-alert-detail span {
        display:block;
        color:#536b82;
        font-family:monospace;
        font-size:7px;
        letter-spacing:.08em;
      }


      .hc-alert-detail strong {
        display:block;
        margin-top:4px;
        color:#bcd3e7;
        font-family:monospace;
        font-size:9px;
      }


      .hc-alert-footer {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:10px 13px;
        color:#536b82;
        font-family:monospace;
        font-size:7px;
      }


      .hc-alert-footer span:first-child {
        display:flex;
        align-items:center;
        gap:5px;
      }


      .hc-alert-footer .icon {
        width:10px;
        height:10px;
      }


      .hc-digital-twin-modern {
        width:100%;
      }


      .hc-dt-original-wrap {
        width:100%;
      }


      .hc-dt-original-wrap .dt-header-card {
        margin-top:0;
        border:
          1px solid
          rgba(92,210,255,.10);
        border-radius:10px;
        background:
          linear-gradient(
            145deg,
            rgba(16,39,64,.92),
            rgba(7,24,43,.96)
          );
        box-shadow:
          0 12px 30px rgba(0,0,0,.10);
      }


      .hc-dt-original-wrap .dt-grid {
        margin-top:12px;
      }


      .hc-dt-original-wrap .dash-card {
        border-color:
          rgba(92,210,255,.08);
        border-radius:10px;
      }


      .hc-dt-original-wrap .dt-title {
        color:#dbeafe;
      }


      .hc-dt-original-wrap .dt-eyebrow {
        color:#71869e;
        font-family:monospace;
        letter-spacing:.12em;
      }


      .hc-dt-original-wrap .dt-map-wrap {
        border-radius:8px;
        overflow:hidden;
      }


      @media (max-width:900px) {

        .hc-modern-toolbar {
          align-items:flex-start;
          flex-direction:column;
        }

        .hc-modern-scenario-group {
          width:100%;
        }

        .hc-modern-two-column,
        .hc-alert-grid {
          grid-template-columns:1fr;
        }

      }


      @media (max-width:650px) {

        .hc-modern-kpi-grid {
          grid-template-columns:
            repeat(2,minmax(0,1fr));
        }

        .hc-modern-section-heading {
          align-items:flex-start;
          flex-direction:column;
        }

        .hc-alert-primary {
          grid-template-columns:1fr;
        }

        .hc-residual-row {
          align-items:flex-start;
          flex-direction:column;
        }

        .hc-residual-values {
          justify-content:flex-start;
        }

      }

    `;

    document.head.appendChild(
      style
    );

  }


  console.log(
    'HydroCybernetics: modern municipal UI layer installed.'
  );

})();
