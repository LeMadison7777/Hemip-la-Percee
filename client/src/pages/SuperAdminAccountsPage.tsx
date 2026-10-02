import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Check, RefreshCw, ShieldCheck, UserPlus, X } from "lucide-react";

type PendingAccount = { id: string; name: string | null; email: string; registrationProfile: "TEACHER" | "ADMINISTRATIVE"; createdAt: string };
type GlobalAccount = { id: string; name: string | null; email: string; role: string; registrationStatus: string; isActive: boolean; createdAt: string };
type GlobalCounts = { users: number; activeUsers: number; students: number; teachers: number; courses: number; schedules: number; publishedSchedules: number; results: number; payments: number; debts: number; announcements: number; testimonials: number; documents: number };
type NewAccount = { name: string; email: string; role: string; password: string; employeeCode: string; department: string };
type PreEnrollmentRole = "visitor" | "student" | "teacher" | "payment_manager" | "academic_admin";
type PreEnrollmentAccount = { email: string; role: PreEnrollmentRole };
const roleLabels: Record<string, string> = { visitor: "En attente de profil", student: "Étudiant", teacher: "Enseignant", academic_admin: "SAC", evaluation_manager: "Évaluations", payment_manager: "Gestion financière", super_admin: "Super Admin" };
const preEnrollmentRoleLabels: Record<PreEnrollmentRole, string> = { visitor: "Accès à compléter", student: "Étudiant", teacher: "Enseignant", payment_manager: "Gestion financière", academic_admin: "SAC" };

function parsePreEnrollmentCsv(source: string): PreEnrollmentAccount[] {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) throw new Error("Le fichier doit contenir l’en-tête email,role et au moins une adresse.");
  if (lines[0]!.split(",").map(value => value.trim().toLowerCase()).join(",") !== "email,role") {
    throw new Error("L’en-tête doit être exactement : email,role.");
  }
  const allowedRoles = new Set<PreEnrollmentRole>(["visitor", "student", "teacher", "payment_manager", "academic_admin"]);
  const accounts = lines.slice(1).map((line, index) => {
    const columns = line.split(",").map(value => value.trim());
    const email = columns[0]?.toLowerCase() ?? "";
    const role = columns[1]?.toLowerCase() as PreEnrollmentRole | undefined;
    if (columns.length !== 2 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !role || !allowedRoles.has(role)) {
      throw new Error(`Adresse ou rôle invalide à la ligne ${index + 2}.`);
    }
    return { email, role };
  });
  if (accounts.length > 1000) throw new Error("Un fichier peut contenir au maximum 1 000 adresses.");
  if (new Set(accounts.map(account => account.email)).size !== accounts.length) throw new Error("Le fichier contient des adresses en double.");
  return accounts;
}

export default function SuperAdminAccountsPage() {
  const [accounts, setAccounts] = useState<PendingAccount[]>([]);
  const [allAccounts, setAllAccounts] = useState<GlobalAccount[]>([]);
  const [overview, setOverview] = useState<GlobalCounts | null>(null);
  const [form, setForm] = useState<NewAccount>({ name: "", email: "", role: "academic_admin", password: "", employeeCode: "", department: "" });
  const [csvAccounts, setCsvAccounts] = useState<PreEnrollmentAccount[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [accessReason, setAccessReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pendingResponse, allResponse, overviewResponse] = await Promise.all([
        fetch("/api/admin/accounts/pending", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/admin/accounts", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/admin/overview", { credentials: "same-origin", cache: "no-store" }),
      ]);
      const [pendingPayload, allPayload, overviewPayload] = await Promise.all([pendingResponse.json().catch(() => ({})), allResponse.json().catch(() => ({})), overviewResponse.json().catch(() => ({}))]);
      if (!pendingResponse.ok) throw new Error(pendingPayload.message ?? "Impossible de charger les demandes.");
      if (!allResponse.ok) throw new Error(allPayload.message ?? "Impossible de charger la liste des comptes.");
      if (!overviewResponse.ok) throw new Error(overviewPayload.message ?? "Impossible de charger la vue globale.");
      setAccounts(pendingPayload.accounts ?? []);
      setAllAccounts(allPayload.accounts ?? []);
      setOverview(overviewPayload.counts ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Les demandes sont indisponibles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const changeAccess = async (account: GlobalAccount) => {
    if (accessReason.trim().length < 3) { setError("Indiquez un motif d’au moins 3 caractères pour le journal d’audit."); return; }
    const nextState = !account.isActive;
    setBusyId(account.id); setMessage(""); setError("");
    try {
      const response = await fetch(`/api/admin/accounts/${encodeURIComponent(account.id)}/access`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextState, reason: accessReason.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "L’accès n’a pas pu être modifié.");
      setMessage(`Accès ${nextState ? "réactivé" : "désactivé"} pour ${account.email}.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L’accès n’a pas pu être modifié.");
    } finally { setBusyId(""); }
  };

  const decide = async (account: PendingAccount, decision: "approve" | "reject", formElement?: HTMLFormElement) => {
    setBusyId(account.id);
    setMessage("");
    setError("");
    const data = formElement ? new FormData(formElement) : new FormData();
    try {
      const response = await fetch(`/api/admin/accounts/${encodeURIComponent(account.id)}/decision`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, assignedRole: data.get("assignedRole"), employeeCode: data.get("employeeCode"), department: data.get("department"), reason: data.get("reason") }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "La décision n’a pas été enregistrée.");
      setMessage(decision === "approve" ? `Compte de ${account.name ?? account.email} approuvé.` : `Demande de ${account.email} refusée.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La décision n’a pas été enregistrée.");
    } finally {
      setBusyId("");
    }
  };

  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusyId("create");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/accounts", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Le compte n’a pas été créé.");
      const signInHint = form.password ? "La connexion se fait avec le mot de passe temporaire défini." : "Aucun mot de passe n’a été défini : la personne doit choisir « Code e-mail seul » à la connexion.";
      setMessage(`Le compte ${payload.account.email} a été créé avec le rôle ${payload.account.role}. ${signInHint}`);
      setForm({ name: "", email: "", role: "academic_admin", password: "", employeeCode: "", department: "" });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le compte n’a pas été créé.");
    } finally {
      setBusyId("");
    }
  };

  const chooseCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    setCsvAccounts([]);
    setCsvFileName("");
    setError("");
    setMessage("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Choisissez un fichier .csv."); return; }
    if (file.size > 1024 * 1024) { setError("Le fichier CSV doit faire moins de 1 Mo."); return; }
    try {
      setCsvAccounts(parsePreEnrollmentCsv(await file.text()));
      setCsvFileName(file.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le fichier CSV n’a pas pu être lu.");
    }
  };

  const importCsv = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!csvAccounts.length) return;
    setBusyId("import"); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/accounts/pre-enroll/import", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts: csvAccounts }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "L’import n’a pas été enregistré.");
      setMessage(`Import terminé : ${payload.created} nouvelle(s) préinscription(s), ${payload.updated} mise(s) à jour. Les étudiants et enseignants doivent compléter le formulaire d’inscription avec cette adresse ; le dossier enseignant sera soumis à approbation. Les autres rôles autorisés peuvent choisir « Code e-mail seul ».`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L’import n’a pas été enregistré.");
    } finally {
      setBusyId("");
    }
  };

  return <div className="admin-page"><div className="container">
    <header className="admin-heading"><div><span className="eyebrow"><i /> ACCÈS ET COMPTES</span><h1>Contrôle <em>des accès.</em></h1><p>Gérez les comptes HEMIP, approuvez le personnel et créez des comptes internes.</p></div><button className="button button--outline" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} /> Actualiser</button></header>
    <div className="admin-stat-grid"><div className="admin-stat"><span>COMPTES ENREGISTRÉS</span><strong>{loading ? "—" : allAccounts.length}</strong><small>Liste des comptes HEMIP</small></div><div className="admin-stat"><span>ACCÈS ACTIFS</span><strong>{loading ? "—" : allAccounts.filter(account => account.isActive).length}</strong><small>Comptes autorisés à se connecter</small></div><div className="admin-stat"><span>DEMANDES EN ATTENTE</span><strong>{loading ? "—" : accounts.length}</strong><small>Personnel à approuver</small></div><div className="admin-stat"><span>CONTRÔLE</span><strong>Super Admin</strong><small>Les changements d’accès sont audités</small></div></div>
    <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">VUE GLOBALE DE LA BASE</span><h2>Activité HEMIP</h2></div><RefreshCw size={18} /></div>{overview ? <div className="superadmin-overview-grid">{[["Étudiants", overview.students], ["Enseignants", overview.teachers], ["Cours", overview.courses], ["Plannings actifs", overview.schedules], ["Plannings publiés", overview.publishedSchedules], ["Relevés officiels", overview.results], ["Paiements", overview.payments], ["Échéances", overview.debts], ["Pièces", overview.documents], ["Annonces", overview.announcements], ["Témoignages", overview.testimonials], ["Comptes actifs", overview.activeUsers]].map(([label, count]) => <div key={label}><span>{label}</span><strong>{count}</strong></div>)}</div> : loading ? <p role="status">Chargement de la vue globale…</p> : <p className="academic-empty">La vue globale n’est pas disponible.</p>}</section>
    {message && <div className="inline-message" role="status"><Check size={16} /> {message}</div>}{error && <div className="inline-message" role="alert">{error}</div>}
    <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">INSCRIPTIONS DU PERSONNEL</span><h2>Demandes à examiner</h2></div><ShieldCheck size={20} /></div>
      {loading ? <p role="status">Chargement des demandes…</p> : accounts.length === 0 ? <p className="academic-empty">Aucune demande de compte du personnel n’est en attente.</p> : <div className="approval-list">{accounts.map(account => <form key={account.id} className="approval-card" onSubmit={event => { event.preventDefault(); void decide(account, "approve", event.currentTarget); }}>
        <div className="approval-card-head"><div><strong>{account.name ?? "Nom non renseigné"}</strong><span>{account.email}</span></div><time>{new Date(account.createdAt).toLocaleDateString("fr-FR")}</time></div>
        <div className="approval-card-grid">
          {account.registrationProfile === "TEACHER" ? <><label>Matricule employé<input name="employeeCode" placeholder="Attribué par HEMIP" required /></label><label>Département<input name="department" placeholder="Département" required /></label></> : <label>Rôle à attribuer<select name="assignedRole" defaultValue="academic_admin"><option value="academic_admin">Secrétariat académique (SAC)</option><option value="evaluation_manager">Responsable des évaluations</option><option value="payment_manager">Gestion administrative et financière</option></select></label>}
          <label>Motif de décision<input name="reason" placeholder="Motif d’approbation ou de refus" minLength={3} maxLength={500} /></label>
        </div>
        <div className="approval-card-actions"><button type="submit" className="button button--primary" disabled={busyId === account.id}>{busyId === account.id ? "Traitement…" : "Approuver"} <Check size={15} /></button><button type="button" className="button button--outline" disabled={busyId === account.id} onClick={event => void decide(account, "reject", event.currentTarget.form ?? undefined)}>Refuser <X size={15} /></button></div>
      </form>)}</div>}
    </section>
    <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">VUE GLOBALE DES ACCÈS</span><h2>Comptes et rôles</h2></div><ShieldCheck size={20} /></div><p className="audit-footnote">Désactiver un compte invalide ses sessions. Les demandes en attente et refusées gardent leur procédure d’approbation; le dernier Super Admin actif ne peut pas être retiré.</p><label className="access-reason">Motif d’un changement d’accès<input value={accessReason} onChange={event => setAccessReason(event.target.value)} minLength={3} maxLength={500} placeholder="Ex. départ du personnel, fin de contrat…" /></label>
      {loading ? <p role="status">Chargement des comptes…</p> : allAccounts.length === 0 ? <p className="academic-empty">Aucun compte n’est encore enregistré.</p> : <div className="table-scroll"><table className="tariff-table"><thead><tr><th>Compte</th><th>Rôle</th><th>Inscription</th><th>Accès</th><th>Créé le</th><th>Action</th></tr></thead><tbody>{allAccounts.map(account => <tr key={account.id}><td>{account.name ?? "Nom non renseigné"}<small>{account.email}</small></td><td>{roleLabels[account.role] ?? account.role}</td><td>{account.registrationStatus}</td><td>{account.isActive ? <span className="status-good">Actif</span> : <span className="status-due">Désactivé</span>}</td><td>{new Date(account.createdAt).toLocaleDateString("fr-FR")}</td><td>{account.registrationStatus === "ACTIVE" ? <button className="text-button" onClick={() => void changeAccess(account)} disabled={busyId === account.id || accessReason.trim().length < 3}>{busyId === account.id ? "Traitement…" : account.isActive ? "Désactiver" : "Réactiver"}</button> : <small>Procédure d’inscription</small>}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="admin-panel pre-enrollment-panel"><div className="panel-heading"><div><span className="eyebrow">ACCÈS PAR LISTE</span><h2>Préinscrire des adresses par CSV</h2></div><UserPlus size={20} /></div>
      <p>Importe un fichier CSV privé au format <code>email,role</code>. Le fichier est lu pour l’import ; seules les adresses et les rôles sont ajoutés aux préinscriptions.</p>
      <div className="pre-enrollment-warning"><ShieldCheck size={17} /><span>Rôles acceptés : <code>visitor</code>, <code>student</code>, <code>teacher</code>, <code>payment_manager</code>, <code>academic_admin</code>. Pour un étudiant ou un enseignant, ce fichier ne crée pas le dossier de scolarité ou d’emploi : passe par l’inscription et l’approbation, ou crée le compte depuis le formulaire ci-dessous. Les rôles Évaluations et Super Admin se créent directement.</span></div>
      <form className="pre-enrollment-form" onSubmit={importCsv}>
        <label>Fichier CSV<input type="file" accept=".csv,text/csv" onChange={event => void chooseCsv(event)} disabled={busyId === "import"} /></label>
        {csvFileName && <div className="pre-enrollment-preview"><strong>{csvFileName} · {csvAccounts.length} adresse(s) prête(s)</strong><div>{Array.from(new Set(csvAccounts.map(account => account.role))).map(role => <span key={role}>{preEnrollmentRoleLabels[role]} : {csvAccounts.filter(account => account.role === role).length}</span>)}</div></div>}
        <button className="button button--primary" type="submit" disabled={busyId === "import" || csvAccounts.length === 0}>{busyId === "import" ? "Import en cours…" : "Importer les adresses"} <UserPlus size={15} /></button>
      </form>
    </section>
    <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">CRÉATION DIRECTE</span><h2>Créer un compte interne</h2></div><UserPlus size={20} /></div><form className="account-admin-form" onSubmit={createAccount}>
      <label>Nom complet<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} minLength={3} maxLength={160} required /></label>
      <label>Adresse e-mail<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required /></label>
      <label>Rôle<select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}><option value="academic_admin">Secrétariat académique (SAC)</option><option value="evaluation_manager">Responsable des évaluations</option><option value="payment_manager">Gestion administrative et financière</option><option value="teacher">Enseignant</option><option value="super_admin">Super Admin</option></select></label>
      <label>Mot de passe temporaire <small>(facultatif, 8 caractères min. ; vide = code e-mail)</small><input type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} minLength={8} maxLength={256} autoComplete="new-password" /></label>
      {form.role === "teacher" && <><label>Matricule employé<input value={form.employeeCode} onChange={event => setForm({ ...form, employeeCode: event.target.value })} required /></label><label>Département<input value={form.department} onChange={event => setForm({ ...form, department: event.target.value })} required /></label></>}
      <button className="button button--primary" disabled={busyId === "create"}>{busyId === "create" ? "Création…" : "Créer le compte"} <UserPlus size={15} /></button>
    </form><p className="audit-footnote"><ShieldCheck size={15} /> Chaque création et décision est enregistrée dans le journal d’audit. Les identifiants ne sont jamais réaffichés.</p></section>
  </div></div>;
}

