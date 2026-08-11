'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

interface Patient {
  PatientDurableKey: string;
  Age: string;
  Sex: string;
  Ethnicity: string;
  PrimaryChiefComplaintName: string;
  PrimaryEdDiagnosisName: string;
  had_psych_event: boolean;
  recieved_transfusion: boolean;
  LengthOfStayInDays: string;
  IcuLengthOfStay: string;
  EdDisposition: string;
  encounters: object[];
}

const REVIEWERS = ['Reviewer A', 'Reviewer B'];

export default function Home() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [backendHealth, setBackendHealth] = useState<string>('Checking...');
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState<boolean>(true);
  const [completedPatients, setCompletedPatients] = useState<Set<string>>(new Set());

  const fetchCompletedReviews = async (reviewer: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/reviews/${reviewer}`);
      const result = await response.json();
      if (result.status === 'success') {
        setCompletedPatients(new Set(Object.keys(result.data)));
      }
    } catch {
      console.error('Failed to fetch reviews');
    }
  };

  const handleLogin = (name: string) => {
    if (name === 'Admin') {
      router.push('/admin');
      return;
    }
    setLoggedInUser(name);
    setShowLogin(false);
    fetchCompletedReviews(name);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reviewerFromUrl = params.get('reviewer');
    if (reviewerFromUrl && REVIEWERS.includes(reviewerFromUrl)) {
      handleLogin(reviewerFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/health');
        if (response.ok) {
          const data = await response.json();
          setBackendHealth(data.status);
        }
      } catch {
        setBackendHealth('unhealthy');
      }
    };

    const fetchPatients = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:8000/api/patients');
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const result = await response.json();
        if (result.status === 'success') {
          setPatients(result.data);
        } else {
          throw new Error(result.message || 'Failed to parse CSV');
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    const fetchAssignments = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/assignments');
        const result = await response.json();
        if (result.status === 'success') {
          setAssignments(result.data);
        }
      } catch {
        console.error('Failed to fetch assignments');
      }
    };

    checkHealth();
    fetchPatients();
    fetchAssignments();
  }, []);

  const myPatients = loggedInUser
    ? patients.filter(p => assignments[p.PatientDurableKey] === loggedInUser)
    : [];
  const completedCount = myPatients.filter(p => completedPatients.has(p.PatientDurableKey)).length;
  const progressPct = myPatients.length > 0 ? Math.round((completedCount / myPatients.length) * 100) : 0;

  if (loading) {
    return <div className={styles.loadingScreen}>Loading Live Clinical Database...</div>;
  }

  return (
    <div className={styles.appWrapper}>

      {/* LOGIN MODAL */}
      {showLogin && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', borderRadius: '12px', padding: '2.5rem',
            minWidth: '320px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{ color: '#003d9b', marginBottom: '0.5rem', fontSize: '1.5rem' }}>MedReview Pro</h2>
            <p style={{ color: '#505f76', marginBottom: '2rem', fontSize: '0.95rem' }}>Select your name to continue</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {REVIEWERS.map(name => (
                <button
                  key={name}
                  onClick={() => handleLogin(name)}
                  style={{
                    background: '#003d9b', color: 'white', border: 'none',
                    padding: '0.85rem 1.5rem', borderRadius: '8px', fontSize: '1rem',
                    fontWeight: '600', cursor: 'pointer'
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = '#002a6e')}
                  onMouseOut={e => (e.currentTarget.style.background = '#003d9b')}
                >
                  {name}
                </button>
              ))}

              <div style={{ borderTop: '1px solid #eceef0', margin: '0.5rem 0' }}></div>

              <button
                onClick={() => handleLogin('Admin')}
                style={{
                  background: 'white', color: '#505f76', border: '1px solid #c3c6d6',
                  padding: '0.85rem 1.5rem', borderRadius: '8px', fontSize: '1rem',
                  fontWeight: '600', cursor: 'pointer'
                }}
                onMouseOver={e => (e.currentTarget.style.background = '#f7f9fb')}
                onMouseOut={e => (e.currentTarget.style.background = 'white')}
              >
                Admin
              </button>
            </div>
          </div>
        </div>
      )}

      <main className={styles.homeMain}>
        <header className={styles.dashboardHeader}>
          <div>
            <h1 className={styles.titleText}>MedReview Pro</h1>
            <p className={styles.subtitleText}>Active Clinical Worklist Evaluation Panel</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {loggedInUser && (
              <span
                onClick={() => { setLoggedInUser(null); setShowLogin(true); setCompletedPatients(new Set()); }}
                style={{
                  background: '#e8f0fe', color: '#003d9b', padding: '0.4rem 0.9rem',
                  borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600',
                  cursor: 'pointer', userSelect: 'none'
                }}
                title="Click to switch user"
              >
                Logged in as {loggedInUser} ↓
              </span>
            )}
            <div className={styles.healthStatusBadge}>
              System Status: <span className={styles[`health-${backendHealth}`]}>{backendHealth}</span>
            </div>
          </div>
        </header>

        {/* PROGRESS BAR */}
        {loggedInUser && (
          <div style={{
            background: 'white', border: '1px solid #c3c6d6', borderRadius: '12px',
            padding: '1.25rem 1.5rem', marginBottom: '1.5rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: '600', color: '#191c1e', fontSize: '0.95rem' }}>Review Progress</span>
              <span style={{ fontWeight: '700', color: '#003d9b', fontSize: '0.95rem' }}>
                {completedCount} / {myPatients.length} completed ({progressPct}%)
              </span>
            </div>
            <div style={{ background: '#eceef0', borderRadius: '999px', height: '12px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '999px', background: '#003d9b',
                width: `${progressPct}%`, transition: 'width 0.4s ease'
              }} />
            </div>
          </div>
        )}

        {errorMsg && <div style={{ marginBottom: '1rem', color: 'red' }}>Error: {errorMsg}</div>}

        <div className={styles.tableCardContainer}>
          <div className={styles.tableHeaderSection}>
            <h3>My Assigned Patients</h3>
            <span className={styles.countBadge}>{myPatients.length} Records</span>
          </div>
          <div className={styles.tableResponsiveWrapper}>
            <table className={styles.patientTable}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Patient Key</th>
                  <th>Age / Sex</th>
                  <th>Chief Complaint</th>
                  <th>ED Diagnosis</th>
                  <th>LOS (days)</th>
                  <th>Admitted</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {!loggedInUser ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>Please log in to view your assigned patients.</td>
                  </tr>
                ) : myPatients.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>No patients assigned.</td>
                  </tr>
                ) : (
                  myPatients.map((p, index) => {
                    const done = completedPatients.has(p.PatientDurableKey);
                    return (
                      <tr key={index} className={styles.tableRow} style={{ opacity: done ? 0.6 : 1 }}>
                        <td>
                          {done
                            ? <span style={{ color: '#16a34a', fontWeight: '700', fontSize: '1rem' }}>✓</span>
                            : <span style={{ color: '#c3c6d6', fontSize: '0.8rem' }}>—</span>
                          }
                        </td>
                        <td className={styles.boldData}>{(p.PatientDurableKey || 'N/A').substring(0, 8)}...</td>
                        <td>{p.Age || 'Unknown'} / {p.Sex || 'Unknown'}</td>
                        <td><span className={styles.truncateText}>{p.PrimaryChiefComplaintName || '*Unspecified'}</span></td>
                        <td><span className={styles.truncateText}>{p.PrimaryEdDiagnosisName || 'None'}</span></td>
                        <td>{p.LengthOfStayInDays || 'N/A'}</td>
                        <td>
                          {p.EdDisposition === 'Admit'
                            ? <span style={{ background: '#ede9fe', color: '#5b21b6', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>Admitted</span>
                            : <span style={{ color: '#c3c6d6', fontSize: '0.8rem' }}>—</span>
                          }
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className={styles.reviewButton}
                            onClick={() => router.push(`/detail/${p.PatientDurableKey}?reviewer=${loggedInUser}`)}
                          >
                            {done ? 'Re-review' : 'Review Chart'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
