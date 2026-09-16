/**
 * Landing Page View Builder
 * Renders Hero, Portals, How It Works (Monitor, Simulate, Analyze, Respond), and System Capabilities.
 * 
 * Note: Uses technically honest, conceptual language without internal tool names
 * or exposing specific research/study area implementations.
 */

const LandingView = {
  render: () => `
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="container">
        <div class="hero-grid">
          
          <div class="hero-content">
            <div class="hero-badge">
              <span class="hero-badge-dot"></span>
              Urban Water Digital Twin Platform
            </div>

            <h1 class="hero-headline">
              Digital Intelligence for Urban Water Networks
            </h1>

            <p class="hero-supporting">
              Monitor network conditions, simulate hydraulic scenarios and understand leakage impacts through a unified digital twin.
            </p>

            <div class="hero-cta-group">
              <a href="#/municipal/login" class="btn btn-primary btn-lg" data-route="/municipal/login">
                ${Icons.municipal('icon')}
                <span>Municipal Portal</span>
              </a>
              <a href="#/citizen/login" class="btn btn-secondary btn-lg" data-route="/citizen/login">
                ${Icons.citizen('icon')}
                <span>Citizen Portal</span>
              </a>
            </div>
          </div>

          <div class="hero-visual">
            <div class="network-visual-container">
              <div class="visual-overlay-header">
                <div class="visual-status-pill">
                  <span class="visual-status-dot"></span>
                  <span>PLATFORM FRAMEWORK</span>
                </div>
                <div class="visual-mode-tag">CYBER-PHYSICAL ARCHITECTURE</div>
              </div>

              <canvas id="hero-network-canvas" class="network-canvas"></canvas>

              <div class="visual-overlay-footer">
                <div class="visual-telemetry-item">
                  <span>PHYSICAL → TWIN → SIMULATION → DECISION</span>
                </div>
                <div class="visual-telemetry-item">
                  <span>4-TIER ARCHITECTURE</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- Two Portal Entry Points Section -->
    <section class="portals-section" id="portals">
      <div class="container">
        <div class="section-header">
          <div class="section-eyebrow">Integrated Access Gateways</div>
          <h2 class="section-title">Dedicated Portals for Utility Operations & Public Transparency</h2>
          <p class="section-desc">
            HydroCybernetics provides a unified digital framework combining hydraulic modeling and network monitoring for municipal engineers while supporting transparent service communication and reporting for the community.
          </p>
        </div>

        <div class="portals-grid">
          
          <!-- Citizen Portal Card -->
          <div class="portal-card">
            <div>
              <div class="portal-card-header">
                <div class="icon-box icon-box-lg">
                  ${Icons.citizen('icon')}
                </div>
                <span class="portal-tag">Public Access</span>
              </div>

              <h3 class="portal-title">Citizen Water Portal</h3>
              <p class="portal-description">
                Designed to empower communities with transparent water supply schedules, neighborhood service advisories, and direct issue reporting.
              </p>

              <ul class="portal-features-list">
                <li class="portal-feature-item">
                  ${Icons.check('icon')}
                  <span>Water supply schedule and distribution advisories</span>
                </li>
                <li class="portal-feature-item">
                  ${Icons.check('icon')}
                  <span>Neighborhood service status and pressure zone information</span>
                </li>
                <li class="portal-feature-item">
                  ${Icons.check('icon')}
                  <span>Direct incident and leak reporting interface</span>
                </li>
                <li class="portal-feature-item">
                  ${Icons.check('icon')}
                  <span>Track reported issue progress and resolution status</span>
                </li>
              </ul>
            </div>

            <div class="portal-card-footer">
              <a href="#/citizen/login" class="btn btn-secondary" data-route="/citizen/login">
                <span>Enter Citizen Portal</span>
                ${Icons.arrowRight('icon')}
              </a>
            </div>
          </div>

          <!-- Municipal Portal Card -->
          <div class="portal-card">
            <div>
              <div class="portal-card-header">
                <div class="icon-box icon-box-lg">
                  ${Icons.municipal('icon')}
                </div>
                <span class="portal-tag">Engineering Operations</span>
              </div>

              <h3 class="portal-title">Municipal Operations Portal</h3>
              <p class="portal-description">
                Provides operational visibility, hydraulic scenario simulation, leakage analysis framework, and decision support for utility engineers.
              </p>

              <ul class="portal-features-list">
                <li class="portal-feature-item">
                  ${Icons.check('icon')}
                  <span>Interactive Geographic Digital Twin with pipeline topology</span>
                </li>
                <li class="portal-feature-item">
                  ${Icons.check('icon')}
                  <span>Physics-based hydraulic simulation & scenario modeling</span>
                </li>
                <li class="portal-feature-item">
                  ${Icons.check('icon')}
                  <span>Framework for leakage analysis and anomaly localization</span>
                </li>
                <li class="portal-feature-item">
                  ${Icons.check('icon')}
                  <span>Sensor data integration, operational analytics & advisory alerts</span>
                </li>
              </ul>
            </div>

            <div class="portal-card-footer">
              <a href="#/municipal/login" class="btn btn-primary" data-route="/municipal/login">
                <span>Enter Municipal Portal</span>
                ${Icons.arrowRight('icon')}
              </a>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- How It Works Section: 4 Core Pillars -->
    <section class="workflow-section" id="how-it-works">
      <div class="container">
        <div class="section-header">
          <div class="section-eyebrow">Platform Framework</div>
          <h2 class="section-title">How HydroCybernetics Works</h2>
          <p class="section-desc">
            A structured cyber-physical framework bridging physical water network telemetry with physics-based digital twins.
          </p>
        </div>

        <div class="workflow-grid">
          
          <!-- Step 1: Monitor -->
          <div class="workflow-card">
            <span class="workflow-step-num">01</span>
            <div class="workflow-icon-wrap">
              <div class="icon-box">
                ${Icons.monitor('icon')}
              </div>
            </div>
            <h3 class="workflow-card-title">Monitor</h3>
            <p class="workflow-card-desc">
              Designed to integrate sensor data across distribution zones, monitoring pressure transducers, flow meters, and storage tank levels.
            </p>
          </div>

          <!-- Step 2: Simulate -->
          <div class="workflow-card">
            <span class="workflow-step-num">02</span>
            <div class="workflow-icon-wrap">
              <div class="icon-box">
                ${Icons.simulate('icon')}
              </div>
            </div>
            <h3 class="workflow-card-title">Simulate</h3>
            <p class="workflow-card-desc">
              Hydraulic modeling evaluates expected nodal pressure heads, link velocities, and head losses across the distribution network.
            </p>
          </div>

          <!-- Step 3: Analyze -->
          <div class="workflow-card">
            <span class="workflow-step-num">03</span>
            <div class="workflow-icon-wrap">
              <div class="icon-box">
                ${Icons.analyze('icon')}
              </div>
            </div>
            <h3 class="workflow-card-title">Analyze</h3>
            <p class="workflow-card-desc">
              Enables comparative analysis between simulated baseline states and observed sensor readings to assist in anomaly and leak identification.
            </p>
          </div>

          <!-- Step 4: Respond -->
          <div class="workflow-card">
            <span class="workflow-step-num">04</span>
            <div class="workflow-icon-wrap">
              <div class="icon-box">
                ${Icons.respond('icon')}
              </div>
            </div>
            <h3 class="workflow-card-title">Respond</h3>
            <p class="workflow-card-desc">
              Provides decision-support guidance for valve operations, maintenance team dispatching, and community notifications.
            </p>
          </div>

        </div>
      </div>
    </section>

    <!-- Platform Capabilities Section -->
    <section class="highlights-section" id="about">
      <div class="container">
        <div class="section-header">
          <div class="section-eyebrow">Platform Capabilities</div>
          <h2 class="section-title">Engineered for Urban Water Resilience</h2>
          <p class="section-desc">
            Built to support municipal water boards, utility operators, and civil infrastructure engineers.
          </p>
        </div>

        <div class="highlights-grid">
          
          <div class="highlight-card">
            <div class="icon-box">
              ${Icons.map('icon')}
            </div>
            <h3 class="highlight-card-title">Geographic Digital Twin</h3>
            <p class="highlight-card-desc">
              Interactive geospatial mapping framework combining pipeline geometries, junction elevations, and hydraulic attributes.
            </p>
          </div>

          <div class="highlight-card">
            <div class="icon-box">
              ${Icons.chart('icon')}
            </div>
            <h3 class="highlight-card-title">Hydraulic Analytics & Dashboards</h3>
            <p class="highlight-card-desc">
              Supports telemetry dashboards for multi-scenario comparative analysis, consumption profiling, and hydraulic auditing.
            </p>
          </div>

          <div class="highlight-card">
            <div class="icon-box">
              ${Icons.database('icon')}
            </div>
            <h3 class="highlight-card-title">Unified Data Architecture</h3>
            <p class="highlight-card-desc">
              Combines hydraulic simulation datasets with sensor data pipelines for structured engineering analysis.
            </p>
          </div>

        </div>
      </div>
    </section>
  `,

  init: () => {
    const canvasElement = document.getElementById('hero-network-canvas');
    if (canvasElement) {
      if (window.currentNetworkCanvas) {
        window.currentNetworkCanvas.stop();
      }
      window.currentNetworkCanvas = new PlatformVisual(canvasElement);
    }
  }
};

window.LandingView = LandingView;
