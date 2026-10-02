import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowDownToLine, CalendarDays, CreditCard, FileText, GraduationCap, Upload } from "lucide-react";

type StudentOverview = {
  student: {
    id: string; matricule: string | null; programCode: string; level: number; cohort: string | null; academicYear: string | null;
    user: { name: string | null; email: string }; financialStatus: { balanceDue: string | number; clearedForResults: boolean } | null;
    debts: Array<{ id: string; description: string; amountDue: string | number; dueAt: string | null; isSettled: boolean }>;
    payments: Array<{ amount: string | number; currency: string; paidAt: string | null; reference: string }>;
  };
  slots: Array<{ id: string; weekday: number; startsAt: string; endsAt: string; room: string | null; course: { code: string; title: string }; teacher: { user: { name: string | null } } | null }>;
  publishedGrades: Array<{ id: string; grade: string | number | null; coefficient: string | number; credit: string | number; course: { code: string; title: string } | null; courseTitle: string; semesterLabel: string; academicYearLabel: string }>;
  publishedResults: Array<{ id: string; weightedAverage: string | number; creditsEarned: string | number; creditsTotal: string | number; outcome: string; publishedAt: string; semester: { label: string }; academicYear: { label: string } | null }>;
  documents: Array<{ id: string; originalName: string; documentType: string | null; reviewStatus: string; createdAt: string }>;
};

const weekdayLabels = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const typeLabels: Record<string, string> = { IDENTITY: "Pièce d’identité", PREVIOUS_DIPLOMA: "Diplôme précédent", OTHER: "Autre document" };
const reviewLabels: Record<string, string> = { SUBMITTED: "À vérifier", ACCEPTED: "Validé", REJECTED: "À corriger" };
const outcomeLabels: Record<string, string> = { ADMITTED: "Admis", FAILED: "Ajourné", RESIT: "Rattrapage" };

function time(value: string) {
  const date = new Date(value);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] ?? character));
}

export default function StudentDashboard() {
  const [data, setData] = useState<StudentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [documentType, setDocumentType] = useState("IDENTITY");
  const [file, setFile] = useState<File | null>(null);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) { setLoading(true); setError(""); }
    try {
      const response = await fetch("/api/academics/student/overview", { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Impossible de charger l’espace étudiant.");
      setData(payload as StudentOverview);
    } catch (cause) {
      if (!quiet) setError(cause instanceof Error ? cause.message : "L’espace étudiant est indisponible.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);
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

  const uploadDocument = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) { setError("Choisissez un document à transmettre."); return; }
    setUploading(true); setError(""); setMessage("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("documentType", documentType);
      const response = await fetch("/api/storage/documents", { method: "POST", credentials: "same-origin", body });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Le document n’a pas pu être transmis.");
      setFile(null);
      setMessage("Document transmis à la gestionnaire pour vérification.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le document n’a pas pu être transmis.");
    } finally {
      setUploading(false);
    }
  };

  const printCertificate = () => {
    if (!data?.student.matricule || !data.student.academicYear) {
      setError("Le secrétariat doit attribuer le matricule et l’année académique avant d’éditer le certificat.");
      return;
    }
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) { setError("Autorisez l’ouverture de la fenêtre d’impression dans votre navigateur."); return; }
    win.opener = null;
    const name = escapeHtml(data.student.user.name ?? data.student.user.email);
    win.document.write(`<!doctype html><html lang="fr"><meta charset="utf-8"><title>Certificat de scolarité</title><style>body{font:16px Arial,sans-serif;color:#17323d;margin:70px auto;max-width:760px;line-height:1.7}header{text-align:center;border-bottom:2px solid #0b789c;padding-bottom:24px}h1{margin-top:48px;text-align:center;font-size:26px}main{margin:45px 20px}.signature{margin:70px 20px 0 auto;width:250px;border-top:1px solid #72858d;padding-top:10px;text-align:center;font-size:13px}.meta{color:#576b72;font-size:13px}</style><body><header><strong>HEMIP · LA PERCÉE</strong><div class="meta">Pointe-Noire · République du Congo</div></header><h1>CERTIFICAT DE SCOLARITÉ</h1><main>Le présent document atteste que <strong>${name}</strong>, titulaire du matricule <strong>${escapeHtml(data.student.matricule)}</strong>, est inscrit(e) en <strong>${escapeHtml(data.student.programCode)} — L${data.student.level}</strong> pour l’année académique <strong>${escapeHtml(data.student.academicYear)}</strong>.</main><div class="meta">Document généré le ${new Date().toLocaleDateString("fr-FR")}.</div><div class="signature">Le service administratif<br><small>Signature et cachet HEMIP</small></div><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  const printStudentCard = () => {
    if (!data?.student.matricule || !data.student.academicYear) {
      setError("Le secrétariat doit attribuer le matricule et l’année académique avant d’éditer la carte.");
      return;
    }
    const win = window.open("", "_blank", "width=700,height=500");
    if (!win) { setError("Autorisez l’ouverture de la fenêtre d’impression dans votre navigateur."); return; }
    win.opener = null;
    const name = escapeHtml(data.student.user.name ?? data.student.user.email);
    win.document.write(`<!doctype html><html lang="fr"><meta charset="utf-8"><title>Carte d’étudiant HEMIP</title><style>@page{size:85.6mm 54mm;margin:0}*{box-sizing:border-box}body{margin:0;padding:12mm;background:#fff;font:12px Arial,sans-serif;color:#17323d}.card{width:85.6mm;height:54mm;padding:6mm;background:linear-gradient(135deg,#073f5a,#0b789c);color:#fff;border-radius:4mm;display:flex;flex-direction:column;justify-content:space-between}.brand{font-size:10px;letter-spacing:.14em}.title{font-size:16px;font-weight:700;letter-spacing:.08em}.name{font-size:15px;font-weight:700}.meta{display:flex;justify-content:space-between;gap:5mm;font-size:9px;line-height:1.5}.number{font-size:10px;letter-spacing:.1em}@media print{body{padding:0}}</style><body><article class="card"><header class="brand"><strong>HEMIP · LA PERCÉE</strong></header><div><div class="title">CARTE D’ÉTUDIANT</div><div class="name">${name}</div></div><div class="meta"><div><strong>${escapeHtml(data.student.programCode)} · L${data.student.level}</strong><br>${escapeHtml(data.student.academicYear)}</div><strong class="number">${escapeHtml(data.student.matricule)}</strong></div></article><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  if (loading) return <div className="dashboard-page"><div className="container"><p role="status">Chargement de votre espace étudiant…</p></div></div>;
  if (!data) return <div className="dashboard-page"><div className="container"><div className="inline-message" role="alert">{error || "L’espace étudiant est indisponible."}</div></div></div>;
  const { student } = data;
  return <div className="dashboard-page"><div className="container">
    <div className="dashboard-top"><div><span className="eyebrow"><i /> ESPACE ÉTUDIANT</span><h1>Bonjour, <em>{student.user.name?.split(" ")[0] ?? "Bienvenue"}.</em></h1><p>{student.programCode} · L{student.level}{student.academicYear ? ` · ${student.academicYear}` : " · Année académique à confirmer"}</p></div><span className="student-avatar"><GraduationCap size={25} /></span></div>
    <div className="student-real-grid">
      <section className="dashboard-panel student-wide"><div className="panel-heading"><div><span className="eyebrow">EMPLOI DU TEMPS PUBLIÉ</span><h2>Votre planning</h2></div><CalendarDays size={19} /></div>
        {data.slots.length ? <div className="student-schedule-list">{data.slots.map(slot => <div className="student-schedule-row" key={slot.id}><strong>{weekdayLabels[slot.weekday] ?? "Jour"}</strong><span>{time(slot.startsAt)}–{time(slot.endsAt)}</span><div><b>{slot.course.title}</b><small>{slot.course.code} · {slot.teacher?.user.name ?? "Enseignant à confirmer"}</small></div><span>{slot.room ?? "Salle à confirmer"}</span></div>)}</div> : <p className="academic-empty">Aucun planning publié pour votre filière et votre niveau.</p>}
      </section>
      <section className="dashboard-panel"><div className="panel-heading"><div><span className="eyebrow">DOSSIER ÉTUDIANT</span><h2>Votre inscription</h2></div><FileText size={18} /></div><div className="student-profile-line"><span>Filière · niveau</span><strong>{student.programCode} · L{student.level}</strong></div><div className="student-profile-line"><span>Matricule</span><strong>{student.matricule ?? "À attribuer par le secrétariat"}</strong></div><div className="student-profile-line"><span>Année</span><strong>{student.academicYear ?? "À confirmer"}</strong></div><div className="student-doc-actions"><button className="button button--outline student-print-button" onClick={printCertificate} disabled={!student.matricule || !student.academicYear}><ArrowDownToLine size={15} /> Certificat</button><button className="button button--outline student-print-button" onClick={printStudentCard} disabled={!student.matricule || !student.academicYear}><CreditCard size={15} /> Carte d’étudiant</button></div></section>
      <section className="dashboard-panel student-wide"><div className="panel-heading"><div><span className="eyebrow">RÉSULTATS OFFICIELS</span><h2>Vos relevés publiés</h2></div><GraduationCap size={19} /></div>
        {data.publishedResults.length ? <div className="student-results-list">{data.publishedResults.map(result => <article className="student-result-card" key={result.id}><div><strong>{result.semester.label} · {result.academicYear?.label ?? "Année non précisée"}</strong><small>Publié le {new Date(result.publishedAt).toLocaleDateString("fr-FR")}</small></div><strong>{Number(result.weightedAverage).toFixed(2)} / 20</strong><span className={`result-outcome result-outcome--${result.outcome.toLowerCase()}`}>{outcomeLabels[result.outcome] ?? result.outcome}</span><small>Crédits obtenus : {Number(result.creditsEarned)} / {Number(result.creditsTotal)}</small></article>)}</div> : <p className="academic-empty">Vos résultats apparaîtront ici après la délibération et leur publication officielle.</p>}
        {data.publishedGrades.length > 0 && <details className="student-course-grades"><summary>Détail des notes publiées</summary><div className="table-scroll"><table className="tariff-table"><thead><tr><th>Cours</th><th>Semestre</th><th>Note</th><th>Coefficient</th><th>Crédits</th></tr></thead><tbody>{data.publishedGrades.map(grade => <tr key={grade.id}><td>{grade.course?.title ?? grade.courseTitle}</td><td>{grade.semesterLabel}</td><td>{grade.grade === null ? "—" : Number(grade.grade).toFixed(2)}</td><td>{Number(grade.coefficient)}</td><td>{Number(grade.credit)}</td></tr>)}</tbody></table></div></details>}
      </section>
      <section className="dashboard-panel"><div className="panel-heading"><div><span className="eyebrow">DOSSIER ADMINISTRATIF</span><h2>Vos pièces</h2></div><Upload size={18} /></div>
        {data.documents.length ? <ul className="student-doc-list">{data.documents.map(document => <li key={document.id}><span>{typeLabels[document.documentType ?? "OTHER"] ?? "Document"}<small>{document.originalName}</small></span><b className={`document-review document-review--${document.reviewStatus.toLowerCase()}`}>{reviewLabels[document.reviewStatus] ?? document.reviewStatus}</b></li>)}</ul> : <p className="academic-empty">Aucune pièce n’a encore été transmise.</p>}
        <form className="student-upload-form" onSubmit={uploadDocument}><label>Type de pièce<select value={documentType} onChange={event => setDocumentType(event.target.value)}><option value="IDENTITY">Pièce d’identité</option><option value="PREVIOUS_DIPLOMA">Diplôme précédent</option><option value="OTHER">Autre document</option></select></label><label>Fichier PDF ou image<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event => setFile(event.target.files?.[0] ?? null)} required /></label><button className="button button--outline" disabled={uploading || !file}>{uploading ? "Envoi…" : "Transmettre la pièce"} <Upload size={14} /></button></form>
      </section>
      <section className="dashboard-panel"><div className="panel-heading"><div><span className="eyebrow">SITUATION FINANCIÈRE</span><h2>Échéances</h2></div><FileText size={18} /></div><div className="student-profile-line"><span>Solde connu</span><strong>{Number(student.financialStatus?.balanceDue ?? 0).toLocaleString("fr-FR")} FCFA</strong></div>
        {student.debts.length ? <ul className="student-debt-list">{student.debts.map(debt => <li key={debt.id}><span>{debt.description}<small>{debt.dueAt ? new Date(debt.dueAt).toLocaleDateString("fr-FR") : "Date à confirmer"}</small></span><b>{Number(debt.amountDue).toLocaleString("fr-FR")} FCFA</b></li>)}</ul> : <p className="academic-empty">Aucune échéance n’est enregistrée.</p>}
        {student.payments.length > 0 && <details><summary>Derniers paiements enregistrés</summary><ul className="student-debt-list">{student.payments.map((payment, index) => <li key={`${payment.reference}-${index}`}><span>{payment.reference}<small>{payment.paidAt ? new Date(payment.paidAt).toLocaleDateString("fr-FR") : "Date à confirmer"}</small></span><b>{Number(payment.amount).toLocaleString("fr-FR")} {payment.currency}</b></li>)}</ul></details>}
      </section>
    </div>
    {(message || error) && <div className="inline-message" role={error ? "alert" : "status"}>{error || message}</div>}
  </div></div>;
}

