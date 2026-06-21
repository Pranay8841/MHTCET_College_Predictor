import React from 'react';
import PredictorForm from '../components/PredictorForm';

function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-badge">
            ✨ Transforming Navodayan’s Pathway to Professional Colleges | MHT-CET 2026
          </div>
          <h1 className="hero-title">
            Find Your Perfect<br />
            <span className="gradient-text">Engineering, Pharmacy, Nursing and Agriculture College</span>
          </h1>
          <p className="hero-subtitle">
            Enter your MHT-CET percentile and preferences below. We'll instantly show you
            every Maharashtra college where you have a realistic chance of admission.
          </p>
        </div>
      </section>

      {/* Predictor Form */}
      <section style={{ paddingBottom: 'var(--space-16)' }}>
        <div className="container">
          <PredictorForm />
        </div>
      </section>

      {/* How It Works */}
      <section style={{ paddingBottom: 'var(--space-16)' }}>
        <div className="container">
          <h2 style={{
            textAlign: 'center',
            fontSize: 'var(--text-2xl)',
            marginBottom: 'var(--space-10)',
            fontFamily: 'var(--font-heading)'
          }}>
            How It Works
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--space-6)',
            maxWidth: '960px',
            margin: '0 auto'
          }}>
            {[
              { icon: '📝', title: 'Enter Details', desc: 'Fill in your MHT-CET percentile, category, gender, and preferred branches.' },
              { icon: '⚡', title: 'Instant Analysis', desc: 'Our engine compares your profile against actual CAP round cutoff data.' },
              { icon: '🎯', title: 'Get Results', desc: 'See every college where you have High, Medium, or Low chances of admission.' },
              { icon: '📥', title: 'Download PDF', desc: 'Export your personalized college list as a PDF to share or print.' }
            ].map((step, idx) => (
              <div key={idx} className="card" style={{
                textAlign: 'center',
                animation: `fadeInUp 0.5s ease ${0.1 * idx}s both`
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-4)' }}>
                  {step.icon}
                </div>
                <h3 style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 700,
                  marginBottom: 'var(--space-2)',
                  fontFamily: 'var(--font-heading)'
                }}>
                  {step.title}
                </h3>
                <p style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.6
                }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export default HomePage;
