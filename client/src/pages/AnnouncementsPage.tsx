import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Bell, BellOff, CalendarDays, ShieldCheck } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

type Announcement = { id: string; title: string; body: string; publishedAt: string; expiresAt: string | null };

function decodeVapidPublicKey(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + "=".repeat((4 - value.length % 4) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const key = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) key[index] = raw.charCodeAt(index);
  return key;
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pushConfigured, setPushConfigured] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/announcements", { credentials: "same-origin", cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Impossible de charger les annonces.");
      setAnnouncements(result.announcements ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger les annonces.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void fetch("/api/push/public-key", { cache: "no-store" }).then(response => {
      if (response.ok) setPushConfigured(true);
    }).catch(() => undefined);
    if ("serviceWorker" in navigator && "PushManager" in window) {
      void navigator.serviceWorker.ready.then(registration => registration.pushManager.getSubscription())
        .then(subscription => setSubscribed(Boolean(subscription))).catch(() => undefined);
    }
  }, [refresh]);

  const manageSubscription = async () => {
    setBusy(true);
    setNotice("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        throw new Error("Ce navigateur ne prend pas en charge les notifications push.");
      }
      const keyResponse = await fetch("/api/push/public-key", { cache: "no-store" });
      const keyPayload = await keyResponse.json();
      if (!keyResponse.ok) throw new Error(keyPayload.message ?? "Les notifications ne sont pas encore configurées.");

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        const response = await fetch("/api/push/subscriptions", {
          method: "DELETE",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        const result = response.status === 204 ? {} : await response.json();
        if (!response.ok) throw new Error(result.message ?? "Impossible de désactiver les notifications.");
        await existing.unsubscribe();
        setSubscribed(false);
        setNotice("Les notifications HEMIP sont désactivées sur cet appareil.");
        return;
      }

      let permission = Notification.permission;
      if (permission === "default") permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Autorisez les notifications HEMIP dans les réglages de votre navigateur pour les recevoir.");

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidPublicKey(keyPayload.publicKey),
      });
      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const result = response.status === 204 ? {} : await response.json();
      if (!response.ok) {
        await subscription.unsubscribe();
        throw new Error(result.message ?? "Impossible d’enregistrer votre abonnement.");
      }
      setSubscribed(true);
      setNotice("Cet appareil recevra les annonces HEMIP publiées pour votre profil.");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Impossible de modifier les notifications.");
    } finally {
      setBusy(false);
    }
  };

  const canPublish = user && ["academic_admin", "super_admin"].includes(user.role);
  const canSubscribe = user && ["student", "teacher"].includes(user.role);

  return (
    <div className="community-page">
      <section className="community-hero community-hero--announcements">
        <div className="container community-hero-inner">
          <span className="eyebrow eyebrow--light"><i /> VIE DE L’ÉTABLISSEMENT</span>
          <h1>Les nouvelles<br /><em>de HEMIP.</em></h1>
          <p>Les annonces qui vous concernent, publiées par l’équipe HEMIP.</p>
        </div>
      </section>
      <div className="container announcements-layout">
        <section className="push-preferences">
          <div className="push-preferences-icon"><Bell size={21} /></div>
          <div className="push-preferences-copy"><span className="eyebrow"><i /> RESTER INFORMÉ·E</span><h2>Recevoir les annonces</h2><p>Autorisez les notifications sur cet appareil pour être averti·e lorsqu’une annonce destinée à votre profil est publiée.</p>
            {!pushConfigured && <small>Le service de notifications est en attente de configuration par HEMIP.</small>}
            {notice && <p className="community-notice" role="status">{notice}</p>}
          </div>
          {pushConfigured && canSubscribe && <button type="button" className="button button--outline" onClick={() => void manageSubscription()} disabled={busy}>{busy ? "Mise à jour…" : subscribed ? <><BellOff size={15} /> Désactiver</> : <><Bell size={15} /> Activer sur cet appareil</>}</button>}
        </section>

        {canPublish && <div className="announcement-publisher-link"><span>Une information à partager ?</span><Link className="text-link" href="/admin/announcements">Publier une annonce <ArrowRight size={14} /></Link></div>}

        <section className="announcements-list" aria-labelledby="announcements-heading">
          <div className="community-list-heading"><div><span className="eyebrow"><i /> INFORMATIONS OFFICIELLES</span><h2 id="announcements-heading">Annonces récentes</h2></div><ShieldCheck size={20} /></div>
          {loading ? <p className="community-empty" role="status">Chargement des annonces…</p> : error ? <div className="community-empty community-error" role="alert">{error}<button className="text-button" onClick={() => void refresh()}>Réessayer</button></div> : announcements.length === 0 ? (
            <div className="community-empty"><Bell size={21} /><strong>Aucune annonce pour le moment.</strong><p>Les annonces publiées pour les étudiants ou les enseignants apparaîtront ici.</p></div>
          ) : (
            <div className="announcement-list-items">
              {announcements.map(announcement => (
                <article className="announcement-card" key={announcement.id}>
                  <span className="eyebrow"><CalendarDays size={14} /> {new Intl.DateTimeFormat("fr-CG", { dateStyle: "long" }).format(new Date(announcement.publishedAt))}</span>
                  <h3>{announcement.title}</h3>
                  <p>{announcement.body}</p>
                  {announcement.expiresAt && <small>Jusqu’au {new Intl.DateTimeFormat("fr-CG", { dateStyle: "long" }).format(new Date(announcement.expiresAt))}</small>}
                </article>
              ))}
            </div>
          )}
          <p className="announcement-audience-note">Connecté·e en tant que {user?.role === "teacher" ? "enseignant·e" : user?.role === "student" ? "étudiant·e" : "administrateur·rice"} · affichage réservé aux comptes HEMIP concernés.</p>
        </section>
      </div>
    </div>
  );
}
