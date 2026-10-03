# Satellite Debris Risk Analyzer

A full-stack web app that estimates collision and reentry risk for satellites, detects live close approaches with debris, and recommends fuel-efficient avoidance maneuvers. Built for the **2026 Congressional App Challenge**.


## What it does

Enter a satellite's mass, area, altitude, and inclination (or just a NORAD ID and the orbit is looked up automatically) and the app returns risk numbers, compliance checks, live conjunction alerts, and a recommended burn.

| Tab | Description | Endpoint |
|---|---|---|
| Analyzer | Debris flux, collision probabilities, risk level, disposal delta-V, fuel mass, decay time, 3D orbit and flux plots | `POST /v3/analyze`, `POST /v4/monte_carlo`, `GET /v4/tle/{norad_id}` |
| Live Dashboard | Preset cards for ISS, Hubble, Starlink-1007, NOAA-20, GPS IIR-11 | `GET /dashboard` |
| Conjunctions | Real TLEs from Celestrak, orbit propagation, closest approaches sorted by miss distance | `GET /conjunctions` |
| Maneuver Optimizer | Smallest burn that raises miss distance to a safe target, plus fuel and timing | `POST /maneuver` |
| Validation | Compares decay predictions to satellites with known reentry dates | n/a |
| Kessler Cascade | Simulates how a collision's debris cloud raises nearby collision risk | `POST /kessler` |

## How it works

- **Debris flux and collision odds** (`calculations.py`): flux is modeled with a Gaussian peak at 850 km and an inclination factor, separately for small, medium, and large debris. Collision probability uses the Poisson formula `P = 1 - e^(-λ)` and is checked against NASA's under 0.1% guideline.
- **Orbital decay** (`calculations.py`, `solar_weather.py`): depends on altitude, area-to-mass ratio, and live NOAA F10.7 solar flux (fallback 150). Checked against the 25-year IADC guideline.
- **Disposal delta-V and fuel**: Hohmann transfer to 200 km using the vis-viva equation, and the Tsiolkovsky rocket equation for fuel.
- **Monte Carlo**: 1,000 runs with randomized inputs, reporting mean, standard deviation, 95th percentile, and a 95% confidence interval.
- **Conjunction detection** (`conjunction.py`): sgp4 propagation in 10-minute steps for up to 72 hours, vectorized with `SatrecArray`, keeping the closest approach per object. Supports catalog groups: visual, stations, active, cosmos-debris, fengyun-debris, iridium-debris.
- **Maneuver optimizer** (`maneuver.py`): binary search on delta-V across prograde, retrograde, radial, and normal burns to find the minimum-fuel option.
- **Kessler cascade** (`kessler.py`): NASA-style fragment count from a 10 kg impactor at 7.5 km/s, spread over an orbital shell to compute the new flux and risk increase.

## Validation

| Satellite | Predicted (yr) | Actual (yr) | Error |
|---|---|---|---|
| UARS | 9.96 | 10.0 | 0.4% |
| ROSAT | 10.4 | 10.5 | 1.0% |
| Tiangong-1 | 6.45 | 6.5 | 0.8% |
| GOCE | 4.28 | 4.3 | 0.5% |

The decay coefficients were tuned using these four satellites, so these results are not an independent test. Testing on new satellites is a next step.

## Project structure

| File | Role |
|---|---|
| `app.py` | FastAPI server and endpoints |
| `calculations.py` | `RiskCalculator`: flux, collision odds, decay, delta-V, fuel, plots, Monte Carlo |
| `conjunction.py` | TLE fetching, sgp4 propagation, close-approach detection |
| `maneuver.py` | Burn optimizer |
| `kessler.py` | Cascade simulation |
| `solar_weather.py` | NOAA F10.7 and Kp fetchers |
| `validation.py` | Historical satellite comparison |
| `dashboard.py` | Preset dashboard satellites |
| `frontend/src/` | React components, one per feature tab |

## Known limitations

- Simplified two-body orbital mechanics and impulsive burns, so results are estimates for education, not mission operations
- Debris flux is an approximation, not a full NASA ORDEM or ESA MASTER model
- Conjunctions use miss distance only, not covariance-based collision probability
- Live features need Celestrak and NOAA to be reachable (default solar values are used if NOAA is down)

## Ideas for 2.0

- Validate decay on satellites not used for tuning
- Covariance-based conjunction probability
- Feed conjunction results straight into the maneuver optimizer
- Alerts for high-risk events

## Credits

Open-source libraries: FastAPI, Uvicorn, Pydantic, NumPy, SciPy, sgp4, Matplotlib, Requests, React, Vite, Axios, lucide-react. Data from Celestrak and NOAA SWPC.
