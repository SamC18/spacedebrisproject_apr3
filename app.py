from dashboard import get_dashboard_data
from kessler import run_cascade_simulation
from conjunction import find_conjunctions, CATALOG_GROUPS
from maneuver import optimize_avoidance_maneuver
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import traceback
from calculations import (RiskCalculator, validate_inputs,
                           run_monte_carlo, fetch_tle_params)

app = FastAPI(title="Satellite Debris Risk Analyzer API", version="4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"],
    allow_headers=["*"], allow_credentials=True,
)


class SatelliteInput(BaseModel):
    mass:          float          = Field(..., gt=0,  le=50000)
    area:          float          = Field(..., gt=0,  le=1000)
    altitude:      Optional[float] = Field(None, ge=150, le=2000)
    inclination:   Optional[float] = Field(None, ge=0,   le=180)
    mission_years: float          = Field(5,    gt=0,  le=50)
    norad_id:      Optional[int]  = Field(None, ge=1)


@app.get("/")
def root():
    return {"service": "Satellite Debris Risk Analyzer", "version": "4.0",
            "endpoints": ["/health", "/v2/analyze", "/v3/analyze",
                          "/v4/monte_carlo", "/v4/tle/{norad_id}", "/docs"]}


@app.get("/health")
def health():
    try:
        calc = RiskCalculator(1, 1, 550, 0, 1)
        return {"status": "healthy", "version": "4.0",
                "test_delta_v": calc.calculate_delta_v()}
    except Exception as e:
        return {"status": "degraded", "error": str(e)}


@app.post("/v2/analyze")
def analyze_v2(data: SatelliteInput):
    try:
        if data.norad_id:
            params = fetch_tle_params(data.norad_id)
            data.altitude    = data.altitude    or params['altitude']
            data.inclination = data.inclination or params['inclination']
        errors = validate_inputs(data.mass, data.area, data.altitude,
                                 data.inclination, data.mission_years)
        if errors:
            raise HTTPException(400, "; ".join(errors))
        calc  = RiskCalculator(data.mass, data.area, data.altitude,
                               data.inclination, data.mission_years)
        dv    = calc.calculate_delta_v()
        decay = calc.predict_decay_years()
        plot  = ""
        try:
            plot = calc.generate_3d_orbit_plot()
        except Exception as e:
            print(f"Plot error: {e}")
        return {"delta_v_for_disposal_m_s": float(dv),
                "predicted_natural_decay_years": float(round(decay, 1)),
                "complies_with_25_year_rule": bool(decay <= 25),
                "orbit_visualization_3d": plot}
    except HTTPException:
        raise
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(500, f"Analysis failed: {e}")


@app.post("/v3/analyze")
def analyze_v3(data: SatelliteInput):
    try:
        if data.norad_id:
            params = fetch_tle_params(data.norad_id)
            data.altitude    = data.altitude    or params['altitude']
            data.inclination = data.inclination or params['inclination']
        errors = validate_inputs(data.mass, data.area, data.altitude,
                                 data.inclination, data.mission_years)
        if errors:
            raise HTTPException(400, "; ".join(errors))
        calc  = RiskCalculator(data.mass, data.area, data.altitude,
                               data.inclination, data.mission_years)
        coll  = calc.calculate_collision_probabilities()
        dv    = calc.calculate_delta_v()
        decay = calc.predict_decay_years()
        fuel  = calc.calculate_fuel_mass(dv)
        risk  = calc.get_risk_assessment()
        orbit_plot = flux_plot = ""
        try:
            orbit_plot = calc.generate_3d_orbit_plot()
            flux_plot  = calc.generate_flux_plot()
        except Exception as e:
            print(f"Plot error: {e}")
        return {
            "collision_risk": {
                "flux": {k: float(v) for k, v in coll['flux'].items()},
                "small_debris_impacts":              float(round(coll['small_impacts'], 2)),
                "medium_debris_probability_percent": float(round(coll['medium_prob'] * 100, 4)),
                "catastrophic_probability_percent":  float(round(coll['catastrophic_prob'] * 100, 4)),
                "catastrophic_probability_raw":      float(coll['catastrophic_prob']),
                "risk_level":       risk['level'],
                "risk_color":       risk['color'],
                "risk_description": risk['description'],
            },
            "compliance": {
                "nasa_compliant":         bool(coll['catastrophic_prob'] < 0.001),
                "nasa_requirement":       "< 0.1% (1 in 1,000)",
                "nasa_actual":            f"{coll['catastrophic_prob']*100:.4f}%",
                "iadc_25_year_compliant": bool(decay <= 25),
                "iadc_actual":            f"{decay:.1f} years",
            },
            "disposal": {
                "delta_v_required_m_s":  float(dv),
                "natural_decay_years":   float(round(decay, 1)),
                "fuel_mass_required_kg": float(round(fuel, 1)),
                "area_to_mass_ratio":    float(round(calc.area_to_mass, 4)),
            },
            "orbit_visualization_3d": orbit_plot,
            "flux_visualization":     flux_plot,
            "mission_parameters": {
                "mass_kg":               float(data.mass),
                "area_m2":               float(data.area),
                "altitude_km":           float(data.altitude),
                "inclination_deg":       float(data.inclination),
                "mission_duration_years": float(data.mission_years),
            },
            "metadata": {"analysis_version": "4.0",
                         "calculation_engine": "pure_python_numpy"},
        }
    except HTTPException:
        raise
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(500, f"Analysis failed: {e}")


@app.post("/v4/monte_carlo")
def monte_carlo(data: SatelliteInput):
    try:
        if data.norad_id:
            params = fetch_tle_params(data.norad_id)
            data.altitude    = data.altitude    or params['altitude']
            data.inclination = data.inclination or params['inclination']
        errors = validate_inputs(data.mass, data.area, data.altitude,
                                 data.inclination, data.mission_years)
        if errors:
            raise HTTPException(400, "; ".join(errors))
        mc = run_monte_carlo(data.mass, data.area, data.altitude,
                             data.inclination, data.mission_years)
        return {"monte_carlo_results": mc, "runs": 1000,
                "metadata": {"version": "4.0"}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/v4/tle/{norad_id}")
def get_tle(norad_id: int):
    try:
        return fetch_tle_params(norad_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)



@app.get("/dashboard")
def dashboard_endpoint():
    return get_dashboard_data()

@app.post("/kessler")
def kessler_endpoint(payload: dict):
    from calculations import RiskCalculator
    calc = RiskCalculator(
        mass          = float(payload.get("mass_kg", 500)),
        area          = float(payload.get("area_m2", 5)),
        altitude      = float(payload.get("altitude_km", 550)),
        inclination   = float(payload.get("inclination_deg", 53)),
        mission_years = float(payload.get("mission_years", 5))
    )
    return run_cascade_simulation(calc)

# ─────────────────────────────────────────────
# Sprint 2 — Live Conjunction Detection
# ─────────────────────────────────────────────

@app.get("/conjunctions")
def conjunctions_endpoint(
    norad_id:      int   = 25544,
    hours:         float = 24.0,
    threshold_km:  float = 10.0,
    catalog_group: str   = "visual",
):
    """
    Detect upcoming conjunction events for a satellite.

    Query params:
      norad_id      — NORAD catalog ID of the satellite (default: 25544 = ISS)
      hours         — look-ahead window in hours (max 72, default 24)
      threshold_km  — flag events closer than this in km (default 10)
      catalog_group — which Celestrak group to check against:
                      visual | stations | cosmos-debris | fengyun-debris |
                      iridium-debris | active
    """
    if hours > 72:
        hours = 72.0
    if threshold_km <= 0:
        threshold_km = 1.0

    result = find_conjunctions(
        norad_id=norad_id,
        hours=hours,
        threshold_km=threshold_km,
        catalog_group=catalog_group,
    )
    return result


@app.get("/conjunction-catalogs")
def catalog_list():
    """Returns the available catalog group names."""
    return {"available_groups": list(CATALOG_GROUPS.keys())}
# ── Sprint 3: Maneuver Optimizer ──────────────────────────────────────────────
@app.post("/maneuver")
def maneuver_endpoint(payload: dict):
    return optimize_avoidance_maneuver(
        altitude_km        = float(payload.get("altitude_km", 550)),
        inclination_deg    = float(payload.get("inclination_deg", 53)),
        spacecraft_mass_kg = float(payload.get("spacecraft_mass_kg", 500)),
        miss_distance_km   = float(payload.get("miss_distance_km", 2.5)),
        minutes_to_tca     = float(payload.get("minutes_to_tca", 90)),
        object_name        = str(payload.get("object_name", "Unknown")),
        target_miss_km     = float(payload.get("target_miss_km", 5.0)),
        isp_s              = float(payload.get("isp_s", 220)),
    )
