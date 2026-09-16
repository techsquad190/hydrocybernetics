/*
 * ============================================================
 * HYDROCYBERNETICS
 * LIVE HYDRAULIC INTEGRATION BRIDGE
 *
 * Connects the current EPANET/WNTR API response to the
 * existing Municipal Simulation and Leak Analysis UI.
 *
 * Backend:
 *   /api/simulation/scenarios
 *   /api/simulation/results
 *   /api/simulation/comparison
 *
 * This file does NOT modify:
 *   - EPANET
 *   - WNTR
 *   - SQLite
 *   - Digital Twin / Cesium
 *   - IoT telemetry
 * ============================================================
 */

(function () {

    'use strict';


    /*
     * ----------------------------------------------------------
     * Wait until DashboardMunicipalView exists.
     * ----------------------------------------------------------
     */

    function initialise() {

        if (
            typeof window.DashboardMunicipalView ===
            'undefined'
        ) {

            console.warn(
                'Hydraulic integration: DashboardMunicipalView not ready. Retrying...'
            );

            setTimeout(
                initialise,
                300
            );

            return;

        }


        const DM =
            window.DashboardMunicipalView;


        const API =
            (
                typeof CONFIG !== 'undefined' &&
                CONFIG.API_BASE_URL
            )
                ? CONFIG.API_BASE_URL
                : 'http://localhost:5000';


        const ENDPOINTS =
            (
                typeof CONFIG !== 'undefined' &&
                CONFIG.ENDPOINTS
            )
                ? CONFIG.ENDPOINTS
                : {};


        const RESULTS_ENDPOINT =
            ENDPOINTS.SIMULATION_RESULTS ||
            '/api/simulation/results';


        const SCENARIOS_ENDPOINT =
            ENDPOINTS.SIMULATION_SCENARIOS ||
            '/api/simulation/scenarios';


        const COMPARISON_ENDPOINT =
            ENDPOINTS.SIMULATION_COMPARISON ||
            '/api/simulation/comparison';


        /*
         * ========================================================
         * HELPERS
         * ========================================================
         */


        function getContainer() {

            return document.getElementById(
                'municipal-subview-container'
            );

        }


        function renderSimulation() {

            const container =
                getContainer();


            if (container) {

                container.innerHTML =
                    DM.renderSimulation();

            }

        }


        function renderLeakAnalysis() {

            const container =
                getContainer();


            if (
                container &&
                typeof DM.renderLeakAnalysis ===
                'function'
            ) {

                container.innerHTML =
                    DM.renderLeakAnalysis();

            }

        }


        /*
         * --------------------------------------------------------
         * Convert the NEW WNTR API response into the structure
         * expected by the existing frontend.
         *
         * NEW API:
         *
         * {
         *   scenario: "baseline",
         *   source: "EPANET/WNTR",
         *   results: [
         *     {
         *       element_type: "junction",
         *       element_id: "9",
         *       pressure: ...
         *     },
         *     {
         *       element_type: "pipe",
         *       element_id: "1",
         *       flow: ...
         *     }
         *   ]
         * }
         *
         * FRONTEND:
         *
         * {
         *   nodes: [...],
         *   pipes: [...]
         * }
         * --------------------------------------------------------
         */

        function normalizeScenarioResponse(
            response
        ) {

            const nodes =
                [];

            const pipes =
                [];


            if (
                response &&
                Array.isArray(
                    response.results
                )
            ) {

                response.results.forEach(
                    item => {

                        const type =
                            String(
                                item.element_type ||
                                item.type ||
                                ''
                            ).toLowerCase();


                        const rawId =
                            String(
                                item.element_id ??
                                item.id ??
                                ''
                            );


                        /*
                         * WNTR currently returns EPANET IDs as
                         * numeric strings ("1", "2", ...).
                         *
                         * The frontend uses J1...J9 and P1...P9.
                         */

                        if (
                            type === 'junction' ||
                            type === 'node'
                        ) {

                            const id =
                                rawId.startsWith('J')
                                    ? rawId
                                    : `J${rawId}`;


                            nodes.push({

                                id,

                                pressure:
                                    item.pressure ??
                                    item.value ??
                                    null,

                                demand:
                                    item.demand ??
                                    null,

                                unit:
                                    item.unit ||
                                    'm'

                            });

                        }


                        if (
                            type === 'pipe' ||
                            type === 'link'
                        ) {

                            const id =
                                rawId.startsWith('P')
                                    ? rawId
                                    : `P${rawId}`;


                            pipes.push({

                                id,

                                flow:
                                    item.flow ??
                                    item.value ??
                                    null,

                                unit:
                                    item.unit ||
                                    'L/s'

                            });

                        }

                    }
                );

            }


            /*
             * If an older backend response is encountered,
             * preserve compatibility with it.
             */

            if (
                response &&
                Array.isArray(
                    response.nodes
                )
            ) {

                response.nodes.forEach(
                    node => {

                        const id =
                            String(node.id);


                        if (
                            !nodes.some(
                                existing =>
                                    String(existing.id) === id
                            )
                        ) {

                            nodes.push(
                                node
                            );

                        }

                    }
                );

            }


            if (
                response &&
                Array.isArray(
                    response.pipes
                )
            ) {

                response.pipes.forEach(
                    pipe => {

                        const id =
                            String(pipe.id);


                        if (
                            !pipes.some(
                                existing =>
                                    String(existing.id) === id
                            )
                        ) {

                            pipes.push(
                                pipe
                            );

                        }

                    }
                );

            }


            return {

                scenario:
                    response?.scenario ||
                    'baseline',

                source:
                    response?.source ||
                    'EPANET/WNTR',

                nodes,

                pipes

            };

        }


        /*
         * ========================================================
         * LIVE SCENARIO FETCH
         * ========================================================
         */

        async function fetchScenario(
            scenario
        ) {

            const url =
                `${API}${RESULTS_ENDPOINT}` +
                `?scenario=${encodeURIComponent(
                    scenario
                )}`;


            console.log(
                `[Hydraulic] Fetching ${scenario}:`,
                url
            );


            const response =
                await fetch(
                    url,
                    {
                        method: 'GET',
                        cache: 'no-store'
                    }
                );


            if (!response.ok) {

                throw new Error(
                    `Hydraulic API returned HTTP ${response.status} for ${scenario}.`
                );

            }


            const data =
                await response.json();


            const normalized =
                normalizeScenarioResponse(
                    data
                );


            console.log(
                `[Hydraulic] ${scenario}:`,
                normalized
            );


            return normalized;

        }


        /*
         * ========================================================
         * SIMULATION
         *
         * Replace only the data-loading part of the old function.
         * The existing renderSimulation() remains untouched.
         * ========================================================
         */

        DM.loadSimulationData =
            async function (
                scenario = 'baseline'
            ) {

                const state =
                    DM.simulationState;


                state.loading =
                    true;

                state.error =
                    null;

                state.currentScenario =
                    scenario;


                renderSimulation();


                try {

                    /*
                     * --------------------------------------------------
                     * Load available scenarios.
                     * --------------------------------------------------
                     */

                    if (
                        state.scenarios.length === 0
                    ) {

                        try {

                            const scenarioResponse =
                                await fetch(
                                    `${API}${SCENARIOS_ENDPOINT}`,
                                    {
                                        method: 'GET',
                                        cache: 'no-store'
                                    }
                                );


                            if (
                                scenarioResponse.ok
                            ) {

                                const scenarioData =
                                    await scenarioResponse.json();


                                if (
                                    Array.isArray(
                                        scenarioData.scenarios
                                    )
                                ) {

                                    state.scenarios =
                                        scenarioData.scenarios;

                                }

                            }

                        } catch (error) {

                            /*
                             * Scenario-list failure should not prevent
                             * the actual selected scenario from loading.
                             */

                            console.warn(
                                '[Hydraulic] Scenario list unavailable:',
                                error
                            );

                        }

                    }


                    /*
                     * --------------------------------------------------
                     * Load live EPANET/WNTR results.
                     * --------------------------------------------------
                     */

                    state.results =
                        await fetchScenario(
                            scenario
                        );


                    /*
                     * --------------------------------------------------
                     * Load comparison for disruption scenarios.
                     *
                     * We prefer the backend comparison endpoint.
                     * --------------------------------------------------
                     */

                    state.comparison =
                        null;


                    if (
                        scenario !== 'baseline'
                    ) {

                        try {

                            const comparisonResponse =
                                await fetch(
                                    `${API}${COMPARISON_ENDPOINT}` +
                                    `?scenario=${encodeURIComponent(
                                        scenario
                                    )}`,
                                    {
                                        method: 'GET',
                                        cache: 'no-store'
                                    }
                                );


                            if (
                                comparisonResponse.ok
                            ) {

                                const comparisonData =
                                    await comparisonResponse.json();


                                state.comparison =
                                    normalizeComparison(
                                        comparisonData
                                    );

                            }

                        } catch (error) {

                            console.warn(
                                '[Hydraulic] Comparison endpoint unavailable. Building comparison locally.',
                                error
                            );


                            /*
                             * Fallback:
                             * compare live scenario against live baseline.
                             */

                            const baseline =
                                await fetchScenario(
                                    'baseline'
                                );


                            state.comparison =
                                buildComparison(
                                    baseline,
                                    state.results
                                );

                        }

                    }


                    /*
                     * --------------------------------------------------
                     * Validate.
                     * --------------------------------------------------
                     */

                    if (
                        !state.results ||
                        !Array.isArray(
                            state.results.nodes
                        ) ||
                        !Array.isArray(
                            state.results.pipes
                        )
                    ) {

                        throw new Error(
                            'The hydraulic API returned no usable junction or pipe data.'
                        );

                    }


                    if (
                        state.results.nodes.length === 0 &&
                        state.results.pipes.length === 0
                    ) {

                        throw new Error(
                            `No hydraulic elements were returned for scenario '${scenario}'.`
                        );

                    }


                    state.loading =
                        false;


                    state.error =
                        null;


                    console.log(
                        '[Hydraulic] Simulation data connected successfully.'
                    );


                } catch (error) {

                    console.error(
                        '[Hydraulic] Simulation connection error:',
                        error
                    );


                    state.loading =
                        false;


                    state.error =
                        error &&
                            error.message
                            ? error.message
                            : 'Unable to load hydraulic simulation data.';

                }


                renderSimulation();

            };


        /*
         * ========================================================
         * COMPARISON NORMALIZATION
         * ========================================================
         */

        function normalizeComparison(
            response
        ) {

            /*
             * Backend comparison should already contain
             * nodes and pipes.
             */

            if (
                response &&
                Array.isArray(
                    response.nodes
                ) &&
                Array.isArray(
                    response.pipes
                )
            ) {

                return {

                    nodes:
                        response.nodes.map(
                            node => ({

                                id:
                                    String(node.id)
                                        .startsWith('J')
                                        ? String(node.id)
                                        : `J${node.id}`,

                                baseline:
                                    Number(
                                        node.baseline ??
                                        node.baseline_pressure ??
                                        0
                                    ),

                                current:
                                    Number(
                                        node.current ??
                                        node.pressure ??
                                        node.value ??
                                        0
                                    ),

                                delta:
                                    Number(
                                        node.delta ??
                                        node.delta_pressure ??
                                        0
                                    )

                            })
                        ),

                    pipes:
                        response.pipes.map(
                            pipe => ({

                                id:
                                    String(pipe.id)
                                        .startsWith('P')
                                        ? String(pipe.id)
                                        : `P${pipe.id}`,

                                from:
                                    pipe.from ||
                                    pipe.from_node ||
                                    '',

                                to:
                                    pipe.to ||
                                    pipe.to_node ||
                                    '',

                                baseline:
                                    Number(
                                        pipe.baseline ??
                                        pipe.baseline_flow ??
                                        0
                                    ),

                                current:
                                    Number(
                                        pipe.current ??
                                        pipe.flow ??
                                        pipe.value ??
                                        0
                                    ),

                                delta:
                                    Number(
                                        pipe.delta ??
                                        pipe.delta_flow ??
                                        0
                                    )

                            })
                        )

                };

            }


            return null;

        }


        /*
         * ========================================================
         * LOCAL COMPARISON FALLBACK
         * ========================================================
         */

        function buildComparison(
            baseline,
            current
        ) {

            const baselineNodes =
                {};


            baseline.nodes.forEach(
                node => {

                    baselineNodes[
                        String(node.id)
                    ] =
                        Number(
                            node.pressure ??
                            node.value ??
                            0
                        );

                }
            );


            const baselinePipes =
                {};


            baseline.pipes.forEach(
                pipe => {

                    baselinePipes[
                        String(pipe.id)
                    ] =
                        Number(
                            pipe.flow ??
                            pipe.value ??
                            0
                        );

                }
            );


            return {

                nodes:
                    current.nodes.map(
                        node => {

                            const id =
                                String(node.id);


                            const baselineValue =
                                baselineNodes[id] ??
                                0;


                            const currentValue =
                                Number(
                                    node.pressure ??
                                    node.value ??
                                    0
                                );


                            return {

                                id,

                                baseline:
                                    baselineValue,

                                current:
                                    currentValue,

                                delta:
                                    currentValue -
                                    baselineValue

                            };

                        }
                    ),


                pipes:
                    current.pipes.map(
                        pipe => {

                            const id =
                                String(pipe.id);


                            const baselineValue =
                                baselinePipes[id] ??
                                0;


                            const currentValue =
                                Number(
                                    pipe.flow ??
                                    pipe.value ??
                                    0
                                );


                            return {

                                id,

                                from:
                                    pipe.from ||
                                    '',

                                to:
                                    pipe.to ||
                                    '',

                                baseline:
                                    baselineValue,

                                current:
                                    currentValue,

                                delta:
                                    currentValue -
                                    baselineValue

                            };

                        }
                    )

            };

        }


        /*
         * ========================================================
         * SCENARIO SWITCH
         * ========================================================
         */

        DM.switchScenario =
            function (
                scenario
            ) {

                return DM.loadSimulationData(
                    scenario
                );

            };


        /*
         * ========================================================
         * LEAK ANALYSIS
         *
         * Existing renderLeakAnalysis() is retained.
         * Only the data-loading function is replaced.
         * ========================================================
         */

        DM.loadLeakAnalysis =
            async function (
                scenario = 'j4_leak'
            ) {

                const state =
                    DM.__hydraulicLeakState ||
                    (
                        DM.__hydraulicLeakState = {

                            scenario:
                                'j4_leak',

                            loading:
                                false,

                            error:
                                null,

                            comparison:
                                null

                        }
                    );


                state.scenario =
                    scenario === 'j6_leak'
                        ? 'j6_leak'
                        : 'j4_leak';


                state.loading =
                    true;

                state.error =
                    null;

                state.comparison =
                    null;


                /*
                 * The existing renderer expects DM.__finalModules.
                 * Keep both states synchronized.
                 */

                DM.__finalModules =
                    DM.__finalModules ||
                    {};

                DM.__finalModules.scenario =
                    state.scenario;

                DM.__finalModules.loading =
                    true;

                DM.__finalModules.error =
                    null;

                DM.__finalModules.comparison =
                    null;


                renderLeakAnalysis();


                try {

                    /*
                     * Get baseline and selected disruption directly
                     * from the live EPANET/WNTR API.
                     */

                    const [
                        baseline,
                        current
                    ] =
                        await Promise.all([

                            fetchScenario(
                                'baseline'
                            ),

                            fetchScenario(
                                state.scenario
                            )

                        ]);


                    const comparison =
                        buildComparison(
                            baseline,
                            current
                        );


                    state.comparison =
                        comparison;


                    DM.__finalModules.scenario =
                        state.scenario;

                    DM.__finalModules.loading =
                        false;

                    DM.__finalModules.error =
                        null;

                    DM.__finalModules.comparison =
                        comparison;


                    state.loading =
                        false;

                    state.error =
                        null;


                    console.log(
                        `[Hydraulic] Leak Analysis connected: ${state.scenario}`
                    );


                } catch (error) {

                    console.error(
                        '[Hydraulic] Leak Analysis error:',
                        error
                    );


                    state.loading =
                        false;

                    state.error =
                        error &&
                            error.message
                            ? error.message
                            : 'Unable to load leak analysis data.';


                    DM.__finalModules.loading =
                        false;

                    DM.__finalModules.error =
                        state.error;

                    DM.__finalModules.comparison =
                        null;

                }


                renderLeakAnalysis();

            };


        /*
         * ========================================================
         * INITIAL ROUTE LOADING
         * ========================================================
         */

        const hash =
            window.location.hash ||
            '';


        if (
            hash.includes(
                '/municipal/simulation'
            )
        ) {

            DM.loadSimulationData(
                DM.simulationState.currentScenario ||
                'baseline'
            );

        }


        if (
            hash.includes(
                '/municipal/leak-analysis'
            )
        ) {

            DM.loadLeakAnalysis(
                'j4_leak'
            );

        }


        /*
         * --------------------------------------------------------
         * Listen for future route changes.
         * --------------------------------------------------------
         */

        window.addEventListener(
            'hashchange',
            function () {

                const currentHash =
                    window.location.hash ||
                    '';


                if (
                    currentHash.includes(
                        '/municipal/simulation'
                    )
                ) {

                    DM.loadSimulationData(
                        DM.simulationState.currentScenario ||
                        'baseline'
                    );

                }


                if (
                    currentHash.includes(
                        '/municipal/leak-analysis'
                    )
                ) {

                    /*
                     * Preserve selected leak scenario if one was already
                     * selected.
                     */

                    const selectedScenario =
                        (
                            DM.__hydraulicLeakState &&
                            DM.__hydraulicLeakState.scenario
                        )
                        ||
                        'j4_leak';


                    DM.loadLeakAnalysis(
                        selectedScenario
                    );

                }

            }
        );


        console.log(
            'HydroCybernetics hydraulic integration bridge loaded.'
        );

    }


    initialise();

})();