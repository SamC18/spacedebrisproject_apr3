
# ==============================================================
# solar_weather.py
# Fetches live solar activity data from NOAA's Space Weather
# Prediction Center (SWPC) API.
#
# Two numbers we care about:
#   F10.7 — solar radio flux (how active the Sun is)
#            Normal quiet Sun = ~70, Active Sun = 150-250+
#            We're near Solar Maximum in 2026, expect 150+
#
#   Kp    — geomagnetic storm index (0-9 scale)
#            0-1 = calm, 5+ = storm, 9 = extreme
#            Storms temporarily puff up the atmosphere a LOT
# ==============================================================

import requests

# If NOAA is unreachable, use these safe fallback values
# (these are realistic 2026 Solar Maximum values)
DEFAULT_F107 = 150.0
DEFAULT_KP   = 3.0


# --- PART 1: Fetch the F10.7 solar flux ---

def get_solar_flux():
    """
    Returns today's F10.7 solar radio flux from NOAA.
    Higher number = more active Sun = more atmospheric drag on satellites.
    Falls back to DEFAULT_F107 if NOAA is unreachable.
    """
    try:
        url = "https://services.swpc.noaa.gov/products/summary/10cm-flux.json"
        # timeout=5 means give up after 5 seconds if no response
        response = requests.get(url, timeout=5)
        response.raise_for_status()  # raises error if status not 200 OK
        data = response.json()
        flux = float(data["Flux"])
        print(f"[NOAA] Live F10.7 solar flux: {flux}")
        return flux
    except Exception as e:
        print(f"[NOAA] Could not fetch F10.7 (using default {DEFAULT_F107}): {e}")
        return DEFAULT_F107


# --- PART 2: Fetch the Kp geomagnetic index ---

def get_kp_index():
    """
    Returns the latest Kp index (0-9 scale) from NOAA.
    High Kp = geomagnetic storm = atmosphere expanded = more drag.
    Falls back to DEFAULT_KP if NOAA is unreachable.
    """
    try:
        url = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()

        # The response is a list of readings.
        # Skip the header row (index 0), take the most recent reading.
        # Each row looks like: ["2026-03-18 00:00:00", "3.33", ...]
        if len(data) > 1:
            latest_row = data[-1]   # last row = most recent
            kp = float(latest_row[1])
            print(f"[NOAA] Live Kp index: {kp}")
            return kp
        return DEFAULT_KP
    except Exception as e:
        print(f"[NOAA] Could not fetch Kp (using default {DEFAULT_KP}): {e}")
        return DEFAULT_KP


# --- PART 3: Get everything at once ---

def get_space_weather():
    """
    Returns a dictionary with both solar weather values and
    a human-readable activity level description.
    """
    f107 = get_solar_flux()
    kp   = get_kp_index()

    # Classify activity level
    if f107 >= 200 or kp >= 5:
        activity = "HIGH ⚠️  (elevated drag — satellites deorbit faster)"
    elif f107 >= 130:
        activity = "MODERATE ☀️  (near Solar Maximum levels)"
    else:
        activity = "LOW 🌙 (quiet Sun — minimal drag boost)"

    return {
        "f107":           f107,
        "kp_index":       kp,
        "activity_level": activity,
        "source":         "NOAA Space Weather Prediction Center"
    }


# --- PART 4: Run directly as a test ---
if __name__ == "__main__":
    print("\n--- Live Space Weather Test ---")
    weather = get_space_weather()
    print(f"F10.7 Solar Flux : {weather['f107']}")
    print(f"Kp Index         : {weather['kp_index']}")
    print(f"Activity Level   : {weather['activity_level']}")
    print(f"Source           : {weather['source']}")

