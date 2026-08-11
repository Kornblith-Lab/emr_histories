'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../page.module.css';

interface Patient {
  PatientDurableKey: string;
  Age: string;
  Sex: string;
  PrimaryChiefComplaintName: string;
  PrimaryEdDiagnosisName: string;
  LengthOfStayInDays: string;
  EdDisposition: string;
}

interface ReviewRecord {
  reviewer: string;
  patient_id: string;
  submitted_at?: string;
  updated_at?: string;
}

const REVIEWERS = ['Reviewer A', 'Reviewer B'];
const COLORS: Record<string, string> = { 'Reviewer A': '#003d9b', 'Reviewer B': '#16a34a' };

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function formatWeekLabel(weekStartStr: string): string {
  const d = new Date(weekStartStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AdminPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [patientsRes, assignmentsRes, reviewsRes] = await Promise.all([
        fetch('http://localhost:8000/api/patients'),
        fetch('http://localhost:8000/api/assignments'),
        fetch('http://localhost:8000/api/reviews_all'),
      ]);

      const patientsJson = await patientsRes.json();
      const assignmentsJson = await assignmentsRes.json();
      const reviewsJson = await reviewsRes.json();

      if (patientsJson.status === 'success') setPatients(patientsJson.data);
      else throw new Error(patientsJson.message || 'Failed to load patients');

      if (assignmentsJson.status === 'success') setAssignments(assignmentsJson.data);
      else throw new Error(assignmentsJson.message || 'Failed to load assignments');

      if (reviewsJson.status === 'success') setReviews(reviewsJson.data);
      else throw new Error(reviewsJson.message || 'Failed to load reviews');

    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleReassign = async (patientId: string, newReviewer: string) => {
    setSavingId(patientId);
    try {
      await fetch('http://localhost:8000/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId, reviewer: newReviewer }),
      });
      setAssignments(prev => ({ ...prev, [patientId]: newReviewer }));
    } catch {
      alert('Failed to update assignment.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className={styles.loadingScreen}>Loading Admin Dashboard...</div>;

  const reviewedPatientIds = new Set(reviews.map(r => r.patient_id));
  const stats = REVIEWERS.map(reviewer => {
    const assigned = patients.filter(p => assignments[p.PatientDurableKey] === reviewer);
    const completedCount = reviews.filter(r => r.reviewer === reviewer).length;
    const pct = assigned.length > 0 ? Math.round((completedCount / assigned.length) * 100) : 0;
    return { reviewer, assignedCount: assigned.length, completedCount, pct };
  });

  const weeklyCounts: Record<string, Record<string, number>> = {};
  reviews.forEach(r => {
    if (!r.submitted_at) return;
    const weekStart = getWeekStart(new Date(r.submitted_at));
    if (!weeklyCounts[weekStart]) {
      weeklyCounts[weekStart] = {};
      REVIEWERS.forEach(rev => { weeklyCounts[weekStart][rev] = 0; });
    }
    if (weeklyCounts[weekStart][r.reviewer] !== undefined) {
      weeklyCounts[weekStart][r.reviewer] += 1;
    }
  });

  const sortedWeeks = Object.keys(weeklyCounts).sort();
  const maxWeeklyCount = Math.max(1, ...sortedWeeks.flatMap(week => REVIEWERS.map(rev => weeklyCounts[week][rev] || 0)));

  return (
    <div className={styles.appWrapper}>
      <main className={styles.homeMain}>
        <header className={styles.dashboardHeader}>
          <div>
            <h1 className={styles.titleText}>Admin Dashboard</h1>
            <p className={styles.subtitleText}>Reviewer Progress &amp; Assignment Control</p>
          </div>
          <button onClick={() => router.push('/')} className={styles.backIconButton}>
            ← Back to Login
          </button>
        </header>

        {errorMsg && <div style={{ marginBottom: '1rem', color: 'red' }}>Error: {errorMsg}</div>}

        {/* HORIZONTAL PROGRESS CHART */}
        <div style={{ background: 'white', border: '1px solid #c3c6d6', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', color: '#191c1e' }}>Reviewer Progress</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {stats.map(s => (
              <div key={s.reviewer}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: '600', fontSize: '0.95rem', color: '#191c1e' }}>{s.reviewer}</span>
                  <span style={{ fontSize: '0.85rem', color: '#505f76' }}>
                    {s.completedCount} / {s.assignedCount} done ·{' '}
                    <strong style={{ color: COLORS[s.reviewer] || '#003d9b' }}>{s.pct}%</strong>
                  </span>
                </div>
                <div style={{ background: '#eceef0', borderRadius: '999px', height: '20px', overflow: 'hidden', width: '100%' }}>
                  <div style={{ height: '100%', borderRadius: '999px', background: COLORS[s.reviewer] || '#003d9b', width: `${s.pct}%`, transition: 'width 0.4s ease', minWidth: s.pct > 0 ? '4px' : '0' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WEEKLY REVIEWS CHART */}
        <div style={{ background: 'white', border: '1px solid #c3c6d6', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: '#191c1e' }}>Reviews Completed Per Week</h3>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
            {REVIEWERS.map(rev => (
              <div key={rev} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#505f76' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: COLORS[rev], display: 'inline-block' }}></span>
                {rev}
              </div>
            ))}
          </div>
          {sortedWeeks.length === 0 ? (
            <p style={{ color: '#505f76', fontSize: '0.9rem' }}>No dated reviews yet. This chart will populate as new assessments are finalized.</p>
          ) : (
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end', height: '180px', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              {sortedWeeks.map(week => (
                <div key={week} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '70px' }}>
                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'flex-end', height: '130px' }}>
                    {REVIEWERS.map(rev => {
                      const count = weeklyCounts[week][rev] || 0;
                      return (
                        <div key={rev} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: '#505f76', marginBottom: '0.2rem' }}>{count > 0 ? count : ''}</span>
                          <div style={{ width: '22px', height: `${Math.max((count / maxWeeklyCount) * 110, count > 0 ? 4 : 0)}px`, background: COLORS[rev], borderRadius: '4px 4px 0 0', transition: 'height 0.4s ease' }} />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#505f76', fontWeight: '600' }}>
                    {formatWeekLabel(week)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PATIENT ASSIGNMENT TABLE */}
        <div className={styles.tableCardContainer}>
          <div className={styles.tableHeaderSection}>
            <h3>All Patients — Assignment Control</h3>
            <span className={styles.countBadge}>{patients.length} Total</span>
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
                  <th>Assigned To</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p, index) => {
                  const reviewedDone = reviewedPatientIds.has(p.PatientDurableKey);
                  const currentReviewer = assignments[p.PatientDurableKey] || REVIEWERS[0];
                  return (
                    <tr key={index} className={styles.tableRow}>
                      <td>{reviewedDone ? <span style={{ color: '#16a34a', fontWeight: '700' }}>✓</span> : <span style={{ color: '#c3c6d6' }}>—</span>}</td>
                      <td className={styles.boldData}>{(p.PatientDurableKey || 'N/A').substring(0, 8)}...</td>
                      <td>{p.Age || 'Unknown'} / {p.Sex || 'Unknown'}</td>
                      <td><span className={styles.truncateText}>{p.PrimaryChiefComplaintName || '*Unspecified'}</span></td>
                      <td><span className={styles.truncateText}>{p.PrimaryEdDiagnosisName || 'None'}</span></td>
                      <td>{p.LengthOfStayInDays || 'N/A'}</td>
                      <td>
                        <select
                          value={currentReviewer}
                          disabled={savingId === p.PatientDurableKey}
                          onChange={e => handleReassign(p.PatientDurableKey, e.target.value)}
                          style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #c3c6d6', fontSize: '0.85rem', background: savingId === p.PatientDurableKey ? '#eceef0' : 'white', cursor: 'pointer' }}
                        >
                          {REVIEWERS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className={styles.reviewButton} onClick={() => router.push(`/detail/${p.PatientDurableKey}?reviewer=${currentReviewer}`)}>
                          View Chart
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}