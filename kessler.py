import numpy as np

TYPICAL_COLLISION_VELOCITY_KMS = 7.5
R_EARTH_KM = 6378.137

def nasa_fragment_count(mass_target_kg, mass_impactor_kg, velocity_kms):
    total_mass_kg = mass_target_kg + mass_impactor_kg
    total_mass_g  = total_mass_kg * 1000
    ke_factor     = (velocity_kms / TYPICAL_COLLISION_VELOCITY_KMS) ** 2
    n_total       = 0.1 * (total_mass_g ** 0.75) * ke_factor
    return {
        "total_fragments":  int(n_total),
        "large_fragments":  max(1, int(n_total * 0.001)),
        "medium_fragments": max(2, int(n_total * 0.05)),
        "small_fragments":  int(n_total * 0.949),
    }

def calculate_post_cascade_flux(original_flux, fragments, altitude_km):
    r            = R_EARTH_KM + altitude_km
    shell_volume = 4 * np.pi * r**2 * 200
    scale        = 10.0
    new_flux = {
        "large":  original_flux["large"]  + (fragments["large_fragments"]  / shell_volume) * scale,
        "medium": original_flux["medium"] + (fragments["medium_fragments"] / shell_volume) * scale,
        "small":  original_flux["small"]  + (fragments["small_fragments"]  / shell_volume) * scale,
    }
    multipliers = {
        "large_multiplier":  round(new_flux["large"]  / original_flux["large"]  if original_flux["large"]  > 0 else 1, 2),
        "medium_multiplier": round(new_flux["medium"] / original_flux["medium"] if original_flux["medium"] > 0 else 1, 2),
    }
    return new_flux, multipliers

def run_cascade_simulation(risk_calculator):
    original_flux  = risk_calculator.calculate_debris_flux()
    original_probs = risk_calculator.calculate_collision_probabilities()
    impactor_mass  = 10.0
    fragments      = nasa_fragment_count(
        mass_target_kg=risk_calculator.mass,
        mass_impactor_kg=impactor_mass,
        velocity_kms=TYPICAL_COLLISION_VELOCITY_KMS
    )
    new_flux, multipliers = calculate_post_cascade_flux(
        original_flux, fragments, risk_calculator.altitude
    )
    mission_years = risk_calculator.mission_years
    area          = risk_calculator.area
    lambda_med    = new_flux["medium"] * area * mission_years
    lambda_lrg    = new_flux["large"]  * area * mission_years
    new_med_prob  = 1 - np.exp(-lambda_med)
    new_lrg_prob  = 1 - np.exp(-lambda_lrg)
    new_catastrophic = new_med_prob + new_lrg_prob - (new_med_prob * new_lrg_prob)
    prob_before   = original_probs["catastrophic_prob"]
    prob_after    = new_catastrophic
    prob_increase = ((prob_after - prob_before) / prob_before * 100) if prob_before > 0 else 0
    return {
        "collision_details": {
            "target_mass_kg":   risk_calculator.mass,
            "impactor_mass_kg": impactor_mass,
            "velocity_kms":     TYPICAL_COLLISION_VELOCITY_KMS,
        },
        "fragments_created": fragments,
        "flux_before": {k: round(v, 10) for k, v in original_flux.items()},
        "flux_after":  {k: round(v, 10) for k, v in new_flux.items()},
        "flux_multipliers": multipliers,
        "collision_prob_before_pct": round(prob_before  * 100, 4),
        "collision_prob_after_pct":  round(prob_after   * 100, 4),
        "probability_increase_pct":  round(prob_increase, 1),
        "cascade_severity": (
            "CATASTROPHIC" if prob_increase > 200 else
            "SEVERE"       if prob_increase > 50  else
            "MODERATE"     if prob_increase > 10  else
            "LOW"
        )
    }

if __name__ == "__main__":
    import json
    from calculations import RiskCalculator
    calc = RiskCalculator(
        mass=420000, area=2500,
        altitude=408, inclination=51.6,
        mission_years=5
    )
    result = run_cascade_simulation(calc)
    print("\n--- Kessler Cascade Simulation Test (ISS parameters) ---")
    print(json.dumps(result, indent=2))
