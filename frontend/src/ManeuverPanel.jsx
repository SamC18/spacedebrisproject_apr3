import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = `http://${window.location.hostname}:8000`;

const DIRECTION_INFO = {
  prograde:   { label: 'Prograde',   icon: '→', desc: 'Burns in direction of travel — raises orbit' },
  retrograde: { label: 'Retrograde', icon: '←', desc: 'Burns against direction of travel — lowers orbit' },
  radial:     { label: 'Radial',     icon: '↑', desc: 'Burns toward/away from Earth center' },
  normal:     { label: 'Normal',     icon: '⊙', desc: 'Burns perpendicular to orbital plane — changes inclination' },
};

const TIMING_COLORS = {
  IMMEDIATE: '#ef4444',
  SOON:      '#f59e0b',
  PLANNED:   '#10b981',
};

const PRESETS = [
  { label: 'ISS',        altitude: 408,   inclination: 51.6,  mass: 420000, isp: 220 },
  { label: 'Hubble',     altitude: 540,   inclination: 28.5,  mass: 11110,  isp: 220 },
  { label: 'Starlink',   altitude: 550,   inclination: 53.0,  mass: 260,    isp: 220 },
  { label: 'NOAA-20',    altitude: 824,   inclination: 98.7,  mass: 2500,   isp: 220 },
  { label: 'Custom',     altitude: 550,   inclination: 53.0,  mass: 500,    isp: 220 },
];

export default function ManeuverPanel() {
  const [preset,       setPreset]       = useState(0);
  const [form,         setForm]         = useState(PRESETS[0]);
  const [conjunction,  setConjunction]  = useState({ miss_km: 2.5, minutes_to_tca: 90, object_name: 'COSMOS 2251 DEBRIS' });
  const [target_miss,  setTargetMiss]   = useState(5.0);
  const [result,       setResult]       = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);

  const selectPreset = (i) => {
    setPreset(i);
    setForm(PRESETS[i]);
  };

  const compute = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${API_BASE}/maneuver`, {
        altitude_km:        Number(form.altitude),
        inclination_deg:    Number(form.inclination),
        spacecraft_mass_kg: Number(form.mass),
        miss_distance_km:   Number(conjunction.miss_km),
        minutes_to_tca:     Number(conjunction.minutes_to_tca),
        object_name:        conjunction.object_name,
        target_miss_km:     Number(target_miss),
        isp_s:              Number(form.isp),
      });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const card = {
    background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)',
    borderRadius: 20, padding: 28, marginBottom: 24,
    border: '1px solid rgba(255,255,255,0.12)',
  };
  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8, boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.08)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)', fontSize: 15,
  };
  const label = (text) => (
    <label style={{ color: '#cbd5e1', fontSize: 13, display: 'block', marginBottom: 6 }}>
      {text}
    </label>
  );
  const field = (labelText, key, unit, obj, setter) => (
    <div>
      {label(`${labelText} (${unit})`)}
      <input
        type="number"
        value={obj[key]}
        onChange={e => setter({ ...obj, [key]: e.target.value })}
        style={inputStyle}
      />
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={card}>
        <h2 style={{ color: '#fff', margin: '0 0 6px', fontSize: 22 }}>
          Collision Avoidance Maneuver Optimizer
        </h2>
        <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 20px' }}>
          Computes minimum delta-V burn using two-body orbital mechanics and the vis-viva equation.
        </p>

        {/* Preset buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => selectPreset(i)} style={{
              padding: '6px 16px', borderRadius: 8, border: 'none',
              background: preset === i ? 'linear-gradient(135deg,#06b6d4,#3b82f6)' : 'rgba(255,255,255,0.1)',
              color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: preset === i ? 700 : 400,
            }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Spacecraft parameters */}
        <h3 style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1 }}>
          Spacecraft Parameters
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          {field('Altitude',    'altitude',    'km',  form, setForm)}
          {field('Inclination', 'inclination', 'deg', form, setForm)}
          {field('Mass',        'mass',        'kg',  form, setForm)}
          {field('Thruster Isp','isp',         's',   form, setForm)}
        </div>

        {/* Conjunction parameters */}
        <h3 style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1 }}>
          Conjunction Event
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 8 }}>
          {field('Miss Distance',   'miss_km',       'km',  conjunction, setConjunction)}
          {field('Time to TCA',     'minutes_to_tca','min', conjunction, setConjunction)}
          <div>
            {label('Safe Threshold (km)')}
            <input type="number" value={target_miss}
                   onChange={e => setTargetMiss(e.target.value)}
                   style={inputStyle} />
          </div>
          <div>
            {label('Threatening Object')}
            <input type="text" value={conjunction.object_name}
                   onChange={e => setConjunction({ ...conjunction, object_name: e.target.value })}
                   style={inputStyle} />
          </div>
        </div>

        <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 20px' }}>
          Tip: Run the Conjunctions tab first to get real miss distance and TCA values, then paste them here.
        </p>

        <button onClick={compute} disabled={loading} style={{
          width: '100%', padding: 14, borderRadius: 12, border: 'none',
          background: loading ? '#475569' : 'linear-gradient(135deg,#06b6d4,#3b82f6)',
          color: '#fff', fontWeight: 700, fontSize: 17,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          {loading ? 'Computing...' : 'Compute Avoidance Maneuver'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fee2e2', border: '2px solid #ef4444', borderRadius: 12, padding: 16, marginBottom: 20, color: '#991b1b' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results */}
      {result && result.status === 'NO_MANEUVER_NEEDED' && (
        <div style={{ ...card, textAlign: 'center', padding: 36 }}>
          <p style={{ fontSize: 36, margin: 0 }}>OK</p>
          <p style={{ color: '#10b981', fontSize: 18, fontWeight: 600, margin: '8px 0' }}>No Maneuver Required</p>
          <p style={{ color: '#64748b', fontSize: 14 }}>{result.message}</p>
        </div>
      )}

      {result && result.status === 'MANEUVER_COMPUTED' && (
        <div>
          {/* Conjunction summary */}
          <div style={{ ...card, padding: 20 }}>
            <h3 style={{ color: '#fff', margin: '0 0 16px' }}>Conjunction Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
              <StatBox label="Threatening Object" value={result.conjunction_summary.threatening_object} color="#f59e0b" small />
              <StatBox label="Current Miss Distance" value={`${result.conjunction_summary.current_miss_km} km`} color="#ef4444" />
              <StatBox label="Time to TCA" value={`${result.conjunction_summary.minutes_to_tca} min`} color="#f59e0b" />
              <StatBox label="Risk if No Maneuver" value={result.conjunction_summary.risk_if_no_maneuver} color="#ef4444" small />
            </div>
          </div>

          {/* Recommended burn — hero card */}
          {(() => {
            const rb = result.recommended_burn;
            const dirInfo = DIRECTION_INFO[rb.direction] || {};
            const timingColor = TIMING_COLORS[result.burn_timing.timing] || '#fff';
            return (
              <div style={{
                ...card,
                border: '2px solid #06b6d4',
                background: 'rgba(6,182,212,0.08)',
                padding: 28,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                  <div>
                    <h3 style={{ color: '#06b6d4', margin: '0 0 4px', fontSize: 20 }}>
                      Recommended Burn
                    </h3>
                    <p style={{ color: '#94a3b8', margin: 0, fontSize: 14 }}>
                      {dirInfo.icon} {dirInfo.label} — {dirInfo.desc}
                    </p>
                  </div>
                  <div style={{
                    background: timingColor + '22', border: `2px solid ${timingColor}`,
                    borderRadius: 10, padding: '8px 16px', textAlign: 'center',
                  }}>
                    <div style={{ color: timingColor, fontWeight: 700, fontSize: 16 }}>
                      {result.burn_timing.timing}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 11 }}>Execute</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 16 }}>
                  <StatBox label="Delta-V Required"   value={`${rb.delta_v_m_s.toFixed(3)} m/s`} color="#06b6d4" big />
                  <StatBox label="Fuel Required"      value={`${rb.fuel_required_kg.toFixed(4)} kg`} color="#3b82f6" big />
                  <StatBox label="New Miss Distance"  value={`${rb.new_miss_km.toFixed(2)} km`} color="#10b981" big />
                  <StatBox label="New Altitude"       value={`${rb.new_altitude_km} km`} color="#8b5cf6" big />
                </div>

                <div style={{
                  background: 'rgba(255,255,255,0.05)', borderRadius: 10,
                  padding: '12px 16px', fontSize: 13, color: '#94a3b8',
                }}>
                  {result.burn_timing.note}
                </div>
              </div>
            );
          })()}

          {/* All burn options comparison */}
          <div style={card}>
            <h3 style={{ color: '#fff', margin: '0 0 16px' }}>All Burn Options Compared</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr>
                    {['Direction', 'Delta-V (m/s)', 'New Miss (km)', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: 600 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.all_burn_options.map((opt, i) => {
                    const isRecommended = opt.direction === result.recommended_burn.direction;
                    const dirInfo = DIRECTION_INFO[opt.direction] || {};
                    return (
                      <tr key={i} style={{ background: isRecommended ? 'rgba(6,182,212,0.1)' : 'transparent' }}>
                        <td style={{ padding: '10px 12px', color: isRecommended ? '#06b6d4' : '#fff', fontWeight: isRecommended ? 700 : 400 }}>
                          {dirInfo.icon} {dirInfo.label} {isRecommended ? '← RECOMMENDED' : ''}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#fff', fontFamily: 'monospace' }}>
                          {opt.dv_m_s.toFixed(3)}
                        </td>
                        <td style={{ padding: '10px 12px', color: opt.new_miss_km >= result.safe_threshold_km ? '#10b981' : '#f59e0b' }}>
                          {opt.new_miss_km.toFixed(2)}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {opt.achievable
                            ? <span style={{ color: '#10b981', fontWeight: 600 }}>Achievable</span>
                            : <span style={{ color: '#ef4444' }}>Insufficient</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Orbital context */}
          <div style={card}>
            <h3 style={{ color: '#fff', margin: '0 0 16px' }}>Orbital Context</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
              <StatBox label="Altitude"          value={`${result.orbital_context.current_altitude_km} km`}      color="#94a3b8" />
              <StatBox label="Inclination"       value={`${result.orbital_context.inclination_deg} deg`}         color="#94a3b8" />
              <StatBox label="Orbital Velocity"  value={`${result.orbital_context.orbital_velocity_km_s} km/s`}  color="#94a3b8" />
              <StatBox label="Orbital Period"    value={`${result.orbital_context.orbital_period_min} min`}      color="#94a3b8" />
              <StatBox label="Spacecraft Mass"   value={`${result.orbital_context.spacecraft_mass_kg} kg`}       color="#94a3b8" />
              <StatBox label="Thruster Isp"      value={`${result.orbital_context.isp_s} s`}                     color="#94a3b8" />
            </div>
            <p style={{ color: '#475569', fontSize: 12, marginTop: 16, marginBottom: 0 }}>
              {result.science_note}
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 40, margin: 0 }}>delta-v</p>
          <p style={{ color: '#94a3b8', fontSize: 15, margin: '12px 0 0' }}>
            Enter spacecraft parameters and conjunction details, then click Compute.
            <br />
            Use the Conjunctions tab to get real miss distance and TCA values.
          </p>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color, big, small }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ fontSize: small ? 13 : big ? 24 : 20, fontWeight: 700, color: color || '#fff', wordBreak: 'break-word' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{label}</div>
    </div>
  );
}
