import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, RefreshCw, Send, Undo2 } from "lucide-react";

type Grade = {
  id: string; studentId: string; grade: string | number | null; coefficient: string | number; credit: string | number;
  status: string; reviewNote: string | null; submittedAt: string | null;
  student: { matricule: string | null; user: { name: string | null; email: string } };
  course: { code: string; title: string; programCode: string; level: number };
  semester: { id: string; label: string; academicYear: { label: string } };
  enteredBy: { name: string | null } | null;
};

const outcomeLabels: Record<string, string> = { ADMITTED: "Admis", FAILED: "Ajourné", RESIT: "Rattrapage" };

export default function EvaluationDashboard() {
  const [records, setRecords] = useState<Grade[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [creditThreshold, setCreditThreshold] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [policyNote, setPolicyNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/academics/evaluations/queue", { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "La file des notes est indisponible.");
      const nextRecords = payload.records ?? [];
      setRecords(nextRecords); setSelected([]);
      setSemesterFilter(current => current && nextRecords.some((record: Grade) => record.semester.id === current) ? current : nextRecords[0]?.semester.id ?? "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "La file des notes est indisponible."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const selectedRecords = useMemo(() => records.filter(record => selected.includes(record.id)), [records, selected]);
  const visibleRecords = useMemo(() => records.filter(record => !semesterFilter || record.semester.id === semesterFilter), [records, semesterFilter]);
  const semesterOptions = useMemo(() => Array.from(new Map(records.map(record => [record.semester.id, { id: record.semester.id, label: `${record.semester.academicYear.label} · ${record.semester.label}` }])).values()), [records]);
  const groupedStudents = useMemo(() => Array.from(new Set(selectedRecords.map(record => record.studentId))), [selectedRecords]);
  const semestres = Array.from(new Set(selectedRecords.map(record => record.semester.id)));
  const canPublish = selectedRecords.length > 0 && selectedRecords.every(record => record.status === "VERIFIED") && semestres.length === 1 && groupedStudents.every(id => outcomes[id]);

  const submit = async (path: string, body: unknown, success: (payload: any) => string) => {
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "L’opération n’a pas pu être enregistrée.");
      setMessage(success(payload));
      setReviewNote(""); setPolicyNote("");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "L’opération n’a pas pu être enregistrée."); }
    finally { setBusy(false); }
  };

  const review = (action: "verify" | "return") => submit("/api/academics/evaluations/review", { gradeIds: selected, action, reviewNote }, payload => `${payload.updated} note(s) ${action === "verify" ? "vérifiée(s)" : "retournée(s) à l’enseignant"}.`);
  const publish = (event: FormEvent) => {
    event.preventDefault();
    void submit("/api/academics/evaluations/publish", { gradeIds: selected, outcomes, creditThreshold: Number(creditThreshold), policyNote }, payload => `${payload.publishedGrades} note(s) et ${payload.summaries?.length ?? 0} relevé(s) publiés. ${payload.push?.delivered ?? 0} notification(s) envoyée(s).`);
  };

  const toggleAll = () => setSelected(current => visibleRecords.length > 0 && visibleRecords.every(record => current.includes(record.id)) ? current.filter(id => !visibleRecords.some(record => record.id === id)) : visibleRecords.map(record => record.id));
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);

  return <div className="admin-page"><div className="container">
    <header className="admin-heading"><div><span className="eyebrow"><i /> RESPONSABLE DES ÉVALUATIONS</span><h1>Délibérer et <em>publier.</em></h1><p>Vérifiez les notes transmises, calculez les moyennes pondérées et publiez les décisions officielles.</p></div><button className="button button--outline" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} /> Actualiser</button></header>
    {message && <div className="inline-message" role="status"><Check size={16} /> {message}</div>}{error && <div className="inline-message" role="alert">{error}</div>}
    <div className="admin-stat-grid"><div className="admin-stat"><span>NOTES À TRAITER</span><strong>{loading ? "—" : records.filter(record => record.status === "SUBMITTED").length}</strong><small>Transmises par les enseignants</small></div><div className="admin-stat"><span>VÉRIFIÉES</span><strong>{loading ? "—" : records.filter(record => record.status === "VERIFIED").length}</strong><small>Prêtes pour délibération</small></div><div className="admin-stat"><span>SÉLECTION</span><strong>{selected.length}</strong><small>{groupedStudents.length} étudiant(s) · {semestres.length} semestre(s)</small></div></div>
    <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">FILE DE TRANSMISSION</span><h2>Notes reçues</h2></div><label className="finance-student-select">Semestre<select value={semesterFilter} onChange={event => { setSemesterFilter(event.target.value); setSelected([]); }}><option value="">Tous les semestres</option>{semesterOptions.map(semester => <option key={semester.id} value={semester.id}>{semester.label}</option>)}</select></label><button className="text-button" onClick={toggleAll} disabled={!visibleRecords.length}>{visibleRecords.length > 0 && visibleRecords.every(record => selected.includes(record.id)) ? "Tout désélectionner" : "Tout sélectionner"}</button></div>
      {loading ? <p role="status">Chargement des notes…</p> : visibleRecords.length === 0 ? <p className="academic-empty">Aucune note n’attend de vérification pour ce semestre.</p> : <div className="table-scroll"><table className="tariff-table"><thead><tr><th><span className="sr-only">Choisir</span></th><th>Étudiant</th><th>Filière</th><th>Cours</th><th>Semestre</th><th>Note / 20</th><th>Coef.</th><th>Crédits</th><th>État</th><th>Retour</th></tr></thead><tbody>{visibleRecords.map(record => <tr key={record.id}><td><input type="checkbox" aria-label={`Sélectionner ${record.student.user.name ?? record.student.user.email}, ${record.course.code}`} checked={selected.includes(record.id)} onChange={() => toggle(record.id)} /></td><td>{record.student.user.name ?? record.student.user.email}<small>{record.student.matricule ?? "Matricule à attribuer"}</small></td><td>{record.course.programCode} · L{record.course.level}</td><td>{record.course.code} · {record.course.title}<small>Saisie par {record.enteredBy?.name ?? "enseignant"}</small></td><td>{record.semester.academicYear.label} · {record.semester.label}</td><td>{record.grade === null ? "—" : Number(record.grade).toFixed(2)}</td><td>{Number(record.coefficient)}</td><td>{Number(record.credit)}</td><td>{record.status === "VERIFIED" ? "Vérifiée" : record.status === "CHANGES_REQUESTED" ? "À corriger" : "À vérifier"}</td><td>{record.reviewNote ?? "—"}</td></tr>)}</tbody></table></div>}
      <div className="evaluation-review-actions"><label>Motif / correction demandée<input value={reviewNote} onChange={event => setReviewNote(event.target.value)} maxLength={1000} placeholder="Requis pour retourner les notes" /></label><button className="button button--outline" onClick={() => void review("return")} disabled={busy || !selected.length || reviewNote.trim().length < 3}><Undo2 size={15} /> Retourner</button><button className="button button--primary" onClick={() => void review("verify")} disabled={busy || !selected.length || selectedRecords.some(record => record.status !== "SUBMITTED")}><Check size={15} /> Vérifier</button></div>
    </section>
    <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">DÉLIBÉRATION OFFICIELLE</span><h2>Calculer et publier</h2></div><Send size={19} /></div><p className="audit-footnote">Sélectionnez toutes les notes enregistrées pour les étudiants et le semestre concernés. Chaque note doit être vérifiée avant la publication du relevé officiel.</p><form className="evaluation-publish-form" onSubmit={publish}>
      <label>Seuil de validation des crédits / 20<input type="number" min="0" max="20" step="0.25" value={creditThreshold} onChange={event => setCreditThreshold(event.target.value)} required /></label>
      <label>Décision officielle par étudiant<select value="" disabled={!groupedStudents.length} onChange={event => { if (event.target.value) setOutcomes(current => Object.fromEntries(groupedStudents.map(id => [id, event.target.value]))); }}><option value="">Attribuer la même décision à tous…</option><option value="ADMITTED">Admis</option><option value="FAILED">Ajourné</option><option value="RESIT">Rattrapage</option></select></label>
      <label className="evaluation-policy-note">Motif de délibération<input value={policyNote} onChange={event => setPolicyNote(event.target.value)} maxLength={1000} placeholder="Référence de décision ou remarque" /></label>
      {groupedStudents.length > 0 && <div className="evaluation-outcomes">{groupedStudents.map(studentId => { const record = selectedRecords.find(item => item.studentId === studentId)!; const name = record.student.user.name ?? record.student.user.email; return <label key={studentId}>{name}<select value={outcomes[studentId] ?? ""} onChange={event => setOutcomes(current => ({ ...current, [studentId]: event.target.value }))}><option value="">Choisir une décision</option>{Object.entries(outcomeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>; })}</div>}
      <button className="button button--primary" disabled={busy || !canPublish}>{busy ? "Publication…" : "Publier les résultats"} <Send size={15} /></button>
      {selectedRecords.length > 0 && (semestres.length > 1 || selectedRecords.some(record => record.status !== "VERIFIED")) && <small className="auth-hint">Choisissez un seul semestre et uniquement des notes déjà vérifiées.</small>}
    </form></section>
  </div></div>;
}
