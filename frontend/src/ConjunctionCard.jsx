import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = `http://${window.location.hostname}:8000`;

const SEVERITY_COLORS = {
  CRITICAL: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', badge: '#ef4444' },
  HIGH:     { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', badge: '#f59e0b' },
  MODERATE: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', badge: '#3b82f6' },
  LOW:      { bg: '#d1fae5', border: '#10b981', text: '#065f46', badge: '#10b981' },
};

const TRACKED_SATELLITES = [
  { name: 'ISS',      norad_id: 25544 },
  { name: 'Hubble',   norad_id: 20580 },
  { name: 'Starlink', norad_id: 44713 },
  { name: 'NOAA-20',  norad_id: 43013 },
];

const CATALOG_OPTIONS = [
  { value: 'visual',         label: 'Visual (fast ~150 objects)' },
  { value: 'stations',       label: 'Space Stations' },
  { value: 'cosmos-debris',  label: 'Cosmos-1408 Debris' },
  { value: 'fengyun-debris', label: 'Fengyun-1C Debris' },
  { value: 'iridium-debris', label: 'Iridium-33 Debris' },
  { value: 'active',         label: 'All Active (slow)' },
];

export default function ConjunctionCard() {
  const [selectedNorad, setSelectedNorad] = useState(25544);
  const [catalogGroup,  setCatalogGroup]  = useState('visual');
  const [hours,         setHours]         = useState(24);
  const [thresholdKm,   setThresholdKm]   = useState(50);
  const [data,          setData]          = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [elapsed,       setElapsed]       = useState(null);

  const fetchConjunctions = async () => {
    setLoading(true);
    setError(null);
    const t0 = Date.now();
    try {
      const res = await axios.get(`${API_BASE}/conjunctions`, {
        params: {
          norad_id:      selectedNorad,
          hours:         hours,
          threshold_km:  thresholdKm,
          catalog_group: catalogGroup,
        },
        timeout: 120000,
      });
      setData(res.data);
      setElapsed(((Date.now() - t0) / 1000).toFixed(1));
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const card = {
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(10px)',
    borderRadius: 20,
    padding: 28,
    marginBottom: 24,
    border: '1px solid rgba(255,255,255,0.12)',
  };

  const sel = {
    padding: '8px 12px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.25)',
    fontSize: 14,
  };

  return (
    <div>
      {/* Controls */}
      <div style={card}>
        <h2 style={{ color: '#fff', margin: '0 0 20px', fontSize: 22 }}>
          Satellite Conjunction Detection
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <div>
            <label style={{ color: '#cbd5e1', fontSize: 13, display: 'block', marginBottom: 6 }}>
              Target Satellite
            </label>
            <select
              value={selectedNorad}
              onChange={e => setSelectedNorad(Number(e.target.value))}
              style={sel}
            >
              {TRACKED_SATELLITES.map(s => (
                <option key={s.norad_id} value={s.norad_id}>
                  {s.name} ({s.norad_id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ color: '#cbd5e1', fontSize: 13, display: 'block', marginBottom: 6 }}>
              Scan Against
            </label>
            <select
              value={catalogGroup}
              onChange={e => setCatalogGroup(e.target.value)}
              style={sel}
            >
              {CATALOG_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ color: '#cbd5e1', fontSize: 13, display: 'block', marginBottom: 6 }}>
              Window (hrs)
            </label>
            <input
              type="number" min={1} max={72} value={hours}
              onChange={e => setHours(Number(e.target.value))}
              style={{ ...sel, width: 70, textAlign: 'center' }}
            />
          </div>

          <div>
            <label style={{ color: '#cbd5e1', fontSize: 13, display: 'block', marginBottom: 6 }}>
              Threshold (km)
            </label>
            <input
              type="number" min={1} max={500} value={thresholdKm}
              onChange={e => setThresholdKm(Number(e.target.value))}
              style={{ ...sel, width: 70, textAlign: 'center' }}
            />
          </div>

          <button
            onClick={fetchConjunctions}
            disabled={loading}
            style={{
              padding: '11px 28px', borderRadius: 10, border: 'none',
              background: loading ? '#475569' : 'linear-gradient(135deg,#06b6d4,#3b82f6)',
              color: '#fff', fontWeight: 600, fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Scanning...' : 'Scan Now'}
          </button>
        </div>

        {loading && (
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 14 }}>
            Fetching live TLE data and propagating orbits with SGP4...
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: '#fee2e2', border: '2px solid #ef4444',
          borderRadius: 12, padding: 16, marginBottom: 20, color: '#991b1b',
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results */}
      {data && (
        <div>
          {/* Summary */}
          <div style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#fff', margin: 0 }}>{data.target.name}</h3>
                <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>
                  NORAD {data.target.norad_id} | Altitude: {data.target.altitude_km} km
                </p>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                {[
                  ['Objects Scanned', data.scan_metadata.objects_scanned, false],
                  ['Conjunctions',    data.conjunctions.length,           data.conjunctions.length > 0],
                  ['Scan Time',       `${elapsed}s`,                      false],
                ].map(([label, value, hi]) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: hi ? '#f59e0b' : '#fff' }}>
                      {value}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{
              marginTop: 14, fontSize: 12, color: '#64748b',
              borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10,
            }}>
              Catalog: <strong style={{ color: '#94a3b8' }}>{data.scan_metadata.catalog_group}</strong>
              {' | '}Window: {data.scan_metadata.time_window_hours}h
              {' | '}Threshold: {data.scan_metadata.threshold_km} km
              {' | '}Source: {data.scan_metadata.data_source}
            </div>
          </div>

          {/* No results */}
          {data.conjunctions.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: 36 }}>
              <p style={{ fontSize: 36, margin: 0 }}>OK</p>
              <p style={{ color: '#10b981', fontSize: 18, fontWeight: 600, margin: '8px 0' }}>
                No conjunctions detected
              </p>
              <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
                No objects in{' '}
                <strong style={{ color: '#94a3b8' }}>{data.scan_metadata.catalog_group}</strong>{' '}
                came within{' '}
                <strong style={{ color: '#94a3b8' }}>{data.scan_metadata.threshold_km} km</strong>.
                Try a larger threshold or different catalog.
              </p>
            </div>
          ) : (
            data.conjunctions.map((c, i) => {
              const col = SEVERITY_COLORS[c.severity] || SEVERITY_COLORS.LOW;
              return (
                <div key={i} style={{
                  background: col.bg,
                  border: `2px solid ${col.border}`,
                  borderRadius: 14, padding: 18, marginBottom: 12,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          background: col.badge, color: '#fff',
                          borderRadius: 6, padding: '2px 10px',
                          fontSize: 12, fontWeight: 700,
                        }}>
                          {c.severity}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: 16, color: col.text }}>
                          {c.object_name}
                        </span>
                        <span style={{ fontSize: 12, color: col.text, opacity: 0.7 }}>
                          NORAD {c.object_norad_id}
                        </span>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 13, color: col.text }}>
                        TCA in <strong>{Math.round(c.minutes_until_tca)} min</strong>
                        {' '}({c.time_of_closest_approach_utc})
                        {c.object_altitude_km && (
                          <span style={{ marginLeft: 16 }}>
                            Alt: {c.object_altitude_km} km
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{
                      background: col.border + '22',
                      border: `1px solid ${col.border}`,
                      borderRadius: 12, padding: '10px 18px',
                      textAlign: 'center', minWidth: 90,
                    }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: col.border }}>
                        {c.miss_distance_km.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 11, color: col.text, opacity: 0.8 }}>km miss</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && (
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 40, margin: 0 }}>---</p>
          <p style={{ color: '#94a3b8', fontSize: 15, margin: '12px 0 0' }}>
            Select a satellite and catalog, then click Scan Now.
            <br />
            Default threshold is 50 km, wide enough to show real results.
          </p>
        </div>
      )}
    </div>
  );
}
