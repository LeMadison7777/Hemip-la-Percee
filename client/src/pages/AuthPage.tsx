import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, CheckCircle2, Eye, EyeOff, GraduationCap, ShieldCheck } from "lucide-react";

type ProgramOption = { code: string; label: string };
type AuthUser = { role: string; registrationStatus: string; registrationProfile: string | null };

function destination(user: AuthUser): string {
  if (user.registrationStatus === "PENDING_APPROVAL") return "/account/pending";
  if (user.role === "visitor" && !user.registrationProfile) return "/account/complete";
  if (user.role === "student") return "/student/dashboard";
  if (user.role === "teacher") return "/teacher/dashboard";
  if (user.role === "academic_admin") return "/admin/schedule";
  if (user.role === "evaluation_manager") return "/admin/evaluations";
  if (user.role === "payment_manager") return "/admin/payments";
  if (user.role === "super_admin") return "/super-admin/accounts";
  return "/";
}

async function finishAuth(providerId: string, credentials: Record<string, string>): Promise<AuthUser> {
  const csrfResponse = await fetch("/auth/csrf", { credentials: "same-origin", cache: "no-store" });
  if (!csrfResponse.ok) throw new Error("La vérification de sécurité a échoué.");
  const { csrfToken } = await csrfResponse.json() as { csrfToken: string };
  await fetch("/auth/callback/" + providerId, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, ...credentials, callbackUrl: "/auth" }).toString(),
    redirect: "follow",
  });
  const response = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("Code invalide, expiré ou déjà utilisé. Vérifiez-le ou demandez un nouveau code.");
  const payload = await response.json() as { user?: AuthUser };
  if (!payload.user) throw new Error("La session n’a pas pu être ouverte.");
  return payload.user;
}

export default function AuthPage({ initialMode = "signin" }: { initialMode?: "signin" | "signup" }) {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [method, setMethod] = useState<"password" | "otp">("password");
  const [phase, setPhase] = useState<"form" | "code">("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [profile, setProfile] = useState("student");
  const [programCode, setProgramCode] = useState("");
  const [level, setLevel] = useState("1");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/auth/providers", { cache: "no-store" }).then(response => response.ok ? response.json() : null),
      fetch("/api/auth/registration-options", { cache: "no-store" }).then(response => response.ok ? response.json() : null),
      fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" }).then(response => response.ok ? response.json() : null),
    ]).then(([providerData, options, session]) => {
      if (!active) return;
      setGoogleEnabled(Boolean(providerData?.googleEnabled));
      const available = (options?.programs ?? []) as ProgramOption[];
      setPrograms(available);
      if (available[0]) setProgramCode(current => current || available[0]!.code);
      if (session?.user) setLocation(destination(session.user as AuthUser));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [setLocation]);

  const requestCode = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    if (mode === "signin" && method === "password") {
      try {
        const user = await finishAuth("hemip-password", { email, password });
        setLocation(destination(user));
      } catch {
        setMessage("Adresse e-mail ou mot de passe invalide, ou service momentanément indisponible.");
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/otp/request";
      const body = mode === "signup"
        ? { firstName, lastName, email, password, profile, programCode, level: Number(level) }
        : { email };
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message ?? "Impossible de demander le code.");
      setChallengeId(String(result.challengeId ?? ""));
      setPhase("code");
      setCode("");
      if (mode === "signin") setPassword("");
      setMessage(result.message ?? "Vérifiez votre boîte e-mail.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Le service de connexion est momentanément indisponible.");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setMessage("Saisissez les 6 chiffres reçus par e-mail.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const user = await finishAuth(mode === "signup" ? "hemip-signup-otp" : "hemip-otp", { email, challengeId, code });
      setLocation(destination(user));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Le code n’a pas pu être vérifié.");
    } finally {
      setBusy(false);
    }
  };

  const resetCode = () => {
    setPhase("form");
    setChallengeId("");
    setCode("");
    setMessage("");
  };

  return <div className="auth-page"><div className="container auth-grid">
    <div className="auth-intro">
      <span className="eyebrow eyebrow--light"><i /> ESPACE HEMIP</span>
      <h1>Un espace pour<br />avancer avec <em>vous.</em></h1>
      <p>Votre inscription, votre scolarité et vos informations dans un seul espace.</p>
      <div className="auth-trust"><ShieldCheck size={18} /><span>Authentification protégée<br /><small>Mot de passe ou code e-mail temporaire</small></span></div>
      <span className="auth-watermark">H</span>
    </div>
    <div className="auth-card">
      <Link href="/" className="auth-home-link">HEMIP · LA PERCÉE</Link>
      <div className="auth-mode-tabs" role="tablist" aria-label="Connexion ou inscription">
        <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); resetCode(); setMessage(""); setShowPassword(false); }}>Connexion</button>
        <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); resetCode(); setMessage(""); setShowPassword(false); }}>Créer un compte</button>
      </div>
      <span className="eyebrow">{mode === "signup" ? "INSCRIPTION HEMIP" : "CONNEXION À VOTRE ESPACE"}</span>
      <h2>{phase === "code" ? "Vérifiez votre e-mail" : mode === "signup" ? "Bienvenue à HEMIP." : "Ravi de vous revoir."}</h2>
      <p>{phase === "code" ? "Un code à 6 chiffres a été demandé pour " + email + "." : mode === "signup" ? "Créez votre accès personnel à la plateforme." : method === "password" ? "Connectez-vous avec votre adresse e-mail et votre mot de passe." : "Recevez un code temporaire par e-mail pour vous connecter sans mot de passe."}</p>

      {phase === "form" && mode === "signin" && <>
        <div className="auth-method-tabs">
          <button type="button" className={method === "password" ? "active" : ""} onClick={() => { setMethod("password"); setMessage(""); setShowPassword(false); }}>E-mail et mot de passe</button>
          <button type="button" className={method === "otp" ? "active" : ""} onClick={() => { setMethod("otp"); setMessage(""); setShowPassword(false); }}>Code e-mail seul</button>
        </div>
        {googleEnabled && <a className="auth-google-button" href="/auth/signin/google?callbackUrl=%2Fauth"><span>G</span> Se connecter avec Google</a>}
      </>}

      {phase === "form" ? <form onSubmit={requestCode} className="auth-form">
        {mode === "signup" && <>
          <div className="auth-form-grid">
            <label>Prénom<input value={firstName} onChange={event => setFirstName(event.target.value)} autoComplete="given-name" minLength={2} maxLength={80} required disabled={busy} /></label>
            <label>Nom<input value={lastName} onChange={event => setLastName(event.target.value)} autoComplete="family-name" minLength={2} maxLength={80} required disabled={busy} /></label>
          </div>
          <label>Profil<select value={profile} onChange={event => setProfile(event.target.value)} disabled={busy}>
            <option value="student">Étudiant</option><option value="teacher">Enseignant</option><option value="administrative">Personnel administratif</option>
          </select></label>
          {profile === "student" && <div className="auth-form-grid">
            <label>Filière<select value={programCode} onChange={event => setProgramCode(event.target.value)} required disabled={busy || programs.length === 0}>
              {programs.length ? programs.map(program => <option key={program.code} value={program.code}>{program.label}</option>) : <option value="">Catalogue non configuré</option>}
            </select></label>
            <label>Niveau<select value={level} onChange={event => setLevel(event.target.value)} required disabled={busy}>
              <option value="1">L1</option><option value="2">L2</option><option value="3">L3</option>
            </select></label>
          </div>}
          {profile === "student" && programs.length === 0 && <small className="auth-hint">Le catalogue des filières doit être configuré par l’administration avant l’inscription.</small>}
        </>}
        <label>Adresse e-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder="prenom@hemip.cg" required disabled={busy} /></label>
        {(mode === "signup" || method === "password") && <div className="auth-password-group"><label htmlFor="auth-password">Mot de passe</label><span className="password-field"><input id="auth-password" type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} maxLength={256} required disabled={busy} /><button className="password-visibility" type="button" onClick={() => setShowPassword(visible => !visible)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-controls="auth-password" aria-pressed={showPassword}>{showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button></span><small className="auth-hint">8 caractères minimum.</small></div>}
        {mode === "signup" && profile !== "student" && <div className="auth-hint auth-pending-note"><ShieldCheck size={16} /> Le compte sera activé après confirmation de l’e-mail, puis soumis à l’approbation du Super Admin.</div>}
        <button className="button button--primary button--full" type="submit" disabled={busy || (mode === "signup" && profile === "student" && programs.length === 0)}>{busy ? mode === "signup" || method === "otp" ? "Envoi…" : "Connexion…" : mode === "signup" ? "Créer mon compte" : method === "password" ? "Se connecter" : "Recevoir mon code"} <ArrowRight size={16} /></button>
      </form> : <form onSubmit={verifyCode} className="auth-form">
        <label>Code à 6 chiffres<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required disabled={busy} /></label>
        <small className="auth-hint">Le code expire après trois minutes et ne peut être utilisé qu’une seule fois.</small>
        <button className="button button--primary button--full" type="submit" disabled={busy || code.length !== 6}>{busy ? "Vérification…" : "Confirmer et continuer"} <ArrowRight size={16} /></button>
        <div className="auth-actions-row"><button type="button" className="text-button" onClick={resetCode} disabled={busy}>Modifier mes informations</button><button type="button" className="text-button" onClick={event => void requestCode(event as unknown as FormEvent)} disabled={busy}>Renvoyer le code</button></div>
      </form>}

      {message && <div className="inline-message" role="status" aria-live="polite"><CheckCircle2 size={16} /><span>{message}</span></div>}
      <span className="auth-privacy">En continuant, vous reconnaissez les <Link href="/terms#cgu">GCU / CGU</Link>, la <Link href="/terms#rgpd">politique de confidentialité</Link> et la <Link href="/terms#usage">politique d’utilisation</Link>.</span>
    </div>
  </div></div>;
}

export function AccountCompletePage() {
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState("student");
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programCode, setProgramCode] = useState("");
  const [level, setLevel] = useState("1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/auth/registration-options", { cache: "no-store" }).then(response => response.ok ? response.json() : null),
      fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" }).then(response => response.ok ? response.json() : null),
    ]).then(([options, session]) => {
      if (!active) return;
      if (!session?.user) { setLocation("/auth"); return; }
      if (session.user.registrationStatus === "PENDING_APPROVAL") { setLocation("/account/pending"); return; }
      if (session.user.role !== "visitor" || session.user.registrationProfile) { setLocation(destination(session.user)); return; }
      const nextPrograms = (options?.programs ?? []) as ProgramOption[];
      setPrograms(nextPrograms);
      if (nextPrograms[0]) setProgramCode(nextPrograms[0]!.code);
    }).catch(() => setMessage("Le service d’inscription est momentanément indisponible."));
    return () => { active = false; };
  }, [setLocation]);
  const complete = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/complete-registration", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, programCode, level: Number(level) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message ?? "Le profil n’a pas pu être enregistré.");
      const session = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" }).then(item => item.json());
      setLocation(destination(session.user as AuthUser));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Le profil n’a pas pu être enregistré.");
    } finally {
      setBusy(false);
    }
  };
  return <div className="page-wrap"><div className="container account-onboarding"><div className="admin-panel"><span className="eyebrow">FINALISER LE PROFIL</span><h1>Quel est votre espace HEMIP ?</h1><p>Votre connexion Google a confirmé votre adresse. Choisissez le profil correspondant à votre situation.</p><form className="auth-form" onSubmit={complete}>
    <label>Profil<select value={profile} onChange={event => setProfile(event.target.value)}><option value="student">Étudiant</option><option value="teacher">Enseignant</option><option value="administrative">Personnel administratif</option></select></label>
    {profile === "student" && <div className="auth-form-grid"><label>Filière<select value={programCode} onChange={event => setProgramCode(event.target.value)} required disabled={!programs.length}>{programs.map(program => <option key={program.code} value={program.code}>{program.label}</option>)}</select></label><label>Niveau<select value={level} onChange={event => setLevel(event.target.value)}><option value="1">L1</option><option value="2">L2</option><option value="3">L3</option></select></label></div>}
    {profile !== "student" && <p className="auth-pending-note"><ShieldCheck size={16} /> Le Super Admin doit approuver les comptes du personnel avant l’accès aux outils internes.</p>}
    <button className="button button--primary" disabled={busy || (profile === "student" && !programs.length)}>{busy ? "Enregistrement…" : "Enregistrer mon profil"} <ArrowRight size={16} /></button>
  </form>{message && <div className="inline-message" role="alert">{message}</div>}</div></div></div>;
}

export function PendingApprovalPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(async response => response.ok ? response.json() : null)
      .then(result => {
        if (!result?.user) { setLocation("/auth"); return; }
        if (result.user.registrationStatus !== "PENDING_APPROVAL") { setLocation(destination(result.user)); return; }
        setEmail(String(result.user.email ?? ""));
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
  }, [setLocation]);
  return <div className="page-wrap"><div className="container account-onboarding"><div className="admin-panel approval-waiting"><span className="approval-waiting-icon"><ShieldCheck size={24} /></span><span className="eyebrow">DEMANDE TRANSMISE</span><h1>Votre compte attend l’approbation.</h1><p>{loading ? "Vérification de votre compte…" : "Un Super Admin vérifiera votre demande de compte du personnel avant d’activer l’accès."}</p>{email && <strong>{email}</strong>}<Link className="button button--outline" href="/">Retour à l’accueil <GraduationCap size={16} /></Link></div></div></div>;
}

