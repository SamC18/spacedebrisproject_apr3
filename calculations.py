import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from io import BytesIO
import base64
import requests
import scipy.stats as stats

R_EARTH_KM = 6378.137
MU_EARTH    = 398600.4418
G0          = 9.80665


class RiskCalculator:
    def __init__(self, mass, area, altitude, inclination, mission_years):
        self.mass          = mass
        self.area          = area
        self.altitude      = altitude
        self.inclination   = inclination
        self.mission_years = mission_years
        self.area_to_mass  = area / mass if mass > 0 else 0

    def calculate_delta_v(self, target_alt=200):
        r1 = R_EARTH_KM + self.altitude
        r2 = R_EARTH_KM + target_alt
        v1 = np.sqrt(MU_EARTH / r1)
        v2 = np.sqrt(MU_EARTH / r2)
        a_transfer = (r1 + r2) / 2
        v_perigee  = np.sqrt(MU_EARTH * (2 / r1 - 1 / a_transfer))
        v_apogee   = np.sqrt(MU_EARTH * (2 / r2 - 1 / a_transfer))
        dv = (abs(v_perigee - v1) + abs(v2 - v_apogee)) * 1.018
        return round(dv * 1000, 2)

    def predict_decay_years(self):
        if self.area_to_mass <= 0:
            return 999
        try:
            f107 = get_solar_flux()
        except Exception:
            f107 = 150  # Solar Maximum default (2026)

        # Solar activity scaling
        # Higher F10.7 = denser upper atmosphere = faster decay
        solar_factor = 1.0 + (f107 - 70.0) / 100.0 * 2.0
        solar_factor = max(0.5, min(solar_factor, 5.0))

        # Altitude-dependent decay coefficient
        # Calibrated against real historical reentries:
        # UARS (585km, 10yr), ROSAT (560km, 10.5yr), Tiangong-1 (380km, 6.5yr)
        if self.altitude < 200:
            k = 3000.0
        elif self.altitude < 300:
            k = 850.0
        elif self.altitude < 400:
            k = 137.0
        elif self.altitude < 500:
            k = 85.0
        elif self.altitude < 600:
            k = 54.0
        elif self.altitude < 700:
            k = 15.0
        elif self.altitude < 800:
            k = 4.0
        elif self.altitude < 900:
            k = 1.0
        else:
            k = 0.3

        effective_coeff = k * solar_factor
        decay_years = self.altitude / (effective_coeff * self.area_to_mass / 0.01)
        return max(0.1, round(decay_years, 2))

    def calculate_debris_flux(self):
        peak_altitude = 850
        peak_width    = 400
        altitude_peak_factor = np.exp(-((self.altitude - peak_altitude) / peak_width) ** 2)
        base_flux  = 1e-6
        inc_rad    = np.deg2rad(self.inclination)
        inc_factor = np.abs(np.sin(inc_rad))
        scale = 1 + 0.5 * inc_factor
        return {
            'small':  base_flux * 1000 * (1 + altitude_peak_factor * 5) * scale,
            'medium': base_flux * 10   * (1 + altitude_peak_factor * 8) * scale,
            'large':  base_flux * 0.1  * (1 + altitude_peak_factor * 3) * scale,
        }

    def calculate_collision_probabilities(self):
        flux = self.calculate_debris_flux()
        small_impacts = flux['small']  * self.area * self.mission_years
        lambda_med    = flux['medium'] * self.area * self.mission_years
        lambda_lrg    = flux['large']  * self.area * self.mission_years
        medium_prob   = 1 - np.exp(-lambda_med)
        large_prob    = 1 - np.exp(-lambda_lrg)
        catastrophic  = medium_prob + large_prob - (medium_prob * large_prob)
        return {
            'flux': flux,
            'small_impacts': small_impacts,
            'medium_prob': medium_prob,
            'large_prob':  large_prob,
            'catastrophic_prob': catastrophic,
        }

    def calculate_fuel_mass(self, delta_v_ms, isp=300):
        mass_ratio = np.exp(delta_v_ms / (isp * G0))
        return self.mass * (mass_ratio - 1)

    def get_risk_assessment(self):
        p = self.calculate_collision_probabilities()['catastrophic_prob']
        if p < 0.0001:
            return {'level': 'Very Low', 'color': '#10b981', 'description': '< 1 in 10,000'}
        elif p < 0.001:
            return {'level': 'Low',      'color': '#3b82f6', 'description': '1 in 10,000 to 1 in 1,000'}
        elif p < 0.01:
            return {'level': 'Moderate', 'color': '#f59e0b', 'description': '1 in 1,000 to 1 in 100'}
        elif p < 0.1:
            return {'level': 'High',     'color': '#ef4444', 'description': '1 in 100 to 1 in 10'}
        else:
            return {'level': 'Critical', 'color': '#991b1b', 'description': '> 1 in 10'}

    def generate_3d_orbit_plot(self):
        inc_rad = np.deg2rad(self.inclination)
        r_orbit = R_EARTH_KM + self.altitude
        theta   = np.linspace(0, 2 * np.pi, 400)
        x_orbit = r_orbit * np.cos(theta)
        y_orbit = r_orbit * np.sin(theta) * np.cos(inc_rad)
        z_orbit = r_orbit * np.sin(theta) * np.sin(inc_rad)
        fig = plt.figure(figsize=(10, 8))
        ax  = fig.add_subplot(111, projection='3d')
        u   = np.linspace(0, 2 * np.pi, 50)
        v   = np.linspace(0, np.pi, 50)
        ax.plot_surface(
            R_EARTH_KM * np.outer(np.cos(u), np.sin(v)),
            R_EARTH_KM * np.outer(np.sin(u), np.sin(v)),
            R_EARTH_KM * np.outer(np.ones(50), np.cos(v)),
            color='#1e3a8a', alpha=0.4, linewidth=0)
        ax.plot(x_orbit, y_orbit, z_orbit, color='#00d0ff', linewidth=3,
                label=f'Orbit: {self.altitude} km, {self.inclination}°')
        ax.scatter([x_orbit[0]], [y_orbit[0]], [z_orbit[0]],
                   color='#ff0000', s=100, zorder=5, label='Satellite')
        ax.set_xlabel('X (km)'); ax.set_ylabel('Y (km)'); ax.set_zlabel('Z (km)')
        ax.set_title(f'Orbital Trajectory\n{self.altitude} km, {self.inclination}°',
                     fontweight='bold')
        ax.legend(); ax.view_init(elev=20, azim=45); ax.grid(True, alpha=0.3)
        lim = r_orbit
        ax.set_xlim([-lim, lim]); ax.set_ylim([-lim, lim]); ax.set_zlim([-lim, lim])
        buf = BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', dpi=120, facecolor='white')
        plt.close(fig)
        return base64.b64encode(buf.getvalue()).decode('utf-8')

    def generate_flux_plot(self, alt_min=150, alt_max=2000, steps=20):
        original_alt = self.altitude
        alts = np.linspace(alt_min, alt_max, steps)
        small_fluxes = []
        for alt in alts:
            self.altitude = alt
            small_fluxes.append(self.calculate_debris_flux()['small'])
        self.altitude = original_alt
        fig, ax = plt.subplots(figsize=(8, 6))
        ax.plot(alts, small_fluxes, color='blue', label='Small Debris Flux')
        ax.set_xlabel('Altitude (km)'); ax.set_ylabel('Flux (/m²/year)')
        ax.set_title(f'Debris Flux vs Altitude (Inclination: {self.inclination}°)')
        ax.grid(True); ax.legend()
        buf = BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', dpi=120)
        plt.close(fig)
        return base64.b64encode(buf.getvalue()).decode('utf-8')


# ── Module-level helpers ────────────────────────────────────────────────────

def validate_inputs(mass, area, altitude, inclination, mission_years):
    errors = []
    if altitude is None:
        errors.append("Altitude is required (or provide a NORAD ID)")
    if inclination is None:
        errors.append("Inclination is required (or provide a NORAD ID)")
    if mass <= 0 or mass > 50000:
        errors.append("Mass must be 0–50,000 kg")
    if area <= 0 or area > 1000:
        errors.append("Area must be 0–1,000 m²")
    if altitude is not None and (altitude < 150 or altitude > 2000):
        errors.append("Altitude must be 150–2,000 km")
    if inclination is not None and (inclination < 0 or inclination > 180):
        errors.append("Inclination must be 0–180 degrees")
    if mission_years <= 0 or mission_years > 50:
        errors.append("Mission duration must be 0–50 years")
    if mass > 0 and area > 0 and area / mass > 10:
        errors.append("Warning: Very high A/m ratio (>10 m²/kg) — check inputs")
    return errors


def get_solar_flux():
    """Fetch latest F10.7 from NOAA. Returns 100 on any error."""
    try:
        url = "https://services.swpc.noaa.gov/text/daily-solar-data.txt"
        response = requests.get(url, timeout=5)
        if response.status_code != 200:
            return 100
        for line in reversed(response.text.split('\n')):
            line = line.strip()
            if line and not line.startswith(':') and not line.startswith('#'):
                parts = line.split()
                if len(parts) > 5:
                    return float(parts[5])
    except Exception:
        pass
    return 100


def fetch_tle_params(norad_id):
    """Fetch TLE from Celestrak and parse altitude + inclination."""
    url = f"https://celestrak.org/NORAD/elements/gp.php?CATNR={norad_id}&FORMAT=tle"
    try:
        response = requests.get(url, timeout=10)
    except Exception as e:
        raise ValueError(f"Network error fetching TLE: {e}")
    if response.status_code != 200 or 'NO SUCH' in response.text:
        raise ValueError("Invalid NORAD ID or TLE not found")
    lines = [l for l in response.text.strip().split('\n') if l.strip()]
    if len(lines) < 3:
        raise ValueError("Invalid TLE format received from Celestrak")
    line2       = lines[2]
    inclination = float(line2[8:16])
    mean_motion = float(line2[52:63])
    n_rad_s     = mean_motion * 2 * np.pi / 86400
    a_km        = (MU_EARTH / n_rad_s ** 2) ** (1 / 3)
    altitude    = a_km - R_EARTH_KM
    return {'altitude': round(altitude, 1), 'inclination': round(inclination, 1)}


def run_monte_carlo(mass, area, altitude, inclination, mission_years, runs=1000):
    """Monte Carlo simulation — jittered inputs, returns statistics."""
    probs = []
    for _ in range(runs):
        j_alt  = max(150,  np.random.normal(altitude,      altitude      * 0.05))
        j_area = max(0.01, np.random.normal(area,          area          * 0.10))
        j_inc  = np.clip(np.random.normal(inclination,     5),            0, 180)
        j_yrs  = max(0.1,  np.random.normal(mission_years, mission_years * 0.05))
        calc = RiskCalculator(mass, j_area, j_alt, j_inc, j_yrs)
        probs.append(calc.calculate_collision_probabilities()['catastrophic_prob'])
    mean_p = float(np.mean(probs))
    std_p  = float(np.std(probs))
    p95    = float(np.percentile(probs, 95))
    ci     = stats.norm.interval(0.95, loc=mean_p,
                                  scale=max(std_p / np.sqrt(runs), 1e-12))
    return {
        'mean_catastrophic_prob': mean_p,
        'std_catastrophic_prob':  std_p,
        'p95_catastrophic_prob':  p95,
        'conf_interval_95':       [float(ci[0]), float(ci[1])],
    }


# ── Backward-compat module-level functions ─────────────────────────────────

def calculate_delta_v(current_alt, target_alt=200):
    return RiskCalculator(1, 1, current_alt, 0, 1).calculate_delta_v(target_alt)

def predict_decay_years(altitude, area_to_mass):
    return RiskCalculator(1, area_to_mass, altitude, 0, 1).predict_decay_years()

def calculate_debris_flux(altitude):
    return RiskCalculator(1, 1, altitude, 0, 1).calculate_debris_flux()

def calculate_collision_probabilities(altitude, area, mission_years):
    return RiskCalculator(1, area, altitude, 0, mission_years).calculate_collision_probabilities()

def calculate_fuel_mass(delta_v_ms, spacecraft_mass_kg, isp=300):
    return RiskCalculator(spacecraft_mass_kg, 1, 0, 0, 1).calculate_fuel_mass(delta_v_ms, isp)

def get_risk_assessment(catastrophic_prob):
    if catastrophic_prob < 0.0001:  return {'level':'Very Low','color':'#10b981','description':'< 1 in 10,000'}
    elif catastrophic_prob < 0.001: return {'level':'Low','color':'#3b82f6','description':'1:10000–1:1000'}
    elif catastrophic_prob < 0.01:  return {'level':'Moderate','color':'#f59e0b','description':'1:1000–1:100'}
    elif catastrophic_prob < 0.1:   return {'level':'High','color':'#ef4444','description':'1:100–1:10'}
    else:                           return {'level':'Critical','color':'#991b1b','description':'> 1 in 10'}

def generate_3d_orbit_plot(altitude, inclination):
    return RiskCalculator(1, 1, altitude, inclination, 1).generate_3d_orbit_plot()

