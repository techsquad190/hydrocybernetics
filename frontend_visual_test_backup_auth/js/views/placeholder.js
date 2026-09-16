/**
 * Modular Placeholder View
 * Standardized, professional view for upcoming HydroCybernetics modules.
 * Note: Does not generate fake data, fake charts, or fake authentication.
 */

const PlaceholderView = {
  render: (routePath) => {
    const moduleDef = (window.CONFIG && window.CONFIG.MODULE_DEFINITIONS && window.CONFIG.MODULE_DEFINITIONS[routePath]) || {
      title: 'Module Under Development',
      tag: 'SYSTEM_MODULE_PENDING',
      category: 'HydroCybernetics Platform',
      description: 'This architectural component will be introduced in subsequent implementation phases.',
      plannedCapabilities: [
        'Component integration and REST API bindings',
        'State management and data layer reconciliation'
      ]
    };

    let iconHtml = Icons.municipal('icon');
    if (routePath.includes('citizen')) iconHtml = Icons.citizen('icon');
    if (routePath.includes('digital-twin')) iconHtml = Icons.map('icon');
    if (routePath.includes('simulation')) iconHtml = Icons.simulate('icon');
    if (routePath.includes('leak')) iconHtml = Icons.leakAlert('icon');
    if (routePath.includes('alert')) iconHtml = Icons.respond('icon');
    if (routePath.includes('report')) iconHtml = Icons.chart('icon');
    if (routePath.includes('sign-in')) iconHtml = Icons.lock('icon');

    return `
      <div class="placeholder-view">
        <div class="container">
          <div class="placeholder-card">
            
            <div class="placeholder-icon">
              ${iconHtml}
            </div>

            <div class="placeholder-tag">${moduleDef.tag}</div>

            <h1 class="placeholder-title">${moduleDef.title}</h1>
            <p class="placeholder-desc">${moduleDef.description}</p>

            <div class="placeholder-specs">
              <div class="placeholder-specs-title">Architectural Scope & Planned Capabilities</div>
              <ul class="placeholder-specs-list">
                ${moduleDef.plannedCapabilities.map(cap => `
                  <li><span>//</span> ${cap}</li>
                `).join('')}
              </ul>
            </div>

            <div class="placeholder-actions">
              <a href="#/" class="btn btn-secondary" data-route="/">
                ${Icons.arrowRight('icon')}
                <span>Return to Platform Overview</span>
              </a>
            </div>

          </div>
        </div>
      </div>
    `;
  },

  init: () => {
    // Cleanup any active canvas when navigating to a placeholder view
    if (window.currentNetworkCanvas) {
      window.currentNetworkCanvas.stop();
      window.currentNetworkCanvas = null;
    }
  }
};

window.PlaceholderView = PlaceholderView;
