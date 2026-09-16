/**
 * HydroCybernetics
 * Simplified Hydraulic Digital Twin
 *
 * Geographic layer:
 *   Google Earth Pro KML-derived coordinates
 *
 * Hydraulic layer:
 *   EPANET / WNTR through Flask API
 *
 * Visualization:
 *   CesiumJS
 *   Satellite imagery + 3D terrain
 *
 * Scenarios:
 *   Baseline
 *   J4 Disruption
 *   J6 Disruption
 */

const DigitalTwinView = {

  state: {
    scenarios: [],
    scenario: 'baseline',
    network: null,
    loading: false,
    error: null,

    viewer: null,
    nodeEntities: [],
    pipeEntities: [],
    sourceEntity: null,

    selectedNode: null
  },


  scenarioLabels: {
    baseline: 'Baseline Network Operation',
    j4_leak: 'Junction 4 Disruption',
    j6_leak: 'Junction 6 Disruption'
  },


  /*
   * ==========================================================
   * MAIN RENDER
   * ==========================================================
   */

  render() {

    const s = this.state;

    const scenarios = s.scenarios.length
      ? s.scenarios
      : [
        'baseline',
        'j4_leak',
        'j6_leak'
      ];

    return `
      <div class="digital-twin-view">

        <div class="dt-header-card">

          <div>

            <div class="dt-eyebrow">
              SIMPLIFIED HYDRAULIC DIGITAL TWIN
            </div>

            <h2 class="dt-title">
              Sadashiv Nagar Digital Twin
            </h2>

            <p class="dt-subtitle">
              3D satellite and terrain visualization of the
              urban water distribution network using
              EPANET/WNTR hydraulic data.
            </p>

          </div>


          <div class="dt-controls">

            <label
              class="dt-select-label"
              for="dt-scenario"
            >
              Scenario
            </label>

            <select
              id="dt-scenario"
              class="dt-scenario-select"
              onchange="DigitalTwinView.switchScenario(this.value)"
            >

              ${scenarios.map(sc => `
                <option
                  value="${sc}"
                  ${s.scenario === sc ? 'selected' : ''}
                >
                  ${this.scenarioLabels[sc] ||
      sc.replace('_', ' ').toUpperCase()}
                </option>
              `).join('')}

            </select>


            <button
              class="btn btn-secondary btn-sm"
              onclick="DigitalTwinView.load('${s.scenario}')"
            >
              Refresh
            </button>

          </div>

        </div>


        ${s.error
        ? this.renderError()
        : this.renderContent()
      }

      </div>
    `;
  },


  /*
   * ==========================================================
   * ERROR
   * ==========================================================
   */

  renderError() {

    const s = this.state;

    return `
      <div class="error-state-card">

        <div
          class="icon-box mx-auto mb-3"
          style="
            color:#ef4444;
            border-color:rgba(239,68,68,.3);
          "
        >
          ${typeof Icons !== 'undefined' &&
        Icons.alertCircle
        ? Icons.alertCircle('icon')
        : '!'}
        </div>


        <h3 class="text-base font-semibold mb-2">
          Digital Twin Data Unavailable
        </h3>


        <p class="text-xs text-secondary max-w-md mx-auto mb-4">
          ${s.error}
        </p>


        <button
          class="btn btn-secondary btn-sm"
          onclick="DigitalTwinView.load('${s.scenario}')"
        >
          Retry
        </button>

      </div>
    `;
  },


  /*
   * ==========================================================
   * CONTENT
   * ==========================================================
   */

  renderContent() {

    const s = this.state;

    return `
      <div class="dt-grid">

        <section class="dash-card dt-map-card">

          <div class="dash-card-header">

            <div class="dash-card-title-wrap">

              <div class="icon-box">

                ${typeof Icons !== 'undefined' &&
        Icons.map
        ? Icons.map('icon')
        : ''}

              </div>


              <div>

                <h3 class="dash-card-title">
                  3D Hydraulic Network
                </h3>


                <p class="dash-card-subtitle">
                  ${this.scenarioLabels[s.scenario] ||
      s.scenario}
                </p>

              </div>

            </div>


            <div class="dt-map-status">

              <span class="context-dot"></span>

              ${s.loading
        ? 'LOADING'
        : 'CONNECTED'}

            </div>

          </div>


          <div class="dt-map-wrap">

            <div
              id="digital-twin-map"
              class="dt-map"
            ></div>


            ${s.loading
        ? `
                <div class="dt-map-loading">

                  <div class="loading-spinner"></div>

                  <span>
                    Loading hydraulic terrain...
                  </span>

                </div>
              `
        : ''}


            <div class="dt-3d-badge">

              <span class="dt-3d-dot"></span>

              CESIUM 3D SATELLITE TERRAIN

            </div>


            <div class="dt-map-overlay">

              <div class="dt-overlay-title">
                HYDROCYBERNETICS
              </div>

              <div class="dt-overlay-subtitle">
                ${this.scenarioLabels[s.scenario] ||
      s.scenario}
              </div>

            </div>

          </div>


          <div class="dt-legend">

            <span>
              <i class="dt-legend-line normal"></i>
              Network link
            </span>

            <span>
              <i class="dt-legend-line affected"></i>
              Scenario change
            </span>

            <span>
              <i class="dt-legend-node"></i>
              Junction
            </span>

            <span>
              <i class="dt-legend-source"></i>
              Source
            </span>

          </div>

        </section>


        <aside class="dash-card dt-detail-card">

          <div class="dash-card-header">

            <div class="dash-card-title-wrap">

              <div class="icon-box">

                ${typeof Icons !== 'undefined' &&
        Icons.gauge
        ? Icons.gauge('icon')
        : ''}

              </div>


              <div>

                <h3 class="dash-card-title">
                  Network State
                </h3>

                <p class="dash-card-subtitle">
                  Selected hydraulic element
                </p>

              </div>

            </div>

          </div>


          <div class="dash-card-body">

            ${this.renderDetails()}

          </div>

        </aside>

      </div>


      <div class="dt-summary-grid">

        ${this.summaryCard(
          'Junctions',
          s.network
            ? s.network.nodes.length
            : 0,
          'Mapped network nodes'
        )}


        ${this.summaryCard(
          'Links',
          s.network
            ? s.network.links.length
            : 0,
          'Mapped network links'
        )}


        ${this.summaryCard(
          'Scenario',
          this.scenarioLabels[s.scenario] ||
          s.scenario,
          'EPANET / WNTR hydraulic state'
        )}


        ${this.summaryCard(
          'Terrain',
          '3D',
          'Cesium satellite + elevation'
        )}

      </div>
    `;
  },


  /*
   * ==========================================================
   * SUMMARY CARD
   * ==========================================================
   */

  summaryCard(label, value, detail) {

    return `
      <div class="dt-summary-card">

        <div class="dt-summary-label">
          ${label}
        </div>


        <div
          class="
            dt-summary-value
            ${String(value).length > 18
        ? 'dt-summary-value-small'
        : ''}
          "
        >
          ${value}
        </div>


        <div class="dt-summary-detail">
          ${detail}
        </div>

      </div>
    `;
  },


  /*
   * ==========================================================
   * DETAILS
   * ==========================================================
   */

  renderDetails() {

    const node =
      this.state.selectedNode;


    if (!node) {

      return `
        <div class="dt-empty-detail">

          <div class="dt-empty-icon">

            ${typeof Icons !== 'undefined' &&
          Icons.map
          ? Icons.map('icon')
          : ''}

          </div>


          <h4>
            Select a junction
          </h4>


          <p>
            Click a junction on the 3D network to inspect
            its hydraulic state.
          </p>

        </div>
      `;
    }


    const delta =
      node.delta;


    const deltaNumber =
      Number(delta);


    const deltaText =
      delta === null ||
        delta === undefined ||
        Number.isNaN(deltaNumber)
        ? '—'
        : `${deltaNumber > 0 ? '+' : ''}${deltaNumber.toFixed(3)} m`;


    return `
      <div class="dt-selected-title">

        <span class="dt-node-badge">
          ${node.id}
        </span>


        <div>

          <div class="dt-selected-name">
            Junction ${String(node.id).replace('J', '')}
          </div>


          <div class="dt-selected-type">
            Hydraulic node
          </div>

        </div>

      </div>


      <div class="dt-detail-list">

        <div>

          <span>
            Pressure head
          </span>

          <strong>
            ${node.value !== null &&
        node.value !== undefined
        ? Number(node.value).toFixed(3)
        : '—'}
            ${node.unit || 'm'}
          </strong>

        </div>


        <div>

          <span>
            Baseline
          </span>

          <strong>
            ${node.baseline_value !== null &&
        node.baseline_value !== undefined
        ? Number(node.baseline_value).toFixed(3)
        : '—'} m
          </strong>

        </div>


        <div>

          <span>
            Change
          </span>


          <strong
            class="${delta !== null &&
        delta !== undefined &&
        Number(delta) < 0
        ? 'dt-negative'
        : ''}"
          >
            ${deltaText}
          </strong>

        </div>


        <div>

          <span>
            Latitude
          </span>

          <strong>
            ${Number(node.lat).toFixed(6)}
          </strong>

        </div>


        <div>

          <span>
            Longitude
          </span>

          <strong>
            ${Number(node.lon).toFixed(6)}
          </strong>

        </div>

      </div>


      <div class="dt-detail-note">

        Hydraulic values are calculated by EPANET/WNTR.
        Geographic placement comes from the Google Earth
        Pro-derived network geometry.

      </div>
    `;
  },


  /*
   * ==========================================================
   * LOAD NETWORK
   * ==========================================================
   */

  async load(scenario = 'baseline') {

    const s =
      this.state;


    s.loading = true;
    s.error = null;
    s.scenario = scenario;
    s.selectedNode = null;


    const container =
      document.getElementById(
        'municipal-subview-container'
      );


    if (container) {

      container.innerHTML =
        this.render();

    }


    try {

      const endpoint =
        `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.NETWORK}` +
        `?scenario=${encodeURIComponent(scenario)}`;


      const response =
        await fetch(endpoint);


      if (!response.ok) {

        const body =
          await response
            .json()
            .catch(() => ({}));


        throw new Error(
          body.error ||
          `HTTP ${response.status}`
        );

      }


      const data =
        await response.json();


      if (
        !data ||
        !Array.isArray(data.nodes)
      ) {

        throw new Error(
          'Invalid network response: nodes are missing.'
        );

      }


      if (
        !Array.isArray(data.links)
      ) {

        throw new Error(
          'Invalid network response: links are missing.'
        );

      }


      s.network =
        data;


      /*
       * Normalize junction data.
       */

      s.network.nodes =
        s.network.nodes.map(node => ({

          ...node,

          id:
            String(node.id),

          value:
            node.pressure !== undefined
              ? node.pressure
              : node.value,

          baseline_value:
            node.baseline_pressure !== undefined
              ? node.baseline_pressure
              : node.baseline_value,

          delta:
            node.delta_pressure !== undefined
              ? node.delta_pressure
              : node.delta

        }));


      /*
       * Normalize pipe data.
       */

      s.network.links =
        s.network.links.map(link => ({

          ...link,

          id:
            String(link.id),

          from_to:
            link.name ||
            `${link.from}-${link.to}`,

          value:
            link.flow !== undefined
              ? link.flow
              : link.value,

          baseline_value:
            link.baseline_flow !== undefined
              ? link.baseline_flow
              : link.baseline_value,

          delta:
            link.delta_flow !== undefined
              ? link.delta_flow
              : link.delta

        }));


      s.loading =
        false;


      if (container) {

        container.innerHTML =
          this.render();

      }


      requestAnimationFrame(() => {

        this.mountCesium();

      });

    } catch (error) {

      console.error(
        'Digital Twin API error:',
        error
      );


      s.loading =
        false;


      s.error =
        `Unable to load the network from the Flask API (${error.message}).`;


      if (container) {

        container.innerHTML =
          this.render();

      }

    }

  },


  /*
   * ==========================================================
   * SCENARIO
   * ==========================================================
   */

  switchScenario(scenario) {

    this.state.selectedNode =
      null;

    this.destroyViewer();

    this.load(scenario);

  },


  /*
   * ==========================================================
   * DESTROY CESIUM
   * ==========================================================
   */

  destroyViewer() {

    const s =
      this.state;


    if (s.viewer) {

      if (
        s.viewer.__hydroInteractionHandler
      ) {

        try {

          s.viewer.__hydroInteractionHandler.destroy();

        } catch (error) {

          console.warn(
            'Cesium interaction cleanup warning:',
            error
          );

        }

      }


      try {

        s.viewer.destroy();

      } catch (error) {

        console.warn(
          'Cesium viewer cleanup warning:',
          error
        );

      }

    }


    s.viewer =
      null;

    s.nodeEntities =
      [];

    s.pipeEntities =
      [];

    s.sourceEntity =
      null;

  },


  /*
   * ==========================================================
   * CESIUM VIEWER
   * ==========================================================
   */

  async mountCesium() {

    const s =
      this.state;


    const element =
      document.getElementById(
        'digital-twin-map'
      );


    if (
      !element ||
      !s.network
    ) {

      return;

    }


    if (
      typeof Cesium ===
      'undefined'
    ) {

      console.error(
        'CesiumJS is not loaded.'
      );


      s.error =
        'CesiumJS failed to load. Please check the Cesium library in index.html.';


      const container =
        document.getElementById(
          'municipal-subview-container'
        );


      if (container) {

        container.innerHTML =
          this.render();

      }


      return;

    }


    this.destroyViewer();


    try {

      /*
       * --------------------------------------------------------
       * World terrain
       * --------------------------------------------------------
       */

      const terrainProvider =
        await Cesium.createWorldTerrainAsync();


      /*
       * --------------------------------------------------------
       * Viewer
       * --------------------------------------------------------
       */

      const viewer =
        new Cesium.Viewer(
          element,
          {

            terrainProvider,

            animation:
              false,

            timeline:
              false,

            baseLayerPicker:
              true,

            geocoder:
              true,

            homeButton:
              true,

            sceneModePicker:
              true,

            navigationHelpButton:
              false,

            fullscreenButton:
              true,

            infoBox:
              false,

            selectionIndicator:
              false,

            shadows:
              true,

            shouldAnimate:
              true,

            requestRenderMode:
              false,

            scene3DOnly:
              true

          }
        );


      s.viewer =
        viewer;


      /*
       * --------------------------------------------------------
       * Scene settings
       * --------------------------------------------------------
       */

      viewer.scene.globe.depthTestAgainstTerrain =
        true;


      viewer.scene.globe.enableLighting =
        true;


      viewer.scene.fog.enabled =
        true;


      viewer.scene.fog.density =
        0.00015;


      viewer.scene.screenSpaceCameraController.enableCollisionDetection =
        true;


      viewer.scene.postProcessStages.fxaa.enabled =
        true;


      const creditContainer =
        element.querySelector(
          '.cesium-viewer-bottom'
        );


      if (creditContainer) {

        creditContainer.style.fontSize =
          '9px';

      }


      /*
       * --------------------------------------------------------
       * Hydraulic network
       * --------------------------------------------------------
       */

      this.addPipeEntities();

      await this.addNodeEntities();

      await this.addSourceEntity();


      /*
       * --------------------------------------------------------
       * Interaction
       * --------------------------------------------------------
       */

      this.setupCesiumInteraction();


      /*
       * --------------------------------------------------------
       * Camera
       * --------------------------------------------------------
       */

      this.flyToNetwork();


      /*
       * --------------------------------------------------------
       * Resize
       * --------------------------------------------------------
       */

      setTimeout(() => {

        if (
          s.viewer &&
          !s.viewer.isDestroyed()
        ) {

          s.viewer.resize();

        }

      }, 150);


    } catch (error) {

      console.error(
        'Cesium initialization error:',
        error
      );


      s.error =
        `Unable to initialize the 3D Digital Twin (${error.message}).`;


      const container =
        document.getElementById(
          'municipal-subview-container'
        );


      if (container) {

        container.innerHTML =
          this.render();

      }

    }

  },


  /*
   * ==========================================================
   * COORDINATE NORMALIZATION
   * ==========================================================
   */

  normalizeCoordinate(point) {

    if (!point) {

      return null;

    }


    if (
      !Array.isArray(point) &&
      typeof point === 'object'
    ) {

      const lat =
        Number(
          point.lat ??
          point.latitude
        );


      const lon =
        Number(
          point.lon ??
          point.lng ??
          point.longitude
        );


      const altitude =
        Number(
          point.alt ??
          point.altitude ??
          point.elevation ??
          0
        );


      if (
        Number.isFinite(lat) &&
        Number.isFinite(lon)
      ) {

        return {

          lon,

          lat,

          altitude:
            Number.isFinite(altitude)
              ? altitude
              : 0

        };

      }


      return null;

    }


    if (
      !Array.isArray(point) ||
      point.length < 2
    ) {

      return null;

    }


    const a =
      Number(point[0]);

    const b =
      Number(point[1]);

    const c =
      point.length >= 3
        ? Number(point[2])
        : 0;


    if (
      !Number.isFinite(a) ||
      !Number.isFinite(b)
    ) {

      return null;

    }


    if (
      Math.abs(a) <= 90 &&
      Math.abs(b) > 90
    ) {

      return {

        lat: a,

        lon: b,

        altitude:
          Number.isFinite(c)
            ? c
            : 0

      };

    }


    if (
      Math.abs(a) > 90 &&
      Math.abs(b) <= 90
    ) {

      return {

        lon: a,

        lat: b,

        altitude:
          Number.isFinite(c)
            ? c
            : 0

      };

    }


    if (
      Math.abs(a) <= 90 &&
      Math.abs(b) <= 90
    ) {

      return {

        lat: a,

        lon: b,

        altitude:
          Number.isFinite(c)
            ? c
            : 0

      };

    }


    return null;

  },


  /*
   * ==========================================================
   * NODE COORDINATE
   * ==========================================================
   */

  getNodeCoordinate(node) {

    if (!node) {

      return null;

    }


    const lat =
      Number(node.lat);

    const lon =
      Number(node.lon);


    if (
      Number.isFinite(lat) &&
      Number.isFinite(lon)
    ) {

      const altitude =
        Number(
          node.altitude ??
          node.elevation ??
          node.alt ??
          0
        );


      return {

        lat,

        lon,

        altitude:
          Number.isFinite(altitude)
            ? altitude
            : 0

      };

    }


    if (node.coordinates) {

      return this.normalizeCoordinate(
        node.coordinates
      );

    }


    return null;

  },


  /*
   * ==========================================================
   * PIPE COORDINATES
   * ==========================================================
   */

  getPipeCoordinates(link) {

    if (!link) {

      return [];

    }


    let raw =
      link.coordinates;


    if (
      !Array.isArray(raw) &&
      link.geometry &&
      Array.isArray(link.geometry.coordinates)
    ) {

      raw =
        link.geometry.coordinates;

    }


    if (
      !Array.isArray(raw)
    ) {

      return [];

    }


    if (
      raw.length >= 2 &&
      typeof raw[0] === 'number'
    ) {

      const point =
        this.normalizeCoordinate(raw);


      return point
        ? [point]
        : [];

    }


    return raw
      .map(point =>
        this.normalizeCoordinate(point)
      )
      .filter(Boolean);

  },


  /*
   * ==========================================================
   * PIPE ENTITIES
   * ==========================================================
   */

  async addPipeEntities() {

    const s =
      this.state;

    const viewer =
      s.viewer;

    if (
      !viewer ||
      !s.network
    ) {

      return;

    }


    /*
     * ========================================================
     * PIPE TERRAIN + TOPOLOGY ALIGNMENT
     *
     * Every pipe:
     *
     *   1. Uses the Google Earth Pro / KML path.
     *   2. Forces the first point to the actual FROM junction.
     *   3. Forces the last point to the actual TO junction.
     *   4. Samples Cesium terrain at every point.
     *   5. Places the pipe 3 m above the terrain.
     *
     * This prevents terrain from hiding the pipe and guarantees
     * that the visual pipe connects to the visual junctions.
     * ========================================================
     */


    for (const link of s.network.links) {

      let coordinates =
        this.getPipeCoordinates(link);


      /*
       * --------------------------------------------------------
       * Find connected junctions.
       * --------------------------------------------------------
       */

      const fromId =
        String(
          link.from ??
          link.start ??
          ''
        );


      const toId =
        String(
          link.to ??
          link.end ??
          ''
        );


      const fromNode =
        s.network.nodes.find(
          node =>
            String(node.id) === fromId ||
            String(node.id) === `J${fromId}`
        );


      const toNode =
        s.network.nodes.find(
          node =>
            String(node.id) === toId ||
            String(node.id) === `J${toId}`
        );


      const fromCoord =
        this.getNodeCoordinate(
          fromNode
        );


      const toCoord =
        this.getNodeCoordinate(
          toNode
        );


      /*
       * --------------------------------------------------------
       * If KML geometry is unavailable, reconstruct the pipe
       * directly from its junctions.
       * --------------------------------------------------------
       */

      if (
        coordinates.length < 2 &&
        fromCoord &&
        toCoord
      ) {

        coordinates = [

          {
            ...fromCoord
          },

          {
            ...toCoord
          }

        ];

      }


      if (
        coordinates.length < 2
      ) {

        console.warn(
          `Skipping ${link.id}: insufficient pipe coordinates.`
        );

        continue;

      }


      /*
       * --------------------------------------------------------
       * FORCE THE PIPE ENDPOINTS TO THE EXACT JUNCTION
       * COORDINATES.
       *
       * This is important because the KML path endpoints and
       * KML junction points are not mathematically identical.
       * --------------------------------------------------------
       */

      if (fromCoord) {

        coordinates[0] = {

          lon:
            fromCoord.lon,

          lat:
            fromCoord.lat,

          altitude:
            fromCoord.altitude

        };

      }


      if (toCoord) {

        coordinates[
          coordinates.length - 1
        ] = {

          lon:
            toCoord.lon,

          lat:
            toCoord.lat,

          altitude:
            toCoord.altitude

        };

      }


      /*
       * --------------------------------------------------------
       * Sample Cesium terrain at every pipe point.
       * --------------------------------------------------------
       */

      const terrainPositions =
        coordinates.map(point =>

          Cesium.Cartographic.fromDegrees(
            point.lon,
            point.lat
          )

        );


      let sampledPositions =
        terrainPositions;


      try {

        sampledPositions =
          await Cesium.sampleTerrainMostDetailed(
            viewer.terrainProvider,
            terrainPositions
          );

      } catch (error) {

        console.warn(
          `Terrain sampling failed for ${link.id}.`,
          error
        );

      }


      /*
       * --------------------------------------------------------
       * Convert to terrain-following 3D points.
       *
       * 3 metres above terrain prevents the terrain mesh from
       * hiding the pipe.
       * --------------------------------------------------------
       */

      const pipePoints =
        coordinates.map(
          (point, index) => {

            let terrainHeight =
              Number(
                point.altitude
              );


            if (
              sampledPositions[index] &&
              Number.isFinite(
                sampledPositions[index].height
              )
            ) {

              terrainHeight =
                sampledPositions[index].height;

            }


            if (
              !Number.isFinite(
                terrainHeight
              )
            ) {

              terrainHeight =
                0;

            }


            return {

              lon:
                point.lon,

              lat:
                point.lat,

              height:
                terrainHeight + 3

            };

          }
        );


      /*
       * --------------------------------------------------------
       * Scenario highlighting.
       *
       * J4 disruption -> P7
       * J6 disruption -> P2
       * --------------------------------------------------------
       */

      const affected =

        (
          s.scenario === 'j4_leak' &&
          String(link.id) === 'P7'
        )

        ||

        (
          s.scenario === 'j6_leak' &&
          String(link.id) === 'P2'
        );


      /*
       * --------------------------------------------------------
       * Cesium Cartesian positions.
       * --------------------------------------------------------
       */

      const positions =
        Cesium.Cartesian3.fromDegreesArrayHeights(

          pipePoints.flatMap(
            point => [

              point.lon,

              point.lat,

              point.height

            ]
          )

        );


      /*
       * --------------------------------------------------------
       * Pipe shadow.
       * --------------------------------------------------------
       */

      viewer.entities.add({

        id:
          `pipe-shadow-${link.id}`,

        polyline: {

          positions,

          width:
            affected
              ? 9
              : 7,

          material:
            Cesium.Color.BLACK.withAlpha(
              0.55
            ),

          clampToGround:
            false,

          arcType:
            Cesium.ArcType.GEODESIC

        }

      });


      /*
       * --------------------------------------------------------
       * Main hydraulic pipe.
       * --------------------------------------------------------
       */

      const entity =
        viewer.entities.add({

          id:
            `pipe-${link.id}`,

          properties: {

            elementType:
              'pipe',

            elementId:
              String(link.id),

            flow:
              link.value ?? null,

            baselineFlow:
              link.baseline_value ?? null,

            delta:
              link.delta ?? null,

            scenario:
              s.scenario

          },

          polyline: {

            positions,

            width:
              affected
                ? 5
                : 3.5,

            material:

              affected

                ? new Cesium.PolylineGlowMaterialProperty({

                  glowPower:
                    0.25,

                  taperPower:
                    0.7,

                  color:
                    Cesium.Color.ORANGE

                })

                : new Cesium.PolylineGlowMaterialProperty({

                  glowPower:
                    0.12,

                  taperPower:
                    0.8,

                  color:
                    Cesium.Color.CYAN

                }),

            clampToGround:
              false,

            arcType:
              Cesium.ArcType.GEODESIC

          }

        });


      s.pipeEntities.push(
        entity
      );

    }

  },
  /*
   * ==========================================================
   * JUNCTION ENTITIES
   *
   * Terrain is sampled before markers are created.
   * ==========================================================
   */

  async addNodeEntities() {

    const s =
      this.state;


    const viewer =
      s.viewer;


    if (
      !viewer ||
      !s.network
    ) {

      return;

    }


    /*
     * Create terrain sampling positions.
     */

    const terrainPositions =
      s.network.nodes
        .map(node => {

          const coordinate =
            this.getNodeCoordinate(node);


          if (!coordinate) {

            return null;

          }


          return Cesium.Cartographic.fromDegrees(
            coordinate.lon,
            coordinate.lat
          );

        })
        .filter(Boolean);


    let sampledPositions =
      [];


    /*
     * Sample Cesium World Terrain.
     */

    try {

      if (terrainPositions.length) {

        sampledPositions =
          await Cesium.sampleTerrainMostDetailed(
            viewer.terrainProvider,
            terrainPositions
          );

      }

    } catch (error) {

      console.warn(
        'Cesium terrain sampling failed. Using KML elevations:',
        error
      );

      sampledPositions =
        terrainPositions;

    }


    /*
     * Create nodes.
     */

    s.network.nodes.forEach((node, index) => {

      const coordinate =
        this.getNodeCoordinate(node);


      if (!coordinate) {

        console.warn(
          `Skipping ${node.id}: invalid coordinates.`
        );

        return;

      }


      const affected =

        (
          s.scenario === 'j4_leak' &&
          String(node.id) === 'J4'
        )

        ||

        (
          s.scenario === 'j6_leak' &&
          String(node.id) === 'J6'
        );


      const pressure =
        Number(node.value);


      /*
       * Node visualization state.
       */

      let nodeColor =
        Cesium.Color.CYAN;


      if (
        Number.isFinite(pressure) &&
        pressure < 10
      ) {

        nodeColor =
          Cesium.Color.YELLOW;

      }


      if (affected) {

        nodeColor =
          Cesium.Color.ORANGE;

      }


      /*
       * --------------------------------------------------------
       * Actual terrain height.
       * --------------------------------------------------------
       */

      let terrainHeight =
        Number(coordinate.altitude);


      if (
        sampledPositions[index] &&
        Number.isFinite(
          sampledPositions[index].height
        )
      ) {

        terrainHeight =
          sampledPositions[index].height;

      }


      if (!Number.isFinite(terrainHeight)) {

        terrainHeight =
          0;

      }


      /*
       * Small offset above terrain.
       */

      const nodeHeight =
        terrainHeight + 1.5;


      /*
       * --------------------------------------------------------
       * Visual hydraulic column.
       * --------------------------------------------------------
       */

      const pressureVisualHeight =
        Number.isFinite(pressure)

          ? Math.max(
            4,
            Math.min(
              45,
              pressure * 1.2
            )
          )

          : 8;


      const column =
        viewer.entities.add({

          id:
            `node-column-${node.id}`,

          properties: {

            elementType:
              'junction',

            elementId:
              String(node.id),

            pressure:
              node.value ?? null,

            baselinePressure:
              node.baseline_value ?? null,

            delta:
              node.delta ?? null

          },

          polyline: {

            positions:
              Cesium.Cartesian3.fromDegreesArrayHeights([

                coordinate.lon,
                coordinate.lat,
                nodeHeight,

                coordinate.lon,
                coordinate.lat,
                nodeHeight +
                pressureVisualHeight

              ]),

            width:
              affected
                ? 7
                : 4,

            material:

              affected

                ? new Cesium.PolylineGlowMaterialProperty({

                  glowPower:
                    0.35,

                  color:
                    Cesium.Color.ORANGE

                })

                : new Cesium.PolylineGlowMaterialProperty({

                  glowPower:
                    0.18,

                  color:
                    nodeColor

                })

          }

        });


      /*
       * --------------------------------------------------------
       * Junction point.
       *
       * IMPORTANT:
       * We intentionally allow Cesium depth testing here.
       * This prevents the marker from appearing detached from
       * the terrain when zooming closely.
       * --------------------------------------------------------
       */

      const point =
        viewer.entities.add({

          id:
            `junction-${node.id}`,

          properties: {

            elementType:
              'junction',

            elementId:
              String(node.id),

            pressure:
              node.value ?? null,

            baselinePressure:
              node.baseline_value ?? null,

            delta:
              node.delta ?? null

          },

          position:
            Cesium.Cartesian3.fromDegrees(

              coordinate.lon,

              coordinate.lat,

              nodeHeight

            ),


          point: {

            pixelSize:
              affected
                ? 18
                : 13,

            color:
              nodeColor,

            outlineColor:
              Cesium.Color.WHITE,

            outlineWidth:
              2,

            /*
             * DO NOT use disableDepthTestDistance here.
             * The marker should respect the terrain.
             */

            heightReference:
              Cesium.HeightReference.NONE

          },


          label: {

            text:
              affected
                ? `⚠ ${node.id}`
                : String(node.id),

            font:
              'bold 12px JetBrains Mono',

            fillColor:
              Cesium.Color.WHITE,

            outlineColor:
              Cesium.Color.BLACK,

            outlineWidth:
              4,

            style:
              Cesium.LabelStyle.FILL_AND_OUTLINE,

            showBackground:
              true,

            backgroundColor:
              affected

                ? Cesium.Color.DARKORANGE.withAlpha(
                  0.9
                )

                : Cesium.Color.fromCssColorString(
                  '#081220'
                ).withAlpha(0.88),

            backgroundPadding:
              new Cesium.Cartesian2(
                6,
                4
              ),

            pixelOffset:
              new Cesium.Cartesian2(
                0,
                -24
              ),

            /*
             * Labels remain readable but still use normal
             * depth behaviour.
             */

            disableDepthTestDistance:
              500

          }

        });


      /*
       * --------------------------------------------------------
       * Affected junction ring.
       * --------------------------------------------------------
       */

      if (affected) {

        viewer.entities.add({

          id:
            `junction-alert-${node.id}`,

          position:
            Cesium.Cartesian3.fromDegrees(

              coordinate.lon,

              coordinate.lat,

              nodeHeight + 0.5

            ),

          ellipse: {

            semiMinorAxis:
              12,

            semiMajorAxis:
              12,

            height:
              nodeHeight + 0.5,

            material:
              Cesium.Color.ORANGE.withAlpha(
                0.18
              ),

            outline:
              true,

            outlineColor:
              Cesium.Color.ORANGE,

            outlineWidth:
              3

          }

        });

      }


      s.nodeEntities.push(
        point,
        column
      );

    });

  },


  /*
   * ==========================================================
   * SOURCE
   *
   * Uses the same terrain anchoring strategy as junctions.
   * ==========================================================
   */

  async addSourceEntity() {

    const s =
      this.state;


    const viewer =
      s.viewer;


    if (
      !viewer ||
      !s.network
    ) {

      return;

    }


    const source =
      s.network.source;


    if (!source) {

      return;

    }


    const coordinate =
      this.getNodeCoordinate(source);


    if (!coordinate) {

      return;

    }


    /*
     * --------------------------------------------------------
     * Sample actual Cesium terrain.
     * --------------------------------------------------------
     */

    let terrainHeight =
      Number(coordinate.altitude);


    try {

      const terrainPosition =
        Cesium.Cartographic.fromDegrees(
          coordinate.lon,
          coordinate.lat
        );


      const sampled =
        await Cesium.sampleTerrainMostDetailed(
          viewer.terrainProvider,
          [terrainPosition]
        );


      if (
        sampled &&
        sampled[0] &&
        Number.isFinite(
          sampled[0].height
        )
      ) {

        terrainHeight =
          sampled[0].height;

      }

    } catch (error) {

      console.warn(
        'Source terrain sampling failed. Using KML elevation:',
        error
      );

    }


    if (!Number.isFinite(terrainHeight)) {

      terrainHeight =
        0;

    }


    /*
     * Small offset above the terrain.
     */

    const sourceHeight =
      terrainHeight + 2;


    /*
     * --------------------------------------------------------
     * Source marker.
     * --------------------------------------------------------
     */

    const entity =
      viewer.entities.add({

        id:
          'water-source',

        properties: {

          elementType:
            'source',

          elementId:
            'SOURCE'

        },

        position:
          Cesium.Cartesian3.fromDegrees(

            coordinate.lon,

            coordinate.lat,

            sourceHeight

          ),


        point: {

          pixelSize:
            18,

          color:
            Cesium.Color.WHITE,

          outlineColor:
            Cesium.Color.CYAN,

          outlineWidth:
            3,

          /*
           * Allow terrain depth testing.
           */

          heightReference:
            Cesium.HeightReference.NONE

        },


        label: {

          text:
            'SOURCE',

          font:
            'bold 12px JetBrains Mono',

          fillColor:
            Cesium.Color.WHITE,

          outlineColor:
            Cesium.Color.BLACK,

          outlineWidth:
            4,

          style:
            Cesium.LabelStyle.FILL_AND_OUTLINE,

          showBackground:
            true,

          backgroundColor:
            Cesium.Color.fromCssColorString(
              '#081220'
            ).withAlpha(0.9),

          backgroundPadding:
            new Cesium.Cartesian2(
              7,
              4
            ),

          pixelOffset:
            new Cesium.Cartesian2(
              0,
              -25
            ),

          disableDepthTestDistance:
            500

        }

      });


    s.sourceEntity =
      entity;

  },


  /*
   * ==========================================================
   * CESIUM INTERACTION
   * ==========================================================
   */

  setupCesiumInteraction() {

    const s =
      this.state;


    const viewer =
      s.viewer;


    if (!viewer) {

      return;

    }


    const handler =
      new Cesium.ScreenSpaceEventHandler(
        viewer.scene.canvas
      );


    /*
     * --------------------------------------------------------
     * Click interaction
     * --------------------------------------------------------
     */

    handler.setInputAction(

      click => {

        const picked =
          viewer.scene.pick(
            click.position
          );


        if (
          !Cesium.defined(picked) ||
          !picked.id
        ) {

          return;

        }


        const entity =
          picked.id;


        const elementType =
          this.readProperty(
            entity,
            'elementType'
          );


        const elementId =
          this.readProperty(
            entity,
            'elementId'
          );


        if (
          elementType ===
          'junction'
        ) {

          const node =
            s.network.nodes.find(
              item =>
                String(item.id) ===
                String(elementId)
            );


          if (node) {

            this.selectNode(
              node
            );

          }

          return;

        }


        if (
          elementType ===
          'pipe'
        ) {

          this.showPipeDetails(
            entity
          );

          return;

        }


        if (
          elementType ===
          'source'
        ) {

          this.showSourceDetails();

        }

      },

      Cesium.ScreenSpaceEventType.LEFT_CLICK

    );


    /*
     * --------------------------------------------------------
     * Hover cursor
     * --------------------------------------------------------
     */

    handler.setInputAction(

      movement => {

        const picked =
          viewer.scene.pick(
            movement.endPosition
          );


        viewer.scene.canvas.style.cursor =
          Cesium.defined(picked)
            ? 'pointer'
            : 'default';

      },

      Cesium.ScreenSpaceEventType.MOUSE_MOVE

    );


    viewer.__hydroInteractionHandler =
      handler;

  },


  /*
   * ==========================================================
   * PROPERTY HELPER
   * ==========================================================
   */

  readProperty(entity, property) {

    if (
      !entity ||
      !entity.properties
    ) {

      return null;

    }


    const value =
      entity.properties[property];


    if (
      value &&
      typeof value.getValue ===
      'function'
    ) {

      return value.getValue(
        Cesium.JulianDate.now()
      );

    }


    return value ?? null;

  },


  /*
   * ==========================================================
   * SELECT NODE
   *
   * Camera now stops at a comfortable distance instead of
   * diving extremely close to the terrain.
   * ==========================================================
   */

  selectNode(node) {

    const s =
      this.state;


    s.selectedNode =
      node;


    const container =
      document.getElementById(
        'municipal-subview-container'
      );


    if (container) {

      const detail =
        container.querySelector(
          '.dt-detail-card .dash-card-body'
        );


      if (detail) {

        detail.innerHTML =
          this.renderDetails();

      }

    }


    /*
     * --------------------------------------------------------
     * Focus camera on selected junction.
     *
     * We use a HeadingPitchRange instead of an absolute
     * 550 m destination. This produces a much more natural
     * local inspection view.
     * --------------------------------------------------------
     */

    const coordinate =
      this.getNodeCoordinate(
        node
      );


    if (
      coordinate &&
      s.viewer
    ) {

      const target =
        Cesium.Cartesian3.fromDegrees(
          coordinate.lon,
          coordinate.lat,
          coordinate.altitude
        );


      s.viewer.camera.flyTo({

        destination:
          Cesium.Cartesian3.fromDegrees(

            coordinate.lon,

            coordinate.lat,

            Math.max(
              coordinate.altitude + 180,
              180
            )

          ),

        orientation: {

          heading:
            Cesium.Math.toRadians(
              25
            ),

          pitch:
            Cesium.Math.toRadians(
              -60
            ),

          roll:
            0

        },

        duration:
          1.2

      });

    }

  },


  /*
   * ==========================================================
   * PIPE DETAILS
   * ==========================================================
   */

  showPipeDetails(entity) {

    const flow =
      this.readProperty(
        entity,
        'flow'
      );


    const baseline =
      this.readProperty(
        entity,
        'baselineFlow'
      );


    const delta =
      this.readProperty(
        entity,
        'delta'
      );


    const id =
      this.readProperty(
        entity,
        'elementId'
      );


    const message = `

      <div class="dt-popup">

        <strong>
          ${id}
        </strong>


        <div class="dt-popup-subtitle">
          Hydraulic pipe
        </div>


        <hr>


        <div>
          Flow:
          <b>
            ${flow === null ||
        flow === undefined
        ? '—'
        : Number(flow).toFixed(3)}
            L/s
          </b>
        </div>


        <div>
          Baseline:
          <b>
            ${baseline === null ||
        baseline === undefined
        ? '—'
        : Number(baseline).toFixed(3)}
            L/s
          </b>
        </div>


        <div>
          Change:
          <b>
            ${delta === null ||
        delta === undefined
        ? '—'
        : `${Number(delta) > 0 ? '+' : ''}${Number(delta).toFixed(3)} L/s`}
          </b>
        </div>

      </div>

    `;


    this.showCesiumInfo(
      message
    );

  },


  /*
   * ==========================================================
   * SOURCE DETAILS
   * ==========================================================
   */

  showSourceDetails() {

    this.showCesiumInfo(`

      <div class="dt-popup">

        <strong>
          Water Source
        </strong>


        <div class="dt-popup-subtitle">
          EPANET / WNTR source node
        </div>


        <hr>


        <div>
          Hydraulic source
        </div>

      </div>

    `);

  },


  /*
   * ==========================================================
   * SIMPLE CESIUM INFO PANEL
   * ==========================================================
   */

  showCesiumInfo(html) {

    const existing =
      document.querySelector(
        '.dt-cesium-info'
      );


    if (existing) {

      existing.remove();

    }


    const panel =
      document.createElement(
        'div'
      );


    panel.className =
      'dt-cesium-info';


    panel.innerHTML = `

      <button
        class="dt-cesium-info-close"
        type="button"
      >
        ×
      </button>

      ${html}

    `;


    const mapWrap =
      document.querySelector(
        '.dt-map-wrap'
      );


    if (mapWrap) {

      mapWrap.appendChild(
        panel
      );

    }


    const closeButton =
      panel.querySelector(
        '.dt-cesium-info-close'
      );


    if (closeButton) {

      closeButton.addEventListener(
        'click',
        () => panel.remove()
      );

    }

  },


  /*
   * ==========================================================
   * CAMERA
   * ==========================================================
   */

  flyToNetwork() {

    const s =
      this.state;


    const viewer =
      s.viewer;


    if (
      !viewer ||
      !s.network
    ) {

      return;

    }


    const positions =
      [];


    /*
     * Junctions.
     *
     * Keep the initial camera reasonably high.
     * This is only for framing the whole network.
     */

    s.network.nodes.forEach(node => {

      const coordinate =
        this.getNodeCoordinate(
          node
        );


      if (coordinate) {

        positions.push(

          Cesium.Cartesian3.fromDegrees(

            coordinate.lon,

            coordinate.lat,

            Math.max(
              coordinate.altitude + 30,
              30
            )

          )

        );

      }

    });


    /*
     * Source.
     */

    if (s.network.source) {

      const sourceCoordinate =
        this.getNodeCoordinate(
          s.network.source
        );


      if (sourceCoordinate) {

        positions.push(

          Cesium.Cartesian3.fromDegrees(

            sourceCoordinate.lon,

            sourceCoordinate.lat,

            Math.max(
              sourceCoordinate.altitude + 30,
              30
            )

          )

        );

      }

    }


    if (!positions.length) {

      viewer.camera.flyTo({

        destination:
          Cesium.Cartesian3.fromDegrees(

            74.50545,

            15.87420,

            2500

          ),

        orientation: {

          heading:
            0,

          pitch:
            Cesium.Math.toRadians(
              -50
            ),

          roll:
            0

        }

      });


      return;

    }


    const boundingSphere =
      Cesium.BoundingSphere.fromPoints(
        positions
      );


    viewer.camera.flyToBoundingSphere(

      boundingSphere,

      {

        duration:
          1.5,

        offset:
          new Cesium.HeadingPitchRange(

            Cesium.Math.toRadians(
              20
            ),

            Cesium.Math.toRadians(
              -55
            ),

            Math.max(
              boundingSphere.radius * 3.5,
              650
            )

          )

      }

    );

  },


  /*
   * ==========================================================
   * INIT
   * ==========================================================
   */

  init() {

    if (
      typeof Cesium ===
      'undefined'
    ) {

      console.warn(
        'CesiumJS has not loaded yet. Retrying...'
      );


      setTimeout(
        () => this.init(),
        500
      );


      return;

    }


    this.load(
      this.state.scenario
    );

  }

};


/*
 * ============================================================
 * GLOBAL APPLICATION ACCESS
 * ============================================================
 */

window.DigitalTwinView =
  DigitalTwinView;