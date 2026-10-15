# Satellite Debris Risk Analyzer

A full-stack web app that estimates collision and reentry risk for satellites, finds close approaches with other orbiting objects, and recommends the smallest burn needed to avoid one. Built for the **2026 Congressional App Challenge**.

**Stack:** Python (FastAPI, NumPy, SciPy, sgp4, Matplotlib) · React 19 + Vite · data from Celestrak and NOAA SWPC

**Live demo:** https://spacedebrisproject-apr3.onrender.com (if it has been idle, the first load may take a minute to wake up)

## The problem

Tens of thousands of tracked objects orbit Earth, and even a small fragment moving at orbital speed can destroy a satellite. Every collision makes more fragments, which makes the next collision more likely (the *Kessler effect*). Operators need quick answers to four questions:

1. How likely is my satellite to be hit?
2. Will it come down on its own within the 25-year guideline, or does it need to be deorbited?
3. Is something about to pass dangerously close?
4. If so, how much fuel does it cost to dodge it?

This app answers all four in one place.

## What it does

Enter a satellite's mass, area, altitude, and inclination (or a NORAD ID, and the orbit is looked up automatically). The app has six tabs:

| Tab | What it does | Endpoint |
|---|---|---|
| **Analyzer** | Debris flux, collision probabilities, risk level, natural decay time, 25-year compliance, disposal delta-V and fuel, 3D orbit plot, flux plot, optional Monte Carlo uncertainty | `POST /v3/analyze`, `POST /v4/monte_carlo`, `GET /v4/tle/{norad_id}` |
| **Live Dashboard** | Risk score from 0 to 100 for five real satellites (ISS, Hubble, Starlink-1007, NOAA-20, GPS IIR-11), color-coded, with a NOAA space-weather banner | `GET /dashboard` |
| **Conjunctions** | Tracks a target satellite (ISS or Hubble in the app) against a catalog of objects and lists the closest sampled approaches, sorted by miss distance | `GET /conjunctions` |
| **Maneuver Optimizer** | Finds the smallest burn that pushes the miss distance to a safe target, with fuel cost and timing advice | `POST /maneuver` |
| **Validation** | Compares the decay model's predictions to satellites whose real reentry dates are known | uses `POST /v3/analyze` |
| **Kessler Cascade** | Simulates how a collision's debris cloud raises collision risk for nearby satellites | `POST /kessler` |

Interactive API docs are served at `/docs`.

## Run it locally

**Backend** (Python 3.11):

```bash
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

The API is now at `http://localhost:8000` (docs at `http://localhost:8000/docs`).

**Frontend** (Node 20.19+ or 22.12+):

```bash
cd frontend
npm install
echo "VITE_API_BASE=http://localhost:8000" > .env.local
npm run dev
```

If `VITE_API_BASE` is not set, the frontend uses the hosted API at `https://spacedebrisproject-apr3.onrender.com`. If that server has been idle, the first request may take a while to wake up.

## Data sources and fallbacks

The app tries live data first and falls back to safe defaults, so it keeps working if a service is unreachable.

| Data | Source | If it cannot be reached |
|---|---|---|
| Solar flux (F10.7) and Kp index for the dashboard banner | NOAA SWPC | Defaults of F10.7 = 150 and Kp = 3 are shown. The banner is still labeled "Live Space Weather" in this case. |
| Solar flux for the decay model | NOAA SWPC | A fixed value of F10.7 = 100 is used when the flux cannot be read. Currently the data file this model reads returns "not found," so the decay model always uses 100, including on the hosted demo (see "Orbital decay"). |
| Orbit catalogs for Conjunctions | Celestrak | A saved snapshot is used (`tle_visual.tle`, the "visual" group, 156 objects). The result panel shows which source was used and the snapshot's date. Some cloud hosts are blocked by Celestrak, so this fallback matters for hosted use. |
| NORAD ID lookup in the Analyzer | Celestrak | The lookup fails with an error. Enter altitude and inclination manually instead. |

## Example: analyzing the Hubble Space Telescope

Input: Hubble's preset orbit (540 km, 28.5°), mass 11,110 kg, area 13 m², 5-year mission, at the calibration solar flux (F10.7 = 150).

- **Catastrophic collision probability:** about 0.43% over 5 years, which is **Moderate** risk
- **Natural decay time:** about 34 years, so it **fails the 25-year guideline** and would need an active deorbit
- **Disposal delta-V:** about 197 m/s to lower the orbit to 200 km, which takes about 770 kg of propellant at Isp 300 s

This example uses the preset orbit from the Dashboard. Entering NORAD ID 20580 in the Analyzer downloads Hubble's *current* orbit instead, which in the saved October 2026 data is about 470 km, so the results differ (about 0.34% catastrophic probability and about 17 years of decay, which would pass the 25-year guideline).

The decay time shifts with solar activity, because a more active Sun makes the upper atmosphere denser and speeds up decay. The decay model currently uses a fixed F10.7 = 100 (see "Orbital decay"), so the hosted demo shows about 38.6 years for the same satellite instead of 34.

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
Satellites slowly fall because of drag from the thin upper atmosphere. Decay time depends on altitude, area-to-mass ratio, and solar activity. The drag coefficient is interpolated by altitude between anchor points. Four anchors (255, 380, 560, and 585 km) were tuned on real satellites; the others (150, 700, 800, 900, and 2,000 km) are assumed values. The result is scaled by the solar flux: `1.65 × (1 + (F10.7 − 150) / 400)`, so F10.7 = 150 is the calibration point. The decay model has its own solar-flux fetcher (in `calculations.py`) that falls back to 100 when the NOAA data cannot be read. The NOAA file it reads currently returns "not found," so the model uses 100 everywhere, including the hosted demo, and its decay predictions run a little long compared with the 150 calibration point. Using one flux source for both the decay model and the dashboard (`solar_weather.py`) is on the 2.0 list.

### Disposal delta-V and fuel
Delta-V for disposal comes from a **Hohmann transfer** down to 200 km using the vis-viva equation `v = sqrt(μ(2/r - 1/a))`, with a 1.8% margin. Fuel comes from the **Tsiolkovsky rocket equation** `m_fuel = m(e^(Δv/(Isp·g0)) - 1)`, using Isp 300 s for disposal.

### Monte Carlo uncertainty
Real inputs are never exact, so the app runs **1,000 simulations** with random noise added to altitude (5%), area (10%), inclination (5°), and mission length (5%). It reports the mean, standard deviation, 95th percentile, and a 95% confidence interval.

### Live conjunction detection (`conjunction.py`)
1. Gets the target's orbital data (a **TLE**, two lines of text describing an orbit) and a catalog group from Celestrak, or from the saved snapshot if Celestrak is unreachable. Groups: visual, stations, active, cosmos-debris, fengyun-debris, iridium-debris. A snapshot is saved only for "visual".
2. Uses the **sgp4** library to predict every object's position in 10-minute steps for up to 72 hours.
3. Vectorized with `SatrecArray`, so the catalog is checked quickly (catalog size is capped at 600 objects).
4. Keeps the single closest approach per object and sorts by miss distance.

A live Celestrak attempt that fails times out after 15 seconds, so the first scan on a host that can't reach Celestrak can take about that long.

**Sampling limit.** Positions are checked every 10 minutes, and objects move thousands of kilometers between checks, so a fast fly-by can fall between samples. A short list, or "No conjunctions detected," is therefore not proof of safety. The reported miss distance is the closest *sampled* distance, and the relative speed is a rough estimate. In one test on the saved snapshot, a 24-hour Hubble scan at a 50 km threshold flagged 0 objects with 10-minute steps but 4 objects with 10-second steps. A smaller time step is on the 2.0 list.

### Maneuver optimizer (`maneuver.py`)
Tests burns in four directions (prograde, retrograde, radial, normal) and uses a **binary search** on burn size to find the smallest delta-V that raises the miss distance to a target (default 5 km). It returns fuel cost (default Isp 220 s) and timing advice: immediate if closest approach is within 90 minutes, soon within 4 hours, planned beyond that. Miss-distance change is estimated with simple first-order formulas (drift for prograde and retrograde burns, displacement for radial and normal burns), not a full orbit propagation. The "risk if no maneuver" label uses fixed bands by miss distance, not a computed probability.

### Kessler cascade (`kessler.py`)
Simulates a collision with a 10 kg impactor at 7.5 km/s. The fragment count follows a simplified NASA-style power law scaled by collision energy, split into large (0.1%), medium (5%), and small (94.9%) fragments. The fragments are spread over an orbital shell to compute the new flux, and the result is labeled Low, Moderate, Severe, or Catastrophic. The spreading uses a 200 km thick shell and a tuning factor, so the results are qualitative.

### Dashboard risk score (`dashboard.py`)
The 0 to 100 score adds three parts:
- **Collision risk:** 1 point for each 0.01% of catastrophic probability, capped at 40 points.
- **Decay time:** 5 points under 10 years, 10 points over 10 years, 20 points over 25 years, and 30 points over 100 years.
- **25-year compliance:** 30 points if the satellite does not meet the guideline.

Green is below 40, orange is 40 to 69, and red is 70 or more.

## Validation

The decay model was checked against satellites whose reentry times are known, at the calibration solar flux (F10.7 = 150):

| Satellite | Predicted (yr) | Actual (yr) | Error |
|---|---|---|---|
| UARS | 9.96 | 10.0 | 0.4% |
| ROSAT | 10.4 | 10.5 | 1.0% |
| Tiangong-1 | 6.45 | 6.5 | 0.8% |
| GOCE | 4.28 | 4.3 | 0.5% |

**Honest note:** the drag coefficients were tuned using these same four satellites, so this is a calibration check, not an independent test. It only covers altitudes from about 255 to 585 km. Envisat (790 km), which was not used for tuning, is predicted to last far longer than the others (about 157 years), as expected for its altitude, but there is no reentry date to compare against.

**What the hosted demo shows.** The Validation tab runs the same model with F10.7 = 100, so it reports an average error of about 13.8% (UARS 11.4 vs 10.0 yr, ROSAT 11.9 vs 10.5, Tiangong-1 7.4 vs 6.5, GOCE 4.9 vs 4.3), still within 20% for each satellite. At the calibration flux of 150 the errors are under 1%, as in the table above. Testing on satellites not used for tuning is the next step.

## Tech stack

| Layer | Tools |
|---|---|
| Backend | Python, FastAPI, Uvicorn, Pydantic, NumPy, SciPy, sgp4, Matplotlib, Requests |
| Frontend | React 19, Vite, Axios, lucide-react |
| Data | Celestrak (TLE orbital data), NOAA SWPC (F10.7 solar flux, Kp index) |

## Project structure

| File | Role |
|---|---|
| `app.py` | FastAPI server, input validation, and all endpoints |
| `calculations.py` | `RiskCalculator`: flux, collision odds, decay, delta-V, fuel, plots, Monte Carlo |
| `conjunction.py` | TLE loading (live or snapshot), sgp4 propagation, close-approach detection |
| `maneuver.py` | Burn optimizer |
| `kessler.py` | Cascade simulation |
| `solar_weather.py` | NOAA F10.7 and Kp fetchers with fallback values |
| `validation.py` | Historical satellite data and a command-line prediction comparison |
| `dashboard.py` | Preset satellites and the risk score formula |
| `tle_visual.tle` | Saved Celestrak snapshot used when live data is unreachable |
| `frontend/src/App.jsx` | Main app, tab navigation, Analyzer and Dashboard views |
| `frontend/src/` (other files) | One React component per feature tab |
| `requirements.txt`, `runtime.txt` | Python dependencies and version |

## Known limitations

- Orbital mechanics are simplified (two-body, impulsive burns), so results are estimates for education, not mission operations.
- Impact odds use a satellite's full cross-section and do not model shielding or operator maneuvers, so very large objects like the ISS come out as high risk.
- The debris flux model is an approximation, not a full NASA ORDEM or ESA MASTER model.
- The decay model is calibrated only between about 255 and 585 km.
- Conjunctions use miss distance only, not covariance-based collision probability, and 10-minute sampling can miss fast fly-bys (see "Live conjunction detection").
- The Dashboard's GPS preset (about 20,200 km) is far outside the model's 150 to 2,000 km range, so its decay time and risk score are not meaningful.
- Maneuver and Kessler results come from simplified models intended to show the idea, not to replace operational tools.
- The Analyzer limits input to mass up to 50,000 kg, area up to 1,000 m², altitude 150 to 2,000 km, and mission length up to 50 years. The Kessler tab's ISS preset (2,500 m²) exceeds the Analyzer's area limit, and the ISS presets on the Maneuver tab and Dashboard (420,000 kg) exceed its mass limit.
- Live features need Celestrak and NOAA to be reachable. See "Data sources and fallbacks" for what happens otherwise.
- The decay model currently uses a fixed solar flux of F10.7 = 100, because the NOAA data file it reads is no longer available. This makes decay times run a little long compared with the calibration value of 150. The dashboard banner is labeled "Live Space Weather" even when it shows default values.
- There are no automated tests yet.

## Ideas for 2.0

- Validate the decay model on satellites not used for tuning
- Covariance-based collision probability for conjunctions
- A finer time step (or refining around each closest approach) for conjunction scans
- Feed a detected conjunction straight into the maneuver optimizer
- Alerts for high-risk events
- Use one solar-flux source for the decay model and the dashboard, and label default values clearly
- Automated tests

## Credits

Open-source libraries: FastAPI, Uvicorn, Pydantic, NumPy, SciPy, sgp4, Matplotlib, Requests, React, Vite, Axios, lucide-react. Data from Celestrak and NOAA SWPC.
