import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowRight, Heart, MessageSquareQuote, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

type Testimonial = {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
};

export default function TestimonialsPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [showAuthorName, setShowAuthorName] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/community/testimonials", { cache: "no-store", credentials: "same-origin" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Impossible de charger les témoignages.");
      setItems(result.testimonials ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger les témoignages.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch("/api/community/testimonials", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, showAuthorName }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Votre témoignage n’a pas pu être envoyé.");
      setBody("");
      setShowAuthorName(false);
      setNotice(result.message);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Votre témoignage n’a pas pu être envoyé.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLike = async (item: Testimonial) => {
    if (!user) {
      window.location.assign("/auth");
      return;
    }
    if (!["student", "teacher"].includes(user.role)) {
      setNotice("Les mentions J’aime sont réservées aux comptes étudiants et enseignants.");
      return;
    }
    const liked = !item.likedByMe;
    setItems(current => current.map(entry => entry.id === item.id
      ? { ...entry, likedByMe: liked, likeCount: Math.max(0, entry.likeCount + (liked ? 1 : -1)) }
      : entry));
    try {
      const response = await fetch(`/api/community/testimonials/${encodeURIComponent(item.id)}/like`, {
        method: liked ? "PUT" : "DELETE",
        credentials: "same-origin",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Impossible de mettre à jour le J’aime.");
      setItems(current => current.map(entry => entry.id === item.id
        ? { ...entry, likedByMe: result.likedByMe, likeCount: result.likeCount }
        : entry));
    } catch (cause) {
      await refresh();
      setNotice(cause instanceof Error ? cause.message : "Impossible de mettre à jour le J’aime.");
    }
  };

  const canWrite = user?.role === "student";

  return (
    <div className="community-page">
      <section className="community-hero">
        <div className="container community-hero-inner">
          <span className="eyebrow eyebrow--light"><i /> LA COMMUNAUTÉ HEMIP</span>
          <h1>Chaque parcours<br /><em>raconte quelque chose.</em></h1>
          <p>Un espace pour partager votre vécu à HEMIP, avec vos mots et à votre rythme.</p>
          <a className="button button--white" href="#partager">Partager mon expérience <ArrowRight size={15} /></a>
          <span className="community-hero-mark"><MessageSquareQuote size={29} /></span>
        </div>
      </section>

      <div className="container community-layout">
        <section className="community-compose" id="partager">
          <div className="community-section-title">
            <span className="eyebrow"><i /> VOTRE EXPÉRIENCE</span>
            <h2>Racontez votre histoire.</h2>
            <p>Ce que vous avez appris, une rencontre, un défi ou un moment marquant : votre témoignage peut aider d’autres étudiants à se projeter.</p>
          </div>

          {authLoading ? <div className="community-notice" role="status">Vérification de votre espace…</div> : canWrite ? (
            <form className="community-form" onSubmit={submit}>
              <label htmlFor="testimonial-body">Votre témoignage</label>
              <textarea id="testimonial-body" value={body} onChange={event => setBody(event.target.value)} minLength={20} maxLength={3000} rows={7} placeholder="Écrivez votre expérience ici…" required />
            <div className="community-form-meta"><span>Votre texte sera publié dès son envoi.</span><span>{body.length} / 3 000</span></div>
              <label className="community-consent"><input type="checkbox" checked={showAuthorName} onChange={event => setShowAuthorName(event.target.checked)} /><span>J’autorise l’affichage de mon nom tel qu’il figure dans mon compte HEMIP.</span></label>
              <button className="button button--primary" type="submit" disabled={submitting || body.trim().length < 20}>{submitting ? "Envoi…" : "Envoyer mon témoignage"} <ArrowRight size={15} /></button>
              {notice && <p className="community-notice" role="status">{notice}</p>}
            </form>
          ) : user ? (
            <div className="community-signin"><ShieldCheck size={20} /><div><strong>Le partage est ouvert aux étudiants.</strong><p>Vous pouvez lire les témoignages et aimer ceux qui vous parlent.</p></div></div>
          ) : (
            <div className="community-signin"><ShieldCheck size={20} /><div><strong>Connectez-vous avec votre compte étudiant pour écrire.</strong><p>Les témoignages sont liés à un compte HEMIP vérifié.</p><Link href="/auth">Accéder à mon espace <ArrowRight size={14} /></Link></div></div>
          )}
          {!canWrite && !authLoading && user && notice && <p className="community-notice" role="status">{notice}</p>}
        </section>

        <section className="community-stories" aria-labelledby="testimonials-heading">
          <div className="community-list-heading"><div><span className="eyebrow"><i /> PAROLES D’ÉTUDIANTS</span><h2 id="testimonials-heading">Leurs témoignages</h2></div><span className="community-count">{items.length}</span></div>
          {loading ? <p className="community-empty" role="status">Chargement des témoignages…</p> : error ? <div className="community-empty community-error" role="alert">{error}<button className="text-button" onClick={() => void refresh()}>Réessayer</button></div> : items.length === 0 ? (
            <div className="community-empty"><Sparkles size={21} /><strong>Aucun témoignage publié pour le moment.</strong><p>Quand les premiers témoignages auront été partagés et validés, ils apparaîtront ici.</p></div>
          ) : (
            <div className="community-testimonial-list">
              {items.map(item => (
                <article className="community-testimonial" key={item.id}>
                  <div className="community-quote-mark">“</div>
                  <p className="community-testimonial-body">{item.body}</p>
                  <div className="community-testimonial-footer"><div><strong>{item.authorName ?? "Anonyme"}</strong><time dateTime={item.createdAt}>{new Intl.DateTimeFormat("fr-CG", { dateStyle: "medium" }).format(new Date(item.createdAt))}</time></div><button className={`community-like ${item.likedByMe ? "community-like--active" : ""}`} type="button" onClick={() => void toggleLike(item)} aria-pressed={item.likedByMe} aria-label={item.likedByMe ? "Retirer mon J’aime" : "Aimer ce témoignage"} disabled={Boolean(user && !["student", "teacher"].includes(user.role))}><Heart size={17} fill={item.likedByMe ? "currentColor" : "none"} /><span>{item.likeCount}</span></button></div>
                </article>
              ))}
            </div>
          )}
          <div className="community-moderation-note"><ShieldCheck size={16} /><span>Chaque témoignage est publié dès son envoi. Votre nom reste masqué sans votre accord explicite.</span></div>
        </section>
      </div>
    </div>
  );
}
