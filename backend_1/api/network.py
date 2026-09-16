from flask import Blueprint, jsonify, request
import json
import os
import wntr

network_bp = Blueprint("network", __name__, url_prefix="/api/network")

BASE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..")
)

GEOGRAPHY_PATH = os.path.join(
    BASE_DIR,
    "data",
    "network_geography.json"
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


def _load_geography():
    with open(GEOGRAPHY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _run_epanet(scenario):
    if scenario not in SCENARIO_FILES:
        raise ValueError(f"Unknown scenario: {scenario}")

    inp_path = os.path.join(
        EPANET_DIR,
        SCENARIO_FILES[scenario]
    )

    if not os.path.exists(inp_path):
        raise FileNotFoundError(
            f"EPANET file not found: {inp_path}"
        )

    # Load EPANET model
    wn = wntr.network.WaterNetworkModel(inp_path)

    # Run hydraulic simulation
    simulator = wntr.sim.EpanetSimulator(wn)
    results = simulator.run_sim()

    # Use the first simulation timestep
    time_index = results.node["pressure"].index[0]

    pressures = results.node["pressure"].loc[time_index]
    flows = results.link["flowrate"].loc[time_index]

    # WNTR returns flow in m3/s.
    # Convert to L/s.
    flows_lps = flows * 1000.0

    return pressures, flows_lps


@network_bp.route("", methods=["GET"])
def get_network():

    scenario = (
        request.args.get("scenario", "baseline").strip()
        or "baseline"
    )

    try:
        # Load geographic data from Google Earth KML-derived JSON
        geography = _load_geography()

        # Run requested EPANET scenario
        pressures, flows = _run_epanet(scenario)

        # Always run baseline for comparison
        baseline_pressures, baseline_flows = _run_epanet(
            "baseline"
        )

        # ---------------------------------------------
        # Nodes
        # ---------------------------------------------

        nodes = []

        for node in geography["nodes"]:

            # Geography uses IDs such as J1, J2, J3...
            node_id = str(node["id"])

            # EPANET/WNTR uses IDs such as 1, 2, 3...
            epanet_node_id = node_id.replace("J", "")

            pressure = pressures.get(epanet_node_id)
            baseline_pressure = baseline_pressures.get(
                epanet_node_id
            )

            pressure_value = (
                round(float(pressure), 2)
                if pressure is not None
                else None
            )

            baseline_pressure_value = (
                round(float(baseline_pressure), 2)
                if baseline_pressure is not None
                else None
            )

            delta_pressure = (
                round(
                    pressure_value - baseline_pressure_value,
                    2
                )
                if pressure_value is not None
                and baseline_pressure_value is not None
                else None
            )

            nodes.append({
                **node,
                "pressure": pressure_value,
                "baseline_pressure": baseline_pressure_value,
                "delta_pressure": delta_pressure,
                "unit": "m"
            })

        # ---------------------------------------------
        # Pipes
        # ---------------------------------------------

        links = []

        for link in geography["links"]:

            # Geography uses IDs such as P1, P2, P3...
            link_id = str(link["id"])

            # EPANET/WNTR uses IDs such as 1, 2, 3...
            epanet_link_id = link_id.replace("P", "")

            flow = flows.get(epanet_link_id)
            baseline_flow = baseline_flows.get(
                epanet_link_id
            )

            flow_value = (
                round(float(flow), 2)
                if flow is not None
                else None
            )

            baseline_flow_value = (
                round(float(baseline_flow), 2)
                if baseline_flow is not None
                else None
            )

            delta_flow = (
                round(
                    flow_value - baseline_flow_value,
                    2
                )
                if flow_value is not None
                and baseline_flow_value is not None
                else None
            )

            links.append({
                **link,
                "flow": flow_value,
                "baseline_flow": baseline_flow_value,
                "delta_flow": delta_flow,
                "unit": "L/s"
            })

        # ---------------------------------------------
        # Response
        # ---------------------------------------------

        return jsonify({
            "scenario": scenario,
            "nodes": nodes,
            "links": links,

            "source": geography.get("source_node"),
            "area": geography.get("area"),

            "source_type": "EPANET/WNTR",
            "geography_source": "Google Earth Pro KML",

            "note": (
                "Geographic positions come from the supplied "
                "Google Earth Pro KML; hydraulic values are "
                "calculated from the corresponding EPANET "
                "model through WNTR."
            )
        })

    except FileNotFoundError as exc:

        return jsonify({
            "error": "Required network data file is missing.",
            "details": str(exc)
        }), 500

    except Exception as exc:

        return jsonify({
            "error": "Failed to load network data.",
            "details": str(exc)
        }), 500