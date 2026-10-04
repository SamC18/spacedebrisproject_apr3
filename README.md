# Satellite Debris Risk Analyzer

A full-stack web app that estimates collision and reentry risk for satellites, finds live close approaches with debris, and recommends the smallest burn needed to avoid one. Built for the **2026 Congressional App Challenge**.

**Stack:** Python (FastAPI, NumPy, SciPy, sgp4, Matplotlib) · React 19 + Vite · live data from Celestrak and NOAA SWPC

## The problem

Tens of thousands of tracked objects orbit Earth, and even a small fragment moving at orbital speed can destroy a satellite. Every collision makes more fragments, which makes the next collision more likely (the *Kessler effect*). Operators need quick answers to four questions:

1. How likely is my satellite to be hit?
2. Will it come down on its own within the 25-year guideline, or does it need to be deorbited?
3. Is something about to pass dangerously close?
4. If so, how much fuel does it cost to dodge it?

This app answers all four in one place, using live orbital and space-weather data.

## What it does

Enter a satellite's mass, area, altitude, and inclination (or just a NORAD ID, and the orbit is looked up automatically). The app has six tabs:

| Tab | What it does | Endpoint |
|---|---|---|
| **Analyzer** | Debris flux, collision probabilities, risk level, natural decay time, 25-year compliance, disposal delta-V and fuel, 3D orbit plot, flux plot, optional Monte Carlo uncertainty | `POST /v3/analyze`, `POST /v4/monte_carlo`, `GET /v4/tle/{norad_id}` |
| **Live Dashboard** | Risk score from 0 to 100 for five real satellites (ISS, Hubble, Starlink-1007, NOAA-20, GPS IIR-11), color-coded, with live NOAA space weather | `GET /dashboard` |
| **Conjunctions** | Downloads live orbital data, tracks a satellite against a catalog of objects, lists the closest approaches sorted by miss distance | `GET /conjunctions` |
| **Maneuver Optimizer** | Finds the smallest burn that pushes the miss distance to a safe target, with fuel cost and timing advice | `POST /maneuver` |
| **Validation** | Compares the decay model's predictions to satellites whose real reentry dates are known | n/a |
| **Kessler Cascade** | Simulates how a collision's debris cloud raises collision risk for nearby satellites | `POST /kessler` |

## Example: analyzing the Hubble Space Telescope

Input: NORAD ID 20580, mass 11,110 kg, area 13 m², 5-year mission.

With default solar activity, the Analyzer reports roughly:

- **Catastrophic collision probability:** about 0.43% over 5 years, which is **Moderate** risk
- **Natural decay time:** about 34 years, so it **fails the 25-year guideline** and would need an active deorbit
- **Disposal delta-V:** about 197 m/s to lower the orbit to 200 km

Exact numbers shift slightly with live solar activity, because a more active Sun makes the upper atmosphere denser and speeds up decay.

## Risk levels

| Level | Catastrophic collision probability |
|---|---|
| Very Low | below 1 in 10,000 |
| Low | 1 in 10,000 to 1 in 1,000 |
| Moderate | 1 in 1,000 to 1 in 100 |
| High | 1 in 100 to 1 in 10 |
| Critical | above 1 in 10 |

NASA's guideline is a catastrophic probability under 0.1% (1 in 1,000), and the IADC guideline is deorbiting within 25 years.

## How it works

### Debris flux and collision probability (`calculations.py`)
Debris is not spread evenly: it is densest near 850 km. The model uses a Gaussian peak at 850 km (width 400 km) and an inclination factor `1 + 0.5·|sin(i)|`, computed separately for small, medium, and large debris. Expected impacts equal flux × cross-section area × mission years, and the probability of at least one hit follows the Poisson formula `P = 1 - e^(-λ)`. The catastrophic probability combines medium and large impacts: `P_med + P_large - P_med·P_large`.

### Orbital decay (`calculations.py`, `solar_weather.py`)
Satellites slowly fall because of drag from the thin upper atmosphere. Decay time depends on altitude, area-to-mass ratio, and solar activity. The app pulls the live **F10.7 solar radio flux** from NOAA (fallback value 150, solar maximum). The altitude-dependent drag coefficient is interpolated between anchor points tuned on four real satellites (see Validation).

### Disposal delta-V and fuel
Delta-V for disposal comes from a **Hohmann transfer** down to 200 km using the vis-viva equation `v = sqrt(μ(2/r - 1/a))`. Fuel comes from the **Tsiolkovsky rocket equation** `m_fuel = m(e^(Δv/(Isp·g0)) - 1)`.

### Monte Carlo uncertainty
Real inputs are never exact, so the app runs **1,000 simulations** with random noise added to altitude (5%), area (10%), inclination (5°), and mission length (5%). It reports the mean, standard deviation, 95th percentile, and a 95% confidence interval.

### Live conjunction detection (`conjunction.py`)
1. Downloads the target's orbital data (a **TLE**, two lines of text describing an orbit) and a catalog group from Celestrak. Groups: visual, stations, active, cosmos-debris, fengyun-debris, iridium-debris.
2. Uses the **sgp4** library to predict every object's position in 10-minute steps for up to 72 hours.
3. Vectorized with `SatrecArray`, so large catalogs are checked in seconds.
4. Keeps the single closest approach per object and sorts by miss distance.

### Maneuver optimizer (`maneuver.py`)
Tests burns in four directions (prograde, retrograde, radial, normal) and uses a **binary search** on burn size to find the smallest delta-V that raises the miss distance to a target (default 5 km). It returns fuel cost (default Isp 220 s) and timing advice: immediate if closest approach is within 90 minutes, soon within 4 hours, planned beyond that.

### Kessler cascade (`kessler.py`)
Simulates a collision with a 10 kg impactor at 7.5 km/s. The fragment count follows a NASA-style power law scaled by collision energy, split into large (0.1%), medium (5%), and small (94.9%) fragments. The fragments are spread over an orbital shell to compute the new flux, and the result is labeled Low, Moderate, Severe, or Catastrophic.

### Dashboard risk score (`dashboard.py`)
The 0 to 100 score adds three parts: collision risk (up to 40 points), decay time (5 points under 10 years, up to 30 points over 100 years), and 25-year compliance (30 points if non-compliant). Green is below 40, orange is 40 to 69, and red is 70 or more.

## Validation

The decay model was checked against satellites whose reentry times are known (default solar activity):

| Satellite | Predicted (yr) | Actual (yr) | Error |
|---|---|---|---|
| UARS | 9.96 | 10.0 | 0.4% |
| ROSAT | 10.4 | 10.5 | 1.0% |
| Tiangong-1 | 6.45 | 6.5 | 0.8% |
| GOCE | 4.28 | 4.3 | 0.5% |

**Honest note:** the drag coefficients were tuned using these same four satellites, so this is a calibration check, not an independent test. Envisat, which was not used for tuning, is predicted to last far longer than the others, as expected for its altitude. Testing on satellites not used for tuning is the next step.

## Tech stack

| Layer | Tools |
|---|---|
| Backend | Python, FastAPI, Uvicorn, Pydantic, NumPy, SciPy, sgp4, Matplotlib, Requests |
| Frontend | React 19, Vite, Axios, lucide-react |
| Live data | Celestrak (TLE orbital data), NOAA SWPC (F10.7 solar flux, Kp index) |

## Project structure

| File | Role |
|---|---|
| `app.py` | FastAPI server, input validation (Pydantic), and all endpoints |
| `calculations.py` | `RiskCalculator`: flux, collision odds, decay, delta-V, fuel, plots, Monte Carlo |
| `conjunction.py` | TLE fetching, sgp4 propagation, close-approach detection |
| `maneuver.py` | Burn optimizer |
| `kessler.py` | Cascade simulation |
| `solar_weather.py` | NOAA F10.7 and Kp fetchers with fallback values |
| `validation.py` | Historical satellite data and prediction comparison |
| `dashboard.py` | Preset satellites and the risk score formula |
| `frontend/src/App.jsx` | Main app, tab navigation, Analyzer and Dashboard views |
| `frontend/src/` (other files) | One React component per feature tab |

## Known limitations

- Orbital mechanics are simplified (two-body, impulsive burns), so results are estimates for education, not mission operations.
- Impact odds use a satellite's full cross-section and do not model shielding or operator maneuvers, so very large objects like the ISS come out as high risk.
- The debris flux model is an approximation, not a full NASA ORDEM or ESA MASTER model.
- Conjunctions use miss distance only, not covariance-based collision probability.
- The Analyzer limits input to mass up to 50,000 kg and area up to 1,000 m².
- Live features need Celestrak and NOAA to be reachable. If NOAA is down, default solar values are used.

## Ideas for 2.0

- Validate the decay model on satellites not used for tuning
- Covariance-based collision probability for conjunctions
- Feed a detected conjunction straight into the maneuver optimizer
- Alerts for high-risk events

## Credits

Open-source libraries: FastAPI, Uvicorn, Pydantic, NumPy, SciPy, sgp4, Matplotlib, Requests, React, Vite, Axios, lucide-react. Data from Celestrak and NOAA SWPC.
