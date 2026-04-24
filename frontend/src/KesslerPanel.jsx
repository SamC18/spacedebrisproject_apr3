import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = `http://${window.location.hostname}:8000`;

const PRESETS = [
  { label: 'ISS',      mass: 420000, area: 2500, altitude: 408,  inclination: 51.6 },
  { label: 'Hubble',   mass: 11110,  area: 13,   altitude: 540,  inclination: 28.5 },
  { label: 'Starlink', mass: 260,    area: 3,    altitude: 550,  inclination: 53.0 },
  { label: 'NOAA-20',  mass: 2500,   area: 10,   altitude: 824,  inclination: 98.7 },
  { label: 'Custom',   mass: 500,    area: 5,    altitude: 550,  inclination: 53.0 },
];

const SEVERITY_COLORS = {
  CATASTROPHIC: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', badge: '#ef4444' },
  SEVERE:       { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', badge: '#f59e0b' },
  MODERATE:     { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', badge: '#3b82f6' },
  LOW:          { bg: '#d1fae5', border: '#10b981', text: '#065f46', badge: '#10b981' },
};

export default function KesslerPanel() {
  const [preset,  setPreset]  = useState(0);
  const [form,    setForm]    = useState(PRESETS[0]);
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const selectPreset = (i) => { setPreset(i); setForm(PRESETS[i]); };

  const simulate = async () => {
    setLoading(true); setError(null);
    try {
      const res = await axios.post(`${API_BASE}/kessler`, {
        mass_kg:        Number(form.mass),
        area_m2:        Number(form.area),
        altitude_km:    Number(form.altitude),
        inclination_deg: Number(form.inclination),
        mission_years:  5,
      });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

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

  const col = result ? (SEVERITY_COLORS[result.cascade_severity] || SEVERITY_COLORS.LOW) : null;

  return (
    <div>
      {/* Header */}
      <div style={card}>
        <h2 style={{ color: '#fff', margin: '0 0 8px', fontSize: 22 }}>
          Kessler Cascade Simulator
        </h2>
        <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 20px' }}>
          Simulates a hypervelocity collision using the NASA Standard Breakup Model.
          Shows how many fragments are created and how much the collision probability
          increases for all other satellites in the same orbital shell.
        </p>

        {/* Presets */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => selectPreset(i)} style={{
              padding: '6px 16px', borderRadius: 8, border: 'none',
              background: preset === i ? 'linear-gradient(135deg,#06b6d4,#3b82f6)' : 'rgba(255,255,255,0.1)',
              color: '#fff', cursor: 'pointer', fontSize: 13,
              fontWeight: preset === i ? 700 : 400,
            }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 24 }}>
          {[
            ['Mass (kg)',       'mass'],
            ['Area (m²)',       'area'],
            ['Altitude (km)',   'altitude'],
            ['Inclination (°)', 'inclination'],
          ].map(([label, key]) => (
            <div key={key}>
              <label style={{ color: '#cbd5e1', fontSize: 13, display: 'block', marginBottom: 6 }}>{label}</label>
              <input type="number" value={form[key]}
                onChange={e => setForm({ ...form, [key]: e.target.value })}
                style={inputStyle} />
            </div>
          ))}
        </div>

        {/* Science note */}
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#94a3b8' }}>
          Assumes a 10 kg impactor at 7.5 km/s relative velocity (typical orbital collision speed).
          Fragment count uses the NASA Standard Breakup Model: N = 0.1 × M⁰·⁷⁵ × (v/7.5)²
        </div>

        <button onClick={simulate} disabled={loading} style={{
          width: '100%', padding: 14, borderRadius: 12, border: 'none',
          background: loading ? '#475569' : 'linear-gradient(135deg,#ef4444,#f59e0b)',
          color: '#fff', fontWeight: 700, fontSize: 17,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          {loading ? 'Simulating...' : '💥 Run Cascade Simulation'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', border: '2px solid #ef4444',
                      borderRadius: 12, padding: 16, marginBottom: 20, color: '#991b1b' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && col && (
        <div>
          {/* Severity banner */}
          <div style={{
            background: col.bg, border: `2px solid ${col.border}`,
            borderRadius: 14, padding: 24, marginBottom: 20, textAlign: 'center',
          }}>
            <span style={{ background: col.badge, color: '#fff', borderRadius: 8,
                           padding: '4px 16px', fontSize: 14, fontWeight: 700 }}>
              {result.cascade_severity}
            </span>
            <p style={{ color: col.text, fontSize: 22, fontWeight: 700, margin: '12px 0 4px' }}>
              Collision probability increased by {result.probability_increase_pct}%
            </p>
            <p style={{ color: col.text, fontSize: 14, margin: 0 }}>
              Before: {result.collision_prob_before_pct}% → After: {result.collision_prob_after_pct}%
            </p>
          </div>

          {/* Fragment stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 20 }}>
            {[
              ['Total Fragments',  result.fragments_created.total_fragments.toLocaleString(),  '#ef4444'],
              ['Large (>10cm)',    result.fragments_created.large_fragments.toLocaleString(),   '#f59e0b'],
              ['Medium (1-10cm)',  result.fragments_created.medium_fragments.toLocaleString(),  '#3b82f6'],
              ['Small (<1cm)',     result.fragments_created.small_fragments.toLocaleString(),   '#94a3b8'],
            ].map(([label, value, color]) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Flux comparison */}
          <div style={card}>
            <h3 style={{ color: '#fff', margin: '0 0 16px' }}>Debris Flux Change</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr>
                    {['Size Category', 'Flux Before', 'Flux After', 'Multiplier'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px',
                                           color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.1)',
                                           fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Large debris',  result.flux_before.large,  result.flux_after.large,  result.flux_multipliers.large_multiplier],
                    ['Medium debris', result.flux_before.medium, result.flux_after.medium, result.flux_multipliers.medium_multiplier],
                    ['Small debris',  result.flux_before.small,  result.flux_after.small,  null],
                  ].map(([label, before, after, mult]) => (
                    <tr key={label}>
                      <td style={{ padding: '10px 12px', color: '#fff' }}>{label}</td>
                      <td style={{ padding: '10px 12px', color: '#94a3b8', fontFamily: 'monospace' }}>{before.toExponential(2)}</td>
                      <td style={{ padding: '10px 12px', color: '#f59e0b', fontFamily: 'monospace' }}>{after.toExponential(2)}</td>
                      <td style={{ padding: '10px 12px', color: mult > 2 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                        {mult ? `${mult}×` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Collision details */}
          <div style={card}>
            <h3 style={{ color: '#fff', margin: '0 0 16px' }}>Collision Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>
              {[
                ['Target Mass',    `${result.collision_details.target_mass_kg.toLocaleString()} kg`, '#fff'],
                ['Impactor Mass',  `${result.collision_details.impactor_mass_kg} kg`,                '#fff'],
                ['Impact Velocity',`${result.collision_details.velocity_kms} km/s`,                 '#ef4444'],
                ['Altitude',       `${form.altitude} km`,                                           '#94a3b8'],
              ].map(([label, value, color]) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
            <p style={{ color: '#475569', fontSize: 12, marginTop: 16, marginBottom: 0 }}>
              The Kessler Syndrome occurs when cascade severity becomes self-sustaining —
              each collision creates enough fragments to cause further collisions.
              Donald Kessler first described this scenario in 1978.
            </p>
          </div>
        </div>
      )}

      {!result && !loading && (
        <div style={{ ...card, textAlign: 'center', padding: 48 }}>
          <p style={{ fontSize: 40, margin: 0 }}>💥</p>
          <p style={{ color: '#94a3b8', fontSize: 15, margin: '16px 0 0' }}>
            Select a satellite and click Run Cascade Simulation.<br />
            This shows what happens if that satellite is hit by a 10 kg debris object.
          </p>
        </div>
      )}
    </div>
  );
}