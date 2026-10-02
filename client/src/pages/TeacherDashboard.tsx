import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BookOpen, CalendarDays, Send } from "lucide-react";

type Course = { id: string; code: string; title: string; programCode: string; level: number; coefficient: string | number; credits: string | number };
type Semester = { id: string; label: string; academicYear: { label: string } };
type Schedule = { id: string; weekday: number; startsAt: string; endsAt: string; room: string | null; course: { code: string; title: string } };
type GradebookStudent = { id: string; matricule: string | null; user: { name: string | null; email: string }; gradeRecord: { grade: string | number | null; status: string; reviewNote: string | null } | null };
type Gradebook = { course: Course; semester: Semester; students: GradebookStudent[] };
const weekdayLabels = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const time = (value: string) => { const date = new Date(value); return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`; };

export default function TeacherDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [courseId, setCourseId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [gradebook, setGradebook] = useState<Gradebook | null>(null);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) { setLoading(true); setError(""); }
    try {
      const [catalogResponse, scheduleResponse] = await Promise.all([
        fetch("/api/academics/teacher/courses", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/academics/schedule", { credentials: "same-origin", cache: "no-store" }),
      ]);
      const [catalog, timetable] = await Promise.all([catalogResponse.json(), scheduleResponse.json()]);
      if (!catalogResponse.ok) throw new Error(catalog.message ?? "Les cours assignés ne sont pas disponibles.");
      if (!scheduleResponse.ok) throw new Error(timetable.message ?? "Le planning n’est pas disponible.");
      setCourses(catalog.courses ?? []); setSemesters(catalog.semesters ?? []); setSchedule(timetable.slots ?? []);
      if (!semesterId && catalog.semesters?.[0]) setSemesterId(catalog.semesters[0].id);
    } catch (cause) {
      if (!quiet) setError(cause instanceof Error ? cause.message : "Impossible de charger l’espace enseignant.");
    } finally { if (!quiet) setLoading(false); }
  }, [semesterId]);
  useEffect(() => {
    void refresh();
    const sync = () => { if (document.visibilityState === "visible") void refresh(true); };
    const onServiceWorkerMessage = (event: MessageEvent) => { if (event.data?.type === "HEMIP_PUSH") sync(); };
    const interval = window.setInterval(sync, 30000);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
    };
  }, [refresh]);

  const loadGradebook = async (nextCourse = courseId, nextSemester = semesterId) => {
    setMessage(""); setError(""); setGradebook(null); setGrades({});
    if (!nextCourse || !nextSemester) return;
    try {
      const response = await fetch(`/api/academics/teacher/gradebook?courseId=${encodeURIComponent(nextCourse)}&semesterId=${encodeURIComponent(nextSemester)}`, { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Le relevé de notes n’est pas disponible.");
      setGradebook(payload as Gradebook);
      const values: Record<string, string> = {};
      for (const student of payload.students as GradebookStudent[]) {
        if (student.gradeRecord?.grade !== null && student.gradeRecord?.grade !== undefined && student.gradeRecord.status !== "PUBLISHED") values[student.id] = String(student.gradeRecord.grade);
      }
      setGrades(values);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Le relevé de notes n’est pas disponible."); }
  };

  const submitGrades = async (event: FormEvent) => {
    event.preventDefault();
    if (!gradebook) return;
    const lockedStudentIds = new Set(gradebook.students.filter(student => ["VERIFIED", "PUBLISHED"].includes(student.gradeRecord?.status ?? "")).map(student => student.id));
    const entries = Object.entries(grades).filter(([studentId, value]) => value.trim() !== "" && !lockedStudentIds.has(studentId)).map(([studentId, value]) => ({ studentId, grade: Number(value) }));
    if (!entries.length) { setError("Saisissez au moins une note avant de transmettre."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/academics/teacher/grades/submit", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, semesterId, grades: entries }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Les notes n’ont pas été transmises.");
      setMessage(`${payload.submitted} note(s) transmise(s) au responsable des évaluations.`);
      await loadGradebook();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Les notes n’ont pas été transmises."); }
    finally { setSaving(false); }
  };

  return <div className="admin-page"><div className="container">
    <header className="admin-heading"><div><span className="eyebrow"><i /> ESPACE ENSEIGNANT</span><h1>Votre activité <em>académique.</em></h1><p>Consultez vos interventions et transmettez les notes de vos cours assignés.</p></div></header>
    {message && <div className="inline-message" role="status">{message}</div>}{error && <div className="inline-message" role="alert">{error}</div>}
    <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">INTERVENTIONS PUBLIÉES</span><h2>Mon planning</h2></div><CalendarDays size={20} /></div>
      {loading ? <p role="status">Chargement de vos interventions…</p> : schedule.length === 0 ? <p className="academic-empty">Aucun créneau publié ne vous est encore attribué.</p> : <div className="student-schedule-list">{schedule.map(slot => <div className="student-schedule-row" key={slot.id}><strong>{weekdayLabels[slot.weekday] ?? "Jour"}</strong><span>{time(slot.startsAt)}–{time(slot.endsAt)}</span><div><b>{slot.course.title}</b><small>{slot.course.code}</small></div><span>{slot.room ?? "Salle à confirmer"}</span></div>)}</div>}
    </section>
    <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">SAISIE DES NOTES BRUTES</span><h2>Transmettre les évaluations</h2></div><BookOpen size={20} /></div>
      <div className="gradebook-selectors"><label>Cours<select value={courseId} onChange={event => { setCourseId(event.target.value); setGradebook(null); }}><option value="">Choisir un cours</option>{courses.map(course => <option value={course.id} key={course.id}>{course.code} · {course.title} · {course.programCode} L{course.level}</option>)}</select></label><label>Semestre<select value={semesterId} onChange={event => { setSemesterId(event.target.value); setGradebook(null); }}><option value="">Choisir un semestre</option>{semesters.map(semester => <option value={semester.id} key={semester.id}>{semester.academicYear.label} · {semester.label}</option>)}</select></label><button className="button button--outline" onClick={() => void loadGradebook()} disabled={!courseId || !semesterId}>Charger la classe</button></div>
      {gradebook && <form onSubmit={submitGrades}><div className="table-scroll"><table className="tariff-table"><thead><tr><th>Matricule</th><th>Étudiant</th><th>Note / 20</th><th>État</th><th>Retour du responsable</th></tr></thead><tbody>{gradebook.students.map(student => <tr key={student.id}><td>{student.matricule ?? "À attribuer"}</td><td>{student.user.name ?? student.user.email}</td><td><input aria-label={`Note de ${student.user.name ?? student.user.email}`} type="number" min="0" max="20" step="0.01" value={grades[student.id] ?? ""} onChange={event => setGrades({ ...grades, [student.id]: event.target.value })} disabled={student.gradeRecord?.status === "PUBLISHED" || student.gradeRecord?.status === "VERIFIED"} /></td><td>{student.gradeRecord?.status ?? "À saisir"}</td><td>{student.gradeRecord?.reviewNote ?? "—"}</td></tr>)}</tbody></table></div><p className="audit-footnote">Le cours applique le coefficient {Number(gradebook.course.coefficient)} et vaut {Number(gradebook.course.credits)} crédit(s). Les notes vérifiées ou publiées sont verrouillées.</p><button className="button button--primary" disabled={saving || !gradebook.students.length}>{saving ? "Transmission…" : "Transmettre les notes"} <Send size={15} /></button></form>}
      {!loading && !courses.length && <p className="academic-empty">Aucun cours ne vous est assigné. Contactez le secrétariat académique.</p>}
    </section>
  </div></div>;
}

