from app import app
from database import db
from models import HydraulicResult

with app.app_context():

    # J4 leak scenario - node pressures
    node_pressures = {
        "J9": 36.39,
        "J6": 26.38,
        "J2": 22.98,
        "J4": 33.89,
        "J5": 32.68,
        "J7": 38.51,
        "J3": 31.16,
        "J8": 25.49,
        "J1": 29.53
    }

    # J4 leak scenario - pipe flows
    pipe_flows = {
        "P1": 12.91,
        "P2": 11.62,
        "P3": 10.31,
        "P4": 9.00,
        "P5": 5.07,
        "P6": 2.62,
        "P7": 1.31,
        "P8": 1.31,
        "P9": 1.31
    }

    for node, pressure in node_pressures.items():
        db.session.add(HydraulicResult(
            scenario="j4_leak",
            element_type="node",
            element_id=node,
            value=pressure,
            unit="m"
        ))

    for pipe, flow in pipe_flows.items():
        db.session.add(HydraulicResult(
            scenario="j4_leak",
            element_type="pipe",
            element_id=pipe,
            value=flow,
            unit="L/s"
        ))

    db.session.commit()

    print("J4 leak EPANET results inserted successfully.")