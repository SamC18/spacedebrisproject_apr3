# Test the fix
from calculations import RiskCalculator

tests = [
    ("UARS",      5900, 20.0, 585, 57.0, 10.0),
    ("ROSAT",     2426, 12.0, 560, 53.0, 10.5),
    ("Tiangong-1",8506, 14.0, 380, 42.8, 6.5),
    ("GOCE",      1077,  5.4, 255, 96.7, 4.3),
]
print(f"{'Satellite':<12} {'Predicted':>10} {'Actual':>8} {'Error':>8}")
for name, mass, area, alt, inc, actual in tests:
    calc = RiskCalculator(mass, area, alt, inc, 1)
    pred = calc.predict_decay_years()
    err  = abs(pred - actual) / actual * 100
    print(f"{name:<12} {pred:>10.1f} {actual:>8.1f} {err:>7.1f}%")
