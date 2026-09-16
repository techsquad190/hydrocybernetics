from app import app
from database import db
from models import HydraulicResult

with app.app_context():

    # J6 leak scenario - node pressures
    node_pressures = {
        "J9": 36.40,
        "J6": 26.41,
        "J2": 23.12,
        "J4": 34.19,
        "J5": 32.99,
        "J7": 38.81,
        "J3": 31.43,
        "J8": 25.76,
        "J1": 29.80
    }

    # J6 leak scenario - pipe flows
    pipe_flows = {
        "P1": 12.77,
        "P2": 11.48,
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
            scenario="j6_leak",
            element_type="node",
            element_id=node,
            value=pressure,
            unit="m"
        ))

    for pipe, flow in pipe_flows.items():
        db.session.add(HydraulicResult(
            scenario="j6_leak",
            element_type="pipe",
            element_id=pipe,
            value=flow,
            unit="L/s"
        ))

    db.session.commit()

    print("J6 leak EPANET results inserted successfully.")