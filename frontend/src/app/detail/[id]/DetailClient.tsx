'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from '../../page.module.css';

interface Encounter {
  EncounterKey: string;
  AdmissionDecisionInstant: string;
  ArrivalInstant: string;
  DepartureInstant: string;
  PrimaryEdDiagnosisName: string;
  SurgicalProcedures: string;
  BP: string;
  Pulse: string;
  Resp: string;
  SpO2: string;
  Temp: string;
  summary: string;
  note_text: string;
  had_psych_event: string;
  recieved_transfusion: string;
  LengthOfStayInDays: string;
  IcuLengthOfStay: string;
  VentilatorDays: string;
  MedicationAdministrations: string;
  EdDisposition: string;
}

interface Patient {
  PatientDurableKey: string;
  Age: string;
  Sex: string;
  Ethnicity: string;
  PrimaryChiefComplaintName: string;
  PrimaryEdDiagnosisName: string;
  PrimaryInpatientDiagnosisName: string;
  had_psych_event: boolean;
  recieved_transfusion: boolean;
  LengthOfStayInDays: string;
  IcuLengthOfStay: string;
  VentilatorDays: string;
  ProblemList: string;
  AcquiredDuringAdmission: string;
  MedicationAdministrations: string;
  EdDisposition: string;
  encounters: Encounter[];
}

const DOMAINS = [
  {
    title: 'Domain 1 — Accuracy',
    questions: [
      { id: 'q1', text: 'The summary accurately represents the care provided at the transferring emergency department.' },
      { id: 'q2', text: "The summary accurately reflects the patient's hospital course after transfer." },
      { id: 'q3', text: "The summary accurately reflects the patient's final diagnosis and disposition." },
    ],
  },
  {
    title: 'Domain 2 — Completeness',
    questions: [
      { id: 'q4', text: "The summary includes the key information needed to understand the transferring emergency department's care." },
      { id: 'q5', text: "The summary includes the key information needed to understand the patient's hospital course and outcome." },
      { id: 'q6', text: "There are important omissions that would affect the understanding of the patient's course. (reverse scored)" },
    ],
  },
  {
    title: 'Domain 3 — Clarity & Organization',
    questions: [
      { id: 'q7', text: 'The summary is easy to read and understand.' },
      { id: 'q8', text: 'The information is logically organized.' },
      { id: 'q9', text: 'The length is appropriate for its intended purpose.' },
    ],
  },
  {
    title: 'Domain 4 — Synthesis',
    questions: [
      { id: 'q10', text: 'The summary appropriately prioritizes clinically relevant information.' },
      { id: 'q11', text: 'The summary avoids unnecessary detail.' },
    ],
  },
  {
    title: 'Domain 5 — Utility',
    questions: [
      { id: 'q12', text: 'The summary clearly distinguishes care provided before and after transfer.' },
      { id: 'q13', text: "The summary provides useful follow-up information regarding the patient's outcome." },
    ],
  },
  {
    title: 'Global',
    questions: [
      { id: 'q14', text: 'Overall, this is a high-quality follow-up summary.' },
    ],
  },
];

const SCALE_LABELS = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];
type Scores = Record<string, number>;

interface ErrorAssessment {
  has_errors: boolean | null;
  error_count: string | null;
  error_severity: string | null;
  error_changes_understanding: boolean | null;
  error_description: string;
  additional_comments: string;
}

export default function DetailClient({ patientId }: { patientId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewer = searchParams.get('reviewer') || 'Unknown';

  const [patient, setPatient] = useState<Patient | null>(null);
  const [allPatientIds, setAllPatientIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [showFinalizeMenu, setShowFinalizeMenu] = useState<boolean>(false);

  const [currentDomain, setCurrentDomain] = useState<number>(0);
  const [scores, setScores] = useState<Scores>({});
  const [errorAssessment, setErrorAssessment] = useState<ErrorAssessment>({
    has_errors: null,
    error_count: null,
    error_severity: null,
    error_changes_understanding: null,
    error_description: '',
    additional_comments: '',
  });

  const [metricsPct, setMetricsPct] = useState<number>(35);
  const isDragging = useRef(false);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const goHome = () => router.push(`/?reviewer=${reviewer}`);

  // Drag handlers for vertical split panel
  const onMouseDown = () => { isDragging.current = true; };
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !rightPanelRef.current) return;
    const rect = rightPanelRef.current.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const pct = Math.min(Math.max((offsetY / rect.height) * 100, 15), 75);
    setMetricsPct(pct);
  }, []);

  const onMouseUp = useCallback(() => { isDragging.current = false; }, []);

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowFinalizeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:8000/api/patients');
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const result = await response.json();
        if (result.status === 'success') {
          setAllPatientIds(result.data.map((p: Patient) => p.PatientDurableKey));
          const found = result.data.find(
            (p: Patient) => String(p.PatientDurableKey).trim() === String(patientId).trim()
          );
          if (found) setPatient(found);
          else throw new Error('Patient record not found.');
        } else {
          throw new Error(result.message || 'Failed to load records.');
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    const fetchExistingReview = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/reviews/${reviewer}`);
        const result = await response.json();
        if (result.status === 'success' && result.data[patientId]) {
          const existing = result.data[patientId];
          const existingScores: Scores = {};
          for (let i = 1; i <= 14; i++) {
            if (existing[`q${i}`] !== undefined) existingScores[`q${i}`] = existing[`q${i}`];
          }
          setScores(existingScores);
          setErrorAssessment({
            has_errors: existing.has_errors ?? null,
            error_count: existing.error_count ?? null,
            error_severity: existing.error_severity ?? null,
            error_changes_understanding: existing.error_changes_understanding ?? null,
            error_description: existing.error_description ?? '',
            additional_comments: existing.additional_comments ?? '',
          });
          setSubmitted(true);
        }
      } catch {
        console.error('Could not load existing review');
      }
    };

    if (patientId) {
      fetchPatient();
      fetchExistingReview();
    }
  }, [patientId, reviewer]);

  // Validation functions
  const allQuestionsAnswered = (): boolean => {
    for (let i = 1; i <= 14; i++) {
      if (scores[`q${i}`] === undefined) return false;
    }
    if (errorAssessment.has_errors === null) return false;
    if (errorAssessment.has_errors === true) {
      if (!errorAssessment.error_count) return false;
      if (!errorAssessment.error_severity) return false;
      if (errorAssessment.error_changes_understanding === null) return false;
    }
    return true;
  };

  const currentDomainComplete = (): boolean => {
    if (currentDomain < DOMAINS.length) {
      return DOMAINS[currentDomain].questions.every(q => scores[q.id] !== undefined);
    }
    if (errorAssessment.has_errors === null) return false;
    if (errorAssessment.has_errors === true) {
      if (!errorAssessment.error_count) return false;
      if (!errorAssessment.error_severity) return false;
      if (errorAssessment.error_changes_understanding === null) return false;
    }
    return true;
  };

  // Calculates completion percentage for progress bar
  const getDomainProgress = (index: number): number => {
    if (index < DOMAINS.length) {
      const qList = DOMAINS[index].questions;
      const answeredCount = qList.filter(q => scores[q.id] !== undefined).length;
      return Math.round((answeredCount / qList.length) * 100);
    } else {
      // Error assessment section progress
      let required = 1;
      let filled = errorAssessment.has_errors !== null ? 1 : 0;
      if (errorAssessment.has_errors === true) {
        required += 3;
        if (errorAssessment.error_count) filled++;
        if (errorAssessment.error_severity) filled++;
        if (errorAssessment.error_changes_understanding !== null) filled++;
      }
      return Math.round((filled / required) * 100);
    }
  };

  const saveReview = async (): Promise<boolean> => {
    if (!allQuestionsAnswered()) {
      alert('Please answer all questions before finalizing.');
      return false;
    }
    setSubmitting(true);
    try {
      const payload = {
        reviewer,
        patient_id: patientId,
        ...Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`q${i + 1}`, scores[`q${i + 1}`]])),
        has_errors: errorAssessment.has_errors,
        error_count: errorAssessment.error_count,
        error_severity: errorAssessment.error_severity,
        error_changes_understanding: errorAssessment.error_changes_understanding,
        error_description: errorAssessment.error_description,
        additional_comments: errorAssessment.additional_comments,
      };

      const response = await fetch('http://localhost:8000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.status === 'success') {
        setSubmitted(true);
        return true;
      } else {
        alert('Failed to save review. Please try again.');
        return false;
      }
    } catch {
      alert('Error submitting review.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalizeAndHome = async () => {
    setShowFinalizeMenu(false);
    const ok = await saveReview();
    if (ok) goHome();
  };

  const handleFinalizeAndNext = async () => {
    setShowFinalizeMenu(false);
    const ok = await saveReview();
    if (!ok) return;
    const currentIndex = allPatientIds.indexOf(patientId);
    const nextId = allPatientIds[currentIndex + 1];
    if (nextId) router.push(`/detail/${nextId}?reviewer=${reviewer}`);
    else goHome();
  };

  if (loading) return <div className={styles.loadingScreen}>Loading Patient Chart...</div>;
  if (errorMsg || !patient) {
    return (
      <div className={styles.appWrapper} style={{ padding: '2rem', textAlign: 'center' }}>
        <p>{errorMsg || 'Patient not found.'}</p>
        <button onClick={goHome} className={styles.reviewButton} style={{ marginTop: '1rem' }}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  const firstEncounter = patient.encounters[0];
  const isLastStep = currentDomain === DOMAINS.length;
  const currentTitle = isLastStep ? 'Structured Error Assessment' : DOMAINS[currentDomain].title;
  const progressPct = getDomainProgress(currentDomain);

  return (
    <div className={styles.appWrapper}>
      <div className={styles.detailViewport}>
        <header className={styles.appHeaderBar}>
          <div className={styles.headerLeftHand}>
            <button onClick={goHome} className={styles.backIconButton}>Back</button>
            <span className={styles.brandTitle}>MedReviewPro</span>
            <div className={styles.dividerLine}></div>
            <div className={styles.patientMetaStrings}>
              <span>ID: {patient.PatientDurableKey?.substring(0, 8)}</span>
              <span className={styles.metaSeparator}>|</span>
              <span>{patient.Age} Yrs ({patient.Sex})</span>
              <span className={styles.metaSeparator}>|</span>
              <span className={styles.mrnMono}>
                {patient.encounters.length} Encounter{patient.encounters.length !== 1 ? 's' : ''}
              </span>
              <span className={styles.metaSeparator}>|</span>
              <span className={styles.mrnMono}>
                LOS: {patient.LengthOfStayInDays || 'N/A'} days
              </span>
            </div>
          </div>
          <div className={styles.headerRightHand} style={{ position: 'relative' }}>
            <span style={{ background: '#e8f0fe', color: '#003d9b', padding: '0.4rem 0.9rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600' }}>
              Logged in as {reviewer}
            </span>
            <button className={styles.archiveBtn} onClick={goHome}>Close</button>
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                className={styles.finalizeBtn}
                onClick={() => setShowFinalizeMenu(prev => !prev)}
                disabled={submitting || !allQuestionsAnswered()}
                style={{ opacity: !allQuestionsAnswered() ? 0.5 : 1 }}
              >
                {submitting ? 'Saving...' : submitted ? 'Update Assessment' : 'Finalize Assessment'}
              </button>
              {showFinalizeMenu && (
                <div style={{ position: 'absolute', top: 'calc(100% + 0.4rem)', right: 0, background: 'white', border: '1px solid #c3c6d6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', minWidth: '230px', zIndex: 50, overflow: 'hidden' }}>
                  <button onClick={handleFinalizeAndHome} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.7rem 1rem', background: 'white', border: 'none', borderBottom: '1px solid #eceef0', cursor: 'pointer', fontSize: '0.85rem', color: '#191c1e' }}>
                    Finalize & Return to Dashboard
                  </button>
                  <button onClick={handleFinalizeAndNext} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.7rem 1rem', background: 'white', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#191c1e' }}>
                    Finalize & Go to Next Case
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className={styles.layoutSplitArea}>
          {/* LEFT PANEL */}
          <section className={styles.leftColumnSplit70}>
            <div className={styles.summarySubBlock}>
              <div className={styles.blockPanelHeader}>
                <h4>Patient Transfer Summary</h4>
              </div>
              <div className={styles.panelScrollingBody}>
                <p className={styles.clinicalParagraph}>
                  {firstEncounter.summary || 'No summary available.'}
                </p>
              </div>
            </div>

            <div className={styles.notesSubBlock}>
              <div className={styles.blockPanelHeader}>
                <h4>Full Clinical Notes</h4>
              </div>
              <div className={styles.panelScrollingBody}>
                {patient.encounters.map((enc, i) => (
                  <div key={enc.EncounterKey || i}>
                    {i > 0 && <hr style={{ border: 'none', borderTop: '2px solid #c3c6d6', margin: '1.5rem 0' }} />}
                    <p className={styles.clinicalParagraph} style={{ whiteSpace: 'pre-wrap' }}>
                      {enc.note_text || 'No clinical notes logged.'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* RIGHT PANEL */}
          <section ref={rightPanelRef} className={styles.rightColumnSplit30} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* METRICS */}
            <div style={{ height: `${metricsPct}%`, overflowY: 'auto', flexShrink: 0 }}>
              <div style={{ padding: '0.85rem 1.5rem', background: '#ffffff', borderBottom: '1px solid #c3c6d6' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.6rem' }}>
                  {patient.had_psych_event && (
                    <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', padding: '0.22rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>⚠️ Psych Event</span>
                  )}
                  {patient.recieved_transfusion && (
                    <span style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '0.22rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>🩸 Transfusion</span>
                  )}
                  {patient.EdDisposition === 'Admit' && (
                    <span style={{ background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd', padding: '0.22rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>🏥 Admitted</span>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {[
                    { label: 'BP', value: firstEncounter.BP },
                    { label: 'HR', value: `${firstEncounter.Pulse} bpm` },
                    { label: 'RR', value: firstEncounter.Resp },
                    { label: 'SpO2', value: `${firstEncounter.SpO2}%` },
                    { label: 'Temp', value: `${firstEncounter.Temp}°F` },
                  ].map(v => (
                    <div key={v.label} style={{ background: '#f7f9fb', border: '1px solid #c3c6d6', borderRadius: '6px', padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}>
                      <span style={{ color: '#505f76', marginRight: '0.3rem' }}>{v.label}</span>
                      <strong>{v.value || 'N/A'}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '0.85rem 1.5rem', background: '#ffffff', borderBottom: '1px solid #c3c6d6' }}>
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.7rem', fontWeight: '700', color: '#505f76', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diagnoses</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  {[
                    { label: 'ED Diagnosis', value: patient.PrimaryEdDiagnosisName },
                    { label: 'Inpatient Diagnosis', value: patient.PrimaryInpatientDiagnosisName },
                    { label: 'Problem List', value: patient.ProblemList },
                    { label: 'Acquired During Admission', value: patient.AcquiredDuringAdmission },
                  ].map(item => (
                    <div key={item.label} style={{ background: '#f7f9fb', border: '1px solid #c3c6d6', borderRadius: '6px', padding: '0.5rem' }}>
                      <span style={{ display: 'block', fontSize: '0.65rem', color: '#505f76', marginBottom: '0.15rem' }}>{item.label}</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: '600' }}>{item.value || 'N/A'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '0.85rem 1.5rem', background: '#ffffff', borderBottom: '1px solid #c3c6d6' }}>
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.7rem', fontWeight: '700', color: '#505f76', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clinical Course</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  <div style={{ background: '#f7f9fb', border: '1px solid #c3c6d6', borderRadius: '6px', padding: '0.5rem' }}>
                    <span style={{ display: 'block', fontSize: '0.65rem', color: '#505f76', marginBottom: '0.15rem' }}>ICU LOS</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: '600' }}>{patient.IcuLengthOfStay || '0'} days</span>
                  </div>
                  <div style={{ background: '#f7f9fb', border: '1px solid #c3c6d6', borderRadius: '6px', padding: '0.5rem' }}>
                    <span style={{ display: 'block', fontSize: '0.65rem', color: '#505f76', marginBottom: '0.15rem' }}>Ventilator Days</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: '600' }}>{patient.VentilatorDays || '0'}</span>
                  </div>
                  <div style={{ gridColumn: 'span 2', background: '#f7f9fb', border: '1px solid #c3c6d6', borderRadius: '6px', padding: '0.5rem' }}>
                    <span style={{ display: 'block', fontSize: '0.65rem', color: '#505f76', marginBottom: '0.15rem' }}>Surgical Procedures</span>
                    <span style={{ fontSize: '0.78rem' }}>{firstEncounter.SurgicalProcedures || 'None'}</span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '0.85rem 1.5rem', background: '#ffffff' }}>
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.7rem', fontWeight: '700', color: '#505f76', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Medications</p>
                <div style={{ background: '#f7f9fb', border: '1px solid #c3c6d6', borderRadius: '6px', padding: '0.5rem', fontSize: '0.78rem', whiteSpace: 'pre-wrap' }}>
                  {patient.MedicationAdministrations || 'None recorded'}
                </div>
              </div>
            </div>

            {/* DRAGGABLE DIVIDER */}
            <div
              onMouseDown={onMouseDown}
              style={{
                height: '8px',
                background: '#eceef0',
                cursor: 'row-resize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderTop: '1px solid #c3c6d6',
                borderBottom: '1px solid #c3c6d6',
                flexShrink: 0,
                userSelect: 'none',
              }}
            >
              <div style={{ width: '32px', height: '3px', borderRadius: '2px', background: '#c3c6d6' }} />
            </div>

            {/* ASSESSMENT PANEL */}
            <div style={{ flex: 1, background: '#ffffff', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              
              {/* DOMAIN TITLE HEADER & PROGRESS BAR */}
              <div style={{ padding: '0.8rem 1.5rem 0.6rem', borderBottom: '1px solid #eceef0', background: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#003d9b' }}>
                    {currentTitle}
                  </h3>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#505f76' }}>
                    Step {currentDomain + 1} of {DOMAINS.length + 1} ({progressPct}%)
                  </span>
                </div>
                {/* Progress Bar Container */}
                <div style={{ width: '100%', height: '6px', background: '#e0e0e0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${progressPct}%`,
                      background: progressPct === 100 ? '#16a34a' : '#003d9b',
                      transition: 'width 0.3s ease, background-color 0.3s ease',
                    }}
                  />
                </div>
              </div>

              {/* PINNED INSTRUCTIONS */}
              <div style={{ padding: '0.6rem 1.5rem', background: '#f0f4ff', borderBottom: '1px solid #c3d2f5', flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#003d9b', lineHeight: '1.4' }}>
                  <strong>Instructions:</strong> Rate each item based on your own review of the case or chart. This summary is intended to provide concise informational follow-up to the transferring ED—it is not a performance evaluation.
                </p>
                <p style={{ margin: '0.45rem 0 0', fontSize: '0.72rem', color: '#505f76', lineHeight: '1.4' }}>
                  <strong>Rating Scale:</strong> 1 = Strongly Disagree &nbsp;|&nbsp; 2 = Disagree &nbsp;|&nbsp; 3 = Neutral &nbsp;|&nbsp; 4 = Agree &nbsp;|&nbsp; 5 = Strongly Agree
                </p>
              </div>

              {/* DOMAIN QUESTIONS CONTENT */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
                {!isLastStep ? (
                  <>
                    {DOMAINS[currentDomain].questions.map(q => (
                      <div key={q.id} style={{ marginBottom: '1.25rem' }}>
                        <p style={{ fontSize: '0.82rem', color: '#434654', marginBottom: '0.6rem', lineHeight: '1.4' }}>
                          {q.text}
                        </p>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          {[1, 2, 3, 4, 5].map(n => (
                            <button
                              key={n}
                              onClick={() => setScores(prev => ({ ...prev, [q.id]: n }))}
                              title={SCALE_LABELS[n - 1]}
                              style={{
                                flex: 1,
                                padding: '0.5rem 0.25rem',
                                border: '1px solid',
                                borderColor: scores[q.id] === n ? '#003d9b' : '#c3c6d6',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                fontWeight: '600',
                                background: scores[q.id] === n ? '#003d9b' : '#f7f9fb',
                                color: scores[q.id] === n ? 'white' : '#434654',
                                transition: 'all 0.15s',
                              }}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                        {scores[q.id] && (
                          <p style={{ fontSize: '0.7rem', color: '#505f76', marginTop: '0.25rem' }}>
                            {SCALE_LABELS[scores[q.id] - 1]}
                          </p>
                        )}
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div style={{ marginBottom: '1rem' }}>
                      <p style={{ fontSize: '0.82rem', color: '#434654', marginBottom: '0.5rem' }}>
                        Did you identify any clinically meaningful factual inaccuracies?
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {[
                          { label: 'No', value: false },
                          { label: 'Yes', value: true },
                        ].map(opt => (
                          <button
                            key={opt.label}
                            onClick={() =>
                              setErrorAssessment(prev => ({
                                ...prev,
                                has_errors: opt.value,
                                error_count: opt.value ? prev.error_count : null,
                                error_severity: opt.value ? prev.error_severity : null,
                                error_changes_understanding: opt.value ? prev.error_changes_understanding : null,
                              }))
                            }
                            style={{
                              flex: 1,
                              padding: '0.5rem',
                              border: '1px solid',
                              borderColor: errorAssessment.has_errors === opt.value ? '#003d9b' : '#c3c6d6',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.82rem',
                              fontWeight: '600',
                              background: errorAssessment.has_errors === opt.value ? '#003d9b' : '#f7f9fb',
                              color: errorAssessment.has_errors === opt.value ? 'white' : '#434654',
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {errorAssessment.has_errors === true && (
                      <>
                        <div style={{ marginBottom: '1rem' }}>
                          <p style={{ fontSize: '0.82rem', color: '#434654', marginBottom: '0.5rem' }}>Number of inaccuracies:</p>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {['1', '2', '3 or more'].map(opt => (
                              <button
                                key={opt}
                                onClick={() => setErrorAssessment(prev => ({ ...prev, error_count: opt }))}
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  border: '1px solid',
                                  borderColor: errorAssessment.error_count === opt ? '#003d9b' : '#c3c6d6',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.78rem',
                                  fontWeight: '600',
                                  background: errorAssessment.error_count === opt ? '#003d9b' : '#f7f9fb',
                                  color: errorAssessment.error_count === opt ? 'white' : '#434654',
                                }}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                          <p style={{ fontSize: '0.82rem', color: '#434654', marginBottom: '0.5rem' }}>Highest severity:</p>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {['Minor', 'Moderate', 'Major'].map(opt => (
                              <button
                                key={opt}
                                onClick={() => setErrorAssessment(prev => ({ ...prev, error_severity: opt }))}
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  border: '1px solid',
                                  borderColor: errorAssessment.error_severity === opt ? '#003d9b' : '#c3c6d6',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.78rem',
                                  fontWeight: '600',
                                  background: errorAssessment.error_severity === opt ? '#003d9b' : '#f7f9fb',
                                  color: errorAssessment.error_severity === opt ? 'white' : '#434654',
                                }}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                          <p style={{ fontSize: '0.82rem', color: '#434654', marginBottom: '0.5rem' }}>
                            Would the most severe inaccuracy meaningfully change understanding of the patient's course?
                          </p>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {[
                              { label: 'No', value: false },
                              { label: 'Yes', value: true },
                            ].map(opt => (
                              <button
                                key={opt.label}
                                onClick={() =>
                                  setErrorAssessment(prev => ({
                                    ...prev,
                                    error_changes_understanding: opt.value,
                                  }))
                                }
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  border: '1px solid',
                                  borderColor: errorAssessment.error_changes_understanding === opt.value ? '#003d9b' : '#c3c6d6',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.82rem',
                                  fontWeight: '600',
                                  background: errorAssessment.error_changes_understanding === opt.value ? '#003d9b' : '#f7f9fb',
                                  color: errorAssessment.error_changes_understanding === opt.value ? 'white' : '#434654',
                                }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                          <p style={{ fontSize: '0.82rem', color: '#434654', marginBottom: '0.5rem' }}>Brief description of inaccuracy/inaccuracies:</p>
                          <textarea
                            value={errorAssessment.error_description}
                            onChange={e => setErrorAssessment(prev => ({ ...prev, error_description: e.target.value }))}
                            rows={3}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #c3c6d6', fontSize: '0.82rem', resize: 'vertical', boxSizing: 'border-box' }}
                            placeholder="Describe any inaccuracies..."
                          />
                        </div>
                      </>
                    )}

                    <div style={{ marginBottom: '1rem' }}>
                      <p style={{ fontSize: '0.82rem', color: '#434654', marginBottom: '0.5rem' }}>Additional comments (optional):</p>
                      <textarea
                        value={errorAssessment.additional_comments}
                        onChange={e => setErrorAssessment(prev => ({ ...prev, additional_comments: e.target.value }))}
                        rows={3}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #c3c6d6', fontSize: '0.82rem', resize: 'vertical', boxSizing: 'border-box' }}
                        placeholder="Any additional comments..."
                      />
                    </div>
                  </>
                )}
              </div>

              {/* NEXT / BACK NAVIGATION */}
              <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid #eceef0', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', background: '#fafafa', flexShrink: 0 }}>
                <button
                  onClick={() => setCurrentDomain(prev => Math.max(0, prev - 1))}
                  disabled={currentDomain === 0}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    border: '1px solid #c3c6d6',
                    background: 'white',
                    cursor: currentDomain === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    opacity: currentDomain === 0 ? 0.4 : 1,
                  }}
                >
                  ← Back
                </button>
                {currentDomain < DOMAINS.length ? (
                  <button
                    onClick={() => setCurrentDomain(prev => prev + 1)}
                    disabled={!currentDomainComplete()}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: currentDomainComplete() ? '#003d9b' : '#c3c6d6',
                      color: 'white',
                      cursor: currentDomainComplete() ? 'pointer' : 'not-allowed',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                    }}
                  >
                    Next →
                  </button>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: allQuestionsAnswered() ? '#16a34a' : '#505f76', fontWeight: '600', alignSelf: 'center' }}>
                    {allQuestionsAnswered() ? '✓ Ready to finalize' : 'Complete all fields'}
                  </span>
                )}
              </div>

            </div>
          </section>
        </main>
      </div>
    </div>
  );
}