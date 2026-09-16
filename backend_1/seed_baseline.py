from app import app
from database import db
from models import HydraulicResult

with app.app_context():

    # Baseline node pressures
    node_pressures = {
        "J9": 36.48,
        "J6": 26.63,
        "J2": 23.33,
        "J4": 34.40,
        "J5": 33.20,
        "J7": 39.02,
        "J3": 31.64,
        "J8": 25.97,
        "J1": 30.01
    }

    # Baseline pipe flows
    pipe_flows = {
        "P1": 11.77,
        "P2": 10.48,
        "P3": 9.17,
        "P4": 7.86,
        "P5": 3.93,
        "P6": 2.62,
        "P7": 1.31,
        "P8": 1.31,
        "P9": 1.31
    }

    for node, pressure in node_pressures.items():
        db.session.add(HydraulicResult(
            scenario="baseline",
            element_type="node",
            element_id=node,
            value=pressure,
            unit="m"
        ))

    for pipe, flow in pipe_flows.items():
        db.session.add(HydraulicResult(
            scenario="baseline",
            element_type="pipe",
            element_id=pipe,
            value=flow,
            unit="L/s"
        ))

    db.session.commit()

    print("Baseline EPANET results inserted successfully.")