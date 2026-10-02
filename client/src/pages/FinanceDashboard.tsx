import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, FileText, RefreshCw, Send, Wallet } from "lucide-react";

type Student = {
  id: string; matricule: string | null; programCode: string; level: number; academicYear: string | null; cohort: string | null;
  phone: string | null; dateOfBirth: string | null;
  user: { name: string | null; email: string }; financialStatus: { balanceDue: string | number } | null;
  debts: Array<{ id: string; description: string; amountDue: string | number; dueAt: string | null; isSettled: boolean }>;
  payments: Array<{ id: string; amount: string | number; reference: string; method: string; status: string; paidAt: string | null }>;
};
type FinanceData = {
  students: Student[];
  pendingPayments: Array<{ id: string; amount: string | number; reference: string; method: string; createdAt: string; student: { matricule: string | null; user: { name: string | null } } }>;
  pendingDocuments: Array<{ id: string; originalName: string; documentType: string | null; createdAt: string; student: { id: string; matricule: string | null; user: { name: string | null; email: string } } | null }>;
  feePlans: Array<{ id: string; name: string; tuition: string | number; currency: string }>;
};

const money = (value: string | number | null | undefined) => `${Number(value ?? 0).toLocaleString("fr-FR")} FCFA`;
const methodLabels: Record<string, string> = { cash: "EspÃ¨ces", mobile_money: "Mobile Money", bank_transfer: "Virement", other: "Autre" };
const documentLabels: Record<string, string> = { IDENTITY: "PiÃ¨ce dâ€™identitÃ©", PREVIOUS_DIPLOMA: "DiplÃ´me prÃ©cÃ©dent", OTHER: "Autre document" };

export default function FinanceDashboard() {
  const [data, setData] = useState<FinanceData>({ students: [], pendingPayments: [], pendingDocuments: [], feePlans: [] });
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [debtForm, setDebtForm] = useState({ description: "", amountDue: "", dueAt: "", feePlanId: "" });
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "cash", reference: "", paidAt: "", feePlanId: "" });
  const [profileForm, setProfileForm] = useState({ matricule: "", academicYear: "", cohort: "", phone: "", dateOfBirth: "" });

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/finance", { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Les dossiers financiers sont indisponibles.");
      setData(payload as FinanceData);
      if (!studentId && payload.students?.[0]) setStudentId(payload.students[0].id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Les dossiers financiers sont indisponibles."); }
    finally { setLoading(false); }
  }, [studentId]);
  useEffect(() => { void refresh(); }, [refresh]);

  const selectedStudent = useMemo(() => data.students.find(student => student.id === studentId) ?? null, [data.students, studentId]);
  useEffect(() => {
    if (!selectedStudent) return;
    setProfileForm({ matricule: selectedStudent.matricule ?? "", academicYear: selectedStudent.academicYear ?? "", cohort: selectedStudent.cohort ?? "", phone: selectedStudent.phone ?? "", dateOfBirth: selectedStudent.dateOfBirth ? selectedStudent.dateOfBirth.slice(0, 10) : "" });
  }, [selectedStudent?.id, selectedStudent?.matricule, selectedStudent?.academicYear, selectedStudent?.cohort, selectedStudent?.phone, selectedStudent?.dateOfBirth]);

  const call = async (key: string, url: string, body: unknown, success: (payload: any) => string) => {
    setBusy(key); setMessage(""); setError("");
    try {
      const response = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Lâ€™opÃ©ration nâ€™a pas pu Ãªtre enregistrÃ©e.");
      setMessage(success(payload)); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Lâ€™opÃ©ration nâ€™a pas pu Ãªtre enregistrÃ©e."); }
    finally { setBusy(""); }
  };

  const saveProfile = (event: FormEvent) => {
    event.preventDefault(); if (!selectedStudent) return;
    void call("profile", `/api/admin/students/${encodeURIComponent(selectedStudent.id)}/profile`, profileForm, () => "Dossier dâ€™inscription mis Ã  jour.");
  };
  const createDebt = (event: FormEvent) => {
    event.preventDefault(); if (!studentId) return;
    void call("debt", "/api/admin/debts", { ...debtForm, studentId, amountDue: Number(debtForm.amountDue), dueAt: debtForm.dueAt || null, feePlanId: debtForm.feePlanId || null }, () => "Ã‰chÃ©ance ajoutÃ©e au dossier.");
    setDebtForm({ description: "", amountDue: "", dueAt: "", feePlanId: "" });
  };
  const recordPayment = (event: FormEvent) => {
    event.preventDefault(); if (!studentId) return;
    void call("payment", "/api/admin/payments", { ...paymentForm, studentId, amount: Number(paymentForm.amount), paidAt: paymentForm.paidAt || null, feePlanId: paymentForm.feePlanId || null }, () => "Paiement enregistrÃ© en attente de validation.");
    setPaymentForm({ amount: "", method: "cash", reference: "", paidAt: "", feePlanId: "" });
  };
  const reviewDocument = (id: string, decision: "accept" | "reject") => void call(`document-${id}`, `/api/storage/documents/${encodeURIComponent(id)}/review`, { decision }, () => decision === "accept" ? "PiÃ¨ce validÃ©e." : "PiÃ¨ce retournÃ©e pour correction.");
  const validatePayment = (id: string) => void call(`validate-${id}`, `/api/admin/payments/${encodeURIComponent(id)}/validate`, { reason: "ContrÃ´le de la piÃ¨ce de paiement effectuÃ©." }, () => "Paiement validÃ©; solde recalculÃ©.");
  const remind = (id: string) => void call(`reminder-${id}`, `/api/admin/debts/${encodeURIComponent(id)}/reminder`, {}, () => "Relance envoyÃ©e par e-mail.");

  const openDocument = async (id: string) => {
    setError("");
    try {
      const response = await fetch(`/api/storage/documents/${encodeURIComponent(id)}/signed-read-url`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "La piÃ¨ce ne peut pas Ãªtre ouverte.");
      window.open(payload.signedUrl, "_blank", "noopener,noreferrer");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "La piÃ¨ce ne peut pas Ãªtre ouverte."); }
  };

  const totalOutstanding = data.students.reduce((sum, student) => sum + Number(student.financialStatus?.balanceDue ?? 0), 0);
  return <div className="admin-page"><div className="container">
    <header className="admin-heading"><div><span className="eyebrow"><i /> GESTION ADMINISTRATIVE ET FINANCIÃˆRE</span><h1>Suivre les dossiers et les <em>paiements.</em></h1><p>Finalisez les inscriptions, contrÃ´lez les piÃ¨ces et enregistrez les Ã©chÃ©ances et rÃ¨glements.</p></div><button className="button button--outline" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} /> Actualiser</button></header>
    {message && <div className="inline-message" role="status"><Check size={16} /> {message}</div>}{error && <div className="inline-message" role="alert">{error}</div>}
    <div className="admin-stat-grid"><div className="admin-stat"><span>DOSSIERS ACTIFS</span><strong>{loading ? "â€”" : data.students.length}</strong><small>Ã‰tudiants inscrits dans le systÃ¨me</small></div><div className="admin-stat"><span>PAIEMENTS Ã€ VALIDER</span><strong>{loading ? "â€”" : data.pendingPayments.length}</strong><small>En attente de contrÃ´le</small></div><div className="admin-stat"><span>RESTE Ã€ RÃ‰GLER</span><strong>{loading ? "â€”" : money(totalOutstanding)}</strong><small>Somme des soldes connus</small></div></div>
    <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">DOSSIER ADMINISTRATIF</span><h2>Inscription et piÃ¨ces justificatives</h2></div><FileText size={19} /></div>
      <label className="finance-student-select">Ã‰tudiant<select value={studentId} onChange={event => setStudentId(event.target.value)}><option value="">Choisir un Ã©tudiant</option>{data.students.map(student => <option key={student.id} value={student.id}>{student.user.name ?? student.user.email} Â· {student.programCode} L{student.level}</option>)}</select></label>
      {selectedStudent ? <><form className="account-admin-form" onSubmit={saveProfile}><label>Matricule<input value={profileForm.matricule} onChange={event => setProfileForm({ ...profileForm, matricule: event.target.value })} required maxLength={40} /></label><label>AnnÃ©e acadÃ©mique<input value={profileForm.academicYear} onChange={event => setProfileForm({ ...profileForm, academicYear: event.target.value })} placeholder="Ã€ confirmer par la scolaritÃ©" required maxLength={30} /></label><label>Groupe / cohorte<input value={profileForm.cohort} onChange={event => setProfileForm({ ...profileForm, cohort: event.target.value })} maxLength={80} /></label><label>TÃ©lÃ©phone<input value={profileForm.phone} onChange={event => setProfileForm({ ...profileForm, phone: event.target.value })} maxLength={40} /></label><label>Date de naissance<input type="date" value={profileForm.dateOfBirth} onChange={event => setProfileForm({ ...profileForm, dateOfBirth: event.target.value })} /></label><button className="button button--primary" disabled={busy === "profile"}>{busy === "profile" ? "Enregistrementâ€¦" : "Enregistrer le dossier"}</button></form><p className="audit-footnote">{selectedStudent.user.name ?? selectedStudent.user.email} Â· {selectedStudent.programCode} Â· L{selectedStudent.level} Â· Solde {money(selectedStudent.financialStatus?.balanceDue)}</p></> : <p className="academic-empty">{loading ? "Chargement des Ã©tudiantsâ€¦" : "Aucun dossier Ã©tudiant actif."}</p>}
      <h3 className="finance-section-title">PiÃ¨ces reÃ§ues Ã  vÃ©rifier</h3>{data.pendingDocuments.length ? <div className="finance-review-list">{data.pendingDocuments.map(document => <article key={document.id}><div><strong>{documentLabels[document.documentType ?? "OTHER"] ?? "Document"}</strong><span>{document.student?.user.name ?? document.student?.user.email} Â· {document.student?.matricule ?? "Matricule Ã  attribuer"}</span><small>{document.originalName}</small></div><div><button className="button button--outline" onClick={() => void openDocument(document.id)}>Ouvrir la piÃ¨ce</button><button className="button button--primary" onClick={() => reviewDocument(document.id, "accept")} disabled={busy === `document-${document.id}`}>Valider</button><button className="button button--outline" onClick={() => reviewDocument(document.id, "reject")} disabled={busy === `document-${document.id}`}>Ã€ corriger</button></div></article>)}</div> : <p className="academic-empty">Aucune piÃ¨ce nâ€™attend de vÃ©rification.</p>}
    </section>
    <div className="finance-forms-grid"><section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">FRAIS ET MENSUALITÃ‰S</span><h2>Ajouter une Ã©chÃ©ance</h2></div><Wallet size={19} /></div><form className="academic-form-grid" onSubmit={createDebt}><label>LibellÃ©<input value={debtForm.description} onChange={event => setDebtForm({ ...debtForm, description: event.target.value })} required maxLength={180} placeholder="MensualitÃ© â€” septembre" /></label><label>Montant (FCFA)<input type="number" min="1" step="1" value={debtForm.amountDue} onChange={event => setDebtForm({ ...debtForm, amountDue: event.target.value })} required /></label><label>Ã‰chÃ©ance<input type="date" value={debtForm.dueAt} onChange={event => setDebtForm({ ...debtForm, dueAt: event.target.value })} /></label><label>Plan de frais<select value={debtForm.feePlanId} onChange={event => setDebtForm({ ...debtForm, feePlanId: event.target.value })}><option value="">Sans plan associÃ©</option>{data.feePlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} Â· {money(plan.tuition)}</option>)}</select></label><button className="button button--primary" disabled={busy === "debt" || !studentId}>{busy === "debt" ? "Enregistrementâ€¦" : "Ajouter au dossier"}</button></form></section>
      <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">RÃˆGLEMENT REÃ‡U</span><h2>Enregistrer un paiement</h2></div><Wallet size={19} /></div><form className="academic-form-grid" onSubmit={recordPayment}><label>Montant (FCFA)<input type="number" min="1" step="1" value={paymentForm.amount} onChange={event => setPaymentForm({ ...paymentForm, amount: event.target.value })} required /></label><label>Mode<select value={paymentForm.method} onChange={event => setPaymentForm({ ...paymentForm, method: event.target.value })}><option value="cash">EspÃ¨ces</option><option value="mobile_money">Mobile Money</option><option value="bank_transfer">Virement</option><option value="other">Autre</option></select></label><label>RÃ©fÃ©rence du reÃ§u<input value={paymentForm.reference} onChange={event => setPaymentForm({ ...paymentForm, reference: event.target.value })} required minLength={3} maxLength={100} /></label><label>Date du rÃ¨glement<input type="date" value={paymentForm.paidAt} onChange={event => setPaymentForm({ ...paymentForm, paidAt: event.target.value })} /></label><label>Plan de frais<select value={paymentForm.feePlanId} onChange={event => setPaymentForm({ ...paymentForm, feePlanId: event.target.value })}><option value="">Sans plan associÃ©</option>{data.feePlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label><button className="button button--primary" disabled={busy === "payment" || !studentId}>{busy === "payment" ? "Enregistrementâ€¦" : "Enregistrer en attente"}</button></form></section></div>
    <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">CONTRÃ”LE DES RÃˆGLEMENTS</span><h2>Paiements Ã  valider</h2></div></div>{data.pendingPayments.length ? <div className="finance-review-list">{data.pendingPayments.map(payment => <article key={payment.id}><div><strong>{payment.student.user.name ?? "Ã‰tudiant"} Â· {payment.student.matricule ?? "Matricule Ã  attribuer"}</strong><span>{money(payment.amount)} Â· {methodLabels[payment.method] ?? payment.method}</span><small>RÃ©fÃ©rence {payment.reference} Â· {new Date(payment.createdAt).toLocaleDateString("fr-FR")}</small></div><button className="button button--primary" onClick={() => validatePayment(payment.id)} disabled={busy === `validate-${payment.id}`}>{busy === `validate-${payment.id}` ? "Validationâ€¦" : "Valider le paiement"} <Check size={15} /></button></article>)}</div> : <p className="academic-empty">Aucun paiement ne reste Ã  valider.</p>}</section>
    <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">SITUATION DES DOSSIERS</span><h2>Ã‰chÃ©ances et relances</h2></div></div>{data.students.length ? <div className="table-scroll"><table className="tariff-table"><thead><tr><th>Ã‰tudiant</th><th>FiliÃ¨re / niveau</th><th>Solde</th><th>Ã‰chÃ©ance</th><th>Montant</th><th>Action</th></tr></thead><tbody>{data.students.flatMap(student => student.debts.filter(debt => !debt.isSettled).map(debt => <tr key={debt.id}><td>{student.user.name ?? student.user.email}<small>{student.matricule ?? "Matricule Ã  attribuer"}</small></td><td>{student.programCode} Â· L{student.level}</td><td>{money(student.financialStatus?.balanceDue)}</td><td>{debt.dueAt ? new Date(debt.dueAt).toLocaleDateString("fr-FR") : "Ã€ dÃ©finir"}</td><td>{money(debt.amountDue)}</td><td><button className="text-button" onClick={() => remind(debt.id)} disabled={busy === `reminder-${debt.id}`}>{busy === `reminder-${debt.id}` ? "Envoiâ€¦" : "Envoyer une relance"} <Send size={13} /></button></td></tr>))}</tbody></table></div> : <p className="academic-empty">Aucun dossier financier nâ€™est encore enregistrÃ©.</p>}</section>
  </div></div>;
}

