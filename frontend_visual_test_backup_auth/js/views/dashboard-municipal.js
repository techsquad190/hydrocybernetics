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


  telemetryState: {
    pressure: null, flow: null, loading: false, error: null,
    lastUpdated: null, timer: null
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

  render(activeSubTab = 'digital-twin') {

    /* Overview has been removed from the municipal navigation. */
    if (activeSubTab === 'overview') {
      activeSubTab = 'digital-twin';
    }

    return `

      <div class="municipal-layout">

        <!-- ==================================================
             SIDEBAR
             ================================================== -->

        <aside class="municipal-sidebar">

          <div class="sidebar-header">

            <a
              href="#/municipal/digital-twin"
              class="sidebar-brand"
              data-route="/municipal/digital-twin"
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

              ${this.navItem(
      'telemetry',
      '/municipal/telemetry',
      'Telemetry',
      'gauge',
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

      case 'telemetry':
        content = this.renderTelemetry();
        break;

      default:
        content = this.renderDigitalTwin();
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

      telemetry: {
        title: 'Telemetry',
        subtitle: 'Live readings received from the ESP32 field sensors',
        icon: 'gauge',
        mode: 'ESP32 FIELD DATA'
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


  /* ==========================================================
     ESP32 TELEMETRY
     ========================================================== */

  renderTelemetry() {
    const state = this.telemetryState;
    const hasPressure = state.pressure !== null && state.pressure !== undefined && Number.isFinite(Number(state.pressure));
    const hasFlow = state.flow !== null && state.flow !== undefined && Number.isFinite(Number(state.flow));
    const pressure = hasPressure ? `${this.format(state.pressure, 2)}` : '—';
    const flow = hasFlow ? `${this.format(state.flow, 3)}` : '—';
    const updated = state.lastUpdated ? new Date(state.lastUpdated).toLocaleTimeString() : 'Waiting for first reading';
    const connectionLabel = state.error ? 'ATTENTION REQUIRED' : (state.lastUpdated ? 'API RESPONDING' : 'CONNECTING');
    const connectionClass = state.error ? 'hc-telemetry-status-error' : 'hc-telemetry-status-ok';
    return `
      <style>
        .hc-telemetry-page{display:flex;flex-direction:column;gap:20px;color:#e5eefb}
        .hc-telemetry-hero{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:24px 26px;background:linear-gradient(115deg,#10243b 0%,#0c1b2e 72%);border:1px solid #203a55;border-radius:16px}
        .hc-telemetry-hero-main{display:flex;align-items:center;gap:15px;min-width:0}
        .hc-telemetry-icon{display:grid;place-items:center;width:48px;height:48px;flex:0 0 48px;border-radius:12px;background:#0c3443;border:1px solid #15566a;color:#63dcf4}
        .hc-telemetry-eyebrow{font:600 10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.13em;color:#6d9cbd;text-transform:uppercase;margin-bottom:5px}
        .hc-telemetry-title{font-size:22px;line-height:1.25;font-weight:700;color:#f4f8ff;margin:0}
        .hc-telemetry-subtitle{font-size:13px;line-height:1.5;color:#8eabc8;margin:5px 0 0}
        .hc-telemetry-status{display:inline-flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;border:1px solid #23445b;background:#0b2032;font:600 10px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.05em;white-space:nowrap}
        .hc-telemetry-status:before{content:'';width:7px;height:7px;border-radius:50%;background:#50d9ae;box-shadow:0 0 10px #50d9ae55}
        .hc-telemetry-status-error:before{background:#f4a261;box-shadow:0 0 10px #f4a26155}
        .hc-telemetry-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
        .hc-telemetry-card{min-width:0;padding:19px 20px;background:linear-gradient(145deg,#10253b,#0c1c2e);border:1px solid #203950;border-radius:14px;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
        .hc-telemetry-card:hover{transform:translateY(-2px);border-color:#2c627b;box-shadow:0 10px 24px #02081433}
        .hc-telemetry-card-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px}
        .hc-telemetry-card-icon{display:grid;place-items:center;width:36px;height:36px;border:1px solid #254b63;border-radius:10px;background:#0b2b40;color:#69d7f1}
        .hc-telemetry-chip{font:600 9px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;color:#82a9c7;border:1px solid #244158;border-radius:6px;padding:5px 7px}
        .hc-telemetry-label{font:600 10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:#7596b5}
        .hc-telemetry-value{font-size:29px;line-height:1.2;font-weight:700;letter-spacing:-.03em;color:#f1f7ff;margin-top:8px;overflow-wrap:anywhere}
        .hc-telemetry-unit{font-size:13px;font-weight:500;letter-spacing:0;color:#8eabc8;margin-left:5px}
        .hc-telemetry-note{font-size:12px;line-height:1.5;color:#7895b1;margin:10px 0 0}
        .hc-telemetry-section{padding:22px 24px;background:#0d1e31;border:1px solid #203950;border-radius:14px}
        .hc-telemetry-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}
        .hc-telemetry-section-title{font-size:15px;font-weight:700;color:#edf5ff;margin:0}
        .hc-telemetry-section-copy{font-size:12px;color:#819fbd;margin:5px 0 0;line-height:1.5}
        .hc-telemetry-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .hc-telemetry-detail{padding:14px 15px;background:#0a1929;border:1px solid #1c334a;border-radius:10px;min-width:0}
        .hc-telemetry-detail-label{display:block;font:600 9px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.09em;color:#7596b5;text-transform:uppercase;margin-bottom:7px}
        .hc-telemetry-detail-value{font-size:13px;font-weight:600;color:#dce9f8;overflow-wrap:anywhere}
        .hc-telemetry-actions{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-top:18px;padding-top:16px;border-top:1px solid #1d344a}
        .hc-telemetry-updated{font-size:11px;color:#7e9ab7}
        .hc-telemetry-refresh{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border:1px solid #236078;border-radius:9px;background:#0c3445;color:#8de9fb;font-size:12px;font-weight:700;cursor:pointer;transition:background .15s ease,border-color .15s ease}
        .hc-telemetry-refresh:hover{background:#10445a;border-color:#3286a0}
        @media(max-width:900px){.hc-telemetry-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hc-telemetry-hero{align-items:flex-start;flex-direction:column}}
        @media(max-width:600px){.hc-telemetry-grid,.hc-telemetry-detail-grid{grid-template-columns:1fr}.hc-telemetry-hero,.hc-telemetry-section{padding:18px}.hc-telemetry-value{font-size:26px}}
      </style>
      <div class="hc-telemetry-page">
        <header class="hc-telemetry-hero">
          <div class="hc-telemetry-hero-main">
            <div class="hc-telemetry-icon">${this.icon('gauge', 'icon')}</div>
            <div>
              <div class="hc-telemetry-eyebrow">FIELD MONITORING / ESP32</div>
              <h2 class="hc-telemetry-title">Telemetry &amp; Sensor Monitoring</h2>
              <p class="hc-telemetry-subtitle">Live hardware readings and communication status for the water distribution network.</p>
            </div>
          </div>
          <div class="hc-telemetry-status ${connectionClass}">${this.escapeHtml(connectionLabel)}</div>
        </header>

        <section class="hc-telemetry-grid" aria-label="Current telemetry metrics">
          <article class="hc-telemetry-card">
            <div class="hc-telemetry-card-top"><div class="hc-telemetry-card-icon">${this.icon('gauge', 'icon')}</div><span class="hc-telemetry-chip">PRESSURE</span></div>
            <div class="hc-telemetry-label">Pressure Head</div>
            <div class="hc-telemetry-value">${this.escapeHtml(pressure)}${hasPressure ? '<span class="hc-telemetry-unit">m H₂O</span>' : ''}</div>
            <p class="hc-telemetry-note">Flow-based pressure-head estimate · decreases above leak threshold</p>
          </article>
          <article class="hc-telemetry-card">
            <div class="hc-telemetry-card-top"><div class="hc-telemetry-card-icon">${this.icon('activity', 'icon') || this.icon('chart', 'icon')}</div><span class="hc-telemetry-chip">YF-S201</span></div>
            <div class="hc-telemetry-label">Flow Rate</div>
            <div class="hc-telemetry-value">${this.escapeHtml(flow)}${hasFlow ? '<span class="hc-telemetry-unit">L/s</span>' : ''}</div>
            <p class="hc-telemetry-note">Latest flow value received from the ESP32.</p>
          </article>
          <article class="hc-telemetry-card">
            <div class="hc-telemetry-card-top"><div class="hc-telemetry-card-icon">${this.icon('wifi', 'icon') || this.icon('monitor', 'icon')}</div><span class="hc-telemetry-chip">CONNECTION</span></div>
            <div class="hc-telemetry-label">ESP32 Data Link</div>
            <div class="hc-telemetry-value" style="font-size:22px">${state.error ? 'Check link' : (state.lastUpdated ? 'Responding' : 'Connecting')}</div>
            <p class="hc-telemetry-note">${state.error ? this.escapeHtml(state.error) : 'Telemetry API communication status.'}</p>
          </article>
        </section>

        <section class="hc-telemetry-section">
          <div class="hc-telemetry-section-head">
            <div><div class="hc-telemetry-eyebrow">DEVICE STATUS</div><h3 class="hc-telemetry-section-title">Hardware Connection</h3><p class="hc-telemetry-section-copy">Status of the telemetry feed and latest successful update.</p></div>
            <span class="hc-telemetry-chip">AUTO REFRESH · 3 SEC</span>
          </div>
          <div class="hc-telemetry-detail-grid">
            <div class="hc-telemetry-detail"><span class="hc-telemetry-detail-label">Pressure model</span><span class="hc-telemetry-detail-value">${hasPressure ? 'Estimate active' : 'Waiting for telemetry'}</span></div>
            <div class="hc-telemetry-detail"><span class="hc-telemetry-detail-label">Flow channel</span><span class="hc-telemetry-detail-value">${hasFlow ? 'Reading available' : 'Waiting for data'}</span></div>
          </div>
          <div class="hc-telemetry-actions"><span class="hc-telemetry-updated">Last successful refresh: ${this.escapeHtml(updated)}</span><button type="button" class="hc-telemetry-refresh" onclick="DashboardMunicipalView.loadTelemetry()">${this.icon('refreshCw', 'icon')} Refresh readings</button></div>
        </section>
      </div>`;
  },

  async loadTelemetry() {
    const state = this.telemetryState;
    const config = this.getConfig();
    state.error = null;
    try {
      const [pressureResponse, flowResponse] = await Promise.all([
        this.fetchJson(`${config.baseUrl}${config.pressure}`),
        this.fetchJson(`${config.baseUrl}${config.flow}`)
      ]);
      state.pressure = pressureResponse.pressure;
      state.flow = flowResponse.flow;
      state.lastUpdated = new Date().toISOString();
    } catch (error) {
      state.pressure = null;
      state.flow = null;
      state.error = `Unable to fetch ESP32 telemetry: ${error.message}`;
    } finally {
      if ((window.location.hash || '').includes('/municipal/telemetry')) {
        this.updateContainer(this.renderTelemetry());
      }
    }
  },

  startTelemetryPolling() {
    this.stopTelemetryPolling();
    this.loadTelemetry();
    this.telemetryState.timer = setInterval(() => {
      if ((window.location.hash || '').includes('/municipal/telemetry')) {
        this.loadTelemetry();
      } else {
        this.stopTelemetryPolling();
      }
    }, 3000);
  },

  stopTelemetryPolling() {
    if (this.telemetryState && this.telemetryState.timer) {
      clearInterval(this.telemetryState.timer);
      this.telemetryState.timer = null;
    }
  },


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
    this.stopTelemetryPolling();

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

    if (hash.includes('/municipal/telemetry')) {
      setTimeout(() => this.startTelemetryPolling(), 0);
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
   ALERT ENGINE REVISION: 2026-09-17-A
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


  /*
   * Digital Twin owns its own scenario switching.
   * Do not route these controls through DashboardMunicipalView.switchScenario,
   * because that method belongs to the Hydraulic Simulation module.
   */
  DM.switchDigitalTwinScenario = function (
    scenario
  ) {

    if (
      typeof DigitalTwinView !== 'undefined' &&
      DigitalTwinView &&
      typeof DigitalTwinView.switchScenario === 'function'
    ) {
      DigitalTwinView.switchScenario(
        scenario
      );
      return;
    }

    if (
      typeof DigitalTwinView !== 'undefined' &&
      DigitalTwinView &&
      typeof DigitalTwinView.load === 'function'
    ) {
      DigitalTwinView.load(
        scenario
      );
      return;
    }

    console.error(
      'HydroCybernetics: Digital Twin scenario controller is unavailable.'
    );
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
      this.simulationState || {};
  
    if (state.loading) {
  
      return `
        <div class="hc-simulation-modern hc-simulation-state">
          <div class="hc-simulation-state-icon">
            ${this.icon('simulate', 'icon')}
          </div>
          <div class="analytics-section-label">
            HYDRAULIC SIMULATION ENGINE
          </div>
          <h3>Loading Hydraulic Simulation</h3>
          <p>Fetching EPANET/WNTR scenario calculations...</p>
        </div>
      `;
  
    }
  
    if (state.error) {
  
      return this.errorCard(
        'Simulation Data Unavailable',
        state.error,
        `
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            onclick="
              DashboardMunicipalView.loadSimulationData(
                '${this.escapeHtml(
                  state.currentScenario || 'baseline'
                )}'
              );
            "
          >
            ${this.icon('refresh', 'icon')}
            Retry
          </button>
        `
      );
  
    }
  
    const result =
      state.results || {};
  
    const nodes =
      Array.isArray(result.nodes)
        ? result.nodes
        : [];
  
    const pipes =
      Array.isArray(result.pipes)
        ? result.pipes
        : [];
  
    const avgPressure =
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
      p1 && p1.flow != null
        ? this.number(
            p1.flow,
            null
          )
        : null;
  
    const totalFlow =
      result.total_abs_flow != null
        ? this.number(
            result.total_abs_flow,
            null
          )
        : null;
  
    const scenarioLabel =
      this.scenarioLabel(
        state.currentScenario || 'baseline'
      );
  
    const scenarioStatus =
      state.currentScenario === 'baseline'
        ? 'NORMAL'
        : 'SCENARIO';
  
    return `
  
      <div class="hc-simulation-modern">
  
        <div class="hc-simulation-header">
  
          <div class="hc-simulation-header-left">
  
            <div class="hc-simulation-header-icon">
              ${this.icon('simulate', 'icon')}
            </div>
  
            <div>
  
              <div class="analytics-section-label">
                HYDRAULIC SIMULATION ENGINE
              </div>
  
              <h2 class="hc-simulation-title">
                Scenario Simulation
              </h2>
  
              <p class="hc-simulation-subtitle">
                Execute and inspect hydraulic states returned directly
                by the EPANET/WNTR simulation backend.
              </p>
  
            </div>
  
          </div>
  
          <span class="hc-simulation-status">
            ${this.escapeHtml(scenarioStatus)}
          </span>
  
        </div>
  
  
        <div class="hc-simulation-control">
  
          <div class="hc-simulation-control-copy">
  
            <div class="analytics-section-label">
              HYDRAULIC SCENARIO CONTROL
            </div>
  
            <div class="hc-simulation-control-title">
              ${this.escapeHtml(scenarioLabel)}
            </div>
  
            <p>
              Select a scenario to execute and inspect its
              corresponding hydraulic state.
            </p>
  
          </div>
  
          <div class="hc-simulation-control-actions">
  
            ${this.modernScenarioControls(
              state.currentScenario || 'baseline',
              'switchScenario'
            )}
  
            <button
              type="button"
              class="btn btn-secondary btn-sm hc-simulation-refresh"
              onclick="
                DashboardMunicipalView.loadSimulationData(
                  '${this.escapeHtml(
                    state.currentScenario || 'baseline'
                  )}'
                );
              "
              title="Reload scenario data"
            >
              ${this.icon('refresh', 'icon')}
              Refresh
            </button>
  
          </div>
  
        </div>
  
  
        <div class="hc-simulation-kpi-grid">
  
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
            'pipeline',
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
            'map',
            'normal',
            'Junctions / pipes'
          )}
  
        </div>
  
  
        <section class="hc-simulation-results-card">

          <div class="hc-simulation-section-heading">

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

          <div class="hc-simulation-results-grid">

            <div class="hc-simulation-result-panel">

              ${this.renderModernPanel(
                'Junction Pressures',
                'Hydraulic pressure head at each modeled junction.',
                this.renderNodeTable(nodes),
                'gauge',
                'NODE STATE'
              )}

            </div>

            <div class="hc-simulation-result-panel">

              ${this.renderModernPanel(
                'Pipe Flows',
                'Hydraulic flow output across modeled pipes.',
                this.renderPipeTable(pipes),
                'pipeline',
                'PIPE STATE'
              )}

            </div>

          </div>

        </section>


        ${
          state.currentScenario !== 'baseline'
            ? `
              <div class="hc-simulation-comparison">
                ${this.renderScenarioComparison(
                  state.comparison
                )}
              </div>
            `
            : ''
        }
  
  
        <div class="hc-simulation-source-strip">
  
          <div class="hc-simulation-source-icon">
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
      this.leakState || {};

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
            type="button"
            class="btn btn-secondary btn-sm"
            onclick="
              DashboardMunicipalView.loadLeakAnalysis(
                '${this.escapeHtml(state.scenario || 'j4_leak')}'
              );
            "
          >
            ${this.icon('refresh', 'icon')}
            Retry
          </button>
        `
      );

    }

    if (!state.baseline || !state.current) {

      return `

        <div class="hc-modern-empty-module hc-leak-empty">

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
              type="button"
              class="btn btn-primary"
              onclick="DashboardMunicipalView.loadLeakAnalysis('j4_leak');"
            >
              Analyse J4
            </button>

            <button
              type="button"
              class="btn btn-secondary"
              onclick="DashboardMunicipalView.loadLeakAnalysis('j6_leak');"
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
      ) || { nodes: [], pipes: [] };

    const nodes =
      Array.isArray(comparison.nodes)
        ? comparison.nodes
        : [];

    const pipes =
      Array.isArray(comparison.pipes)
        ? comparison.pipes
        : [];

    const nodeChanges =
      nodes
        .slice()
        .sort(
          (a, b) =>
            Math.abs(this.number(b.delta)) -
            Math.abs(this.number(a.delta))
        );

    const pipeChanges =
      pipes
        .slice()
        .sort(
          (a, b) =>
            Math.abs(this.number(b.delta)) -
            Math.abs(this.number(a.delta))
        );

    const largestNode =
      nodeChanges[0] || null;

    const largestPipe =
      pipeChanges[0] || null;

    const significantNodes =
      nodeChanges.filter(
        item =>
          Math.abs(this.number(item.delta)) >= 0.05
      );

    const significantPipes =
      pipeChanges.filter(
        item =>
          Math.abs(this.number(item.delta)) >= 0.05
      );

    const scenarioLabel =
      this.scenarioLabel(state.scenario);

    const pressureDelta =
      largestNode
        ? this.signed(largestNode.delta)
        : '0.00';

    const flowDelta =
      largestPipe
        ? this.signed(largestPipe.delta)
        : '0.00';

    // The affected junction is the configured disruption point,
    // not necessarily the junction with the largest pressure residual.
    // Keep largestNode for the MAX PRESSURE CHANGE metric.
    const affectedJunctionId =
      state.scenario === 'j4_leak'
        ? 'J4'
        : state.scenario === 'j6_leak'
          ? 'J6'
          : null;

    const pressureTone =
      largestNode &&
      Math.abs(this.number(largestNode.delta)) >= 0.05
        ? 'warning'
        : 'normal';

    const flowTone =
      largestPipe &&
      Math.abs(this.number(largestPipe.delta)) >= 0.05
        ? 'warning'
        : 'normal';

    return `

      <div class="hc-modern-module-content hc-leak-modern">

        <div class="dash-card hc-leak-shell">

          <div class="dash-card-header hc-leak-shell-header">

            <div class="dash-card-title-wrap">

              <div class="icon-box">
                ${this.icon(
                  'leakAlert',
                  'icon'
                )}
              </div>

              <div>
                <h2 class="dash-card-title">
                  Leak Analysis
                </h2>

                <p class="dash-card-subtitle">
                  Hydraulic divergence and anomaly localization
                </p>
              </div>

            </div>

            <div class="hc-leak-shell-mode">

              <span class="hc-leak-mode-dot"></span>

              <div>
                <strong>ANOMALY ANALYSIS</strong>
                <span>EPANET / WNTR · MODEL-DERIVED</span>
              </div>

            </div>

          </div>

          <div class="dash-card-body hc-leak-shell-body">

        <div class="hc-modern-toolbar hc-leak-toolbar">

          <div class="hc-leak-toolbar-copy">

            <div class="analytics-section-label">
              ANOMALY LOCALIZATION ENGINE
            </div>

            <div class="hc-modern-toolbar-title">
              ${this.escapeHtml(scenarioLabel)}
            </div>

            <div class="hc-modern-toolbar-subtitle">
              Hydraulic divergence from the EPANET/WNTR baseline,
              with affected junctions and pipes surfaced first.
            </div>

          </div>

          <div class="hc-leak-toolbar-right">

            <div class="hc-leak-mode-badge">
              <span class="hc-leak-mode-dot"></span>
              <div>
                <strong>ANOMALY ANALYSIS</strong>
                <span>MODEL-DERIVED</span>
              </div>
            </div>

            ${this.modernScenarioControls(
      state.scenario,
      'loadLeakAnalysis',
      false
    )}

          </div>

        </div>


        <div class="hc-leak-summary-grid">

          <div class="hc-leak-summary-card ${pressureTone === 'warning' ? 'is-warning' : ''}">

            <div class="hc-leak-summary-icon">
              ${this.icon('gauge', 'icon')}
            </div>

            <div class="hc-leak-summary-copy">
              <span>MAX PRESSURE CHANGE</span>
              <strong>
                ${this.escapeHtml(pressureDelta)}
                <small>m</small>
              </strong>
              <small>
                ${largestNode ? `Largest residual at ${this.escapeHtml(largestNode.id)}` : 'No pressure divergence'}
              </small>
            </div>

          </div>


          <div class="hc-leak-summary-card ${significantNodes.length ? 'is-warning' : ''}">

            <div class="hc-leak-summary-icon">
              ${this.icon('alertCircle', 'icon')}
            </div>

            <div class="hc-leak-summary-copy">
              <span>AFFECTED JUNCTION</span>
              <strong>
                ${affectedJunctionId ? this.escapeHtml(affectedJunctionId) : '—'}
              </strong>
              <small>
                ${significantNodes.length} significant node changes
              </small>
            </div>

          </div>


          <div class="hc-leak-summary-card ${flowTone === 'warning' ? 'is-warning' : ''}">

            <div class="hc-leak-summary-icon">
              ${this.icon('monitor', 'icon')}
            </div>

            <div class="hc-leak-summary-copy">
              <span>MAX FLOW CHANGE</span>
              <strong>
                ${this.escapeHtml(flowDelta)}
                <small>L/s</small>
              </strong>
              <small>
                ${largestPipe ? `Largest residual on ${this.escapeHtml(largestPipe.id)}` : 'No flow divergence'}
              </small>
            </div>

          </div>


          <div class="hc-leak-summary-card ${significantPipes.length ? 'is-warning' : ''}">

            <div class="hc-leak-summary-icon">
              ${this.icon('chart', 'icon')}
            </div>

            <div class="hc-leak-summary-copy">
              <span>AFFECTED PIPES</span>
              <strong>
                ${significantPipes.length}
              </strong>
              <small>
                Threshold: |Δ| ≥ 0.05
              </small>
            </div>

          </div>

        </div>


        <div class="hc-leak-dispatch-heading">

          <div>
            <div class="analytics-section-label">
              HYDRAULIC DIVERGENCE
            </div>
            <h3>
              Residual Analysis
            </h3>
            <p>
              Compare the scenario against baseline and inspect the
              strongest pressure and flow deviations.
            </p>
          </div>

          <span class="hc-leak-dispatch-count">
            BASELINE → ${this.escapeHtml(scenarioLabel)}
          </span>

        </div>


        <div class="hc-modern-two-column hc-leak-analysis-grid">

          ${this.renderLeakResidualPanel(
      'PRESSURE RESIDUALS',
      'Nodal Pressure',
      'Baseline → current pressure head by junction.',
      this.renderModernNodeResiduals(nodeChanges),
      'gauge',
      `${significantNodes.length} SIGNIFICANT`
    )}

          ${this.renderLeakResidualPanel(
      'FLOW RESIDUALS',
      'Pipe Flow',
      'Baseline → current flow response by pipe.',
      this.renderModernPipeResiduals(pipeChanges),
      'pipeline',
      `${significantPipes.length} SIGNIFICANT`
    )}

        </div>


        <div class="hc-modern-source-strip hc-leak-boundary">

          <div class="hc-modern-source-icon">
            ${this.icon('info', 'icon')}
          </div>

          <div>
            <strong>Interpretation boundary</strong>
            <span>
              Divergence indicates a modeled difference from the
              baseline hydraulic state. It is an analytical signal
              and does not by itself confirm a physical leak.
            </span>
          </div>

        </div>

          </div>

        </div>

      </div>

    `;

  };


  DM.renderLeakResidualPanel = function (
    eyebrow,
    title,
    subtitle,
    body,
    iconName = 'chart',
    badge = ''
  ) {

    return `

      <section class="hc-leak-residual-panel">

        <div class="hc-leak-residual-header">

          <div class="hc-leak-residual-title-wrap">

            <div class="hc-leak-residual-icon">
              ${this.icon(iconName, 'icon')}
            </div>

            <div class="hc-leak-residual-heading">

              <div class="hc-leak-residual-eyebrow">
                ${this.escapeHtml(eyebrow)}
              </div>

              <h3>
                ${this.escapeHtml(title)}
              </h3>

              <p>
                ${this.escapeHtml(subtitle)}
              </p>

            </div>

          </div>

          ${badge
        ? `
              <span class="hc-leak-residual-badge">
                ${this.escapeHtml(badge)}
              </span>
            `
        : ''}

        </div>

        <div class="hc-leak-residual-body">
          ${body}
        </div>

      </section>

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
      this.alertsState || {};

    if (state.loading) {

      return this.loadingCard(
        'OPERATIONAL ALERTS',
        'Evaluating the configured hydraulic event scenarios...'
      );

    }

    if (state.error) {

      return this.errorCard(
        'Alerts Unavailable',
        state.error,
        `
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            onclick="DashboardMunicipalView.loadAlerts();"
          >
            ${this.icon('refresh', 'icon')}
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
        'Preparing scenario advisories...'
      );

    }

    /*
     * Alerts are tied to the configured disruption junctions.
     * They do not infer a physical leak and do not replace the
     * complete Simulation or Leak Analysis views.
     */

    const buildEvent =
      (scenarioData, scenarioKey, targetNodeId) => {

        const comparison =
          this.buildComparison(
            state.baseline,
            scenarioData
          );

        const targetId =
          String(targetNodeId || '').toUpperCase();

        const node =
          Array.isArray(comparison.nodes)
            ? comparison.nodes.find(
              item =>
                String(item.id || '').toUpperCase() ===
                targetId
            ) || null
            : null;

        // The affected link is the configured disruption link, not
        // whichever pipe happens to have the largest flow change.
        // Keep the largest-change pipe separate so FLOW RESPONSE
        // continues to reflect the hydraulic simulation.
        const affectedLinkId =
          scenarioKey === 'J4'
            ? 'P7'
            : scenarioKey === 'J6'
              ? 'P2'
              : null;

        const affectedPipe =
          affectedLinkId &&
          Array.isArray(comparison.pipes)
            ? comparison.pipes.find(
              item =>
                String(item && item.id || '').toUpperCase() ===
                affectedLinkId
            ) || { id: affectedLinkId }
            : null;

        const flowPipe =
          Array.isArray(comparison.pipes) &&
            comparison.pipes.length
            ? comparison.pipes
              .slice()
              .sort(
                (a, b) =>
                  Math.abs(
                    this.number(b && b.delta)
                  ) -
                  Math.abs(
                    this.number(a && a.delta)
                  )
              )[0]
            : null;

        const pressureDelta =
          node
            ? this.number(node.delta)
            : 0;

        const flowDelta =
          flowPipe
            ? this.number(flowPipe.delta)
            : 0;

        let severity = 'MONITOR';

        if (pressureDelta <= -0.50) {
          severity = 'CRITICAL';
        } else if (pressureDelta < -0.10) {
          severity = 'WARNING';
        } else if (pressureDelta > 0.10) {
          severity = 'RESPONSE';
        }

        return {
          scenarioKey,
          title:
            scenarioKey === 'J4'
              ? 'J4 DISRUPTION'
              : 'J6 DISRUPTION',
          node,
          pipe: affectedPipe,
          pressureDelta,
          flowDelta,
          severity
        };

      };

    const events = [
      buildEvent(
        state.j4,
        'J4',
        'J4'
      ),
      buildEvent(
        state.j6,
        'J6',
        'J6'
      )
    ];

    const warningCount =
      events.filter(
        event =>
          event.severity === 'WARNING' ||
          event.severity === 'CRITICAL'
      ).length;

    const statusClass =
      severity => {

        if (severity === 'CRITICAL') {
          return 'hc-alert-status-critical';
        }

        if (severity === 'WARNING') {
          return 'hc-alert-status-warning';
        }

        if (severity === 'RESPONSE') {
          return 'hc-alert-status-response';
        }

        return 'hc-alert-status-monitor';

      };

    return `

      <div class="hc-modern-module-content hc-alerts-modern">

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
                  Operational Alerts
                </h2>

                <p class="dash-card-subtitle">
                  Hydraulic scenario event advisories
                </p>
              </div>

            </div>

            <div class="hc-alert-mode-badge">

              <span class="hc-alert-mode-dot"></span>

              <div>
                <strong>ADVISORY MODE</strong>
                <span>EPANET / WNTR · NOT LIVE SCADA</span>
              </div>

            </div>

          </div>

          <div class="dash-card-body">

            <div class="hc-alert-overview-row">

              <div class="hc-alert-overview-copy">

                <div class="analytics-section-label">
                  OPERATIONAL ALERT ENGINE
                </div>

                <div class="hc-modern-toolbar-title">
                  Hydraulic Event Advisories
                </div>

                <div class="hc-modern-toolbar-subtitle">
                  Scenario-derived deviations for the configured J4 and
                  J6 disruption points.
                </div>

              </div>

              <button
                type="button"
                class="btn btn-secondary btn-sm hc-alert-refresh"
                onclick="DashboardMunicipalView.loadAlerts();"
              >
                ${this.icon('refresh', 'icon')}
                Refresh Analysis
              </button>

            </div>

            <div class="hc-alert-summary-grid">

              <div class="hc-alert-summary-card">
                <div class="hc-alert-summary-icon">
                  ${this.icon('alertCircle', 'icon')}
                </div>
                <div class="hc-alert-summary-copy">
                  <span>EVENT SCENARIOS</span>
                  <strong>${events.length}</strong>
                  <small>Configured J4 + J6 disruptions</small>
                </div>
              </div>

              <div class="hc-alert-summary-card ${warningCount ? 'is-warning' : ''}">
                <div class="hc-alert-summary-icon">
                  ${this.icon('gauge', 'icon')}
                </div>
                <div class="hc-alert-summary-copy">
                  <span>PRESSURE WARNINGS</span>
                  <strong>${warningCount}</strong>
                  <small>${warningCount ? 'Modeled pressure response detected' : 'No warning-level response'}</small>
                </div>
              </div>

              <div class="hc-alert-summary-card">
                <div class="hc-alert-summary-icon">
                  ${this.icon('activity', 'icon')}
                </div>
                <div class="hc-alert-summary-copy">
                  <span>FIELD TELEMETRY</span>
                  <strong>OFFLINE</strong>
                  <small>ESP32 pressure + flow integration pending</small>
                </div>
              </div>

            </div>

            <div class="hc-alert-dispatch-heading">

              <div>
                <div class="analytics-section-label">EVENT DISPATCH VIEW</div>
                <h3>Scenario Advisories</h3>
              </div>

              <span class="hc-alert-dispatch-count">
                ${events.length} ACTIVE SCENARIOS
              </span>

            </div>

            <div class="hc-alert-grid">

              ${events.map(
                event => `

                  <article
                    class="analytics-engine-card hc-alert-card hc-alert-event-card"
                  >

                    <div class="hc-alert-card-top">

                      <div class="hc-alert-title-block">

                        <div class="hc-alert-eyebrow">
                          ${this.escapeHtml(event.scenarioKey)}
                          · HYDRAULIC EVENT
                        </div>

                        <div class="hc-alert-title">
                          ${this.escapeHtml(event.title)}
                        </div>

                      </div>

                      <span
                        class="hc-alert-badge ${statusClass(event.severity)}"
                      >
                        ${this.escapeHtml(event.severity)}
                      </span>

                    </div>

                    <div class="hc-alert-primary">

                      <div class="hc-alert-primary-block">

                        <div class="hc-alert-metric-label">
                          PRESSURE RESPONSE
                        </div>

                        <div class="hc-alert-primary-value">
                          ${this.signed(event.pressureDelta)}
                          <span>m</span>
                        </div>

                        <div class="hc-alert-primary-meta">
                          Change at the configured disruption junction
                          relative to the baseline hydraulic state.
                        </div>

                      </div>

                      <div class="hc-alert-node-block">

                        <div class="hc-alert-metric-label">
                          AFFECTED JUNCTION
                        </div>

                        <strong class="hc-alert-node-value">
                          ${this.escapeHtml(
                            event.node
                              ? event.node.id
                              : event.scenarioKey
                          )}
                        </strong>

                        <span class="hc-alert-node-caption">
                          Scenario target
                        </span>

                      </div>

                    </div>

                    <div class="hc-alert-detail-grid">

                      <div class="hc-alert-detail">
                        <span>FLOW RESPONSE</span>
                        <strong class="hc-alert-flow-value">
                          ${this.signed(event.flowDelta)} L/s
                        </strong>
                      </div>

                      <div class="hc-alert-detail">
                        <span>AFFECTED LINK</span>
                        <strong>
                          ${event.pipe
                            ? this.escapeHtml(event.pipe.id)
                            : '—'}
                        </strong>
                      </div>

                      <div class="hc-alert-detail">
                        <span>EVENT SOURCE</span>
                        <strong>EPANET / WNTR</strong>
                      </div>

                      <div class="hc-alert-detail">
                        <span>FIELD TELEMETRY</span>
                        <strong>NOT CONNECTED</strong>
                      </div>

                    </div>

                    <div class="hc-alert-footer">

                      <span>
                        ${this.icon('info', 'icon')}
                        MODEL-DERIVED ADVISORY
                      </span>

                      <span>
                        ${this.escapeHtml(event.scenarioKey)} SCENARIO
                      </span>

                    </div>

                  </article>

                `
              ).join('')}

            </div>

            <div class="hc-alert-boundary">

              <div class="hc-alert-boundary-left">
                ${this.icon('shield', 'icon')}
                <strong>MODEL-DERIVED ADVISORY</strong>
              </div>

              <span>
                Scenario output only · live field telemetry is not connected.
              </span>

            </div>

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
          Array.isArray(network.nodes)
            ? network.nodes
            : [];

        const pipes =
          Array.isArray(network.pipes)
            ? network.pipes
            : Array.isArray(network.links)
              ? network.links
              : [];

        const source =
          network.source
            ? 'CONNECTED'
            : 'MODEL';

        const scenario =
          s.scenario || 'baseline';

        const scenarioLabel =
          (
            DigitalTwinView.scenarioLabels &&
            DigitalTwinView.scenarioLabels[scenario]
          ) ||
          scenario.replace(/_/g, ' ').toUpperCase();

        const scenarioStatus =
          s.loading
            ? 'LOADING'
            : s.error
              ? 'ATTENTION'
              : scenario === 'baseline'
                ? 'NORMAL'
                : 'SCENARIO';

        let original;

        try {
          original =
            originalRender();
        } catch (error) {
          original = `
            <div class="hc-dt-state-card">
              <div class="hc-dt-state-icon">
                ${DM.icon('alertCircle', 'icon')}
              </div>
              <h3>Digital Twin Data Unavailable</h3>
              <p>
                ${DM.escapeHtml(error.message)}
              </p>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                onclick="DigitalTwinView.load('${DM.escapeHtml(scenario)}')"
              >
                Retry
              </button>
            </div>
          `;
        }

        return `

          <div class="hc-digital-twin-modern">

            <section class="hc-dt-hero">

              <div class="hc-dt-hero-main">

                <div class="hc-dt-hero-icon">
                  ${DM.icon('map', 'icon')}
                </div>

                <div class="hc-dt-hero-copy">

                  <div class="analytics-section-label">
                    GEOGRAPHIC DIGITAL TWIN
                  </div>

                  <h2>
                    Sadashiv Nagar Digital Twin
                  </h2>

                  <p>
                    Interactive 3D network view combining mapped infrastructure
                    with EPANET/WNTR scenario state.
                  </p>

                </div>

              </div>

              <div class="hc-dt-hero-meta">

                <span class="hc-dt-live-badge">
                  <span></span>
                  ${DM.escapeHtml(scenarioStatus)}
                </span>

                <span class="hc-dt-hero-context">
                  3D TERRAIN · DMA MODEL
                </span>

              </div>

            </section>


            <section class="hc-dt-command">

              <div class="hc-dt-command-copy">

                <div class="analytics-section-label">
                  SCENARIO CONTROL
                </div>

                <strong>
                  ${DM.escapeHtml(scenarioLabel)}
                </strong>

                <span>
                  Change the hydraulic scenario shown on the geographic model.
                </span>

              </div>

              <div class="hc-dt-command-actions">

                ${DM.modernScenarioControls(
                  scenario,
                  'switchDigitalTwinScenario'
                )}

                <button
                  type="button"
                  class="btn btn-secondary btn-sm hc-dt-refresh"
                  onclick="DigitalTwinView.load('${DM.escapeHtml(scenario)}')"
                  title="Reload digital twin network"
                >
                  ${DM.icon('refresh', 'icon')}
                  Refresh
                </button>

              </div>

            </section>


            <section class="hc-dt-kpis">

              <div class="hc-dt-kpi">

                <div class="hc-dt-kpi-label">
                  NETWORK NODES
                </div>

                <div class="hc-dt-kpi-row">
                  <strong>${DM.escapeHtml(String(nodes.length))}</strong>
                  <span class="hc-dt-kpi-icon">
                    ${DM.icon('map', 'icon')}
                  </span>
                </div>

                <span class="hc-dt-kpi-note">
                  Mapped junctions
                </span>

              </div>


              <div class="hc-dt-kpi">

                <div class="hc-dt-kpi-label">
                  NETWORK LINKS
                </div>

                <div class="hc-dt-kpi-row">
                  <strong>${DM.escapeHtml(String(pipes.length))}</strong>
                  <span class="hc-dt-kpi-icon">
                    ${DM.icon('pipeline', 'icon')}
                  </span>
                </div>

                <span class="hc-dt-kpi-note">
                  Mapped hydraulic pipes
                </span>

              </div>


              <div class="hc-dt-kpi">

                <div class="hc-dt-kpi-label">
                  ACTIVE SCENARIO
                </div>

                <div class="hc-dt-kpi-row">
                  <strong class="hc-dt-kpi-scenario">
                    ${DM.escapeHtml(
                      scenario.replace(/_/g, ' ').toUpperCase()
                    )}
                  </strong>
                  <span class="hc-dt-kpi-icon">
                    ${DM.icon('simulate', 'icon')}
                  </span>
                </div>

                <span class="hc-dt-kpi-note">
                  ${DM.escapeHtml(scenarioLabel)}
                </span>

              </div>


              <div class="hc-dt-kpi">

                <div class="hc-dt-kpi-label">
                  MODEL STATUS
                </div>

                <div class="hc-dt-kpi-row">
                  <strong class="${s.error ? 'hc-dt-kpi-error' : ''}">
                    ${DM.escapeHtml(
                      s.loading
                        ? 'LOADING'
                        : source
                    )}
                  </strong>
                  <span class="hc-dt-kpi-icon">
                    ${DM.icon(
                      s.error ? 'alertCircle' : 'activity',
                      'icon'
                    )}
                  </span>
                </div>

                <span class="hc-dt-kpi-note">
                  ${s.error
                    ? 'Model requires attention'
                    : 'Geographic + hydraulic model'}
                </span>

              </div>

            </section>


            <section class="hc-dt-workspace-heading">

              <div>

                <div class="analytics-section-label">
                  SPATIAL HYDRAULIC MODEL
                </div>

                <h3>
                  Geographic Network State
                </h3>

                <p>
                  Inspect the 3D network and select a junction to view its
                  hydraulic state.
                </p>

              </div>

              <span class="hc-dt-scenario-badge">
                ${DM.escapeHtml(
                  scenario.replace(/_/g, ' ').toUpperCase()
                )}
              </span>

            </section>


            <div class="hc-dt-original-wrap">
              ${original}
            </div>


            <div class="hc-dt-source-strip">

              <div class="hc-dt-source-icon">
                ${DM.icon('checkCircle', 'icon')}
              </div>

              <div>
                <strong>
                  DIGITAL TWIN DATA PIPELINE
                </strong>
                <span>
                  Geographic geometry from the project mapping layer ·
                  hydraulic scenario values from EPANET/WNTR.
                </span>
              </div>

              <span class="hc-dt-source-state">
                ${DM.escapeHtml(source)}
              </span>

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


      .hc-alerts-modern {
        width:100%;
      }


      .hc-alert-overview-row {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:18px;
        margin-bottom:14px;
        padding:4px 2px 0;
      }


      .hc-alert-overview-copy {
        min-width:0;
      }


      .hc-alert-refresh {
        flex-shrink:0;
        white-space:nowrap;
      }


      .hc-alert-mode-badge {
        display:flex;
        align-items:center;
        gap:9px;
        flex-shrink:0;
        min-width:190px;
        padding:8px 11px;
        border:1px solid rgba(92,210,255,.10);
        border-radius:8px;
        background:rgba(7,24,43,.58);
      }


      .hc-alert-mode-dot {
        width:7px;
        height:7px;
        flex-shrink:0;
        border-radius:50%;
        background:#83d8ad;
        box-shadow:0 0 9px rgba(131,216,173,.38);
      }


      .hc-alert-mode-badge strong {
        display:block;
        color:#cfe8f7;
        font-family:monospace;
        font-size:8px;
        letter-spacing:.09em;
      }


      .hc-alert-mode-badge span:not(.hc-alert-mode-dot) {
        display:block;
        margin-top:2px;
        color:#536b82;
        font-family:monospace;
        font-size:6px;
        letter-spacing:.06em;
      }


      .hc-alert-summary-grid {
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:10px;
        margin-bottom:22px;
      }


      .hc-alert-summary-card {
        display:flex;
        align-items:center;
        gap:12px;
        min-width:0;
        min-height:78px;
        padding:12px 14px;
        border:1px solid rgba(92,210,255,.09);
        border-radius:10px;
        background:linear-gradient(145deg,rgba(18,48,76,.70),rgba(8,27,48,.84));
      }


      .hc-alert-summary-card.is-warning {
        border-color:rgba(255,184,107,.14);
      }


      .hc-alert-summary-icon {
        display:flex;
        align-items:center;
        justify-content:center;
        width:31px;
        height:31px;
        flex-shrink:0;
        border:1px solid rgba(92,210,255,.11);
        border-radius:8px;
        color:#73d9ff;
        background:rgba(53,208,255,.055);
      }


      .hc-alert-summary-card.is-warning .hc-alert-summary-icon {
        color:#ffbe78;
        border-color:rgba(255,184,107,.16);
        background:rgba(255,184,107,.06);
      }


      .hc-alert-summary-icon .icon {
        width:15px;
        height:15px;
      }


      .hc-alert-summary-copy {
        min-width:0;
      }


      .hc-alert-summary-copy span {
        display:block;
        color:#71869e;
        font-family:monospace;
        font-size:7px;
        font-weight:600;
        letter-spacing:.09em;
      }


      .hc-alert-summary-copy strong {
        display:block;
        margin-top:4px;
        color:#e3f3ff;
        font-family:monospace;
        font-size:21px;
        line-height:1;
      }


      .hc-alert-summary-copy small {
        display:block;
        margin-top:4px;
        overflow:hidden;
        color:#536b82;
        font-size:7px;
        line-height:1.35;
        text-overflow:ellipsis;
        white-space:nowrap;
      }


      .hc-alert-dispatch-heading {
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:14px;
        margin:2px 0 10px;
        padding-top:2px;
      }


      .hc-alert-dispatch-heading h3 {
        margin:4px 0 0;
        color:#dbeafe;
        font-size:14px;
        font-weight:700;
      }


      .hc-alert-dispatch-count {
        flex-shrink:0;
        color:#536b82;
        font-family:monospace;
        font-size:7px;
        letter-spacing:.08em;
      }


      .hc-alert-grid {
        display:grid;
        grid-template-columns:
          repeat(2,minmax(0,1fr));
        gap:14px;
      }


      .hc-alert-card {
        min-width:0;
        padding:0;
        overflow:hidden;
        border-radius:14px;
        border-color:rgba(255,184,107,.13);
        background:
          linear-gradient(
            145deg,
            rgba(14,37,62,.88),
            rgba(7,24,43,.94)
          );
      }


      .hc-alert-event-card {
        transition:
          transform .18s ease,
          border-color .18s ease,
          box-shadow .18s ease;
      }


      .hc-alert-event-card:hover {
        transform:translateY(-2px);
        border-color:rgba(255,184,107,.25);
        box-shadow:
          0 16px 34px rgba(0,0,0,.18);
      }


      .hc-alert-card-top {
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:14px;
        padding:18px 18px 14px;
        border-bottom:
          1px solid
          rgba(255,184,107,.08);
      }


      .hc-alert-title-block {
        min-width:0;
      }


      .hc-alert-eyebrow {
        color:#71869e;
        font-family:monospace;
        font-size:7px;
        letter-spacing:.13em;
      }


      .hc-alert-title {
        margin:6px 0 0;
        color:#e5f3ff;
        font-size:15px;
        font-weight:700;
        line-height:1.2;
      }


      .hc-alert-status-critical {
        color:#ff7777;
        border-color:rgba(239,68,68,.24);
        background:rgba(239,68,68,.08);
      }


      .hc-alert-status-warning {
        color:#ffbe78;
        border-color:rgba(255,184,107,.24);
        background:rgba(255,184,107,.08);
      }


      .hc-alert-status-response {
        color:#9edfff;
        border-color:rgba(92,210,255,.20);
        background:rgba(92,210,255,.07);
      }


      .hc-alert-status-monitor {
        color:#83d8ad;
        border-color:rgba(131,216,173,.20);
        background:rgba(131,216,173,.06);
      }


      .hc-alert-badge {
        flex-shrink:0;
        padding:6px 8px;
        border:
          1px solid
          rgba(255,184,107,.20);
        border-radius:6px;
        color:#ffbe78;
        background:
          rgba(255,184,107,.07);
        font-family:monospace;
        font-size:7px;
        font-weight:700;
        letter-spacing:.09em;
      }


      .hc-alert-primary {
        display:grid;
        grid-template-columns:
          minmax(0,1.15fr)
          minmax(120px,.85fr);
        gap:16px;
        padding:18px;
        border-bottom:
          1px solid
          rgba(92,210,255,.06);
      }


      .hc-alert-primary-block,
      .hc-alert-node-block {
        min-width:0;
      }


      .hc-alert-metric-label {
        color:#71869e;
        font-family:monospace;
        font-size:7px;
        font-weight:600;
        letter-spacing:.10em;
      }


      .hc-alert-primary-value {
        margin-top:7px;
        color:#ffbe78;
        font-family:monospace;
        font-size:30px;
        font-weight:700;
        line-height:1;
        letter-spacing:-.03em;
      }


      .hc-alert-primary-value span {
        margin-left:3px;
        color:#71869e;
        font-size:11px;
        font-weight:500;
        letter-spacing:0;
      }


      .hc-alert-primary-meta {
        margin-top:7px;
        color:#536b82;
        font-size:8px;
        line-height:1.4;
      }


      .hc-alert-node-block {
        padding-left:14px;
        border-left:
          1px solid
          rgba(92,210,255,.07);
      }


      .hc-alert-node-value {
        display:block;
        margin-top:9px;
        color:#dbeafe;
        font-family:monospace;
        font-size:20px;
        font-weight:700;
        line-height:1;
      }


      .hc-alert-node-caption {
        display:block;
        margin-top:7px;
        color:#536b82;
        font-size:8px;
        line-height:1.4;
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
        min-height:58px;
        padding:12px 14px;
        background:
          rgba(7,24,43,.64);
      }


      .hc-alert-detail span {
        display:block;
        color:#536b82;
        font-family:monospace;
        font-size:7px;
        font-weight:600;
        letter-spacing:.08em;
      }


      .hc-alert-detail strong {
        display:block;
        margin-top:5px;
        color:#c5d9e9;
        font-family:monospace;
        font-size:10px;
        font-weight:700;
      }


      .hc-alert-flow-value {
        color:#9edfff !important;
      }


      .hc-alert-footer {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:11px 14px;
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


      .hc-alert-boundary {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin-top:16px;
        padding:9px 12px;
        border:1px solid rgba(92,210,255,.07);
        border-radius:8px;
        background:rgba(7,24,43,.45);
      }


      .hc-alert-boundary-left {
        display:flex;
        align-items:center;
        gap:6px;
        flex-shrink:0;
      }


      .hc-alert-boundary-left .icon {
        width:11px;
        height:11px;
        color:#73d9ff;
      }


      .hc-alert-boundary-left strong {
        color:#8fb2c9;
        font-family:monospace;
        font-size:7px;
        letter-spacing:.08em;
      }


      .hc-alert-boundary > span {
        color:#536b82;
        font-size:7px;
        text-align:right;
      }


      /* ==========================================================
         DIGITAL TWIN VISUAL SYSTEM
         Scoped ONLY to the Digital Twin module.

         The Digital Twin owns its own controls, map, details and
         summary cards. This layer only makes those existing pieces
         visually consistent with the municipal application.
         ========================================================== */

      .hc-digital-twin-modern {
        width:100%;
        box-sizing:border-box;
      }


      .hc-dt-header {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:20px;
        min-height:84px;
        box-sizing:border-box;
        padding:18px 20px;
        border:1px solid rgba(92,210,255,.10);
        border-radius:8px;
        background:rgba(16,43,71,.96);
      }


      .hc-dt-header-left {
        display:flex;
        align-items:center;
        gap:12px;
        min-width:0;
      }


      .hc-dt-header-icon {
        display:flex;
        align-items:center;
        justify-content:center;
        flex:0 0 32px;
        width:32px;
        height:32px;
        box-sizing:border-box;
        border:1px solid rgba(92,210,255,.12);
        border-radius:8px;
        color:#6fdcff;
        background:rgba(53,208,255,.055);
      }


      .hc-dt-header-icon .icon {
        width:15px;
        height:15px;
      }


      .hc-dt-title {
        margin:4px 0 0;
        color:#dbeafe;
        font-size:13px;
        font-weight:600;
        line-height:1.25;
      }


      .hc-dt-subtitle {
        margin:5px 0 0;
        max-width:680px;
        color:#7f94ad;
        font-size:10px;
        line-height:1.45;
      }


      .hc-dt-status {
        flex-shrink:0;
        padding:4px 7px;
        border:1px solid rgba(92,210,255,.12);
        border-radius:5px;
        color:#5ee7ff;
        background:rgba(53,208,255,.045);
        font-family:monospace;
        font-size:8px;
        letter-spacing:.05em;
      }


      .hc-dt-control {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:18px;
        box-sizing:border-box;
        margin:14px 0 0;
        padding:15px 17px;
        border:1px solid rgba(92,210,255,.08);
        border-radius:9px;
        background:linear-gradient(
          145deg,
          rgba(14,37,62,.72),
          rgba(7,24,43,.82)
        );
      }


      .hc-dt-control-copy {
        min-width:0;
      }


      .hc-dt-control-title {
        margin-top:4px;
        color:#dbeafe;
        font-size:13px;
        font-weight:600;
        line-height:1.3;
      }


      .hc-dt-control-copy p {
        margin:5px 0 0;
        max-width:620px;
        color:#71869e;
        font-size:9px;
        line-height:1.5;
      }


      .hc-dt-control-actions {
        display:flex;
        align-items:center;
        justify-content:flex-end;
        gap:8px;
        flex-shrink:0;
        flex-wrap:wrap;
      }


      .hc-dt-refresh {
        display:inline-flex;
        align-items:center;
        gap:6px;
      }


      .hc-dt-refresh .icon {
        width:12px;
        height:12px;
      }


      .hc-dt-kpi-grid {
        display:grid !important;
        grid-template-columns:repeat(4,minmax(0,1fr)) !important;
        gap:10px;
        box-sizing:border-box;
        margin:14px 0 0;
      }


      .hc-dt-kpi-grid .analytics-engine-kpi {
        min-width:0;
      }


      .hc-dt-section-heading {
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:16px;
        margin:20px 0 12px;
      }


      .hc-dt-section-heading h3 {
        margin:4px 0 0;
        color:#dbeafe;
        font-size:13px;
        font-weight:600;
      }


      .hc-dt-section-heading p {
        margin:5px 0 0;
        max-width:680px;
        color:#71869e;
        font-size:9px;
        line-height:1.5;
      }


      .hc-dt-original-wrap {
        width:100%;
      }


      /* The legacy Digital Twin header is replaced by the modern header above. */
      .hc-dt-original-wrap .dt-header-card {
        display:none !important;
      }


      .hc-dt-original-wrap .dt-grid {
        margin-top:0;
      }


      .hc-dt-original-wrap .dash-card {
        border-color:rgba(92,210,255,.08);
        border-radius:9px;
      }


      .hc-dt-original-wrap .dt-map-wrap {
        border-radius:8px;
        overflow:hidden;
      }


      .hc-dt-original-wrap .dt-map-card,
      .hc-dt-original-wrap .dt-detail-card {
        min-width:0;
      }


      .hc-dt-source-strip {
        display:flex;
        align-items:center;
        gap:10px;
        box-sizing:border-box;
        margin-top:14px;
        padding:11px 13px;
        border:1px solid rgba(92,210,255,.08);
        border-radius:8px;
        background:rgba(7,24,43,.55);
      }


      .hc-dt-source-icon {
        display:flex;
        align-items:center;
        justify-content:center;
        flex:0 0 24px;
        width:24px;
        height:24px;
        border:1px solid rgba(92,210,255,.10);
        border-radius:6px;
        color:#73d9ff;
        background:rgba(53,208,255,.045);
      }


      .hc-dt-source-icon .icon {
        width:12px;
        height:12px;
      }


      .hc-dt-source-strip strong {
        display:block;
        color:#a9bfd4;
        font-family:monospace;
        font-size:8px;
        letter-spacing:.05em;
      }


      .hc-dt-source-strip span {
        display:block;
        margin-top:3px;
        color:#536b82;
        font-size:8px;
        line-height:1.45;
      }


      .hc-dt-state-card {
        display:flex;
        align-items:center;
        flex-direction:column;
        justify-content:center;
        min-height:280px;
        box-sizing:border-box;
        padding:28px;
        border:1px solid rgba(92,210,255,.08);
        border-radius:9px;
        background:rgba(7,24,43,.58);
        text-align:center;
      }


      .hc-dt-state-icon {
        display:flex;
        align-items:center;
        justify-content:center;
        width:34px;
        height:34px;
        margin-bottom:12px;
        border:1px solid rgba(239,68,68,.24);
        border-radius:8px;
        color:#ff7b87;
        background:rgba(239,68,68,.05);
      }


      .hc-dt-state-icon .icon {
        width:15px;
        height:15px;
      }


      .hc-dt-state-card h3 {
        margin:0;
        color:#dbeafe;
        font-size:13px;
      }


      .hc-dt-state-card p {
        max-width:560px;
        margin:7px 0 14px;
        color:#71869e;
        font-size:9px;
        line-height:1.5;
      }


      @media (max-width:900px) {

        .hc-digital-twin-modern .dt-header-card {
          align-items:flex-start;
          flex-direction:column;
        }

        .hc-digital-twin-modern .dt-controls {
          width:100%;
          justify-content:flex-start;
        }

        .hc-digital-twin-modern .dt-grid {
          grid-template-columns:1fr;
        }

        .hc-digital-twin-modern .dt-summary-grid {
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

      }


      @media (max-width:900px) {

        .hc-dt-header {
          align-items:flex-start;
          flex-direction:column;
        }

        .hc-dt-control {
          align-items:flex-start;
          flex-direction:column;
        }

        .hc-dt-control-actions {
          width:100%;
          justify-content:flex-start;
        }

        .hc-dt-kpi-grid {
          grid-template-columns:repeat(2,minmax(0,1fr)) !important;
        }

        .hc-dt-section-heading {
          align-items:flex-start;
          flex-direction:column;
        }

      

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

        .hc-alert-summary-grid {
          grid-template-columns:1fr;
        }

        .hc-alert-mode-badge {
          width:100%;
        }

        .hc-alert-overview-row {
          align-items:flex-start;
          flex-direction:column;
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

        .hc-alert-dispatch-heading,
        .hc-alert-boundary {
          align-items:flex-start;
          flex-direction:column;
        }

        .hc-alert-boundary > span {
          text-align:left;
        }

        .hc-alert-node-block {
          padding-left:0;
          padding-top:12px;
          border-left:0;
          border-top:
            1px solid
            rgba(92,210,255,.07);
        }

        .hc-alert-refresh {
          width:100%;
          justify-content:center;
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



    style.textContent += `

      /* ==========================================================
         HYDROCYBERNETICS — SIMULATION VISUAL SYSTEM
         Scoped ONLY to the Hydraulic Simulation module.
         ========================================================== */

      .hc-simulation-modern {
        width: 100%;
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        border: 1px solid rgba(92, 210, 255, .10);
        border-radius: 8px;
        overflow: hidden;
        background:
          linear-gradient(
            145deg,
            #102b47 0%,
            #0d263f 55%,
            #0b2239 100%
          );
        box-shadow:
          0 8px 24px rgba(0, 0, 0, .12);
      }

      .hc-simulation-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        min-height: 84px;
        box-sizing: border-box;
        padding: 18px 20px;
        border-bottom: 1px solid rgba(92, 210, 255, .07);
        background: rgba(16, 43, 71, .96);
      }

      .hc-simulation-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }

      .hc-simulation-header-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 32px;
        width: 32px;
        height: 32px;
        box-sizing: border-box;
        border: 1px solid rgba(92, 210, 255, .12);
        border-radius: 8px;
        color: #6fdcff;
        background: rgba(53, 208, 255, .055);
      }

      .hc-simulation-header-icon .icon {
        width: 15px;
        height: 15px;
      }

      .hc-simulation-title {
        margin: 4px 0 0;
        color: #dbeafe;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.25;
      }

      .hc-simulation-subtitle {
        margin: 5px 0 0;
        max-width: 680px;
        color: #7f94ad;
        font-size: 10px;
        line-height: 1.45;
      }

      .hc-simulation-status {
        flex-shrink: 0;
        padding: 4px 7px;
        border: 1px solid rgba(92, 210, 255, .12);
        border-radius: 5px;
        color: #5ee7ff;
        background: rgba(53, 208, 255, .045);
        font-family: monospace;
        font-size: 8px;
        letter-spacing: .05em;
      }

      .hc-simulation-control {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        box-sizing: border-box;
        margin: 14px 14px 0;
        padding: 15px 17px;
        border: 1px solid rgba(92, 210, 255, .08);
        border-radius: 9px;
        background:
          linear-gradient(
            145deg,
            rgba(14, 37, 62, .72),
            rgba(7, 24, 43, .82)
          );
      }

      .hc-simulation-control-copy {
        min-width: 0;
      }

      .hc-simulation-control-title {
        margin-top: 4px;
        color: #dbeafe;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.3;
      }

      .hc-simulation-control-copy p {
        margin: 5px 0 0;
        max-width: 620px;
        color: #71869e;
        font-size: 9px;
        line-height: 1.5;
      }

      .hc-simulation-control-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        flex-shrink: 0;
        flex-wrap: wrap;
      }

      .hc-simulation-refresh {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .hc-simulation-refresh .icon {
        width: 12px;
        height: 12px;
      }

      .hc-simulation-kpi-grid {
        display: grid !important;
        grid-template-columns:
          repeat(4, minmax(0, 1fr)) !important;
        gap: 10px;
        box-sizing: border-box;
        margin: 14px 14px 0;
      }

      .hc-simulation-kpi-grid .analytics-engine-kpi {
        position: relative;
        min-width: 0;
        min-height: 84px;
        box-sizing: border-box;
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

      .hc-simulation-kpi-grid .analytics-engine-kpi:hover {
        transform: translateY(-2px);
        border-color: rgba(92, 210, 255, .20);
        box-shadow:
          0 14px 34px rgba(0, 0, 0, .16);
      }

      .hc-simulation-kpi-grid .analytics-engine-kpi-label {
        margin: 0;
        font-family: monospace;
        font-size: 8px;
        line-height: 1.25;
        letter-spacing: .08em;
        color: #7f94ad;
      }

      .hc-simulation-kpi-grid .analytics-engine-kpi-value {
        margin-top: 8px;
        font-family: monospace;
        font-size: 21px;
        line-height: 1.05;
        font-weight: 700;
        color: #e2f4ff;
      }

      .hc-simulation-kpi-grid .hc-modern-kpi-unit {
        margin-left: 3px;
        color: #71869e;
        font-family: monospace;
        font-size: 10px;
        font-weight: 500;
      }

      .hc-simulation-kpi-grid .hc-modern-kpi-meta {
        margin-top: 7px;
        color: #71869e;
        font-size: 8px;
        line-height: 1.4;
      }

      .hc-simulation-results-card {
        box-sizing: border-box;
        margin: 22px 14px 0;
        padding: 0 0 14px;
        border: 1px solid rgba(92, 210, 255, .10);
        border-radius: 10px;
        background:
          linear-gradient(145deg, rgba(14, 38, 62, .72), rgba(7, 24, 43, .82));
        overflow: hidden;
      }

      .hc-simulation-section-heading {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 15px;
        box-sizing: border-box;
        margin: 0;
        padding: 16px 16px 13px;
        border-bottom: 1px solid rgba(92, 210, 255, .08);
      }

      .hc-simulation-section-heading h3 {
        margin: 4px 0 0;
        color: #dbeafe;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.3;
      }

      .hc-simulation-section-heading p {
        margin: 4px 0 0;
        max-width: 680px;
        color: #71869e;
        font-size: 9px;
        line-height: 1.5;
      }

      .hc-simulation-results-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 12px;
        box-sizing: border-box;
        margin: 12px 12px 0;
      }

      .hc-simulation-result-panel {
        min-width: 0;
      }

      .hc-simulation-result-panel .analytics-engine-card {
        height: 100%;
        min-width: 0;
        box-sizing: border-box;
        margin: 0;
      }

      .hc-simulation-result-panel .analytics-engine-card-header {
        min-height: 62px;
        box-sizing: border-box;
        padding: 14px 16px 11px;
      }

      .hc-simulation-result-panel .analytics-engine-card-title {
        font-size: 12px;
        line-height: 1.3;
      }

      .hc-simulation-result-panel .analytics-engine-card-subtitle {
        margin-top: 4px;
        font-size: 9px;
        line-height: 1.4;
      }

      .hc-simulation-result-panel .hc-modern-panel-body {
        padding: 14px 16px 16px;
      }

      .hc-simulation-results-grid .table-responsive {
        width: 100%;
        overflow-x: auto;
      }

      .hc-simulation-results-grid .data-table {
        width: 100%;
        table-layout: fixed;
      }

      .hc-simulation-results-grid .data-table th,
      .hc-simulation-results-grid .data-table td {
        padding: 9px 7px;
        line-height: 1.35;
        vertical-align: middle;
      }

      .hc-simulation-results-grid .data-table th {
        font-size: 8px;
        letter-spacing: .06em;
      }

      .hc-simulation-results-grid .data-table td {
        font-size: 9px;
      }

      .hc-simulation-results-grid .data-table th:first-child,
      .hc-simulation-results-grid .data-table td:first-child {
        width: 34%;
      }

      .hc-simulation-results-grid .data-table th:last-child,
      .hc-simulation-results-grid .data-table td:last-child {
        width: 33%;
      }

      .hc-simulation-comparison {
        margin: 12px 14px 0;
      }

      .hc-simulation-comparison .dash-card {
        margin-top: 0 !important;
        margin-bottom: 0 !important;
        border-color: rgba(92, 210, 255, .10);
        border-radius: 9px;
        background:
          linear-gradient(
            145deg,
            rgba(16, 39, 64, .92),
            rgba(8, 25, 45, .96)
          );
      }

      .hc-simulation-comparison .dash-card-header {
        padding: 14px 16px 11px;
      }

      .hc-simulation-comparison .dash-card-body {
        padding: 14px 16px 16px;
      }

      .hc-simulation-source-strip {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        box-sizing: border-box;
        margin: 14px 14px 14px;
        padding: 12px 14px;
        border: 1px solid rgba(92, 210, 255, .08);
        border-radius: 9px;
        background: rgba(7, 24, 43, .55);
      }

      .hc-simulation-source-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 26px;
        width: 26px;
        height: 26px;
        box-sizing: border-box;
        border: 1px solid rgba(92, 210, 255, .10);
        border-radius: 7px;
        color: #6fdcff;
      }

      .hc-simulation-source-icon .icon {
        width: 13px;
        height: 13px;
      }

      .hc-simulation-source-strip strong {
        display: block;
        color: #bfe9ff;
        font-size: 9px;
        line-height: 1.35;
      }

      .hc-simulation-source-strip span {
        display: block;
        margin-top: 3px;
        color: #71869e;
        font-size: 8px;
        line-height: 1.5;
      }

      .hc-simulation-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 310px;
        box-sizing: border-box;
        padding: 40px 24px;
        text-align: center;
      }

      .hc-simulation-state-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        margin-bottom: 12px;
        border: 1px solid rgba(92, 210, 255, .12);
        border-radius: 9px;
        color: #6fdcff;
        background: rgba(53, 208, 255, .055);
      }

      .hc-simulation-state-icon .icon {
        width: 17px;
        height: 17px;
      }

      .hc-simulation-state h3 {
        margin: 6px 0 0;
        color: #dbeafe;
        font-size: 14px;
      }

      .hc-simulation-state p {
        margin: 6px 0 0;
        color: #71869e;
        font-size: 9px;
        line-height: 1.5;
      }

      @media (max-width: 1000px) {

        .hc-simulation-kpi-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr)) !important;
        }

        .hc-simulation-results-grid {
          grid-template-columns: 1fr;
        }

      }

      @media (max-width: 720px) {

        .hc-simulation-header,
        .hc-simulation-control,
        .hc-simulation-results-card {
          margin-top: 16px;
        }

        .hc-simulation-section-heading {
          align-items: flex-start;
          flex-direction: column;
        }

        .hc-simulation-control-actions {
          width: 100%;
          justify-content: flex-start;
        }

        .hc-simulation-status {
          align-self: flex-start;
        }

      }

      @media (max-width: 620px) {

        .hc-simulation-kpi-grid {
          grid-template-columns: 1fr !important;
        }

        .hc-simulation-header {
          padding: 16px;
        }

        .hc-simulation-control {
          margin-left: 10px;
          margin-right: 10px;
        }

        .hc-simulation-kpi-grid,
        .hc-simulation-results-grid {
          margin-left: 10px;
          margin-right: 10px;
        }

        .hc-simulation-section-heading {
          margin-left: 10px;
          margin-right: 10px;
        }

        .hc-simulation-comparison,
        .hc-simulation-source-strip {
          margin-left: 10px;
          margin-right: 10px;
        }

      }

      .hc-leak-modern {
        width:100%;
      }

      /* Match the finalized Alerts shell exactly: use the shared
         dash-card surface instead of layering a second translucent
         blue background over it. */
      .hc-leak-shell {
        width:100%;
        margin:0;
        overflow:hidden;
        background:var(--bg-card,#10233b);
        border:1px solid var(--border-subtle,rgba(255,255,255,.08));
        border-radius:var(--radius-lg,8px);
        box-shadow:var(--shadow-card,0 2px 8px rgba(0,0,0,.35));
      }

      .hc-leak-shell-header {
        min-height:68px;
      }

      .hc-leak-shell-header .icon-box {
        color:#73d9ff;
        border-color:rgba(92,210,255,.12);
        background:rgba(53,208,255,.055);
      }

      .hc-leak-shell-mode {
        display:flex;
        align-items:center;
        gap:9px;
        flex-shrink:0;
        min-width:205px;
        padding:8px 11px;
        border:1px solid rgba(92,210,255,.10);
        border-radius:8px;
        background:rgba(7,24,43,.58);
      }

      .hc-leak-shell-mode strong {
        display:block;
        color:#cfe8f7;
        font-family:monospace;
        font-size:8px;
        letter-spacing:.09em;
      }

      .hc-leak-shell-mode span:not(.hc-leak-mode-dot) {
        display:block;
        margin-top:2px;
        color:#536b82;
        font-family:monospace;
        font-size:6px;
        letter-spacing:.06em;
      }

      .hc-leak-shell-body {
        padding:0;
        background:transparent;
      }

      .hc-leak-toolbar {
        align-items:center;
        width:100%;
        box-sizing:border-box;
        margin:0 0 18px;
        padding:18px 18px 14px;
      }

      .hc-leak-toolbar-copy {
        min-width:0;
      }

      .hc-leak-toolbar-right {
        display:flex;
        align-items:center;
        justify-content:flex-end;
        gap:9px;
        flex-shrink:0;
      }

      .hc-leak-mode-badge {
        display:flex;
        align-items:center;
        gap:9px;
        min-width:150px;
        padding:8px 11px;
        border:1px solid rgba(92,210,255,.10);
        border-radius:8px;
        background:rgba(7,24,43,.58);
      }

      .hc-leak-mode-dot {
        width:7px;
        height:7px;
        flex-shrink:0;
        border-radius:50%;
        background:#83d8ad;
        box-shadow:0 0 9px rgba(131,216,173,.38);
      }

      .hc-leak-mode-badge strong {
        display:block;
        color:#cfe8f7;
        font-family:monospace;
        font-size:8px;
        letter-spacing:.09em;
      }

      .hc-leak-mode-badge span:not(.hc-leak-mode-dot) {
        display:block;
        margin-top:2px;
        color:#536b82;
        font-family:monospace;
        font-size:6px;
        letter-spacing:.06em;
      }

      .hc-leak-summary-grid {
        display:grid;
        width:100%;
        max-width:100%;
        box-sizing:border-box;
        padding:0;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:12px;
        margin:0 0 22px;
      }

      .hc-leak-summary-card {
        display:flex;
        width:100%;
        max-width:100%;
        box-sizing:border-box;
        align-items:center;
        gap:12px;
        min-width:0;
        min-height:78px;
        padding:12px 14px;
        border:1px solid rgba(92,210,255,.09);
        border-radius:10px;
        background:linear-gradient(145deg,rgba(18,48,76,.70),rgba(8,27,48,.84));
      }

      .hc-leak-summary-card.is-warning {
        border-color:rgba(255,184,107,.14);
      }

      .hc-leak-summary-icon {
        display:flex;
        align-items:center;
        justify-content:center;
        width:31px;
        height:31px;
        flex-shrink:0;
        border:1px solid rgba(92,210,255,.11);
        border-radius:8px;
        color:#73d9ff;
        background:rgba(53,208,255,.055);
      }

      .hc-leak-summary-card.is-warning .hc-leak-summary-icon {
        color:#ffbe78;
        border-color:rgba(255,184,107,.16);
        background:rgba(255,184,107,.06);
      }

      .hc-leak-summary-icon .icon {
        width:15px;
        height:15px;
      }

      .hc-leak-summary-copy {
        min-width:0;
        max-width:100%;
        overflow:hidden;
      }

      .hc-leak-summary-copy > span {
        display:block;
        color:#71869e;
        font-family:monospace;
        font-size:7px;
        font-weight:600;
        letter-spacing:.09em;
      }

      .hc-leak-summary-copy > strong {
        display:block;
        margin-top:4px;
        color:#e3f3ff;
        font-family:monospace;
        font-size:21px;
        line-height:1;
        white-space:nowrap;
      }

      .hc-leak-summary-copy > strong small {
        margin-left:3px;
        color:#71869e;
        font-size:9px;
        font-weight:600;
      }

      .hc-leak-summary-copy > small {
        display:block;
        margin-top:4px;
        overflow:hidden;
        color:#536b82;
        font-size:7px;
        line-height:1.35;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .hc-leak-dispatch-heading {
        display:flex;
        padding-left:18px;
        padding-right:18px;
        align-items:flex-end;
        justify-content:space-between;
        gap:14px;
        margin:2px 0 10px;
        padding-top:2px;
      }

      .hc-leak-dispatch-heading h3 {
        margin:4px 0 0;
        color:#dbeafe;
        font-size:14px;
        font-weight:700;
      }

      .hc-leak-dispatch-heading p {
        margin:4px 0 0;
        max-width:680px;
        color:#71869e;
        font-size:9px;
        line-height:1.5;
      }

      .hc-leak-dispatch-count {
        flex-shrink:0;
        color:#536b82;
        font-family:monospace;
        font-size:7px;
        letter-spacing:.08em;
      }

      .hc-leak-analysis-grid {
        width:100%;
        max-width:100%;
        box-sizing:border-box;
        gap:14px;
        padding:0 18px;
      }

      .hc-leak-residual-panel {
        min-width:0;
        overflow:hidden;
        border:1px solid rgba(92,210,255,.08);
        border-radius:9px;
        background:#0e1e33;
      }

      .hc-leak-residual-header {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        min-height:72px;
        padding:12px 14px;
        border-bottom:1px solid rgba(92,210,255,.07);
      }

      .hc-leak-residual-title-wrap {
        display:flex;
        align-items:center;
        gap:11px;
        min-width:0;
      }

      .hc-leak-residual-icon {
        display:flex;
        align-items:center;
        justify-content:center;
        width:31px;
        height:31px;
        flex:0 0 31px;
        border:1px solid rgba(53,208,255,.14);
        border-radius:8px;
        color:#73d9ff;
        background:rgba(53,208,255,.055);
      }

      .hc-leak-residual-icon .icon {
        width:15px;
        height:15px;
      }

      .hc-leak-residual-heading {
        min-width:0;
      }

      .hc-leak-residual-eyebrow {
        color:#71869e;
        font-family:monospace;
        font-size:7px;
        font-weight:600;
        letter-spacing:.09em;
      }

      .hc-leak-residual-heading h3 {
        margin:3px 0 0;
        color:#dbeafe;
        font-size:14px;
        line-height:1.2;
        font-weight:700;
      }

      .hc-leak-residual-heading p {
        margin:3px 0 0;
        color:#61788f;
        font-size:8px;
        line-height:1.4;
      }

      .hc-leak-residual-badge {
        flex-shrink:0;
        padding:6px 8px;
        border:1px solid rgba(92,210,255,.09);
        border-radius:6px;
        color:#7ea0b9;
        background:rgba(7,24,43,.45);
        font-family:monospace;
        font-size:7px;
        letter-spacing:.08em;
      }

      .hc-leak-residual-body {
        padding:12px 14px 14px;
      }

      .hc-leak-boundary {
        margin:16px 18px 0;
      }

      @media (max-width:1050px) {
        .hc-leak-summary-grid {
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .hc-leak-toolbar-right {
          align-items:flex-end;
          flex-direction:column;
        }
      }

      @media (max-width:760px) {
        .hc-leak-shell-mode {
          width:100%;
          min-width:0;
        }

        .hc-leak-shell-body {
          padding:0;
        }

        .hc-leak-toolbar,
        .hc-leak-summary-grid,
        .hc-leak-dispatch-heading,
        .hc-leak-analysis-grid {
          padding-left:14px;
          padding-right:14px;
        }

        .hc-leak-boundary {
          margin-left:14px;
          margin-right:14px;
        }

        .hc-leak-toolbar {
          align-items:flex-start;
          flex-direction:column;
        }

        .hc-leak-toolbar-right {
          width:100%;
          align-items:stretch;
        }

        .hc-leak-mode-badge {
          width:100%;
        }

        .hc-leak-summary-grid {
          grid-template-columns:1fr;
        }

        .hc-leak-dispatch-heading {
          align-items:flex-start;
          flex-direction:column;
        }
      }

    `;

    document.head.appendChild(
      style
    );

  }


  /* ==========================================================
     DIGITAL TWIN — CLEAN UI POLISH
     Presentation-only overrides. No data/API behavior changed.
     ========================================================== */

  const digitalTwinPolishStyle =
    document.createElement('style');

  digitalTwinPolishStyle.id =
    'hydro-digital-twin-clean-polish';

  digitalTwinPolishStyle.textContent = `

    .hc-digital-twin-modern {
      width:100%;
      box-sizing:border-box;
      margin:0;
      padding:0;
      border:1px solid rgba(92,210,255,.10);
      border-radius:8px;
      overflow:hidden;
      background:
        linear-gradient(
          145deg,
          #102b47 0%,
          #0d263f 55%,
          #0b2239 100%
        );
      box-shadow:
        0 8px 24px rgba(0,0,0,.12);
    }

    /* Compact hero — same visual density as the other municipal modules. */
    .hc-digital-twin-modern .hc-dt-hero {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:20px;
      min-height:84px;
      margin:0;
      padding:18px 20px;
      box-sizing:border-box;
      border:0;
      border-bottom:1px solid rgba(92,210,255,.07);
      border-radius:0;
      background:rgba(16,43,71,.96);
    }

    .hc-digital-twin-modern .hc-dt-hero-main {
      display:flex;
      align-items:center;
      gap:12px;
      min-width:0;
    }

    .hc-digital-twin-modern .hc-dt-hero-icon {
      display:flex;
      align-items:center;
      justify-content:center;
      flex:0 0 36px;
      width:36px;
      height:36px;
      box-sizing:border-box;
      border:1px solid rgba(92,210,255,.14);
      border-radius:8px;
      color:#6fe0ff;
      background:rgba(53,208,255,.055);
    }

    .hc-digital-twin-modern .hc-dt-hero-icon .icon {
      width:17px;
      height:17px;
    }

    .hc-digital-twin-modern .hc-dt-hero-copy {
      min-width:0;
    }

    .hc-digital-twin-modern .hc-dt-hero-copy h2 {
      margin:4px 0 0;
      color:#e1f0fb;
      font-size:15px;
      font-weight:700;
      line-height:1.2;
    }

    .hc-digital-twin-modern .hc-dt-hero-copy p {
      margin:5px 0 0;
      color:#71869e;
      font-size:9px;
      line-height:1.45;
    }

    .hc-digital-twin-modern .hc-dt-hero-meta {
      display:flex;
      align-items:center;
      justify-content:flex-end;
      gap:9px;
      flex-shrink:0;
    }

    .hc-digital-twin-modern .hc-dt-live-badge {
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:5px 8px;
      border:1px solid rgba(53,208,255,.13);
      border-radius:6px;
      color:#70dfff;
      background:rgba(53,208,255,.045);
      font-family:monospace;
      font-size:7px;
      font-weight:700;
      letter-spacing:.08em;
    }

    .hc-digital-twin-modern .hc-dt-live-badge > span {
      width:5px;
      height:5px;
      border-radius:50%;
      background:#35d0ff;
      box-shadow:0 0 7px rgba(53,208,255,.55);
    }

    .hc-digital-twin-modern .hc-dt-hero-context {
      color:#536b82;
      font-family:monospace;
      font-size:7px;
      letter-spacing:.08em;
      white-space:nowrap;
    }

    /* One clean command row instead of a large floating control block. */
    .hc-digital-twin-modern .hc-dt-command {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:18px;
      min-height:68px;
      margin:14px 14px 0;
      padding:15px 17px;
      box-sizing:border-box;
      border:1px solid rgba(92,210,255,.08);
      border-radius:8px;
      background:
        linear-gradient(
          145deg,
          rgba(14,37,62,.72),
          rgba(7,24,43,.82)
        );
    }

    .hc-digital-twin-modern .hc-dt-command-copy {
      min-width:0;
    }

    .hc-digital-twin-modern .hc-dt-command-copy strong {
      display:block;
      margin-top:4px;
      color:#dbeafe;
      font-size:12px;
      font-weight:650;
      line-height:1.2;
    }

    .hc-digital-twin-modern .hc-dt-command-copy > span {
      display:block;
      margin-top:4px;
      color:#5e748b;
      font-size:8px;
      line-height:1.35;
    }

    .hc-digital-twin-modern .hc-dt-command-actions {
      display:flex;
      align-items:center;
      justify-content:flex-end;
      gap:7px;
      flex-shrink:0;
    }

    .hc-digital-twin-modern .hc-dt-command-actions .hc-modern-scenario-group {
      display:flex;
      align-items:center;
      gap:3px;
      padding:3px;
      border:1px solid rgba(92,210,255,.08);
      border-radius:7px;
      background:rgba(5,20,35,.72);
    }

    .hc-digital-twin-modern .hc-dt-command-actions .analytics-scenario-btn {
      min-height:29px;
      padding:0 10px;
      border-radius:5px;
      font-size:8px;
    }

    .hc-digital-twin-modern .hc-dt-refresh {
      min-height:35px;
      padding-left:11px;
      padding-right:11px;
      border-radius:6px;
    }

    /* Explicit KPI cards keep Digital Twin visually aligned with Simulation/Alerts. */
    .hc-digital-twin-modern .hc-dt-kpis {
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:10px;
      margin:14px 14px 0;
    }

    .hc-digital-twin-modern .hc-dt-kpi {
      position:relative;
      min-width:0;
      min-height:84px;
      padding:14px 15px;
      box-sizing:border-box;
      overflow:hidden;
      border:1px solid rgba(92,210,255,.10);
      border-radius:9px;
      background:
        linear-gradient(
          145deg,
          rgba(18,48,76,.82),
          rgba(8,27,48,.88)
        );
      transition:
        transform .18s ease,
        border-color .18s ease,
        box-shadow .18s ease;
    }

    .hc-digital-twin-modern .hc-dt-kpi:hover {
      transform:translateY(-2px);
      border-color:rgba(92,210,255,.20);
      box-shadow:
        0 14px 34px rgba(0,0,0,.16);
    }

    .hc-digital-twin-modern .hc-dt-kpi::after {
      content:'';
      position:absolute;
      right:-24px;
      bottom:-28px;
      width:72px;
      height:72px;
      border-radius:50%;
      background:rgba(53,208,255,.035);
      pointer-events:none;
    }

    .hc-digital-twin-modern .hc-dt-kpi-label {
      color:#71869e;
      font-family:monospace;
      font-size:7px;
      font-weight:600;
      letter-spacing:.10em;
    }

    .hc-digital-twin-modern .hc-dt-kpi-row {
      position:relative;
      z-index:1;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      margin-top:7px;
    }

    .hc-digital-twin-modern .hc-dt-kpi-row strong {
      min-width:0;
      color:#e2f4ff;
      font-family:monospace;
      font-size:21px;
      font-weight:700;
      line-height:1;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }

    .hc-digital-twin-modern .hc-dt-kpi-row strong.hc-dt-kpi-scenario {
      font-size:11px;
    }

    .hc-digital-twin-modern .hc-dt-kpi-row strong.hc-dt-kpi-error {
      color:#ff8c96;
    }

    .hc-digital-twin-modern .hc-dt-kpi-icon {
      display:flex;
      align-items:center;
      justify-content:center;
      flex:0 0 27px;
      width:27px;
      height:27px;
      box-sizing:border-box;
      border:1px solid rgba(92,210,255,.10);
      border-radius:7px;
      color:#6fdcff;
      background:rgba(53,208,255,.055);
    }

    .hc-digital-twin-modern .hc-dt-kpi-icon .icon {
      width:14px;
      height:14px;
    }

    .hc-digital-twin-modern .hc-dt-kpi-note {
      display:block;
      position:relative;
      z-index:1;
      margin-top:6px;
      color:#536b82;
      font-size:7px;
      line-height:1.25;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }

    /* Keep the workspace heading tight; the map should be the visual focus. */
    .hc-digital-twin-modern .hc-dt-workspace-heading {
      display:flex;
      align-items:flex-end;
      justify-content:space-between;
      gap:16px;
      margin:22px 14px 9px;
    }

    .hc-digital-twin-modern .hc-dt-workspace-heading h3 {
      margin:3px 0 0;
      color:#dbeafe;
      font-size:12px;
      font-weight:650;
      line-height:1.2;
    }

    .hc-digital-twin-modern .hc-dt-workspace-heading p {
      margin:4px 0 0;
      color:#5e748b;
      font-size:8px;
      line-height:1.35;
    }

    .hc-digital-twin-modern .hc-dt-scenario-badge {
      flex-shrink:0;
      padding:5px 8px;
      border:1px solid rgba(92,210,255,.09);
      border-radius:5px;
      color:#6d879f;
      background:rgba(7,24,43,.55);
      font-family:monospace;
      font-size:7px;
      letter-spacing:.07em;
    }

    /* Existing Cesium/map content: cleaner cards, stronger map hierarchy. */
    .hc-digital-twin-modern .hc-dt-original-wrap {
      width:auto;
      margin:0 14px;
    }

    .hc-digital-twin-modern .hc-dt-original-wrap .dt-grid {
      grid-template-columns:minmax(0,1.72fr) minmax(285px,.78fr);
      gap:10px;
      margin:0;
    }

    .hc-digital-twin-modern .hc-dt-original-wrap .dt-map-card,
    .hc-digital-twin-modern .hc-dt-original-wrap .dt-detail-card {
      border:1px solid rgba(92,210,255,.085);
      border-radius:8px;
      background:linear-gradient(145deg,rgba(12,34,56,.92),rgba(7,24,43,.96));
      box-shadow:0 8px 22px rgba(0,0,0,.10);
    }

    .hc-digital-twin-modern .hc-dt-original-wrap .dt-map-card .dash-card-header,
    .hc-digital-twin-modern .hc-dt-original-wrap .dt-detail-card .dash-card-header {
      min-height:54px;
      padding:11px 13px;
      border-bottom:1px solid rgba(92,210,255,.065);
    }

    .hc-digital-twin-modern .hc-dt-original-wrap .dt-map-card .dash-card-title,
    .hc-digital-twin-modern .hc-dt-original-wrap .dt-detail-card .dash-card-title {
      font-size:12px;
    }

    .hc-digital-twin-modern .hc-dt-original-wrap .dt-map-card .dash-card-subtitle,
    .hc-digital-twin-modern .hc-dt-original-wrap .dt-detail-card .dash-card-subtitle {
      margin-top:3px;
      font-size:8px;
    }

    .hc-digital-twin-modern .hc-dt-original-wrap .dt-map-wrap,
    .hc-digital-twin-modern .hc-dt-original-wrap .dt-map {
      min-height:455px;
    }

    .hc-digital-twin-modern .hc-dt-original-wrap .dt-map-wrap {
      border-radius:0;
      border-top:0;
      border-bottom:1px solid rgba(92,210,255,.06);
    }

    .hc-digital-twin-modern .hc-dt-original-wrap .dt-detail-card .dash-card-body {
      min-height:455px;
      padding:13px;
    }

    .hc-digital-twin-modern .hc-dt-source-strip {
      margin-top:10px;
      padding:9px 11px;
      border-radius:7px;
    }

    .hc-digital-twin-modern .hc-dt-source-state {
      margin-left:auto;
      flex-shrink:0;
      color:#61d9f7;
      font-family:monospace;
      font-size:7px;
      letter-spacing:.06em;
    }

    @media (max-width:1050px) {
      .hc-digital-twin-modern .hc-dt-kpis {
        grid-template-columns:repeat(2,minmax(0,1fr));
      }

      .hc-digital-twin-modern .hc-dt-command {
        align-items:flex-start;
        flex-direction:column;
      }

      .hc-digital-twin-modern .hc-dt-command-actions {
        width:100%;
        justify-content:flex-start;
      }
    }

    @media (max-width:760px) {
      .hc-digital-twin-modern .hc-dt-hero {
        align-items:flex-start;
        flex-direction:column;
      }

      .hc-digital-twin-modern .hc-dt-hero-meta {
        width:100%;
        justify-content:flex-start;
      }

      .hc-digital-twin-modern .hc-dt-command-actions {
        align-items:stretch;
        flex-direction:column;
      }

      .hc-digital-twin-modern .hc-dt-command-actions .hc-modern-scenario-group {
        width:100%;
      }

      .hc-digital-twin-modern .hc-dt-command-actions .analytics-scenario-btn {
        flex:1;
      }

      .hc-digital-twin-modern .hc-dt-refresh {
        width:100%;
        justify-content:center;
      }

      .hc-digital-twin-modern .hc-dt-workspace-heading {
        align-items:flex-start;
        flex-direction:column;
      }

      .hc-digital-twin-modern .hc-dt-original-wrap .dt-grid {
        grid-template-columns:1fr;
      }

      .hc-digital-twin-modern .hc-dt-original-wrap .dt-map-wrap,
      .hc-digital-twin-modern .hc-dt-original-wrap .dt-map,
      .hc-digital-twin-modern .hc-dt-original-wrap .dt-detail-card .dash-card-body {
        min-height:380px;
      }
    }

    @media (max-width:520px) {
      .hc-digital-twin-modern .hc-dt-kpis {
        grid-template-columns:1fr;
      }

      .hc-digital-twin-modern .hc-dt-hero-context {
        display:none;
      }
    }
  `;

  document.head.appendChild(
    digitalTwinPolishStyle
  );


  console.log(
    'HydroCybernetics: modern municipal UI layer installed.'
  );

})();
