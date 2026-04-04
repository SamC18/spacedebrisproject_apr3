import React, { useState } from 'react';
import axios from 'axios';
import { AlertCircle, CheckCircle, XCircle, Loader } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:8000`;

export default function App() {
  const [form, setForm] = useState({
    mass: 500, area: 10, altitude: 550, inclination: 98, mission_years: 5,
    norad_id: '',
    useMonteCarlo: false,
  });
  const [result, setResult]      = useState(null);
  const [loading, setLoading]    = useState(false);
  const [error, setError]        = useState(null);
  const [apiVersion, setVersion] = useState('v3');

  const buildPayload = () => ({
    mass:          Number(form.mass),
    area:          Number(form.area),
    altitude:      form.norad_id ? null : Number(form.altitude),
    inclination:   form.norad_id ? null : Number(form.inclination),
    mission_years: Number(form.mission_years),
    norad_id:      form.norad_id ? parseInt(form.norad_id, 10) : null,
  });

  const runAnalysis = async () => {
    setLoading(true); setError(null);
    try {
      const endpoint = apiVersion === 'v3' ? '/v3/analyze' : '/v2/analyze';
      const res = await axios.post(`${API_BASE}${endpoint}`, buildPayload());
      let analysisResult = res.data;
      if (form.useMonteCarlo && apiVersion === 'v3') {
        const mp = analysisResult.mission_parameters;
        const mcRes = await axios.post(`${API_BASE}/v4/monte_carlo`, {
          mass:          Number(form.mass),
          area:          Number(form.area),
          altitude:      mp.altitude_km,
          inclination:   mp.inclination_deg,
          mission_years: Number(form.mission_years),
        });
        analysisResult.monte_carlo_results = mcRes.data.monte_carlo_results;
      }
      setResult(analysisResult);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const field = (label, key, unit) => (
    <div key={key}>
      <label style={{ color: '#cbd5e1', fontSize: 14, display: 'block', marginBottom: 8 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type="number"
          value={form[key]}
          onChange={e => setForm({ ...form, [key]: e.target.value })}
          style={{
            width: '100%', padding: '12px', paddingRight: 50,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 10, color: '#fff', fontSize: 16, boxSizing: 'border-box',
          }}
          placeholder={key === 'norad_id' ? 'e.g. 25544 (ISS)' : ''}
        />
        {unit && (
          <span style={{ position: 'absolute', right: 12, top: '50%',
                         transform: 'translateY(-50%)', color: '#64748b', fontSize: 14 }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );

  const StatCard = ({ title, value, subtitle, icon, bg, border }) => (
    <div style={{ background: bg, padding: 20, borderRadius: 12, border: `2px solid ${border}` }}>
      {icon}
      <h3 style={{ marginTop: 10, fontSize: 16, color: '#475569' }}>{title}</h3>
      <p style={{ fontSize: 24, fontWeight: 700, margin: '5px 0', color: border }}>{value}</p>
      <p style={{ fontSize: 13, color: '#64748b' }}>{subtitle}</p>
    </div>
  );

  const card = {
    background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)',
    borderRadius: 20, padding: 35, marginBottom: 30,
    border: '1px solid rgba(255,255,255,0.1)',
  };

  return (
    <div style={{ minHeight: '100vh',
                  background: 'linear-gradient(135deg,#0f172a,#1e293b,#334155)',
                  padding: '40px 20px', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ color: '#fff', fontSize: 42, fontWeight: 700 }}>
            🛰 Satellite Debris Risk Analyzer
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 18 }}>
            Professional Mission Risk Assessment · v4.0
          </p>
        </div>

        <div style={{ ...card, padding: 15, textAlign: 'center' }}>
          <label style={{ color: '#fff', marginRight: 15 }}>Analysis Mode:</label>
          <select value={apiVersion} onChange={e => setVersion(e.target.value)}
                  style={{ padding: '8px 15px', borderRadius: 8,
                           background: 'rgba(255,255,255,.1)',
                           color: '#fff', border: '1px solid rgba(255,255,255,.2)' }}>
            <option value="v2">Legacy (Basic)</option>
            <option value="v3">Enhanced (Full Risk Analysis)</option>
          </select>
        </div>

        <div style={card}>
          <h2 style={{ color: '#fff', marginBottom: 25, fontSize: 24 }}>
            Mission Parameters
          </h2>
          <div style={{ display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
                        gap: 20 }}>
            {field('Spacecraft Mass',      'mass',          'kg')}
            {field('Cross-sectional Area', 'area',          'm²')}
            {field('Altitude',             'altitude',      'km')}
            {field('Inclination',          'inclination',   '°')}
            {field('Mission Duration',     'mission_years', 'yr')}
            {field('NORAD ID (optional)',  'norad_id',      '')}
          </div>
          {form.norad_id && (
            <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>
              ℹ️ Altitude & inclination will be fetched live from Celestrak.
            </p>
          )}
          {apiVersion === 'v3' && (
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <label style={{ color: '#fff', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.useMonteCarlo}
                       onChange={e => setForm({ ...form, useMonteCarlo: e.target.checked })}
                       style={{ marginRight: 8 }} />
                Run Monte Carlo Simulation (1 000 runs — adds ~5 s)
              </label>
            </div>
          )}
          <button onClick={runAnalysis} disabled={loading}
                  style={{
                    marginTop: 30, width: '100%', padding: 16,
                    background: loading
                      ? '#475569'
                      : 'linear-gradient(135deg,#06b6d4,#3b82f6)',
                    color: '#fff', border: 'none', borderRadius: 12,
                    fontSize: 18, fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 10,
                  }}>
            {loading && <Loader size={20} />}
            {loading ? 'Analysing…' : 'Run Analysis'}
          </button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', border: '2px solid #ef4444',
                        borderRadius: 12, padding: 20, marginBottom: 20,
                        color: '#991b1b' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && apiVersion === 'v2' && (
          <div style={{ background: 'rgba(255,255,255,.95)', borderRadius: 20,
                        padding: 35, color: '#1e293b' }}>
            <h2 style={{ fontSize: 28, marginBottom: 20 }}>Results (Legacy)</h2>
            <p><strong>Δv for disposal:</strong>
               <span style={{ color: '#dc2626', fontSize: 20 }}>
                 {result.delta_v_for_disposal_m_s} m/s
               </span>
            </p>
            <p><strong>Natural decay:</strong> {result.predicted_natural_decay_years} years</p>
            <p><strong>IADC 25-yr rule:</strong>
               {result.complies_with_25_year_rule ? ' ✅ PASS' : ' ❌ FAIL'}
            </p>
            {result.orbit_visualization_3d && (
              <img src={`data:image/png;base64,${result.orbit_visualization_3d}`}
                   alt="orbit"
                   style={{ width: '100%', maxWidth: 800, borderRadius: 12, marginTop: 20 }} />
            )}
          </div>
        )}

        {result && apiVersion === 'v3' && result.collision_risk && (
          <div style={{ background: 'rgba(255,255,255,.95)', borderRadius: 20,
                        padding: 35, color: '#1e293b' }}>
            <h2 style={{ fontSize: 28, marginBottom: 30 }}>
              📊 Mission Risk Assessment Report
            </h2>

            {form.norad_id && (
              <p style={{ marginBottom: 20, background: '#dbeafe',
                          padding: 12, borderRadius: 8 }}>
                🔗 Live TLE — Altitude:
                <strong> {result.mission_parameters.altitude_km} km</strong>,
                Inclination:
                <strong> {result.mission_parameters.inclination_deg}°</strong>
              </p>
            )}

            <div style={{ display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))',
                          gap: 20, marginBottom: 30 }}>
              <StatCard
                title="NASA Compliance"
                value={result.compliance.nasa_compliant ? 'PASS' : 'FAIL'}
                subtitle={`Required: ${result.compliance.nasa_requirement} · Actual: ${result.compliance.nasa_actual}`}
                icon={result.compliance.nasa_compliant
                  ? <CheckCircle size={32} color="#10b981" />
                  : <XCircle    size={32} color="#ef4444" />}
                bg={result.compliance.nasa_compliant ? '#d1fae5' : '#fee2e2'}
                border={result.compliance.nasa_compliant ? '#10b981' : '#ef4444'}
              />
              <StatCard
                title="Catastrophic Risk"
                value={`${result.collision_risk.catastrophic_probability_percent}%`}
                subtitle={`Level: ${result.collision_risk.risk_level} — ${result.collision_risk.risk_description}`}
                icon={<AlertCircle size={32} color={result.collision_risk.risk_color} />}
                bg="#dbeafe" border={result.collision_risk.risk_color}
              />
              <StatCard
                title="IADC 25-Year Rule"
                value={`${result.disposal.natural_decay_years} yr`}
                subtitle={result.compliance.iadc_25_year_compliant
                  ? 'Compliant ✓'
                  : 'Requires active disposal'}
                icon={result.compliance.iadc_25_year_compliant
                  ? <CheckCircle size={32} color="#10b981" />
                  : <AlertCircle size={32} color="#f59e0b" />}
                bg={result.compliance.iadc_25_year_compliant ? '#d1fae5' : '#fef3c7'}
                border={result.compliance.iadc_25_year_compliant ? '#10b981' : '#f59e0b'}
              />
            </div>

            <div style={{ background: '#f8fafc', borderRadius: 12,
                          padding: 20, marginBottom: 20 }}>
              <h3 style={{ marginBottom: 12 }}>Disposal Budget</h3>
              <p>Δv required: <strong>{result.disposal.delta_v_required_m_s} m/s</strong></p>
              <p>Fuel required: <strong>{result.disposal.fuel_mass_required_kg} kg</strong></p>
              <p>Area-to-mass ratio:
                 <strong> {result.disposal.area_to_mass_ratio} m²/kg</strong>
              </p>
            </div>

            {result.monte_carlo_results && (
              <div style={{ background: '#f0f9ff', border: '2px solid #0ea5e9',
                            borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <h3 style={{ marginBottom: 12 }}>🎲 Monte Carlo Results (1 000 runs)</h3>
                <p>Mean catastrophic probability:&nbsp;
                  <strong>
                    {(result.monte_carlo_results.mean_catastrophic_prob * 100).toFixed(4)}%
                  </strong>
                  &nbsp;± {(result.monte_carlo_results.std_catastrophic_prob * 100).toFixed(4)}%
                </p>
                <p>95th percentile (worst case):&nbsp;
                  <strong>
                    {(result.monte_carlo_results.p95_catastrophic_prob * 100).toFixed(4)}%
                  </strong>
                </p>
                <p style={{ fontSize: 13, color: '#64748b' }}>
                  95% CI: [
                  {(result.monte_carlo_results.conf_interval_95[0] * 100).toFixed(4)}%,&nbsp;
                  {(result.monte_carlo_results.conf_interval_95[1] * 100).toFixed(4)}%]
                </p>
              </div>
            )}

            {result.orbit_visualization_3d && (
              <div style={{ marginTop: 24 }}>
                <h3 style={{ marginBottom: 12 }}>3D Orbit Visualisation</h3>
                <img src={`data:image/png;base64,${result.orbit_visualization_3d}`}
                     alt="orbit"
                     style={{ width: '100%', maxWidth: 900, borderRadius: 12,
                              boxShadow: '0 4px 15px rgba(0,0,0,.1)' }} />
              </div>
            )}
            {result.flux_visualization && (
              <div style={{ marginTop: 24 }}>
                <h3 style={{ marginBottom: 12 }}>Debris Flux vs Altitude</h3>
                <img src={`data:image/png;base64,${result.flux_visualization}`}
                     alt="flux"
                     style={{ width: '100%', maxWidth: 900, borderRadius: 12,
                              boxShadow: '0 4px 15px rgba(0,0,0,.1)' }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
