
# ==============================================================
# validation.py
# Checks our predictions against 5 real satellites that
# already reentered Earth's atmosphere (truth is known).
# ==============================================================

# --- PART 1: The 5 real satellites we'll test against ---
# Each entry has the satellite's orbital data at a known point
# in time, plus the actual year it reentered.

HISTORICAL_SATELLITES = [
    {
        "name": "UARS (Upper Atmosphere Research Satellite)",
        "description": "NASA climate research satellite",
        "altitude_km": 585,        # orbit altitude when we measure
        "inclination_deg": 57.0,   # tilt of orbit
        "mass_kg": 5900,           # weight of satellite
        "area_m2": 20.0,           # surface area facing drag
        "years_remaining": 10.0,   # how long from measurement to reentry
        "actual_reentry_year": 2011,
        "measurement_year": 2001,
    },
    {
        "name": "ROSAT (X-ray telescope)",
        "description": "German/NASA X-ray space telescope",
        "altitude_km": 560,
        "inclination_deg": 53.0,
        "mass_kg": 2426,
        "area_m2": 12.0,
        "years_remaining": 10.5,
        "actual_reentry_year": 2011,
        "measurement_year": 2001,
    },
    {
        "name": "Tiangong-1 (Chinese Space Lab)",
        "description": "China's first space station module",
        "altitude_km": 380,
        "inclination_deg": 42.8,
        "mass_kg": 8506,
        "area_m2": 14.0,
        "years_remaining": 6.5,
        "actual_reentry_year": 2018,
        "measurement_year": 2011,
    },
    {
        "name": "GOCE (Gravity field satellite)",
        "description": "ESA satellite mapping Earth gravity",
        "altitude_km": 255,
        "inclination_deg": 96.7,
        "mass_kg": 1077,
        "area_m2": 5.4,
        "years_remaining": 4.3,
        "actual_reentry_year": 2013,
        "measurement_year": 2009,
    },
    {
        "name": "Envisat (Earth observation satellite)",
        "description": "ESA's large Earth observation satellite",
        "altitude_km": 790,
        "inclination_deg": 98.5,
        "mass_kg": 8211,
        "area_m2": 25.0,
        "years_remaining": 100.0,  # predicted very long — still up there
        "actual_reentry_year": None,  # not yet reentered (still being tracked)
        "measurement_year": 2012,
    },
]


# --- PART 2: Run our tool's prediction on each satellite ---

def run_validation(calculator_class):
    """
    Takes our RiskCalculator class, runs it on all 5 satellites,
    and prints a comparison table showing predicted vs actual.
    """
    print("\n" + "="*70)
    print("VALIDATION REPORT — Comparing Predictions vs. Reality")
    print("="*70)

    results = []

    for sat in HISTORICAL_SATELLITES:
        # Create a RiskCalculator for this satellite
        calc = calculator_class(
            mass=sat["mass_kg"],
            area=sat["area_m2"],
            altitude=sat["altitude_km"],
            inclination=sat["inclination_deg"],
            mission_years=1   # mission_years doesn't affect decay prediction
        )

        # Get our tool's prediction for how long until reentry
        predicted_years = calc.predict_decay_years()

        # Compare to real answer (if known)
        actual_years = sat["years_remaining"]

        if sat["actual_reentry_year"] is None:
            error_pct = None
            status = "⏳ Still in orbit (long-lived prediction expected)"
        else:
            # How far off were we? (percentage error)
            if actual_years > 0:
                error_pct = abs(predicted_years - actual_years) / actual_years * 100
            else:
                error_pct = 0
            
            # Grade our prediction
            if error_pct < 20:
                status = "✅ GOOD (within 20%)"
            elif error_pct < 50:
                status = "⚠️  OK (within 50%)"
            else:
                status = "❌ OFF (>50% error)"

        results.append({
            "name": sat["name"],
            "predicted": predicted_years,
            "actual": actual_years,
            "error_pct": error_pct,
            "status": status,
        })

        # Print one row of the table
        print(f"\n📡 {sat['name']}")
        print(f"   Altitude: {sat['altitude_km']} km | "
              f"Mass: {sat['mass_kg']} kg | Area: {sat['area_m2']} m²")
        print(f"   Predicted reentry: {predicted_years:.1f} years")
        print(f"   Actual reentry:    {actual_years:.1f} years")
        if error_pct is not None:
            print(f"   Error:             {error_pct:.1f}%  {status}")
        else:
            print(f"   Status:            {status}")

    # Summary
    errors = [r["error_pct"] for r in results if r["error_pct"] is not None]
    if errors:
        avg_error = sum(errors) / len(errors)
        print("\n" + "-"*70)
        print(f"📊 SUMMARY: Average prediction error = {avg_error:.1f}%")
        good = sum(1 for e in errors if e < 20)
        print(f"   {good}/{len(errors)} predictions within 20% accuracy")
        print("-"*70 + "\n")

    return results


# --- PART 3: Run this file directly as a test ---
if __name__ == "__main__":
    # Import our existing calculator
    from calculations import RiskCalculator
    run_validation(RiskCalculator)

