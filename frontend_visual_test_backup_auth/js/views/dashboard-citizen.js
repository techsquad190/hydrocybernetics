/**
 * HydroCybernetics Citizen Dashboard
 *
 * Citizen-facing service portal for the currently modeled Sadashiv Nagar DMA.
 *
 * Backend-persisted version:
 *  - Location selection
 *  - Water service status + supply timetable
 *  - Municipal advisories
 *  - Issue reporting with image evidence
 *  - Browser geolocation capture
 *  - Reports stored in Flask/SQLite
 *  - Reports fetched for the authenticated citizen
 *  - Image evidence compressed and persisted as Base64
 */

const DashboardCitizenView = {

  // ============================================================
  // STATE
  // ============================================================

  state: {
    location: 'Sadashiv Nagar DMA',
    locationCode: 'sadashiv_nagar',

    geo: null,

    selectedImages: [],
    imagePreviews: [],
    selectedImageFilenames: [],

    reports: [],
    reportsLoading: false,
    reportsError: null
  },


  // ============================================================
  // SERVICE DATA
  // ============================================================

  SERVICE_DATA: {

    sadashiv_nagar: {

      name: 'Sadashiv Nagar DMA',

      city: 'Belagavi',

      serviceStatus: 'SERVICE ACTIVE',

      statusTone: 'normal',

      scheduleStatus: 'Prototype timetable',

      nextWindow: '06:00 – 09:00',

      lastUpdate: 'Prototype service information',

      advisory:
        'No active municipal disruption has been published in the current prototype.',

      schedule: [
        {
          day: 'Daily',
          window: '06:00 – 09:00',
          status: 'Planned window'
        }
      ]
    }
  },


  // ============================================================
  // BACKEND CONFIGURATION
  // ============================================================

  getApiBaseUrl: () => {

    if (
      window.CONFIG &&
      window.CONFIG.API_BASE_URL
    ) {
      return window.CONFIG.API_BASE_URL;
    }

    return 'http://localhost:5000';
  },


  getReportsEndpoint: () => {

    return (
      DashboardCitizenView.getApiBaseUrl() +
      '/api/citizen/reports'
    );
  },


  // ============================================================
  // REPORTS - BACKEND
  // ============================================================

  getReports: () => {

    return DashboardCitizenView.state.reports || [];
  },


  loadReports: async () => {

    const state =
      DashboardCitizenView.state;

    state.reportsLoading = true;
    state.reportsError = null;

    try {

      const response = await fetch(
        DashboardCitizenView.getReportsEndpoint(),
        {
          method: 'GET',

          credentials: 'include',

          headers: {
            'Accept': 'application/json'
          }
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch (jsonError) {
        data = {};
      }

      if (!response.ok) {

        throw new Error(
          data.message ||
          `Unable to load reports. Server returned ${response.status}.`
        );
      }

      state.reports =
        Array.isArray(data.reports)
          ? data.reports
          : [];

      state.reportsLoading = false;
      state.reportsError = null;

      console.log(
        'HydroCybernetics: Citizen reports loaded from backend.',
        state.reports
      );

      DashboardCitizenView.refreshDashboard();

      return state.reports;

    } catch (error) {

      console.error(
        'Citizen report loading failed:',
        error
      );

      state.reportsLoading = false;
      state.reportsError =
        error.message ||
        'Unable to load citizen reports.';

      state.reports = [];

      DashboardCitizenView.refreshDashboard();

      return [];
    }
  },


  saveReport: async (report) => {

  try {

    // ----------------------------------------------------------
    // IMPORTANT:
    // handleReportSubmit() sends:
    //   report.evidence_image
    //   report.evidence_filename
    //
    // Therefore we must send those exact properties
    // to the backend.
    // ----------------------------------------------------------

    const evidenceImage =
      report.evidence_image ||
      null;

    const evidenceFilename =
      report.evidence_filename ||
      null;


    console.log(
      'HydroCybernetics: Preparing report for backend.',
      {
        hasImage: !!evidenceImage,
        imageLength:
          evidenceImage
            ? evidenceImage.length
            : 0,
        filename:
          evidenceFilename
      }
    );


    const response = await fetch(
      DashboardCitizenView.getReportsEndpoint(),
      {
        method: 'POST',

        credentials: 'include',

        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },

        body: JSON.stringify({

          category:
            report.category,

          description:
            report.description,

          location:
            report.location,

          latitude:
            report.latitude,

          longitude:
            report.longitude,

          location_accuracy:
            report.location_accuracy,

          // THIS IS THE IMPORTANT FIX
          evidence_image:
            evidenceImage,

          evidence_filename:
            evidenceFilename

        })
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

      throw new Error(
        data.message ||
        `Report submission failed. Server returned ${response.status}.`
      );

    }


    console.log(
      'HydroCybernetics: Citizen report stored in backend.',
      {
        response: data,
        imageSent:
          !!evidenceImage,
        imageLength:
          evidenceImage
            ? evidenceImage.length
            : 0
      }
    );


    return data;


  } catch (error) {

    console.error(
      'Citizen report submission failed:',
      error
    );

    throw error;

  }

},

  // ============================================================
  // DASHBOARD REFRESH
  // ============================================================

  refreshDashboard: () => {

    let container =
      document.getElementById(
        'citizen-dashboard-subview-container'
      );


    if (!container) {

      container =
        document.querySelector(
          '.citizen-dashboard-container'
        );

    }


    if (!container) {

      console.warn(
        'HydroCybernetics: Citizen dashboard container not found. Re-rendering through app routing.'
      );

      if (
        window.app &&
        typeof window.app.handleRouting === 'function'
      ) {

        window.app.handleRouting();

      }

      return;
    }


    if (
      container.classList &&
      container.classList.contains(
        'citizen-dashboard-container'
      )
    ) {

      const wrapper =
        document.createElement('div');

      wrapper.innerHTML =
        DashboardCitizenView.render();

      const newDashboard =
        wrapper.firstElementChild;

      if (newDashboard) {

        container.replaceWith(
          newDashboard
        );

      }

    } else {

      container.innerHTML =
        DashboardCitizenView.render();

    }


    DashboardCitizenView.bindAfterRender();

  },


  bindAfterRender: () => {

    // Reserved for future dashboard bindings.

  },


  // ============================================================
  // SERVICE DATA
  // ============================================================

  getServiceData: () => {

    return DashboardCitizenView.SERVICE_DATA[
      DashboardCitizenView.state.locationCode
    ] ||
    DashboardCitizenView.SERVICE_DATA.sadashiv_nagar;
  },


  // ============================================================
  // RENDER
  // ============================================================

  render: () => {

    const reports =
      DashboardCitizenView.getReports();

    const service =
      DashboardCitizenView.getServiceData();

    const state =
      DashboardCitizenView.state;


    const activeReports =
      reports.filter(
        report =>
          report.status !== 'Resolved'
      ).length;


    const resolvedReports =
      reports.filter(
        report =>
          report.status === 'Resolved'
      ).length;


    const reportError =
      state.reportsError
        ? `
          <div
            class="notice-box-subtle"
            style="
              margin-bottom:16px;
              border-color:rgba(255,80,80,.25);
            "
          >
            <span class="text-xs text-secondary">
              Unable to load reports from the municipal server.
              ${DashboardCitizenView.escape(
                state.reportsError
              )}
            </span>
          </div>
        `
        : '';


    const reportLoading =
      state.reportsLoading
        ? `
          <div
            class="notice-box-subtle"
            style="margin-bottom:16px;"
          >
            <span class="text-xs text-secondary">
              Loading your reports from the municipal server...
            </span>
          </div>
        `
        : '';


    return `

      <div class="citizen-dashboard-container">


        <!-- =====================================================
             PORTAL HEADER
        ====================================================== -->

        <div class="portal-subheader">

          <div class="container">

            <div class="portal-subheader-inner">

              <div>

                <div class="portal-role-tag">
                  CITIZEN PORTAL
                </div>

                <h1 class="portal-page-title">
                  Community Water Dashboard
                </h1>

                <p class="text-xs text-secondary mt-2">
                  Local water-service information for residents
                </p>

              </div>


              <div
                class="portal-subheader-actions"
                style="
                  display:flex;
                  align-items:center;
                  justify-content:flex-end;
                  flex-wrap:wrap;
                  gap:12px;
                  min-width:0;
                "
              >

                <label
                  class="text-xs text-secondary"
                  for="citizen-location-select"
                  style="
                    display:flex;
                    align-items:center;
                    gap:8px;
                    flex:0 1 auto;
                    min-width:0;
                    white-space:nowrap;
                  "
                >

                  LOCATION

                  <select
                    id="citizen-location-select"
                    class="form-select"
                    style="
                      min-width:190px;
                      max-width:240px;
                    "
                    onchange="
                      DashboardCitizenView.changeLocation(this.value);
                    "
                  >

                    <option
                      value="sadashiv_nagar"
                    >
                      Sadashiv Nagar DMA
                    </option>

                  </select>

                </label>


                <button
                  type="button"
                  class="btn btn-primary"
                  style="
                    flex:0 0 auto;
                    white-space:nowrap;
                  "
                  onclick="
                    DashboardCitizenView.openReportModal();
                  "
                >

                  ${Icons.plus('icon')}

                  <span>
                    Report an Issue
                  </span>

                </button>

              </div>

            </div>

          </div>

        </div>


        <!-- =====================================================
             MAIN CONTENT
        ====================================================== -->

        <div class="container py-8">


          <!-- SERVICE STATUS -->

          <div class="dash-card">

            <div class="dash-card-body">

              <div
                style="
                  display:grid;
                  grid-template-columns:minmax(0,1.5fr) minmax(280px,1fr);
                  gap:24px;
                  align-items:stretch;
                "
              >

                <div>

                  <div
                    class="text-xs font-mono text-accent mb-2"
                  >
                    // LOCAL SERVICE STATUS
                  </div>

                  <h2 class="text-2xl font-semibold">
                    ${service.name}
                  </h2>

                  <p class="text-sm text-secondary mt-2">
                    Public water-service information for the
                    selected distribution area.
                  </p>

                  <div
                    style="
                      display:flex;
                      align-items:center;
                      gap:10px;
                      margin-top:20px;
                    "
                  >

                    <span
                      class="status-badge status-badge-normal"
                    >
                      <span class="status-dot"></span>
                      ${service.serviceStatus}
                    </span>

                    <span class="text-xs text-muted">
                      ${service.scheduleStatus}
                    </span>

                  </div>

                </div>


                <div
                  class="info-banner"
                  style="margin:0;"
                >

                  ${Icons.alertCircle('icon')}

                  <div>

                    <div class="font-semibold text-sm">
                      Current advisory
                    </div>

                    <div class="text-xs text-secondary mt-1">
                      ${service.advisory}
                    </div>

                  </div>

                </div>

              </div>

            </div>

          </div>


          <!-- =====================================================
               SUMMARY CARDS
          ====================================================== -->

          <div
            class="overview-cards-grid"
            style="margin-top:24px;"
          >


            <div class="metric-card">

              <div class="metric-card-header">

                <span class="metric-label">
                  NEXT SUPPLY WINDOW
                </span>

                ${Icons.pipeline('icon')}

              </div>

              <div class="metric-val text-accent">
                ${service.nextWindow}
              </div>

              <div class="metric-meta text-xs text-muted">
                Current prototype schedule
              </div>

            </div>


            <div class="metric-card">

              <div class="metric-card-header">

                <span class="metric-label">
                  MY REPORTS
                </span>

                ${Icons.fileText('icon')}

              </div>

              <div class="metric-val">
                ${reports.length}
              </div>

              <div class="metric-meta text-xs text-muted">
                ${activeReports}
                active ·
                ${resolvedReports}
                resolved
              </div>

            </div>


            <div class="metric-card">

              <div class="metric-card-header">

                <span class="metric-label">
                  AREA
                </span>

                ${Icons.map('icon')}

              </div>

              <div
                class="metric-val analytics-metric-value-small"
              >
                SADASHIV NAGAR
              </div>

              <div class="metric-meta text-xs text-muted">
                Belagavi
              </div>

            </div>


            <div class="metric-card">

              <div class="metric-card-header">

                <span class="metric-label">
                  SERVICE UPDATES
                </span>

                ${Icons.alertCircle('icon')}

              </div>

              <div
                class="metric-val analytics-metric-value-small"
              >
                ONLINE
              </div>

              <div class="metric-meta text-xs text-muted">
                Advisory channel available
              </div>

            </div>

          </div>


          <!-- =====================================================
               SUPPLY + ADVISORIES
          ====================================================== -->

          <div
            class="dashboard-grid-2col"
            style="margin-top:32px;"
          >


            <div class="dash-card">

              <div class="dash-card-header">

                <div class="dash-card-title-wrap">

                  <div class="icon-box">
                    ${Icons.pipeline('icon')}
                  </div>

                  <div>

                    <h2 class="dash-card-title">
                      Water Supply Schedule
                    </h2>

                    <p class="dash-card-subtitle">
                      Service timetable for ${service.name}
                    </p>

                  </div>

                </div>

              </div>


              <div class="dash-card-body">

                <div class="scenario-list">

                  ${service.schedule.map(item => `

                    <div class="scenario-item">

                      <div class="scenario-item-header">

                        <div class="font-semibold text-sm">
                          ${item.day}
                        </div>

                        <span
                          class="status-tag status-tag-normal"
                        >
                          ${item.status}
                        </span>

                      </div>

                      <div
                        style="
                          display:flex;
                          align-items:center;
                          gap:10px;
                          margin-top:10px;
                        "
                      >

                        <span class="font-mono text-accent">
                          ${item.window}
                        </span>

                        <span class="text-xs text-secondary">
                          Expected service window
                        </span>

                      </div>

                    </div>

                  `).join('')}

                </div>


                <div class="notice-box-subtle mt-4">

                  <span class="text-xs text-muted">

                    This timetable is a prototype service schedule
                    for the current Sadashiv Nagar demonstration.
                    Official municipal scheduling data can replace
                    it when the service feed is connected.

                  </span>

                </div>

              </div>

            </div>


            <div class="dash-card">

              <div class="dash-card-header">

                <div class="dash-card-title-wrap">

                  <div class="icon-box">
                    ${Icons.alertCircle('icon')}
                  </div>

                  <div>

                    <h2 class="dash-card-title">
                      Service Advisories
                    </h2>

                    <p class="dash-card-subtitle">
                      Notices relevant to the selected area
                    </p>

                  </div>

                </div>

              </div>


              <div class="dash-card-body">

                <div class="info-banner">

                  ${Icons.check('icon')}

                  <div>

                    <div class="font-semibold text-sm">
                      No active disruption reported
                    </div>

                    <div class="text-xs text-secondary mt-1">
                      ${service.advisory}
                    </div>

                  </div>

                </div>


                <div class="meta-data-table mt-4">

                  <div class="meta-row">

                    <span class="meta-label">
                      Area
                    </span>

                    <span class="meta-value text-accent">
                      ${service.name}
                    </span>

                  </div>


                  <div class="meta-row">

                    <span class="meta-label">
                      Service state
                    </span>

                    <span class="meta-value">
                      ${service.serviceStatus}
                    </span>

                  </div>


                  <div class="meta-row">

                    <span class="meta-label">
                      Last update
                    </span>

                    <span class="meta-value text-muted">
                      ${service.lastUpdate}
                    </span>

                  </div>

                </div>

              </div>

            </div>

          </div>


          <!-- =====================================================
               REPORT INFORMATION
          ====================================================== -->

          <div class="dash-card mt-8">

            <div class="dash-card-header">

              <div class="dash-card-title-wrap">

                <div class="icon-box">
                  ${Icons.leakAlert('icon')}
                </div>

                <div>

                  <h2 class="dash-card-title">
                    Report a Water Issue
                  </h2>

                  <p class="dash-card-subtitle">
                    Help municipal operators investigate
                    local water-service problems
                  </p>

                </div>

              </div>


              <button
                class="btn btn-primary btn-sm"
                onclick="
                  DashboardCitizenView.openReportModal();
                "
              >

                ${Icons.plus('icon')}

                <span>
                  New Report
                </span>

              </button>

            </div>


            <div class="dash-card-body">

              <div class="dashboard-grid-2col">

                <div>

                  <div class="font-semibold text-sm">
                    What makes a report useful?
                  </div>

                  <p class="text-xs text-secondary mt-2">

                    Describe what you observed and, when possible,
                    attach a photograph and capture your location.
                    This gives the municipal team both visual and
                    geographic context.

                  </p>

                </div>


                <div class="notice-box-subtle">

                  <span class="text-xs text-secondary">

                    <strong>
                      Recommended evidence:
                    </strong>

                    issue category +
                    description +
                    photo +
                    location +
                    submission time.

                  </span>

                </div>

              </div>

            </div>

          </div>


          <!-- =====================================================
               MY REPORTS
          ====================================================== -->

          <div class="dash-card mt-8">

            <div class="dash-card-header">

              <div class="dash-card-title-wrap">

                <div class="icon-box">
                  ${Icons.fileText('icon')}
                </div>

                <div>

                  <h2 class="dash-card-title">
                    My Reports
                  </h2>

                  <p class="dash-card-subtitle">
                    Track reports submitted for ${service.name}
                  </p>

                </div>

              </div>


              <button
                class="btn btn-secondary btn-sm"
                onclick="
                  DashboardCitizenView.loadReports();
                "
              >
                Refresh
              </button>

            </div>


            <div class="dash-card-body">

              ${reportError}

              ${reportLoading}


              ${
                !state.reportsLoading &&
                reports.length === 0
                  ? `

                    <div class="empty-state-box">

                      ${Icons.fileText('icon')}

                      <div
                        class="font-medium text-sm mt-3"
                      >
                        No Reports Submitted
                      </div>

                      <p
                        class="text-xs text-muted mt-1"
                      >
                        Your submitted water-service reports
                        will appear here with their current status.
                      </p>

                    </div>

                  `
                  : ''
              }


              ${
                !state.reportsLoading &&
                reports.length > 0
                  ? `

                    <div class="table-responsive">

                      <table class="data-table">

                        <thead>

                          <tr>

                            <th>
                              Report ID
                            </th>

                            <th>
                              Issue
                            </th>

                            <th>
                              Evidence
                            </th>

                            <th>
                              Location
                            </th>

                            <th>
                              Date
                            </th>

                            <th>
                              Status
                            </th>

                          </tr>

                        </thead>


                        <tbody>

                          ${reports.map(report => {

                            const reportId =
                              report.id ||
                              '—';


                            const category =
                              report.category ||
                              '—';


                            const location =
                              report.location ||
                              '—';


                            const status =
                              report.status ||
                              'Submitted';


                            const createdAt =
                              report.created_at ||
                              report.submittedAt ||
                              report.date ||
                              '';


                            let displayDate =
                              createdAt;


                            try {

                              if (createdAt) {

                                displayDate =
                                  new Date(
                                    createdAt
                                  ).toLocaleDateString(
                                    'en-IN'
                                  );

                              }

                            } catch (dateError) {

                              displayDate =
                                createdAt;

                            }


                            const imageCount =
                              report.evidence_image
                                ? 1
                                : (
                                    report.imageCount ||
                                    0
                                  );


                            const hasGPS =
                              report.latitude !== null &&
                              report.latitude !== undefined &&
                              report.longitude !== null &&
                              report.longitude !== undefined;


                            return `

                              <tr>

                                <td
                                  class="
                                    font-mono
                                    text-accent
                                    text-xs
                                    font-semibold
                                  "
                                >
                                  ${DashboardCitizenView.escape(
                                    reportId
                                  )}
                                </td>


                                <td>

                                  <span class="category-pill">
                                    ${DashboardCitizenView.escape(
                                      category
                                    )}
                                  </span>

                                </td>


                                <td class="text-xs">

                                  ${
                                    imageCount
                                      ? `
                                        ${imageCount}
                                        photo${imageCount > 1 ? 's' : ''}
                                      `
                                      : 'No photo'
                                  }

                                  ${
                                    hasGPS
                                      ? ' · GPS'
                                      : ''
                                  }

                                </td>


                                <td class="text-sm">

                                  ${DashboardCitizenView.escape(
                                    location
                                  )}

                                </td>


                                <td
                                  class="
                                    font-mono
                                    text-xs
                                    text-muted
                                  "
                                >

                                  ${DashboardCitizenView.escape(
                                    displayDate
                                  )}

                                </td>


                                <td>

                                  <span
                                    class="
                                      status-tag
                                      ${
                                        status === 'Resolved'
                                          ? 'status-tag-normal'
                                          : 'status-tag-review'
                                      }
                                    "
                                  >
                                    ${DashboardCitizenView.escape(
                                      status
                                    )}
                                  </span>

                                </td>

                              </tr>

                            `;

                          }).join('')}

                        </tbody>

                      </table>

                    </div>

                  `
                  : ''
              }

            </div>

          </div>

        </div>


        <!-- =====================================================
             REPORT MODAL
        ====================================================== -->

        <div
          id="report-issue-modal"
          class="modal-backdrop"
          style="
            display:none;
            position:fixed;
            inset:0;
            z-index:9999;
            box-sizing:border-box;
            padding:20px;
            background:rgba(0,0,0,.72);
            align-items:center;
            justify-content:center;
            overflow:auto;
          "
          onclick="
            DashboardCitizenView.handleModalBackdropClick(event);
          "
        >

          <div
            class="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
            style="
              width:min(720px,100%);
              max-height:calc(100vh - 40px);
              margin:auto;
              display:flex;
              flex-direction:column;
              min-height:0;
              overflow:hidden;
              position:relative;
            "
            onclick="event.stopPropagation();"
          >


            <div
              class="modal-header"
              style="
                flex:0 0 auto;
                display:flex;
                align-items:flex-start;
                justify-content:space-between;
                gap:16px;
              "
            >

              <div
                class="modal-title-wrap"
                style="
                  min-width:0;
                  display:flex;
                  align-items:center;
                  gap:12px;
                "
              >

                <div class="icon-box">
                  ${Icons.leakAlert('icon')}
                </div>

                <div style="min-width:0;">

                  <h3
                    id="report-modal-title"
                    class="modal-title"
                  >
                    Report a Water Network Issue
                  </h3>

                  <p class="modal-subtitle">
                    Submit evidence to municipal operations
                  </p>

                </div>

              </div>


              <button
                type="button"
                aria-label="Close report form"
                title="Close"
                onclick="
                  DashboardCitizenView.closeReportModal();
                "
                style="
                  flex:0 0 38px;
                  width:38px;
                  height:38px;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  border:1px solid rgba(255,255,255,.16);
                  border-radius:8px;
                  background:transparent;
                  color:inherit;
                  font-size:28px;
                  line-height:1;
                  cursor:pointer;
                  padding:0;
                "
              >
                &times;
              </button>

            </div>


            <form
              id="issue-report-form"
              onsubmit="
                DashboardCitizenView.handleReportSubmit(event);
              "
              style="
                display:flex;
                flex-direction:column;
                min-height:0;
                flex:1 1 auto;
              "
            >


              <div
                class="modal-body"
                style="
                  flex:1 1 auto;
                  min-height:0;
                  overflow-y:auto;
                  overflow-x:hidden;
                  padding-right:6px;
                "
              >


                <!-- CATEGORY -->

                <div class="form-group">

                  <label
                    class="form-label"
                    for="report-category"
                  >
                    Issue Category
                  </label>

                  <select
                    id="report-category"
                    class="form-select"
                    required
                  >

                    <option value="Leakage">
                      Pipeline Leakage
                    </option>

                    <option value="Low Pressure">
                      Low Water Pressure
                    </option>

                    <option value="Supply Interruption">
                      No Water / Supply Interruption
                    </option>

                    <option value="Water Quality">
                      Water Quality Concern
                    </option>

                    <option value="Overflow">
                      Overflow / Wastage
                    </option>

                    <option value="Infrastructure Damage">
                      Damaged Water Infrastructure
                    </option>

                    <option value="Other">
                      Other
                    </option>

                  </select>

                </div>


                <!-- LOCATION -->

                <div class="form-group">

                  <label
                    class="form-label"
                    for="report-location"
                  >
                    Location / Street Address
                  </label>

                  <input
                    type="text"
                    id="report-location"
                    class="form-input"
                    placeholder="
                      e.g. Main Road, Sadashiv Nagar
                    "
                    required
                  />

                </div>


                <!-- DESCRIPTION -->

                <div class="form-group">

                  <label
                    class="form-label"
                    for="report-description"
                  >
                    Describe the Issue
                  </label>

                  <textarea
                    id="report-description"
                    class="form-textarea"
                    rows="4"
                    placeholder="
                      Describe what you observed, when it started,
                      and any visible impact...
                    "
                    required
                  ></textarea>

                </div>


                <!-- IMAGES -->

                <div class="form-group">

                  <label
                    class="form-label"
                    for="report-images"
                  >
                    Visual Evidence
                  </label>

                  <input
                    type="file"
                    id="report-images"
                    class="form-input"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onchange="
                      DashboardCitizenView.handleImageSelection(event);
                    "
                  />

                  <div class="text-xs text-muted mt-2">

                    Add up to 3 photographs.
                    Images are compressed locally for this prototype.

                  </div>


                  <div
                    id="report-image-preview"
                    style="
                      display:grid;
                      grid-template-columns:repeat(3,minmax(0,1fr));
                      gap:10px;
                      margin-top:12px;
                    "
                  ></div>

                </div>


                <!-- GPS -->

                <div class="form-group">

                  <div
                    style="
                      display:flex;
                      align-items:center;
                      justify-content:space-between;
                      gap:12px;
                      flex-wrap:wrap;
                    "
                  >

                    <label
                      class="form-label"
                      style="margin:0;"
                    >
                      Location Evidence
                    </label>


                    <button
                      type="button"
                      class="btn btn-secondary btn-sm"
                      onclick="
                        DashboardCitizenView.captureLocation();
                      "
                    >

                      ${Icons.map('icon')}

                      <span>
                        Capture My Location
                      </span>

                    </button>

                  </div>


                  <div
                    id="report-location-status"
                    class="notice-box-subtle mt-3"
                  >

                    <span class="text-xs text-secondary">
                      GPS location has not been captured.
                    </span>

                  </div>

                </div>


                <!-- NOTICE -->

                <div class="notice-box-subtle">

                  ${Icons.shield('icon')}

                  <span class="text-xs text-secondary">

                    Visual evidence and GPS coordinates strengthen
                    the report by providing municipal operators with
                    geographic and observational context.

                  </span>

                </div>


                <!-- SUBMISSION ERROR -->

                <div
                  id="report-submit-error"
                  style="display:none;"
                ></div>


              </div>


              <!-- FOOTER -->

              <div
                class="modal-footer"
                style="
                  flex:0 0 auto;
                  display:flex;
                  align-items:center;
                  justify-content:flex-end;
                  gap:12px;
                  padding-top:14px;
                  border-top:1px solid rgba(255,255,255,.08);
                "
              >

                <button
                  type="button"
                  class="btn btn-secondary"
                  onclick="
                    DashboardCitizenView.closeReportModal();
                  "
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  class="btn btn-primary"
                  id="submit-citizen-report"
                >

                  <span>
                    Submit Report
                  </span>

                  ${Icons.arrowRight('icon')}

                </button>

              </div>

            </form>

          </div>

        </div>

      </div>
    `;
  },


  // ============================================================
  // ESCAPE HTML
  // ============================================================

  escape: (value) => {

    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  },


  // ============================================================
  // LOCATION CHANGE
  // ============================================================

  changeLocation: (locationCode) => {

    if (
      !DashboardCitizenView.SERVICE_DATA[locationCode]
    ) {
      return;
    }


    DashboardCitizenView.state.locationCode =
      locationCode;


    DashboardCitizenView.state.location =
      DashboardCitizenView.SERVICE_DATA[
        locationCode
      ].name;


    if (window.app) {
      window.app.handleRouting();
    }

  },


  // ============================================================
  // OPEN REPORT MODAL
  // ============================================================

  openReportModal: () => {

    const modal =
      document.getElementById(
        'report-issue-modal'
      );


    if (modal) {

      modal.style.display = 'flex';

      document.body.style.overflow =
        'hidden';

    }


    DashboardCitizenView.state.selectedImages =
      [];

    DashboardCitizenView.state.imagePreviews =
      [];

    DashboardCitizenView.state.selectedImageFilenames =
      [];

    DashboardCitizenView.state.geo =
      null;


    const form =
      document.getElementById(
        'issue-report-form'
      );


    if (form) {
      form.reset();
    }


    const preview =
      document.getElementById(
        'report-image-preview'
      );


    if (preview) {
      preview.innerHTML = '';
    }


    const locationStatus =
      document.getElementById(
        'report-location-status'
      );


    if (locationStatus) {

      locationStatus.innerHTML = `

        <span class="text-xs text-secondary">
          GPS location has not been captured.
        </span>

      `;

    }


    const errorBox =
      document.getElementById(
        'report-submit-error'
      );


    if (errorBox) {

      errorBox.style.display =
        'none';

      errorBox.innerHTML = '';

    }

  },


  // ============================================================
  // CLOSE REPORT MODAL
  // ============================================================

  closeReportModal: () => {

    const modal =
      document.getElementById(
        'report-issue-modal'
      );


    if (modal) {
      modal.style.display = 'none';
    }


    document.body.style.overflow = '';

  },


  // ============================================================
  // MODAL BACKDROP
  // ============================================================

  handleModalBackdropClick: (event) => {

    if (
      event.target &&
      event.target.id ===
        'report-issue-modal'
    ) {

      DashboardCitizenView.closeReportModal();

    }

  },


  // ============================================================
  // IMAGE SELECTION
  // ============================================================

  handleImageSelection: async (event) => {

    console.log(
      'HydroCybernetics: Image selection event fired.'
    );


    const files =
      Array.from(
        event.target.files || []
      )
      .filter(
        file =>
          file &&
          file.type &&
          file.type.startsWith('image/')
      )
      .slice(0, 3);


    console.log(
      'HydroCybernetics: Selected image files:',
      files
    );


    DashboardCitizenView.state.selectedImages =
      [];

    DashboardCitizenView.state.imagePreviews =
      [];

    DashboardCitizenView.state.selectedImageFilenames =
      [];


    const preview =
      document.getElementById(
        'report-image-preview'
      );


    if (!preview) {

      console.error(
        'HydroCybernetics: Image preview container not found.'
      );

      return;

    }


    preview.innerHTML = '';


    if (!files.length) {

      console.warn(
        'HydroCybernetics: No valid image file selected.'
      );

      return;

    }


    /*
     * IMPORTANT:
     *
     * Process every image first.
     * Only after compression is complete do we
     * write the results into selectedImages.
     *
     * This prevents the asynchronous FileReader/
     * Image pipeline from racing with report submission.
     */

    const processedImages = [];


    for (const file of files) {

      try {

        console.log(
          'HydroCybernetics: Processing image:',
          file.name,
          'size:',
          file.size,
          'bytes',
          'type:',
          file.type
        );


        const compressed =
          await DashboardCitizenView.compressImage(
            file
          );


        if (
          !compressed ||
          typeof compressed !== 'string' ||
          !compressed.startsWith('data:image/')
        ) {

          throw new Error(
            'Image compression did not return a valid image.'
          );

        }


        processedImages.push({

          data:
            compressed,

          filename:
            file.name

        });


        console.log(
          'HydroCybernetics: Image processed successfully:',
          file.name,
          'compressed length:',
          compressed.length
        );


      } catch (error) {

        console.error(
          'HydroCybernetics: Image processing failed:',
          file.name,
          error
        );

      }

    }


    /*
     * Store processed images only after the
     * asynchronous processing has completed.
     */

    DashboardCitizenView.state.selectedImages =
      processedImages.map(
        item => item.data
      );


    DashboardCitizenView.state.imagePreviews =
      processedImages.map(
        item => item.data
      );


    DashboardCitizenView.state.selectedImageFilenames =
      processedImages.map(
        item => item.filename
      );


    console.log(
      'HydroCybernetics: FINAL selectedImages:',
      DashboardCitizenView.state.selectedImages
    );


    console.log(
      'HydroCybernetics: FINAL image count:',
      DashboardCitizenView.state.selectedImages.length
    );


    if (
      DashboardCitizenView.state.selectedImages.length > 0
    ) {

      console.log(
        'HydroCybernetics: First image Base64 length:',
        DashboardCitizenView.state.selectedImages[0].length
      );

    }


    /*
     * Render previews.
     */

    preview.innerHTML =
      DashboardCitizenView.state.imagePreviews
        .map(
          (src, index) => `

            <div
              style="
                position:relative;
                aspect-ratio:4/3;
                overflow:hidden;
                border:1px solid rgba(255,255,255,.12);
                border-radius:8px;
                background:#0a111b;
              "
            >

              <img
                src="${src}"
                alt="Evidence preview ${index + 1}"
                style="
                  width:100%;
                  height:100%;
                  object-fit:cover;
                "
              />

              <div
                style="
                  position:absolute;
                  left:6px;
                  bottom:6px;
                  padding:4px 7px;
                  border-radius:5px;
                  background:rgba(0,0,0,.65);
                  color:#fff;
                  font-size:10px;
                  max-width:calc(100% - 12px);
                  overflow:hidden;
                  text-overflow:ellipsis;
                  white-space:nowrap;
                "
              >
                ${DashboardCitizenView.escape(
                  DashboardCitizenView.state.selectedImageFilenames[index] ||
                  `Image ${index + 1}`
                )}
              </div>

            </div>

          `
        )
        .join('');


    if (
      DashboardCitizenView.state.selectedImages.length === 0
    ) {

      preview.innerHTML = `

        <div
          style="
            grid-column:1/-1;
            padding:12px;
            border:1px dashed rgba(255,255,255,.15);
            border-radius:8px;
          "
        >

          <span class="text-xs text-secondary">
            The selected image could not be processed.
            Please choose another image.
          </span>

        </div>

      `;

    }

  },


  // ============================================================
  // IMAGE COMPRESSION
  // ============================================================

  compressImage: (file) => {

    return new Promise(
      (resolve, reject) => {

        if (!file) {

          reject(
            new Error(
              'No image file supplied.'
            )
          );

          return;

        }


        const reader =
          new FileReader();


        reader.onload = () => {

          const image =
            new Image();


          image.onload = () => {

            try {

              const maxSize = 900;

              let width =
                image.width;

              let height =
                image.height;


              if (
                !width ||
                !height
              ) {

                reject(
                  new Error(
                    'Unable to determine image dimensions.'
                  )
                );

                return;

              }


              if (
                width > maxSize ||
                height > maxSize
              ) {

                const ratio =
                  Math.min(
                    maxSize / width,
                    maxSize / height
                  );


                width =
                  Math.round(
                    width * ratio
                  );


                height =
                  Math.round(
                    height * ratio
                  );

              }


              const canvas =
                document.createElement(
                  'canvas'
                );


              canvas.width =
                width;


              canvas.height =
                height;


              const context =
                canvas.getContext(
                  '2d'
                );


              if (!context) {

                reject(
                  new Error(
                    'Unable to create canvas context.'
                  )
                );

                return;

              }


              /*
               * White background prevents transparent
               * PNG/WebP images from becoming black when
               * converted to JPEG.
               */

              context.fillStyle =
                '#ffffff';


              context.fillRect(
                0,
                0,
                width,
                height
              );


              context.drawImage(
                image,
                0,
                0,
                width,
                height
              );


              const result =
                canvas.toDataURL(
                  'image/jpeg',
                  0.65
                );


              if (
                !result ||
                result === 'data:,'
              ) {

                reject(
                  new Error(
                    'Canvas failed to generate image data.'
                  )
                );

                return;

              }


              resolve(result);

            } catch (error) {

              reject(error);

            }

          };


          image.onerror = () => {

            reject(
              new Error(
                'Browser could not decode the selected image.'
              )
            );

          };


          image.src =
            reader.result;

        };


        reader.onerror = () => {

          reject(
            new Error(
              'Browser could not read the selected image file.'
            )
          );

        };


        reader.readAsDataURL(
          file
        );

      }
    );

  },


  // ============================================================
  // GPS
  // ============================================================

  captureLocation: () => {

    const status =
      document.getElementById(
        'report-location-status'
      );


    if (!navigator.geolocation) {

      if (status) {

        status.innerHTML = `

          <span class="text-xs text-secondary">
            Geolocation is not supported by this browser.
          </span>

        `;

      }

      return;

    }


    if (status) {

      status.innerHTML = `

        <span class="text-xs text-secondary">
          Requesting your current location...
        </span>

      `;

    }


    navigator.geolocation.getCurrentPosition(

      position => {

        const latitude =
          Number(
            position.coords.latitude.toFixed(6)
          );


        const longitude =
          Number(
            position.coords.longitude.toFixed(6)
          );


        const accuracy =
          Math.round(
            position.coords.accuracy
          );


        DashboardCitizenView.state.geo = {

          latitude,

          longitude,

          accuracy

        };


        if (status) {

          status.innerHTML = `

            <span class="text-xs text-accent">

              GPS captured:
              ${latitude},
              ${longitude}

              <span class="text-muted">
                (±${accuracy} m)
              </span>

            </span>

          `;

        }

      },


      error => {

        console.warn(
          'Geolocation error:',
          error
        );


        let message =
          'Unable to capture location.';


        if (error.code === 1) {

          message =
            'Location permission was denied.';

        }


        if (error.code === 2) {

          message =
            'Location is currently unavailable.';

        }


        if (error.code === 3) {

          message =
            'Location request timed out.';

        }


        if (status) {

          status.innerHTML = `

            <span class="text-xs text-secondary">

              ${message}

              You can still submit the report
              using the street address.

            </span>

          `;

        }

      },


      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }

    );

  },


  // ============================================================
  // SUBMIT REPORT
  // ============================================================

  handleReportSubmit: async (event) => {

    event.preventDefault();


    const submitButton =
      document.getElementById(
        'submit-citizen-report'
      );


    const errorBox =
      document.getElementById(
        'report-submit-error'
      );


    const category =
      document.getElementById(
        'report-category'
      ).value;


    const location =
      document.getElementById(
        'report-location'
      ).value.trim();


    const description =
      document.getElementById(
        'report-description'
      ).value.trim();


    const service =
      DashboardCitizenView.getServiceData();


    const images =
      DashboardCitizenView.state
        .selectedImages || [];


    const imageFilenames =
      DashboardCitizenView.state
        .selectedImageFilenames || [];


    const geo =
      DashboardCitizenView.state.geo;


    // ----------------------------------------------------------
    // Clear previous error
    // ----------------------------------------------------------

    if (errorBox) {

      errorBox.style.display =
        'none';

      errorBox.innerHTML = '';

    }


    // ----------------------------------------------------------
    // Basic validation
    // ----------------------------------------------------------

    if (!category) {

      DashboardCitizenView.showSubmitError(
        'Please select an issue category.'
      );

      return;

    }


    if (!location) {

      DashboardCitizenView.showSubmitError(
        'Please enter the location of the issue.'
      );

      return;

    }


    if (!description) {

      DashboardCitizenView.showSubmitError(
        'Please describe the issue.'
      );

      return;

    }


    // ----------------------------------------------------------
    // IMPORTANT IMAGE CHECK
    // ----------------------------------------------------------

    console.log(
      'HydroCybernetics: Submitting report with image count:',
      images.length
    );


    if (images.length > 0) {

      console.log(
        'HydroCybernetics: Image payload length:',
        images[0].length
      );

      console.log(
        'HydroCybernetics: Image filename:',
        imageFilenames[0] || 'unknown'
      );

    } else {

      console.log(
        'HydroCybernetics: No image evidence attached to this report.'
      );

    }


    // ----------------------------------------------------------
    // Disable submit button
    // ----------------------------------------------------------

    if (submitButton) {

      submitButton.disabled =
        true;


      submitButton.dataset.originalText =
        submitButton.innerHTML;


      submitButton.innerHTML = `

        <span>
          Submitting...
        </span>

      `;

    }


    try {

      const reportPayload = {

        category,

        location,

        description,

        area:
          service.name,

        latitude:
          geo
            ? geo.latitude
            : null,

        longitude:
          geo
            ? geo.longitude
            : null,

        location_accuracy:
          geo
            ? geo.accuracy
            : null,

        evidence_image:
          images.length > 0
            ? images[0]
            : null,

        evidence_filename:
          imageFilenames.length > 0
            ? imageFilenames[0]
            : null

      };


      console.log(
        'HydroCybernetics: Sending citizen report to backend...',
        {
          category: reportPayload.category,
          location: reportPayload.location,
          hasImage:
            !!reportPayload.evidence_image,
          imageLength:
            reportPayload.evidence_image
              ? reportPayload.evidence_image.length
              : 0,
          filename:
            reportPayload.evidence_filename
        }
      );


      const result =
        await DashboardCitizenView.saveReport(
          reportPayload
        );


      console.log(
        'HydroCybernetics: Backend accepted report.',
        result
      );


      // --------------------------------------------------------
      // Reset local report-form state
      // --------------------------------------------------------

      DashboardCitizenView.state.selectedImages =
        [];

      DashboardCitizenView.state.imagePreviews =
        [];

      DashboardCitizenView.state.selectedImageFilenames =
        [];

      DashboardCitizenView.state.geo =
        null;


      // --------------------------------------------------------
      // Close modal
      // --------------------------------------------------------

      DashboardCitizenView.closeReportModal();


      // --------------------------------------------------------
      // Reload reports FROM DATABASE
      // --------------------------------------------------------

      await DashboardCitizenView.loadReports();


      // --------------------------------------------------------
      // Refresh dashboard
      // --------------------------------------------------------

      DashboardCitizenView.refreshDashboard();


      // --------------------------------------------------------
      // Success
      // --------------------------------------------------------

      console.log(
        'HydroCybernetics: Citizen report submitted successfully.'
      );


    } catch (error) {

      console.error(
        'HydroCybernetics: Citizen report submission failed:',
        error
      );


      DashboardCitizenView.showSubmitError(
        error.message ||
        'Unable to submit the report. Please make sure the Flask backend is running.'
      );


    } finally {

      if (submitButton) {

        submitButton.disabled =
          false;


        submitButton.innerHTML =
          submitButton.dataset.originalText ||
          `
            <span>
              Submit Report
            </span>
            ${Icons.arrowRight('icon')}
          `;

      }

    }

  },


  // ============================================================
  // SUBMIT ERROR
  // ============================================================

  showSubmitError: (message) => {

    const errorBox =
      document.getElementById(
        'report-submit-error'
      );


    if (!errorBox) {

      alert(message);

      return;

    }


    errorBox.style.display =
      'block';


    errorBox.innerHTML = `

      <div
        class="notice-box-subtle"
        style="
          margin-top:14px;
          border-color:rgba(255,80,80,.3);
        "
      >

        <span class="text-xs text-secondary">

          ${DashboardCitizenView.escape(
            message
          )}

        </span>

      </div>

    `;

  },


  // ============================================================
  // INIT
  // ============================================================

  init: () => {

    if (
      !DashboardCitizenView._escapeHandlerInstalled
    ) {

      document.addEventListener(
        'keydown',
        event => {

          if (
            event.key === 'Escape'
          ) {

            const modal =
              document.getElementById(
                'report-issue-modal'
              );


            if (
              modal &&
              modal.style.display !== 'none'
            ) {

              DashboardCitizenView.closeReportModal();

            }

          }

        }
      );


      DashboardCitizenView
        ._escapeHandlerInstalled =
        true;

    }


    if (
      window.currentNetworkCanvas
    ) {

      window.currentNetworkCanvas.stop();

      window.currentNetworkCanvas =
        null;

    }


    // ----------------------------------------------------------
    // Load reports from backend
    // ----------------------------------------------------------

    DashboardCitizenView.loadReports();

  }

};


// ============================================================
// GLOBAL EXPORT
// ============================================================

window.DashboardCitizenView =
  DashboardCitizenView;

  // ============================================================
// CITIZEN REPORT DOWNLOAD / PDF
// ============================================================

DashboardCitizenView.downloadReport = (reportId) => {

  const reports =
    DashboardCitizenView.state.reports || [];

  const report =
    reports.find(
      item =>
        String(item.id) === String(reportId)
    );

  if (!report) {

    alert(
      'Unable to find this report. Please refresh your reports and try again.'
    );

    return;
  }


  const category =
    report.category ||
    'Water Network Issue';


  const description =
    report.description ||
    'No description provided.';


  const location =
    report.location ||
    'Location not provided';


  const status =
    report.status ||
    'Submitted';


  const createdAt =
    report.created_at ||
    report.submittedAt ||
    report.date ||
    '';


  const latitude =
    report.latitude !== null &&
    report.latitude !== undefined
      ? report.latitude
      : null;


  const longitude =
    report.longitude !== null &&
    report.longitude !== undefined
      ? report.longitude
      : null;


  const accuracy =
    report.location_accuracy !== null &&
    report.location_accuracy !== undefined
      ? report.location_accuracy
      : null;


  let displayDate =
    createdAt;


  try {

    if (createdAt) {

      displayDate =
        new Date(
          createdAt
        ).toLocaleString(
          'en-IN',
          {
            dateStyle: 'medium',
            timeStyle: 'short'
          }
        );

    }

  } catch (error) {

    displayDate =
      createdAt;

  }


  /*
   * Escape text before inserting it into
   * the generated report.
   */

  const escapeHtml = (value) => {

    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  };


  /*
   * Evidence image.
   *
   * The backend already returns evidence_image
   * with the report. If it exists, show it.
   */

  const evidenceImage =
    report.evidence_image
      ? `
        <div class="evidence-section">

          <div class="section-title">
            VISUAL EVIDENCE
          </div>

          <div class="image-container">

            <img
              src="${report.evidence_image}"
              alt="Citizen submitted evidence"
            />

          </div>

        </div>
      `
      : `
        <div class="evidence-section">

          <div class="section-title">
            VISUAL EVIDENCE
          </div>

          <div class="no-evidence">
            No photograph was attached to this report.
          </div>

        </div>
      `;


  /*
   * GPS information.
   */

  const gpsSection =
    latitude !== null &&
    longitude !== null
      ? `
        <div class="info-row">

          <div class="info-label">
            GPS Coordinates
          </div>

          <div class="info-value">
            ${escapeHtml(latitude)},
            ${escapeHtml(longitude)}
          </div>

        </div>

        ${
          accuracy !== null
            ? `
              <div class="info-row">

                <div class="info-label">
                  Location Accuracy
                </div>

                <div class="info-value">
                  ±${escapeHtml(accuracy)} m
                </div>

              </div>
            `
            : ''
        }
      `
      : `
        <div class="info-row">

          <div class="info-label">
            GPS Coordinates
          </div>

          <div class="info-value muted">
            Not captured
          </div>

        </div>
      `;


  /*
   * Create a clean printable report.
   */

  const reportHtml = `

<!DOCTYPE html>

<html>

<head>

  <meta charset="UTF-8">

  <title>
    HydroCybernetics Report #${escapeHtml(report.id)}
  </title>


  <style>

    * {
      box-sizing: border-box;
    }


    body {

      margin: 0;

      padding: 40px;

      background: #f4f7fa;

      color: #17212b;

      font-family:
        Arial,
        Helvetica,
        sans-serif;

      line-height: 1.5;

    }


    .report {

      max-width: 850px;

      margin: 0 auto;

      background: white;

      border: 1px solid #dfe5ea;

      border-radius: 12px;

      overflow: hidden;

    }


    .header {

      padding: 28px 32px;

      background: #10202f;

      color: white;

    }


    .brand {

      font-size: 13px;

      letter-spacing: 2px;

      font-weight: 700;

    }


    .title {

      margin-top: 10px;

      font-size: 26px;

      font-weight: 700;

    }


    .subtitle {

      margin-top: 5px;

      font-size: 13px;

      color: #c7d3dc;

    }


    .body {

      padding: 32px;

    }


    .report-id {

      display: inline-block;

      padding: 6px 10px;

      border-radius: 6px;

      background: #e9f7f4;

      color: #087f6b;

      font-size: 12px;

      font-weight: 700;

      margin-bottom: 24px;

    }


    .info-grid {

      display: grid;

      grid-template-columns:
        1fr 1fr;

      gap: 0;

      border: 1px solid #e1e7ec;

      border-radius: 8px;

      overflow: hidden;

    }


    .info-row {

      display: flex;

      flex-direction: column;

      gap: 4px;

      padding: 14px 16px;

      border-bottom: 1px solid #e1e7ec;

    }


    .info-row:nth-child(odd) {

      border-right: 1px solid #e1e7ec;

    }


    .info-label {

      font-size: 10px;

      text-transform: uppercase;

      letter-spacing: 1px;

      color: #6b7785;

      font-weight: 700;

    }


    .info-value {

      font-size: 14px;

      color: #17212b;

      word-break: break-word;

    }


    .muted {

      color: #8793a0;

    }


    .description-section {

      margin-top: 28px;

    }


    .section-title {

      margin-bottom: 10px;

      font-size: 11px;

      letter-spacing: 1.4px;

      font-weight: 700;

      color: #526170;

    }


    .description {

      padding: 16px;

      border-left: 4px solid #0b8f7a;

      background: #f5f8fa;

      border-radius: 4px;

      white-space: pre-wrap;

      font-size: 14px;

    }


    .evidence-section {

      margin-top: 28px;

    }


    .image-container {

      border: 1px solid #dfe5ea;

      border-radius: 8px;

      padding: 10px;

      background: #fafbfc;

      text-align: center;

    }


    .image-container img {

      max-width: 100%;

      max-height: 520px;

      object-fit: contain;

      border-radius: 5px;

    }


    .no-evidence {

      padding: 18px;

      background: #f5f7f9;

      color: #697785;

      border-radius: 6px;

      font-size: 13px;

    }


    .footer {

      margin-top: 32px;

      padding-top: 18px;

      border-top: 1px solid #e1e7ec;

      font-size: 11px;

      color: #788592;

    }


    .footer strong {

      color: #42515e;

    }


    .print-actions {

      max-width: 850px;

      margin: 0 auto 18px;

      display: flex;

      justify-content: flex-end;

      gap: 10px;

    }


    .print-button {

      border: none;

      border-radius: 7px;

      padding: 10px 16px;

      background: #0b8f7a;

      color: white;

      font-size: 13px;

      font-weight: 700;

      cursor: pointer;

    }


    @media (max-width: 650px) {

      body {

        padding: 15px;

      }


      .body {

        padding: 20px;

      }


      .info-grid {

        grid-template-columns: 1fr;

      }


      .info-row:nth-child(odd) {

        border-right: none;

      }

    }


    @media print {

      body {

        padding: 0;

        background: white;

      }


      .report {

        max-width: none;

        border: none;

        border-radius: 0;

      }


      .print-actions {

        display: none;

      }


      .header {

        -webkit-print-color-adjust: exact;

        print-color-adjust: exact;

      }

    }

  </style>

</head>


<body>


  <div class="print-actions">

    <button
      class="print-button"
      onclick="window.print();"
    >
      Save / Print PDF
    </button>

  </div>


  <div class="report">


    <!-- HEADER -->

    <div class="header">

      <div class="brand">
        HYDROCYBERNETICS
      </div>

      <div class="title">
        Citizen Water Issue Report
      </div>

      <div class="subtitle">
        Community Water Dashboard · Sadashiv Nagar DMA · Belagavi
      </div>

    </div>


    <!-- BODY -->

    <div class="body">


      <div class="report-id">

        REPORT #${escapeHtml(
          report.id
        )}

      </div>


      <!-- INFORMATION -->

      <div class="info-grid">


        <div class="info-row">

          <div class="info-label">
            Issue Category
          </div>

          <div class="info-value">
            ${escapeHtml(category)}
          </div>

        </div>


        <div class="info-row">

          <div class="info-label">
            Status
          </div>

          <div class="info-value">
            ${escapeHtml(status)}
          </div>

        </div>


        <div class="info-row">

          <div class="info-label">
            Location
          </div>

          <div class="info-value">
            ${escapeHtml(location)}
          </div>

        </div>


        <div class="info-row">

          <div class="info-label">
            Submitted
          </div>

          <div class="info-value">
            ${escapeHtml(displayDate)}
          </div>

        </div>


        ${gpsSection}


      </div>


      <!-- DESCRIPTION -->

      <div class="description-section">

        <div class="section-title">
          ISSUE DESCRIPTION
        </div>

        <div class="description">
          ${escapeHtml(description)}
        </div>

      </div>


      <!-- IMAGE -->

      ${evidenceImage}


      <!-- FOOTER -->

      <div class="footer">

        <strong>
          HydroCybernetics
        </strong>

        · Citizen-generated water-service report.

        <br>

        This document represents the information
        submitted through the HydroCybernetics
        citizen portal at the time of reporting.

      </div>


    </div>

  </div>


</body>

</html>
`;


  /*
   * Open report in a new browser tab/window.
   */

  const reportWindow =
    window.open(
      '',
      '_blank',
      'width=1000,height=850'
    );


  if (!reportWindow) {

    alert(
      'The report could not be opened. Please allow pop-ups for this site and try again.'
    );

    return;

  }


  reportWindow.document.open();

  reportWindow.document.write(
    reportHtml
  );

  reportWindow.document.close();


  /*
   * Give the browser time to load the
   * evidence image before the user prints.
   */

  reportWindow.onload = () => {

    reportWindow.focus();

  };


  console.log(
    'HydroCybernetics: Report opened for PDF/printing:',
    report.id
  );

};


// ============================================================
// ADD DOWNLOAD BUTTONS TO MY REPORTS
// ============================================================

DashboardCitizenView.addReportDownloadButtons = () => {

  const table =
    document.querySelector(
      '.citizen-dashboard-container .data-table'
    );


  if (!table) {
    return;
  }


  const headerRow =
    table.querySelector('thead tr');


  const bodyRows =
    table.querySelectorAll('tbody tr');


  if (!headerRow) {
    return;
  }


  /*
   * Prevent duplicate Action columns when the
   * dashboard refreshes.
   */

  if (
    headerRow.querySelector(
      '[data-report-action-header]'
    )
  ) {

    return;

  }


  const actionHeader =
    document.createElement('th');

  actionHeader.setAttribute(
    'data-report-action-header',
    'true'
  );

  actionHeader.textContent =
    'Action';


  headerRow.appendChild(
    actionHeader
  );


  bodyRows.forEach(
    row => {

      const cells =
        row.querySelectorAll('td');


      if (!cells.length) {
        return;
      }


      const reportId =
        cells[0].textContent.trim();


      const actionCell =
        document.createElement('td');


      actionCell.innerHTML = `

        <button
          type="button"
          class="btn btn-secondary btn-sm"
          title="Download report as PDF"
          onclick="
            DashboardCitizenView.downloadReport('${DashboardCitizenView.escape(reportId)}');
          "
          style="
            white-space:nowrap;
            display:inline-flex;
            align-items:center;
            gap:6px;
          "
        >

          ${Icons.fileText('icon')}

          <span>
            Download
          </span>

        </button>

      `;


      row.appendChild(
        actionCell
      );

    }
  );

};


// ============================================================
// PATCH DASHBOARD REFRESH
// ============================================================

const _originalRefreshDashboard =
  DashboardCitizenView.refreshDashboard;


DashboardCitizenView.refreshDashboard = () => {

  _originalRefreshDashboard();

  /*
   * The original refresh is synchronous,
   * so the table exists immediately after
   * rendering in the normal dashboard flow.
   */

  setTimeout(
    () => {

      DashboardCitizenView
        .addReportDownloadButtons();

    },
    0
  );

};


// ============================================================
// INITIAL BUTTON INJECTION
// ============================================================

setTimeout(
  () => {

    DashboardCitizenView
      .addReportDownloadButtons();

  },
  100
);

console.log(
  'HydroCybernetics: Citizen report download module loaded.'
);