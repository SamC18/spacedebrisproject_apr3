# Derive corrected k values from real data
# decay_years = altitude / (k * solar_factor * area_to_mass / 0.01)
# Therefore: k = altitude / (decay_years * solar_factor * area_to_mass / 0.01)

solar_factor = 1.6  # reduced from 2.6 — less aggressive at Solar Max

tests = [
    ("UARS",       585, 5900, 20.0, 10.0),
    ("ROSAT",      560, 2426, 12.0, 10.5),
    ("Tiangong-1", 380, 8506, 14.0, 6.5),
    ("GOCE",       255, 1077,  5.4, 4.3),
]

print(f"{'Satellite':<12} {'A/m':>6} {'k_needed':>10}")
for name, alt, mass, area, actual in tests:
    am = area / mass
    k = alt / (actual * solar_factor * am / 0.01)
    print(f"{name:<12} {am:>6.4f} {k:>10.1f}")
