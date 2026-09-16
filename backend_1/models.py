from database import db
from datetime import datetime


# ============================================================
# SENSOR DATA
# ============================================================

class SensorData(db.Model):
    __tablename__ = "sensor_data"

    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    zone = db.Column(db.String(100))
    pressure = db.Column(db.Float)
    flow_rate = db.Column(db.Float)
    tank_level = db.Column(db.Float)

    leak_status = db.Column(db.Boolean)

    source = db.Column(db.String(20))


# ============================================================
# HYDRAULIC RESULTS
# ============================================================

class HydraulicResult(db.Model):
    __tablename__ = "hydraulic_results"

    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    scenario = db.Column(db.String(50))
    element_type = db.Column(db.String(20))
    element_id = db.Column(db.String(20))

    value = db.Column(db.Float)
    unit = db.Column(db.String(20))


# ============================================================
# AUTHENTICATED USERS
# ============================================================

class AuthUser(db.Model):
    __tablename__ = "auth_users"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(
        db.String(120),
        nullable=False
    )

    email = db.Column(
        db.String(255),
        nullable=False,
        index=True
    )

    password_hash = db.Column(
        db.String(255),
        nullable=False
    )

    role = db.Column(
        db.String(30),
        nullable=False,
        default="citizen",
        index=True
    )

    is_active = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    __table_args__ = (
        db.UniqueConstraint(
            "email",
            "role",
            name="uq_auth_user_email_role"
        ),
    )


# ============================================================
# CITIZEN REPORTS
# ============================================================

class CitizenReport(db.Model):
    __tablename__ = "citizen_reports"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    # --------------------------------------------------------
    # Link report to authenticated citizen
    # --------------------------------------------------------

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("auth_users.id"),
        nullable=False,
        index=True
    )

    # --------------------------------------------------------
    # Report information
    # --------------------------------------------------------

    category = db.Column(
        db.String(100),
        nullable=False
    )

    description = db.Column(
        db.Text,
        nullable=False
    )

    location = db.Column(
        db.String(255),
        nullable=True
    )

    # --------------------------------------------------------
    # GPS information
    # --------------------------------------------------------

    latitude = db.Column(
        db.Float,
        nullable=True
    )

    longitude = db.Column(
        db.Float,
        nullable=True
    )

    location_accuracy = db.Column(
        db.Float,
        nullable=True
    )

    # --------------------------------------------------------
    # Evidence
    #
    # Stored as text so the current local prototype can retain
    # the image/evidence payload without requiring another
    # storage service.
    # --------------------------------------------------------

    evidence_image = db.Column(
        db.Text,
        nullable=True
    )

    evidence_filename = db.Column(
        db.String(255),
        nullable=True
    )

    # --------------------------------------------------------
    # Report status
    # --------------------------------------------------------

    status = db.Column(
        db.String(30),
        nullable=False,
        default="Submitted"
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    # Relationship back to citizen
    user = db.relationship(
        "AuthUser",
        backref=db.backref(
            "citizen_reports",
            lazy=True
        )
    )