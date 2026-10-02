import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Check, Plus, Upload } from "lucide-react";

type Program = { code: string; label: string };
type Teacher = { id: string; employeeCode: string; department: string; user: { name: string | null; email: string } };
type Course = { id: string; code: string; title: string; programCode: string; level: number; coefficient: string | number; credits: string | number; teacherId: string | null };
type Slot = { id: string; programCode: string; level: number; cohort: string | null; weekday: number; startsAt: string; endsAt: string; room: string | null; isPublished: boolean; course: { code: string; title: string }; teacher: { user: { name: string | null } } | null };
type Catalog = { programs: Program[]; courses: Course[]; teachers: Teacher[] };
const dayLabels = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const time = (value: string) => { const date = new Date(value); return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`; };

export default function SecretaryDashboard() {
  const [catalog, setCatalog] = useState<Catalog>({ programs: [], courses: [], teachers: [] });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [courseForm, setCourseForm] = useState({ code: "", title: "", programCode: "", level: "1", coefficient: "1", credits: "0", teacherId: "" });
  const [slotForm, setSlotForm] = useState({ programCode: "", level: "1", cohort: "", courseId: "", teacherId: "", weekday: "1", startsAt: "08:00", endsAt: "10:00", room: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [catalogResponse, slotsResponse] = await Promise.all([
        fetch("/api/academics/catalogue", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/academics/schedule", { credentials: "same-origin", cache: "no-store" }),
      ]);
      const [catalogData, slotsData] = await Promise.all([catalogResponse.json(), slotsResponse.json()]);
      if (!catalogResponse.ok) throw new Error(catalogData.message ?? "Le catalogue n’est pas disponible.");
      if (!slotsResponse.ok) throw new Error(slotsData.message ?? "Le planning n’est pas disponible.");
      setCatalog(catalogData as Catalog); setSlots(slotsData.slots ?? []);
      if (!slotForm.programCode && catalogData.programs?.[0]) setSlotForm(current => ({ ...current, programCode: catalogData.programs[0].code }));
      if (!courseForm.programCode && catalogData.programs?.[0]) setCourseForm(current => ({ ...current, programCode: catalogData.programs[0].code }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de charger le module académique."); }
    finally { setLoading(false); }
  }, [courseForm.programCode, slotForm.programCode]);
  useEffect(() => { void refresh(); }, [refresh]);

  const matchingCourses = useMemo(() => catalog.courses.filter(course => course.programCode === slotForm.programCode && course.level === Number(slotForm.level)), [catalog.courses, slotForm.level, slotForm.programCode]);
  const groups = useMemo(() => {
    const drafts = slots.filter(slot => !slot.isPublished);
    const map = new Map<string, { programCode: string; level: number; cohort: string | null; count: number }>();
    for (const slot of drafts) {
      const key = [slot.programCode, slot.level, slot.cohort ?? ""].join("|");
      const item = map.get(key) ?? { programCode: slot.programCode, level: slot.level, cohort: slot.cohort, count: 0 };
      item.count += 1; map.set(key, item);
    }
    return Array.from(map.values());
  }, [slots]);

  const createCourse = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/academics/courses", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...courseForm, level: Number(courseForm.level), coefficient: Number(courseForm.coefficient), credits: Number(courseForm.credits) }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Le cours n’a pas été créé.");
      setMessage(`Cours ${payload.course.code} ajouté au catalogue.`);
      setCourseForm(current => ({ ...current, code: "", title: "" }));
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Le cours n’a pas été créé."); }
    finally { setBusy(false); }
  };

  const createSlot = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/academics/schedules", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...slotForm, level: Number(slotForm.level), weekday: Number(slotForm.weekday) }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Le créneau n’a pas été enregistré.");
      setMessage(`Créneau de ${payload.slot.course.title} enregistré en brouillon.`);
      setSlotForm(current => ({ ...current, courseId: "", startsAt: "08:00", endsAt: "10:00", room: "" }));
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Le créneau n’a pas été enregistré."); }
    finally { setBusy(false); }
  };

  const publish = async (group: { programCode: string; level: number; cohort: string | null }) => {
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/academics/schedules/publish", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(group) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Le planning n’a pas été publié.");
      setMessage(`${payload.count} créneau(x) publié(s) pour ${group.programCode} · L${group.level}${group.cohort ? ` · ${group.cohort}` : ""}. ${payload.push?.delivered ?? 0} notification(s) envoyée(s).`);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Le planning n’a pas été publié."); }
    finally { setBusy(false); }
  };

  return <div className="admin-page"><div className="container">
    <header className="admin-heading"><div><span className="eyebrow"><i /> SECRÉTARIAT ACADÉMIQUE</span><h1>Planifier et <em>publier.</em></h1><p>Constituez le catalogue de cours, évitez les conflits de salle et d’enseignant, puis publiez chaque planning.</p></div><button className="button button--outline" onClick={() => void refresh()} disabled={loading}><Upload size={15} /> Actualiser</button></header>
    {message && <div className="inline-message" role="status">{message}</div>}{error && <div className="inline-message" role="alert">{error}</div>}
    <div className="academic-admin-grid">
      <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">CATALOGUE HEMIP</span><h2>Ajouter un cours</h2></div><Plus size={19} /></div><form className="academic-form-grid" onSubmit={createCourse}>
        <label>Code<input value={courseForm.code} onChange={event => setCourseForm({ ...courseForm, code: event.target.value.toUpperCase() })} maxLength={30} required /></label>
        <label>Intitulé<input value={courseForm.title} onChange={event => setCourseForm({ ...courseForm, title: event.target.value })} maxLength={140} required /></label>
        <label>Filière<select value={courseForm.programCode} onChange={event => setCourseForm({ ...courseForm, programCode: event.target.value })}>{catalog.programs.map(program => <option key={program.code} value={program.code}>{program.label}</option>)}</select></label>
        <label>Niveau<select value={courseForm.level} onChange={event => setCourseForm({ ...courseForm, level: event.target.value })}><option value="1">L1</option><option value="2">L2</option><option value="3">L3</option></select></label>
        <label>Coefficient<input type="number" min="0.01" max="20" step="0.01" value={courseForm.coefficient} onChange={event => setCourseForm({ ...courseForm, coefficient: event.target.value })} required /></label>
        <label>Crédits<input type="number" min="0" max="120" step="0.5" value={courseForm.credits} onChange={event => setCourseForm({ ...courseForm, credits: event.target.value })} required /></label>
        <label>Enseignant responsable<select value={courseForm.teacherId} onChange={event => setCourseForm({ ...courseForm, teacherId: event.target.value })}><option value="">À attribuer dans le planning</option>{catalog.teachers.map(teacher => <option value={teacher.id} key={teacher.id}>{teacher.user.name ?? teacher.user.email}</option>)}</select></label>
        <button className="button button--primary" disabled={busy || !catalog.programs.length}>{busy ? "Enregistrement…" : "Ajouter au catalogue"} <Plus size={15} /></button>
      </form><p className="audit-footnote">Les filières proposées proviennent du catalogue HEMIP utilisé pour les admissions.</p></section>

      <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">CONSTRUCTION DU PLANNING</span><h2>Ajouter un créneau</h2></div><CalendarDays size={20} /></div><form className="academic-form-grid" onSubmit={createSlot}>
        <label>Filière<select value={slotForm.programCode} onChange={event => setSlotForm({ ...slotForm, programCode: event.target.value, courseId: "" })}>{catalog.programs.map(program => <option key={program.code} value={program.code}>{program.label}</option>)}</select></label>
        <label>Niveau<select value={slotForm.level} onChange={event => setSlotForm({ ...slotForm, level: event.target.value, courseId: "" })}><option value="1">L1</option><option value="2">L2</option><option value="3">L3</option></select></label>
        <label>Groupe / cohorte<input value={slotForm.cohort} onChange={event => setSlotForm({ ...slotForm, cohort: event.target.value })} placeholder="Facultatif" maxLength={80} /></label>
        <label>Cours<select value={slotForm.courseId} onChange={event => setSlotForm({ ...slotForm, courseId: event.target.value })} required><option value="">Choisir un cours</option>{matchingCourses.map(course => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label>
        <label>Enseignant<select value={slotForm.teacherId} onChange={event => setSlotForm({ ...slotForm, teacherId: event.target.value })} required><option value="">Choisir un enseignant</option>{catalog.teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.user.name ?? teacher.user.email}</option>)}</select></label>
        <label>Jour<select value={slotForm.weekday} onChange={event => setSlotForm({ ...slotForm, weekday: event.target.value })}>{[1,2,3,4,5,6].map(day => <option value={day} key={day}>{dayLabels[day]}</option>)}</select></label>
        <label>Début<input type="time" value={slotForm.startsAt} onChange={event => setSlotForm({ ...slotForm, startsAt: event.target.value })} required /></label>
        <label>Fin<input type="time" value={slotForm.endsAt} onChange={event => setSlotForm({ ...slotForm, endsAt: event.target.value })} required /></label>
        <label>Salle<input value={slotForm.room} onChange={event => setSlotForm({ ...slotForm, room: event.target.value })} maxLength={80} required /></label>
        <button className="button button--primary" disabled={busy || !matchingCourses.length}>{busy ? "Vérification…" : "Enregistrer en brouillon"} <Plus size={15} /></button>
      </form><p className="audit-footnote">Chaque créneau est contrôlé contre les conflits de groupe, de salle et d’enseignant.</p></section>
    </div>

    <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">PLANNINGS NON PUBLIÉS</span><h2>Vérifier puis publier</h2></div></div>
      {loading ? <p role="status">Chargement des créneaux…</p> : slots.length === 0 ? <p className="academic-empty">Aucun créneau n’est encore enregistré.</p> : <div className="table-scroll"><table className="tariff-table"><thead><tr><th>État</th><th>Filière</th><th>Niveau / groupe</th><th>Jour</th><th>Heure</th><th>Cours</th><th>Enseignant</th><th>Salle</th></tr></thead><tbody>{slots.map(slot => <tr key={slot.id}><td>{slot.isPublished ? <span className="status-good">Publié</span> : <span className="status-due">Brouillon</span>}</td><td>{slot.programCode}</td><td>L{slot.level}{slot.cohort ? ` · ${slot.cohort}` : ""}</td><td>{dayLabels[slot.weekday]}</td><td>{time(slot.startsAt)}–{time(slot.endsAt)}</td><td>{slot.course.code} · {slot.course.title}</td><td>{slot.teacher?.user.name ?? "À confirmer"}</td><td>{slot.room ?? "—"}</td></tr>)}</tbody></table></div>}
      {groups.length > 0 && <div className="schedule-publish-list">{groups.map(group => <div className="schedule-publish-row" key={`${group.programCode}-${group.level}-${group.cohort ?? "all"}`}><span>{group.programCode} · L{group.level}{group.cohort ? ` · ${group.cohort}` : ""}<small>{group.count} créneau(x) à publier</small></span><button className="button button--primary" onClick={() => void publish(group)} disabled={busy}>Publier ce planning <Check size={15} /></button></div>)}</div>}
    </section>
  </div></div>;
}

