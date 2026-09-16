from flask import Blueprint, request, jsonify
import os
import threading
import wntr


# =========================================================
# BLUEPRINT
# =========================================================

simulation_bp = Blueprint("simulation", __name__)


# =========================================================
# EPANET FILE CONFIGURATION
# =========================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

EPANET_DIR = os.path.join(
    BASE_DIR,
    "data",
    "epanet"
)

SCENARIO_FILES = {
    "baseline": "baseline.inp",
    "j4_leak": "j4.inp",
    "j6_leak": "j6.inp",
}


# =========================================================
# EPANET SIMULATION LOCK
#
# Only one EPANET simulation is allowed to run at a time.
# This prevents simultaneous WNTR/EPANET executions from
# interfering with each other.
# =========================================================

EPANET_LOCK = threading.Lock()


# =========================================================
# RUN EPANET SCENARIO
# =========================================================

def run_epanet_scenario(scenario):

    if scenario not in SCENARIO_FILES:
        raise ValueError(
            f"Unknown scenario: {scenario}"
        )

    inp_file = os.path.join(
        EPANET_DIR,
        SCENARIO_FILES[scenario]
    )

    if not os.path.isfile(inp_file):
        raise FileNotFoundError(
            f"EPANET file not found: {inp_file}"
        )

    print()
    print("=========================================================")
    print(f"[WNTR] Waiting for simulation lock: {scenario}")
    print("=========================================================")

    with EPANET_LOCK:

        print()
        print("=========================================================")
        print(f"[WNTR] Loading scenario: {scenario}")
        print(f"[WNTR] File: {inp_file}")
        print("=========================================================")

        # -----------------------------------------------------
        # Load EPANET model
        # -----------------------------------------------------

        wn = wntr.network.WaterNetworkModel(
            inp_file
        )

        print(
            f"[WNTR] Junctions: "
            f"{len(wn.junction_name_list)}"
        )

        print(
            f"[WNTR] Pipes: "
            f"{len(wn.pipe_name_list)}"
        )

        print(
            f"[WNTR] Tanks: "
            f"{len(wn.tank_name_list)}"
        )

        print(
            f"[WNTR] Reservoirs: "
            f"{len(wn.reservoir_name_list)}"
        )

        # -----------------------------------------------------
        # Detect emitters
        # -----------------------------------------------------

        emitter_nodes = []

        try:
            for node_name in wn.node_name_list:

                node = wn.get_node(
                    node_name
                )

                emitter = getattr(
                    node,
                    "emitter_coefficient",
                    None
                )

                if (
                    emitter is not None
                    and float(emitter) > 0
                ):
                    emitter_nodes.append(
                        {
                            "node": str(node_name),
                            "coefficient": float(emitter),
                        }
                    )

        except Exception as emitter_error:

            print(
                "[WNTR] Emitter diagnostic warning: "
                f"{emitter_error}"
            )

        if emitter_nodes:
            print(
                f"[WNTR] Emitters: {emitter_nodes}"
            )
        else:
            print(
                "[WNTR] Emitters: NONE"
            )

        # -----------------------------------------------------
        # Run hydraulic simulation
        # -----------------------------------------------------

        simulator = wntr.sim.EpanetSimulator(
            wn
        )

        results = simulator.run_sim()

        # -----------------------------------------------------
        # Extract result tables
        # -----------------------------------------------------

        pressure_results = results.node["pressure"]
        demand_results = results.node["demand"]
        flow_results = results.link["flowrate"]

        pressure_index = pressure_results.index
        demand_index = demand_results.index
        flow_index = flow_results.index

        print(
            f"[WNTR] Pressure timesteps: "
            f"{list(pressure_index)}"
        )

        print(
            f"[WNTR] Demand timesteps: "
            f"{list(demand_index)}"
        )

        print(
            f"[WNTR] Flow timesteps: "
            f"{list(flow_index)}"
        )

        if len(pressure_index) == 0:
            raise RuntimeError(
                "WNTR returned no pressure results."
            )

        if len(flow_index) == 0:
            raise RuntimeError(
                "WNTR returned no flow results."
            )

        # -----------------------------------------------------
        # Use final available timestep
        # -----------------------------------------------------

        raw_time_index = pressure_index[-1]

        # Convert NumPy int64 / similar values to native int
        try:
            time_index = int(raw_time_index)
        except (TypeError, ValueError):
            time_index = str(raw_time_index)

        # -----------------------------------------------------
        # Convert all available timestep values to JSON-safe
        # native Python values
        # -----------------------------------------------------

        available_timesteps = []

        for timestep in pressure_index:

            try:
                available_timesteps.append(
                    int(timestep)
                )
            except (TypeError, ValueError):
                available_timesteps.append(
                    str(timestep)
                )

        # -----------------------------------------------------
        # Extract selected timestep
        # -----------------------------------------------------

        pressures = pressure_results.loc[
            raw_time_index
        ]

        demands = demand_results.loc[
            raw_time_index
        ]

        flows = flow_results.loc[
            raw_time_index
        ]

        # -----------------------------------------------------
        # Convert to native numeric values
        #
        # Pressure = metres
        # Demand   = L/s
        # Flow     = L/s
        # -----------------------------------------------------

        pressures = pressures.astype(float)

        demands_lps = (
            demands.astype(float) * 1000.0
        )

        flows_lps = (
            flows.astype(float) * 1000.0
        )

        # -----------------------------------------------------
        # Calculate average pressure
        # -----------------------------------------------------

        valid_pressures = [
            float(value)
            for value in pressures.values
            if value is not None
        ]

        if valid_pressures:

            average_pressure = (
                sum(valid_pressures)
                / len(valid_pressures)
            )

        else:

            average_pressure = 0.0

        # -----------------------------------------------------
        # Calculate total absolute pipe flow
        # -----------------------------------------------------

        valid_flows = [
            float(value)
            for value in flows_lps.values
            if value is not None
        ]

        if valid_flows:

            total_abs_flow = sum(
                abs(value)
                for value in valid_flows
            )

        else:

            total_abs_flow = 0.0

        # -----------------------------------------------------
        # Diagnostics
        # -----------------------------------------------------

        print(
            f"[WNTR] Selected timestep: "
            f"{time_index}"
        )

        print(
            f"[WNTR] Average pressure: "
            f"{average_pressure:.6f} m"
        )

        print(
            f"[WNTR] Total absolute pipe flow: "
            f"{total_abs_flow:.6f} L/s"
        )

        # -----------------------------------------------------
        # Print important junction pressures
        # -----------------------------------------------------

        for key_node in ["4", "6"]:

            if key_node in pressures.index:

                print(
                    f"[WNTR] J{key_node} pressure: "
                    f"{float(pressures[key_node]):.6f} m"
                )

        print(
            f"[WNTR] Simulation completed: {scenario}"
        )

        return {
            "pressures": pressures,
            "demands": demands_lps,
            "flows": flows_lps,
            "time_index": time_index,
            "available_timesteps": available_timesteps,
            "average_pressure": float(
                average_pressure
            ),
            "total_abs_flow": float(
                total_abs_flow
            ),
            "emitters": emitter_nodes,
        }


# =========================================================
# BUILD FRONTEND RESULT
# =========================================================

def build_result_response(
    scenario,
    hydraulic
):

    nodes = []
    pipes = []
    raw_results = []

    # -----------------------------------------------------
    # Junction pressure results
    # -----------------------------------------------------

    for node_id in hydraulic["pressures"].index:

        node_id = str(node_id)

        # Exclude tank/source node
        if node_id == "0":
            continue

        pressure = float(
            hydraulic["pressures"][node_id]
        )

        demand = float(
            hydraulic["demands"].get(
                node_id,
                0.0
            )
        )

        if node_id.startswith("J"):
            frontend_id = node_id
        else:
            frontend_id = f"J{node_id}"

        nodes.append({
            "id": frontend_id,
            "pressure": pressure,
            "value": pressure,
            "demand": demand,
            "unit": "m",
        })

        raw_results.append({
            "element_type": "junction",
            "element_id": node_id,
            "pressure": pressure,
            "demand": demand,
            "unit": "m",
        })

    # -----------------------------------------------------
    # Pipe flow results
    # -----------------------------------------------------

    for pipe_id in hydraulic["flows"].index:

        pipe_id = str(pipe_id)

        flow = float(
            hydraulic["flows"][pipe_id]
        )

        if pipe_id.startswith("P"):
            frontend_id = pipe_id
        else:
            frontend_id = f"P{pipe_id}"

        pipes.append({
            "id": frontend_id,
            "flow": flow,
            "value": flow,
            "unit": "L/s",
        })

        raw_results.append({
            "element_type": "pipe",
            "element_id": pipe_id,
            "flow": flow,
            "unit": "L/s",
        })

    return {
        "scenario": scenario,
        "source": "EPANET/WNTR",
        "timestep": hydraulic["time_index"],
        "available_timesteps": hydraulic[
            "available_timesteps"
        ],
        "average_pressure": hydraulic[
            "average_pressure"
        ],
        "total_abs_flow": hydraulic[
            "total_abs_flow"
        ],
        "emitters": hydraulic["emitters"],
        "nodes": nodes,
        "pipes": pipes,
        "results": raw_results,
    }


# =========================================================
# AVAILABLE SCENARIOS
# =========================================================

@simulation_bp.route(
    "/api/simulation/scenarios",
    methods=["GET"]
)
def get_scenarios():

    return jsonify({
        "scenarios": [
            {
                "id": "baseline",
                "name": "Baseline",
            },
            {
                "id": "j4_leak",
                "name": "J4 Disruption",
            },
            {
                "id": "j6_leak",
                "name": "J6 Disruption",
            },
        ],
        "source": "EPANET/WNTR",
    })


# =========================================================
# SIMULATION RESULTS
# =========================================================

@simulation_bp.route(
    "/api/simulation/results",
    methods=["GET"]
)
def get_results():

    scenario = request.args.get(
        "scenario",
        "baseline"
    )

    if scenario not in SCENARIO_FILES:

        return jsonify({
            "error": (
                f"Unknown scenario: {scenario}"
            ),
            "available_scenarios": list(
                SCENARIO_FILES.keys()
            ),
        }), 400

    try:

        hydraulic = run_epanet_scenario(
            scenario
        )

        response = build_result_response(
            scenario,
            hydraulic
        )

        print(
            f"[WNTR] {scenario}: "
            f"{len(response['nodes'])} junctions, "
            f"{len(response['pipes'])} pipes"
        )

        return jsonify(response)

    except Exception as error:

        print(
            f"[WNTR ERROR] {scenario}: {error}"
        )

        return jsonify({
            "error": str(error),
            "scenario": scenario,
            "source": "EPANET/WNTR",
        }), 500


# =========================================================
# SCENARIO COMPARISON
# =========================================================

@simulation_bp.route(
    "/api/simulation/comparison",
    methods=["GET"]
)
def get_comparison():

    scenario = request.args.get(
        "scenario",
        "baseline"
    )

    if scenario not in SCENARIO_FILES:

        return jsonify({
            "error": (
                f"Unknown scenario: {scenario}"
            ),
            "available_scenarios": list(
                SCENARIO_FILES.keys()
            ),
        }), 400

    try:

        # -------------------------------------------------
        # Run sequentially because the simulation function
        # itself is protected by EPANET_LOCK.
        # -------------------------------------------------

        baseline = run_epanet_scenario(
            "baseline"
        )

        target = run_epanet_scenario(
            scenario
        )

        comparison = []

        # -------------------------------------------------
        # Junction pressure comparison
        # -------------------------------------------------

        for node_id in baseline["pressures"].index:

            node_id = str(node_id)

            if node_id == "0":
                continue

            baseline_pressure = float(
                baseline["pressures"][node_id]
            )

            target_pressure = float(
                target["pressures"].get(
                    node_id,
                    baseline_pressure
                )
            )

            comparison.append({
                "element_type": "junction",
                "element_id": node_id,
                "baseline_pressure": (
                    baseline_pressure
                ),
                "scenario_pressure": (
                    target_pressure
                ),
                "delta_pressure": (
                    target_pressure
                    - baseline_pressure
                ),
            })

        # -------------------------------------------------
        # Pipe flow comparison
        # -----------------------------------------------------

        for pipe_id in baseline["flows"].index:

            pipe_id = str(pipe_id)

            baseline_flow = float(
                baseline["flows"][pipe_id]
            )

            target_flow = float(
                target["flows"].get(
                    pipe_id,
                    baseline_flow
                )
            )

            comparison.append({
                "element_type": "pipe",
                "element_id": pipe_id,
                "baseline_flow": baseline_flow,
                "scenario_flow": target_flow,
                "delta_flow": (
                    target_flow
                    - baseline_flow
                ),
            })

        return jsonify({
            "scenario": scenario,
            "source": "EPANET/WNTR",
            "baseline_timestep": (
                baseline["time_index"]
            ),
            "scenario_timestep": (
                target["time_index"]
            ),
            "comparison": comparison,
        })

    except Exception as error:

        print(
            f"[WNTR COMPARISON ERROR] "
            f"{scenario}: {error}"
        )

        return jsonify({
            "error": str(error),
            "scenario": scenario,
            "source": "EPANET/WNTR",
        }), 500