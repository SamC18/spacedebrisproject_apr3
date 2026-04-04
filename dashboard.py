from calculations import RiskCalculator
from solar_weather import get_space_weather
import datetime

DASHBOARD_SATELLITES = [
    {"name": "ISS (International Space Station)", "norad_id": 25544, "altitude_km": 408, "inclination": 51.6, "mass_kg": 420000, "area_m2": 2500, "mission_years": 5, "icon": "🛸"},
    {"name": "Hubble Space Telescope", "norad_id": 20580, "altitude_km": 540, "inclination": 28.5, "mass_kg": 11110, "area_m2": 13.0, "mission_years": 5, "icon": "🔭"},
    {"name": "Starlink-1007", "norad_id": 44713, "altitude_km": 550, "inclination": 53.0, "mass_kg": 260, "area_m2": 3.0, "mission_years": 5, "icon": "⭐"},
    {"name": "NOAA-20 Weather Satellite", "norad_id": 43013, "altitude_km": 824, "inclination": 98.7, "mass_kg": 2500, "area_m2": 10.0, "mission_years": 10, "icon": "🌩️"},
    {"name": "GPS IIR-11", "norad_id": 28474, "altitude_km": 20200, "inclination": 55.0, "mass_kg": 2032, "area_m2": 8.0, "mission_years": 15, "icon": "📍"},
]

def calculate_risk_score(collision_prob, decay_years, compliant):
    collision_score = min(40, collision_prob * 10000)
    if decay_years > 100:
        decay_score = 30
    elif decay_years > 25:
        decay_score = 20
    elif decay_years > 10:
        decay_score = 10
    else:
        decay_score = 5
    compliance_score = 0 if compliant else 30
    return round(min(100, collision_score + decay_score + compliance_score), 1)

def get_risk_color(score):
    if score >= 70:
        return "#ef4444"
    elif score >= 40:
        return "#f59e0b"
    else:
        return "#10b981"

def get_dashboard_data():
    weather = get_space_weather()
    results = []
    for sat in DASHBOARD_SATELLITES:
        try:
            calc = RiskCalculator(
                mass=sat["mass_kg"], area=sat["area_m2"],
                altitude=sat["altitude_km"], inclination=sat["inclination"],
                mission_years=sat["mission_years"]
            )
            decay_years    = calc.predict_decay_years()
            collision_data = calc.calculate_collision_probabilities()
            delta_v        = calc.calculate_delta_v()
            compliant      = decay_years <= 25
            catastrophic_prob = collision_data["catastrophic_prob"]
            risk_score     = calculate_risk_score(catastrophic_prob, decay_years, compliant)
            results.append({
                "name":              sat["name"],
                "icon":              sat["icon"],
                "norad_id":          sat["norad_id"],
                "altitude_km":       sat["altitude_km"],
                "decay_years":       round(decay_years, 1),
                "catastrophic_prob": round(catastrophic_prob * 100, 4),
                "delta_v_ms":        delta_v,
                "compliant_25yr":    compliant,
                "risk_score":        risk_score,
                "risk_color":        get_risk_color(risk_score),
                "status":            "✅ Compliant" if compliant else "⚠️ Non-Compliant",
            })
        except Exception as e:
            results.append({"name": sat["name"], "icon": sat["icon"], "error": str(e), "risk_score": None})
    return {
        "satellites":    results,
        "space_weather": weather,
        "last_updated":  datetime.datetime.utcnow().isoformat() + "Z"
    }

if __name__ == "__main__":
    import json
    data = get_dashboard_data()
    print(json.dumps(data, indent=2))
