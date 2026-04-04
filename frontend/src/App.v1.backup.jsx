import React, { useState } from 'react';

export default function App() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto' }}>
      <h1>🛸 Satellite Debris Risk Analyzer</h1>
      <button onClick={runAnalysis} style={{ padding: '10px 24px', fontSize: 16, cursor: 'pointer' }}>
        {loading ? 'Loading...' : 'Load Live Dashboard'}
      </button>
      {result && (
        <div>
          <h2>☀️ Space Weather</h2>
          <p>F10.7: {result.space_weather.f107} | Kp: {result.space_weather.kp_index}</p>
          <h2>🛰️ Live Satellite Risk Scores</h2>
          {result.satellites.map((sat, i) => (
            <div key={i} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, marginBottom: 12 }}>
              <h3>{sat.icon} {sat.name}</h3>
              <p>Risk Score: <strong style={{ color: sat.risk_color }}>{sat.risk_score}</strong></p>
              <p>Decay in: {sat.decay_years} years | {sat.status}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
