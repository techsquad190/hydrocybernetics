from flask import Flask, jsonify, request, session, send_from_directory

from database import db

from models import SensorData, AuthUser, CitizenReport

from api.simulation import simulation_bp

from api.network import network_bp

from werkzeug.security import generate_password_hash, check_password_hash

from datetime import datetime

import os

import re



app = Flask(__name__)



# ---------------------------------------------------------

# Application / session configuration

# ---------------------------------------------------------

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
FRONTEND_DIR = os.path.abspath(
    os.path.join(BASE_DIR, "..", "frontend_visual_test_backup_auth")
)

db_path = os.path.join(BASE_DIR, "water_system.db")



app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + db_path

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False



# Local-development session secret.

# For deployment, set HYDRO_SECRET_KEY in the environment.

app.config["SECRET_KEY"] = os.environ.get(

    "HYDRO_SECRET_KEY",

    "hydrocybernetics-local-development-secret-change-for-production"

)

app.config["SESSION_COOKIE_HTTPONLY"] = True

app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

app.config["SESSION_COOKIE_SECURE"] = False



db.init_app(app)



# Register existing APIs

app.register_blueprint(simulation_bp)

app.register_blueprint(network_bp)



# ---------------------------------------------------------

# Local CORS

# ---------------------------------------------------------

ALLOWED_ORIGINS = {

    "http://localhost:5500",

    "http://127.0.0.1:5500",

    "http://localhost:8080",

    "http://127.0.0.1:8080",

    "http://localhost:3000",

    "http://127.0.0.1:3000",

    "http://10.55.112.89:5500",

}





@app.after_request

def apply_cors_headers(response):

    origin = request.headers.get("Origin")



    if origin in ALLOWED_ORIGINS:

        response.headers["Access-Control-Allow-Origin"] = origin

        response.headers["Access-Control-Allow-Methods"] = (

            "GET, POST, PUT, PATCH, DELETE, OPTIONS"

        )

        response.headers["Access-Control-Allow-Headers"] = (

            "Content-Type, Authorization"

        )

        response.headers["Access-Control-Allow-Credentials"] = "true"

        response.headers["Vary"] = "Origin"



    return response





# ---------------------------------------------------------

# Database initialization

# ---------------------------------------------------------

with app.app_context():

    db.create_all()



    if SensorData.query.count() == 0:

        sample = SensorData(

            zone="Sadashiv Nagar",

            pressure=24.5,

            flow_rate=18.3,

            tank_level=82,

            leak_status=False,

            source="EPANET"

        )

        db.session.add(sample)

        db.session.commit()





# ---------------------------------------------------------

# Helper functions

# ---------------------------------------------------------

EMAIL_RE = re.compile(

    r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@"

    r"[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$"

)





def normalize_email(value):

    return str(value or "").strip().lower()





def serialize_user(user):

    return {

        "id": user.id,

        "name": user.name,

        "email": user.email,

        "role": user.role

    }

def serialize_report(report):

    return {

        "id": report.id,

        "user_id": report.user_id,

        "category": report.category,

        "description": report.description,

        "location": report.location,

        "latitude": report.latitude,

        "longitude": report.longitude,

        "location_accuracy": report.location_accuracy,

        "evidence_image": report.evidence_image,

        "evidence_filename": report.evidence_filename,

        "status": report.status,

        "created_at": (

            report.created_at.isoformat()

            if report.created_at

            else None

        )

    }



def current_user():

    user_id = session.get("user_id")

    role = session.get("role")



    if not user_id or not role:

        return None



    return AuthUser.query.filter_by(

        id=user_id,

        role=role,

        is_active=True

    ).first()





# ---------------------------------------------------------

# Root / health

# ---------------------------------------------------------

@app.route("/")
def home():
    # Serve the existing frontend while retaining the backend on port 5000.
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if not os.path.isfile(index_path):
        app.logger.error("Frontend index.html not found: %s", index_path)
        return jsonify({
            "error": "Frontend files were not found.",
            "expected_index": index_path
        }), 500
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:filename>")
def frontend_assets(filename):
    # CSS, JavaScript, images, manifest and other frontend assets.
    return send_from_directory(FRONTEND_DIR, filename)





@app.route("/api/health")

def health():

    return jsonify({

        "status": "healthy",

        "service": "HydroCybernetics API",

        "version": "1.0.0"

    })





# ---------------------------------------------------------

# Authentication API

# Citizen authentication is implemented first.

# Municipal authentication will use the same session model later.

# ---------------------------------------------------------

@app.route("/api/auth/register", methods=["POST"])

def auth_register():

    data = request.get_json(silent=True) or {}



    name = str(data.get("name") or "").strip()

    email = normalize_email(data.get("email"))

    password = str(data.get("password") or "")



    if len(name) < 2:

        return jsonify({

            "ok": False,

            "message": "Please enter your full name."

        }), 400



    if not EMAIL_RE.match(email):

        return jsonify({

            "ok": False,

            "message": "Please enter a valid email address."

        }), 400



    if len(password) < 8:

        return jsonify({

            "ok": False,

            "message": "Password must contain at least 8 characters."

        }), 400



    if AuthUser.query.filter_by(email=email, role="citizen").first():

        return jsonify({

            "ok": False,

            "message": "A citizen account with this email already exists."

        }), 409



    user = AuthUser(

        name=name,

        email=email,

        password_hash=generate_password_hash(password),

        role="citizen",

        is_active=True,

        created_at=datetime.utcnow()

    )



    db.session.add(user)

    db.session.commit()



    # Register + authenticate in one clean step.

    session.clear()

    session["user_id"] = user.id

    session["role"] = user.role



    return jsonify({

        "ok": True,

        "message": "Citizen account created successfully.",

        "user": serialize_user(user)

    }), 201



@app.route("/api/auth/login", methods=["POST"])

def auth_login():

    """

    Authenticate a user for the requested portal.



    The role stored in the database is authoritative.

    The frontend cannot simply claim to be a municipal user.

    """



    data = request.get_json(silent=True) or {}



    email = normalize_email(

        data.get("email")

    )



    password = str(

        data.get("password") or ""

    )



    requested_role = str(

        data.get("role") or "citizen"

    ).strip().lower()





    # ---------------------------------------------------------

    # Validate requested role

    # ---------------------------------------------------------



    if requested_role not in {

        "citizen",

        "municipal"

    }:



        return jsonify({

            "ok": False,

            "message": "Invalid authentication role."

        }), 400





    # ---------------------------------------------------------

    # Validate credentials

    # ---------------------------------------------------------



    if not email or not password:



        return jsonify({

            "ok": False,

            "message": "Email and password are required."

        }), 400





    # ---------------------------------------------------------

    # Find an ACTIVE account with the requested role

    # ---------------------------------------------------------



    user = AuthUser.query.filter_by(

        email=email,

        role=requested_role,

        is_active=True

    ).first()





    # ---------------------------------------------------------

    # Generic authentication failure

    #

    # We deliberately don't reveal whether the email exists.

    # ---------------------------------------------------------



    if (

        not user

        or not check_password_hash(

            user.password_hash,

            password

        )

    ):



        return jsonify({

            "ok": False,

            "message": "Invalid email or password."

        }), 401





    # ---------------------------------------------------------

    # Successful authentication

    # ---------------------------------------------------------



    session.clear()



    session["user_id"] = user.id

    session["role"] = user.role





    return jsonify({

        "ok": True,

        "message": "Signed in successfully.",

        "user": serialize_user(user)

    })





@app.route("/api/auth/me", methods=["GET"])

def auth_me():

    user = current_user()



    if not user:

        return jsonify({

            "authenticated": False,

            "user": None

        }), 401



    return jsonify({

        "authenticated": True,

        "user": serialize_user(user)

    })





@app.route("/api/auth/logout", methods=["POST"])

def auth_logout():

    session.clear()



    return jsonify({

        "ok": True,

        "message": "Signed out successfully."

    })



# ---------------------------------------------------------

# Telemetry: ESP32 Sensor Data

# ---------------------------------------------------------

# ---------------------------------------------------------
# Telemetry: ESP32 Sensor Data
# ---------------------------------------------------------
# DEMONSTRATION MODEL ONLY: flow is used to estimate pressure head.
# This is not a physical pressure measurement and the threshold must
# be calibrated against measured baseline/leak tests before deployment.
FLOW_LEAK_THRESHOLD_LPS = 0.30  # 18 L/min; provisional demo threshold
BASELINE_PRESSURE_HEAD_M = 12.0
MIN_PRESSURE_HEAD_M = 2.0
PRESSURE_DROP_PER_LPS = 30.0


def estimate_pressure_head_from_flow(flow_lps):
    flow_lps = max(0.0, float(flow_lps))
    excess_flow = max(0.0, flow_lps - FLOW_LEAK_THRESHOLD_LPS)
    estimated = BASELINE_PRESSURE_HEAD_M - (excess_flow * PRESSURE_DROP_PER_LPS)
    return round(max(MIN_PRESSURE_HEAD_M, estimated), 2)


# ---------------------------------------------------------
# Telemetry: ESP32 Sensor Data
# ---------------------------------------------------------
# DEMONSTRATION MODEL ONLY: flow is used to estimate pressure head.
# This is not a physical pressure measurement and the threshold must
# be calibrated against measured baseline/leak tests before deployment.
FLOW_LEAK_THRESHOLD_LPS = 0.30  # 18 L/min; provisional demo threshold
BASELINE_PRESSURE_HEAD_M = 12.0
MIN_PRESSURE_HEAD_M = 2.0
PRESSURE_DROP_PER_LPS = 30.0


def estimate_pressure_head_from_flow(flow_lps):
    flow_lps = max(0.0, float(flow_lps))
    excess_flow = max(0.0, flow_lps - FLOW_LEAK_THRESHOLD_LPS)
    estimated = BASELINE_PRESSURE_HEAD_M - (excess_flow * PRESSURE_DROP_PER_LPS)
    return round(max(MIN_PRESSURE_HEAD_M, estimated), 2)


@app.route("/api/telemetry", methods=["POST"])
def receive_telemetry():
    data = request.get_json(silent=True) or {}
    if "flow_lps" not in data:
        return jsonify({"error": "flow_lps is required."}), 400

    try:
        flow_lps = float(data["flow_lps"])
        if not (flow_lps >= 0 and flow_lps < 1000):
            raise ValueError("flow_lps outside accepted range")
    except (TypeError, ValueError):
        return jsonify({"error": "flow_lps must be a valid non-negative number."}), 400

    # Always compute a numeric flow-based pressure estimate on the backend;
    # never preserve null or trust a stale pressure value sent by the device.
    pressure_m = estimate_pressure_head_from_flow(flow_lps)
    possible_leak = flow_lps >= FLOW_LEAK_THRESHOLD_LPS

    sensor_data = SensorData(
        zone="Hardware Sensor",
        pressure=pressure_m,
        flow_rate=flow_lps,
        tank_level=None,
        leak_status=possible_leak,
        source="ESP32"
    )
    db.session.add(sensor_data)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Telemetry received successfully.",
        "data": {
            "pressure_m": pressure_m,
            "flow_lps": flow_lps,
            "pressure_mode": "flow_based_estimate",
            "possible_leak": possible_leak,
            "flow_threshold_lps": FLOW_LEAK_THRESHOLD_LPS
        }
    }), 201


# ---------------------------------------------------------
# Telemetry: Latest Pressure Reading
# ---------------------------------------------------------
@app.route("/api/pressure")
def pressure():
    latest = SensorData.query.filter_by(source="ESP32").order_by(SensorData.id.desc()).first()
    if not latest:
        return jsonify({"pressure": None, "unit": "m"}), 404
    return jsonify({
        "pressure": latest.pressure,
        "unit": "m",
        "mode": "flow_based_estimate",
        "flow_threshold_lps": FLOW_LEAK_THRESHOLD_LPS
    })


# ---------------------------------------------------------
# Telemetry: Latest Flow Rate Reading
# ---------------------------------------------------------
@app.route("/api/flow")
def flow():
    latest = SensorData.query.filter_by(source="ESP32").order_by(SensorData.id.desc()).first()
    if not latest:
        return jsonify({"flow": None, "unit": "L/s"}), 404
    return jsonify({"flow": latest.flow_rate, "unit": "L/s"})


# ---------------------------------------------------------

# Telemetry: Latest Storage Tank Level

# ---------------------------------------------------------

@app.route("/api/tank")

def tank():

    latest = SensorData.query.order_by(SensorData.id.desc()).first()



    if not latest:

        return jsonify({"tank_level": None, "unit": "%"}), 404



    return jsonify({

        "tank_level": latest.tank_level,

        "unit": "%"

    })



# ============================================================

# CITIZEN REPORT API

# ============================================================



@app.route("/api/citizen/reports", methods=["GET"])

def get_citizen_reports():

    """

    Return only reports belonging to the currently

    authenticated citizen.

    """



    user = current_user()



    if not user:

        return jsonify({

            "ok": False,

            "message": "Authentication required."

        }), 401



    if user.role != "citizen":

        return jsonify({

            "ok": False,

            "message": "Citizen access required."

        }), 403



    reports = (

        CitizenReport.query

        .filter_by(user_id=user.id)

        .order_by(CitizenReport.created_at.desc())

        .all()

    )



    return jsonify({

        "ok": True,

        "reports": [

            serialize_report(report)

            for report in reports

        ]

    })





@app.route("/api/citizen/reports", methods=["POST"])

def create_citizen_report():

    """

    Create a new report for the currently authenticated citizen.

    """



    user = current_user()



    if not user:

        return jsonify({

            "ok": False,

            "message": "Authentication required."

        }), 401



    if user.role != "citizen":

        return jsonify({

            "ok": False,

            "message": "Citizen access required."

        }), 403



    data = request.get_json(silent=True) or {}



    category = str(

        data.get("category") or ""

    ).strip()



    description = str(

        data.get("description") or ""

    ).strip()



    location = str(

        data.get("location") or ""

    ).strip()



    if not category:

        return jsonify({

            "ok": False,

            "message": "Report category is required."

        }), 400



    if not description:

        return jsonify({

            "ok": False,

            "message": "Report description is required."

        }), 400



    # --------------------------------------------------------

    # Safely parse optional numeric GPS fields

    # --------------------------------------------------------



    def optional_float(value):

        if value is None or value == "":

            return None



        try:

            return float(value)

        except (TypeError, ValueError):

            return None



    latitude = optional_float(

        data.get("latitude")

    )



    longitude = optional_float(

        data.get("longitude")

    )



    location_accuracy = optional_float(

        data.get("location_accuracy")

    )



    evidence_image = data.get(

        "evidence_image"

    )



    evidence_filename = str(

        data.get("evidence_filename") or ""

    ).strip() or None



    # --------------------------------------------------------

    # Create database record

    # --------------------------------------------------------



    report = CitizenReport(

        user_id=user.id,

        category=category,

        description=description,

        location=location or None,

        latitude=latitude,

        longitude=longitude,

        location_accuracy=location_accuracy,

        evidence_image=evidence_image,

        evidence_filename=evidence_filename,

        status="Submitted",

        created_at=datetime.utcnow()

    )



    db.session.add(report)

    db.session.commit()



    return jsonify({

        "ok": True,

        "message": "Report submitted successfully.",

        "report": serialize_report(report)

    }), 201



#-----------------------------------------------------------

# Municipal fetch records

#-----------------------------------------------------------

# ============================================================

# MUNICIPAL CITIZEN REPORTS API

# ============================================================



@app.route("/api/municipal/citizen-reports", methods=["GET"])

def get_municipal_citizen_reports():

    """

    Return citizen-submitted water-service reports for

    authenticated municipal personnel only.



    This is deliberately separate from /api/citizen/reports,

    which is restricted to the reporting citizen.

    """



    user = current_user()



    # --------------------------------------------------------

    # Authentication check

    # --------------------------------------------------------



    if not user:



        return jsonify({

            "ok": False,

            "message": "Authentication required."

        }), 401





    # --------------------------------------------------------

    # Municipal role check

    # --------------------------------------------------------



    if user.role != "municipal":



        return jsonify({

            "ok": False,

            "message": "Municipal authority access required."

        }), 403





    # --------------------------------------------------------

    # Fetch all citizen reports

    # --------------------------------------------------------



    reports = (

        CitizenReport.query

        .join(

            AuthUser,

            CitizenReport.user_id == AuthUser.id

        )

        .order_by(

            CitizenReport.created_at.desc()

        )

        .all()

    )





    # --------------------------------------------------------

    # Serialize for municipal view

    # --------------------------------------------------------



    result = []



    for report in reports:



        report_data = serialize_report(report)



        citizen = report.user



        report_data["citizen_name"] = (

            citizen.name

            if citizen

            else "Citizen"

        )



        report_data["citizen_email"] = (

            citizen.email

            if citizen

            else None

        )



        result.append(

            report_data

        )





    return jsonify({

        "ok": True,

        "count": len(result),

        "reports": result

    })

if __name__ == "__main__":

    app.run(

        host="0.0.0.0",

        port=5000,

        debug=True

    )
