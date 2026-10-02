import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, BellRing, Check, ShieldCheck } from "lucide-react";

export default function AdminAnnouncementsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, audience, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "L’annonce n’a pas pu être publiée.");
      setTitle("");
      setBody("");
      setExpiresAt("");
      const push = result.push;
      if (!push.configured) {
        setMessage("L’annonce est publiée. Les notifications push sont en attente de configuration.");
      } else if (push.delivered === 0) {
        setMessage("L’annonce est publiée. Aucun appareil abonné correspondant n’a reçu de notification.");
      } else {
        setMessage(`L’annonce est publiée. ${push.delivered} notification(s) envoyée(s).`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L’annonce n’a pas pu être publiée.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page community-admin-page">
      <div className="container">
        <Link className="community-back-link" href="/annonces"><ArrowLeft size={15} /> Retour aux annonces</Link>
        <div className="admin-heading"><div><span className="eyebrow"><i /> COMMUNICATION HEMIP</span><h1>Publier une <em>annonce.</em></h1><p>L’annonce devient visible immédiatement pour le public choisi. Les personnes abonnées recevront une notification sur leurs appareils.</p></div><span className="admin-badge"><BellRing size={14} /> PUBLICATION</span></div>
        <div className="community-admin-grid">
          <form className="community-admin-form" onSubmit={submit}>
            <label htmlFor="announcement-title">Titre de l’annonce</label>
            <input id="announcement-title" value={title} onChange={event => setTitle(event.target.value)} minLength={4} maxLength={140} required placeholder="Un titre clair pour votre information" />
            <div className="community-field-meta"><span>Visible sur la page des annonces</span><span>{title.length} / 140</span></div>
            <label htmlFor="announcement-body">Information à communiquer</label>
            <textarea id="announcement-body" value={body} onChange={event => setBody(event.target.value)} minLength={8} maxLength={4000} rows={8} required placeholder="Rédigez le contenu de l’annonce…" />
            <label htmlFor="announcement-audience">Destinataires</label>
            <select id="announcement-audience" value={audience} onChange={event => setAudience(event.target.value)}>
              <option value="all">Étudiants et enseignants</option>
              <option value="student">Étudiants</option>
              <option value="teacher">Enseignants</option>
            </select>
            <label htmlFor="announcement-expiry">Date d’expiration (facultatif)</label>
            <input id="announcement-expiry" type="datetime-local" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} />
            <div className="community-publish-note"><ShieldCheck size={17} /><span>La publication est journalisée avec votre compte. Le message push ne révèle pas le contenu complet sur un écran verrouillé.</span></div>
            {message && <p className="community-notice" role="status"><Check size={16} /> {message}</p>}
            {error && <p className="community-notice community-error" role="alert">{error}</p>}
            <button className="button button--primary" type="submit" disabled={busy}>{busy ? "Publication…" : "Publier l’annonce"} <ArrowRight size={15} /></button>
          </form>
          <aside className="community-admin-aside"><span className="community-admin-aside-icon"><BellRing size={20} /></span><span className="eyebrow"><i /> NOTIFICATION PUSH</span><h2>Une information, au bon endroit.</h2><p>Les notifications partent uniquement vers les étudiants ou enseignants qui se sont abonnés sur cet appareil et dont le profil correspond à la cible.</p><Link className="text-link" href="/annonces">Voir les annonces <ArrowRight size={14} /></Link></aside>
        </div>
      </div>
    </div>
  );
}
