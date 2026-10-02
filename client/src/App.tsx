import { useEffect, useMemo, useState, type FormEvent, type PointerEvent, type ReactNode } from "react";
import { media, mediaSource } from "./data/media";
import CampusVideos from "./components/CampusVideos";
import { Magnetic } from "./components/core/magnetic";
import { TextEffect } from "./components/core/text-effect";
import TestimonialsPage from "./pages/TestimonialsPage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import AdminAnnouncementsPage from "./pages/AdminAnnouncementsPage";
import AuthExperience, { AccountCompletePage, PendingApprovalPage } from "./pages/AuthPage";
import StudentDashboard from "./pages/StudentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import SecretaryDashboard from "./pages/SecretaryDashboard";
import EvaluationDashboard from "./pages/EvaluationDashboard";
import FinanceDashboard from "./pages/FinanceDashboard";
import SuperAdminAccountsPage from "./pages/SuperAdminAccountsPage";
import { AboutPage, ResearchPage } from "./pages/InstitutionPages";
import { Link, Redirect, Route, Switch, useLocation } from "wouter";
import {
  ArrowDown, ArrowRight, ArrowUpRight, BadgeCheck, BookOpen, CalendarDays,
  Camera, Check, ChevronDown, CircleHelp, ClipboardCheck, Clock3, FileText,
  GraduationCap, HardHat, Laptop, Mail, MapPin, Menu, MessageCircle, Phone,
  Play, Search, ShieldCheck, Sparkles, Wrench, X,
} from "lucide-react";

const contacts = {
  phoneOne: "+242 06 914 92 42",
  phoneTwo: "+242 05 356 06 72",
  whatsapp: "+242 05 586 50 94",
  email: "hemilaperceeinformation@gmail.com",
  location: "Centre-ville de Pointe-Noire, derrière la Tour Mayombe, à côté de la Clinique Netcare",
};
const whatsappNumber = contacts.whatsapp.replace(/\D/g, "");
const whatsappUrl = (message?: string) => `https://wa.me/${whatsappNumber}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
const links = [
  ["Accueil", "/"], ["À propos", "/a-propos"], ["Formations", "/formations"], ["Admissions", "/admissions"],
  ["Tarifs", "/tarifs"], ["Vie de campus", "/album"], ["Témoignages", "/temoignages"], ["Annonces", "/annonces"], ["FAQ", "/faq"], ["Contact", "/contact"],
] as const;

const formations = [
  {
    name: "Technologie & industrie",
    award: "Technicien supérieur",
    schedule: "Système LMD · vacations de jour et du soir",
    courses: [
      { code: "GL", name: "Génie logiciel" },
      { code: "MI", name: "Maintenance industrielle" },
      { code: "AII", name: "Automatisation et informatique industrielle" },
      { code: "EE", name: "Électrotechnique et électronique" },
      { code: "RT", name: "Réseaux et télécommunication" },
      { code: "GP", name: "Génie pétrolier" },
      { code: "RP", name: "Raffinage et pétrochimie" },
      { code: "GC", name: "Génie chimique" },
      { code: "ENR", name: "Énergies renouvelables" },
    ],
    icon: Wrench,
    className: "program-card--red",
    detail: "Des parcours tournés vers la pratique, les systèmes industriels, l’énergie et les technologies.",
  },
  {
    name: "Gestion et administration",
    award: "Licence professionnelle",
    schedule: "Système LMD",
    courses: [
      { code: "GRH", name: "Management des ressources humaines" },
      { code: "DAE", name: "Droit des affaires et des entreprises" },
      { code: "GFC", name: "Gestion financière et comptable" },
      { code: "LT", name: "Logistique et transport" },
      { code: "CIT", name: "Commerce international et transit" },
      { code: "BAF", name: "Banque, finance et assurances" },
    ],
    icon: BookOpen,
    className: "program-card--blue",
    detail: "Des compétences professionnelles en gestion, droit, finance, commerce et logistique.",
  },
];
const formationCount = formations.reduce((total, formation) => total + formation.courses.length, 0);

const feeRows = [
  ["Gestion / Commerce", "400 000", "450 000", "550 000"],
  ["Droit des Affaires", "500 000", "550 000", "600 000"],
  ["Technologie / Industrie", "500 000", "550 500", "650 000"],
];

const faqs = [
  { q: "Quelles sont les conditions pour s’inscrire ?", a: "La formation s’adresse aux titulaires du baccalauréat. Le dossier comprend notamment une copie légalisée du Bac, un extrait d’acte de naissance, deux photos, un certificat médical et une attestation d’assurance." },
  { q: "Où déposer mon dossier ?", a: "Au bureau de la scolarité, au centre-ville de Pointe-Noire, derrière la Tour Mayombe, à côté de la Clinique Netcare. Les horaires d’accueil sont à confirmer auprès de l’administration." },
  { q: "Quel est le montant des frais d’inscription ?", a: "Les frais d’inscription sont de 50 000 FCFA. Les frais de réinscription sont de 45 000 FCFA et les frais d’examen s’élèvent à 30 000 FCFA par an." },
  { q: "Peut-on régler l’écolage en plusieurs fois ?", a: "Un échéancier de paiement sur 9 à 10 mois est prévu. Les règlements sont effectués en espèces avant le 5 du mois, selon les modalités validées par la scolarité." },
  { q: "Un ordinateur est-il nécessaire ?", a: "Un ordinateur est obligatoire pour les filières industrielles et technologiques. Les étudiants concernés doivent également prévoir les équipements de protection requis par leur filière." },
  { q: "Comment consulter mes résultats ?", a: "Les résultats sont publiés dans l’espace étudiant après validation académique et lorsque le quitus financier est accordé. Une dérogation peut être enregistrée par la gestionnaire." },
  { q: "Quels sont les partenaires académiques ?", a: "Les partenaires indiqués par l’établissement sont ENGDE (France), HESTIM (Maroc), I.S.T.A. (RDC) et IPSAS (Tunisie)." },
  { q: "HEMIP propose-t-elle des formations après la licence ?", a: "La présentation indique un Master professionnel de 15 mois en partenariat avec ENSI, au Maroc, ainsi que des formations modulaires certifiées de courte durée." },
  { q: "Quels projets de recherche mène HEMIP ?", a: "Les domaines présentés comprennent les énergies et hydrocarbures, les mines et la minéralurgie, le génie industriel et la consultance. Des projets illustrent notamment le biodiesel, le recyclage des plastiques, le traitement de l’eau et les matériaux écologiques." },
];

const faqsForSearch = (query: string) => faqs.filter((item) => `${item.q} ${item.a}`.toLowerCase().includes(query.toLowerCase()));

function Brand({ small = false }: { small?: boolean }) {
  // make sure to consider if you need authentication for certain routes
  return (
    <Link href="/" className={`brand ${small ? "brand--small" : ""}`} aria-label="HEMIP — accueil">
      <img className="brand-logo" src="/icons/pwa-icon-192.png" alt="Logo HEMIP — La Percée en médaillon circulaire" />
      <span className="brand-word"><strong>HEMIP</strong><small>La Percée</small></span>
    </Link>
  );
}

function Header() {
  const [path] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);
  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      setInstallPrompt(null);
      return;
    }
    const userAgent = navigator.userAgent;
    const isAppleTouchDevice = /iPhone|iPad|iPod/i.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isFirefoxDesktop = /Firefox/i.test(userAgent) && !/Android/i.test(userAgent);
    const isSafariDesktop = /Safari/i.test(userAgent) && !/Chrome|Chromium|CriOS|Edg|OPR/i.test(userAgent) && !isAppleTouchDevice;
    if (isAppleTouchDevice) {
      window.alert("Sur iPhone ou iPad, ouvrez le menu Partager puis choisissez « Sur l’écran d’accueil ». Si l’option n’apparaît pas, ouvrez HEMIP dans Safari.");
    } else if (isFirefoxDesktop) {
      window.alert("Firefox sur ordinateur ne propose pas l’installation des PWA depuis leur manifeste. HEMIP reste utilisable dans Firefox ; pour l’installer, ouvrez le site dans Chrome ou Edge.");
    } else if (isSafariDesktop) {
      window.alert("Sur macOS Sonoma avec Safari 17 ou plus récent, utilisez le menu Fichier puis « Ajouter au Dock » si cette option est disponible.");
    } else {
      window.alert("Ouvrez le menu du navigateur et choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil » si cette option est disponible. Selon le navigateur et l’appareil, HEMIP s’ouvrira comme une application ou comme un raccourci.");
    }
  };
  return (
    <>
      <div className="topline"><div className="container topline-inner"><span><MapPin size={13} /> Pointe-Noire, Congo</span><a href={`tel:${contacts.phoneOne.replaceAll(" ", "")}`}><Phone size={13} /> {contacts.phoneOne}</a><span className="topline-note">Votre avenir prend forme ici.</span></div></div>
      <header className="site-header">
        <div className="container nav-shell">
          <Brand />
          <nav className={`main-nav ${menuOpen ? "main-nav--open" : ""}`} aria-label="Navigation principale">
            {links.map(([label, href]) => <Link key={href} href={href} className={path === href ? "nav-link nav-link--active" : "nav-link"} onClick={() => setMenuOpen(false)}>{label}</Link>)}
            <Link href="/auth" className="mobile-auth" onClick={() => setMenuOpen(false)}>Espace étudiant <ArrowUpRight size={15} /></Link>
          </nav>
          <div className="nav-actions">
            <button className="install-button" onClick={install} aria-label="Installer la PWA"><ArrowDown size={15} /> Installer</button>
            <Link className="button button--primary button--nav" href="/auth">Mon espace <ArrowUpRight size={15} /></Link>
          </div>
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </header>
    </>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div className="footer-brand"><Brand /><p>Depuis 2013, HEMIP forme en ingénierie et en management à Pointe-Noire et à Nkayi.</p><span className="footer-local"><MapPin size={14} /> {contacts.location}</span></div>
        <div className="footer-column"><span className="eyebrow eyebrow--light">Explorer</span><Link href="/a-propos">À propos</Link><Link href="/formations">Nos formations</Link><Link href="/recherche">Recherche & projets</Link><Link href="/admissions">Admissions</Link><Link href="/tarifs">Frais de scolarité</Link><Link href="/album">Vie de campus</Link><Link href="/temoignages">Témoignages</Link><Link href="/annonces">Annonces</Link><Link href="/a-propos#equipe">Équipe pédagogique</Link></div>
        <div className="footer-column"><span className="eyebrow eyebrow--light">Ressources</span><Link href="/terms#cgu">GCU / CGU</Link><Link href="/terms#rgpd">RGPD & confidentialité</Link><Link href="/terms#usage">Politique d’utilisation</Link><Link href="/aide">Centre d’aide</Link></div>
        <div className="footer-column"><span className="eyebrow eyebrow--light">Nous joindre</span><a href={`tel:${contacts.phoneOne.replaceAll(" ", "")}`}>{contacts.phoneOne}</a><a href={`tel:${contacts.phoneTwo.replaceAll(" ", "")}`}>{contacts.phoneTwo}</a><a href={`mailto:${contacts.email}`}>{contacts.email}</a><a href={whatsappUrl()} target="_blank" rel="noreferrer">WhatsApp scolarité <ArrowUpRight size={13} /></a></div>
        <div className="footer-cta"><span className="footer-orbit"><GraduationCap size={25} /></span><span>Prêt·e à commencer ?</span><Link href="/admissions" className="footer-cta-link">Préparer mon dossier <ArrowRight size={15} /></Link></div>
      </div>
      <div className="container footer-bottom"><span>© {new Date().getFullYear()} HEMIP — La Percée</span><Link href="/terms">Documents & confidentialité</Link><Link href="/aide">Aide plateforme</Link><span>Conçu pour apprendre, partout.</span></div>
    </footer>
  );
}

function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  useEffect(() => { setVisible(localStorage.getItem("hemip-cookie-consent") === null); }, []);
  const save = (analyticsOk: boolean, marketingOk: boolean) => {
    const value = { necessary: true, analytics: analyticsOk, marketing: marketingOk, savedAt: new Date().toISOString() };
    localStorage.setItem("hemip-cookie-consent", JSON.stringify(value));
    document.cookie = `hemip-consent=${analyticsOk || marketingOk ? "optional" : "necessary"}; max-age=15552000; path=/; SameSite=Lax`;
    setVisible(false);
  };
  if (!visible) return null;
  return (
    <aside className="cookie-card" aria-label="Préférences de cookies">
      <div className="cookie-icon"><ShieldCheck size={20} /></div>
      <div className="cookie-copy"><strong>Votre confidentialité compte.</strong><p>Les cookies essentiels assurent le fonctionnement du site. Les cookies facultatifs restent désactivés sans votre accord. <Link href="/terms#cookies">En savoir plus</Link></p>{customize && <div className="cookie-options"><label><input type="checkbox" checked disabled /> Essentiels (toujours actifs)</label><label><input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} /> Mesure d’audience</label><label><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /> Contenus et médias intégrés</label></div>}</div>
      <div className="cookie-actions"><button className="cookie-accept" onClick={() => save(true, true)}>{customize ? "Enregistrer" : "Tout accepter"}</button><button className="cookie-reject" onClick={() => save(false, false)}>Tout refuser</button><button className="cookie-settings" onClick={() => setCustomize(!customize)}>{customize ? "Fermer" : "Personnaliser"}</button></div>
    </aside>
  );
}

function PageHeading({ kicker, title, description, hideKicker = false }: { kicker: string; title: ReactNode; description: string; hideKicker?: boolean }) {
  return <div className="page-heading">{!hideKicker && kicker && <span className="eyebrow"><i />{kicker}</span>}<h1>{title}</h1><p>{description}</p></div>;
}

function HomePage() {
  return (
    <div className="legacy-public-page legacy-public-page--home">
      <section className="hero"><div className="hero-grain" /><div className="container hero-grid">
        <div className="hero-copy"><h1><TextEffect per="word" as="span" preset="slide">Le savoir ouvre</TextEffect><br /><TextEffect per="word" as="span" preset="slide">la voie.</TextEffect>{" "}<em><TextEffect per="word" as="span" preset="slide">À vous</TextEffect></em><br /><em><TextEffect per="word" as="span" preset="slide">de la tracer.</TextEffect></em></h1><p>À HEMIP, les idées prennent racine, les talents se construisent et les compétences deviennent des projets d’avenir.</p><div className="hero-actions"><Link className="button button--primary button--large" href="/formations">Découvrir nos formations <ArrowRight size={17} /></Link><Link className="text-link" href="/admissions">Comment s’inscrire <ArrowUpRight size={15} /></Link></div><div className="hero-note"><div className="note-avatars"><span>H</span><span>+</span><span>3</span></div><span>Management, ingénierie<br />et ambition congolaise</span></div></div>
        <div className="hero-visual"><div className="hero-photo"><img src="/media/hero/album-32.webp" alt="Étudiants HEMIP sur le campus de Pointe-Noire" fetchPriority="high" /><div className="photo-shade" /><div className="photo-caption"><span className="photo-caption-mark"><GraduationCap size={19} /></span><span><strong>Apprendre en faisant.</strong><small>Se préparer au monde professionnel.</small></span></div></div><div className="hero-stamp"><span>POINTE-<br />NOIRE</span><i>·</i><span>CONGO</span></div><div className="hero-side-note">LA PERCÉE <b>↗</b></div></div>
      </div><div className="container hero-bottom"><span><span className="red-slash">/</span> Des formations tournées vers l’action</span><a href="#formations">Faire défiler <ArrowDown size={14} /></a></div></section>
      <section className="partner-strip"><div className="container partner-inner"><div className="partner-list"><span>ENGDE<small>FRANCE</small></span><span>HESTIM<small>MAROC</small></span><span>I.S.T.A.<small>RDC</small></span><span>IPSAS<small>TUNISIE</small></span></div></div></section><section className="institution-home-stats"><div className="container"><div><strong>2013</strong><span>année de création</span></div><div><strong>14</strong><span>salles de classe</span></div><div><strong>82</strong><span>enseignants</span></div><div><strong>760</strong><span>étudiants à Pointe-Noire</span></div><Link href="/a-propos">L’établissement <ArrowRight size={15} /></Link></div></section>
      <section className="section section-programs" id="formations"><div className="container"><div className="section-heading"><div><h2><TextEffect per="word" as="span" preset="slide">Une formation.</TextEffect><br /><em><TextEffect per="word" as="span" preset="slide">Un champ des possibles.</TextEffect></em></h2></div><p>Quinze filières en technologie et industrie, en gestion et en administration, dans le système LMD.</p></div><div className="program-grid">{formations.map(({ name, award, courses, icon: Icon, className, detail }, index) => <article className={`program-card ${className}`} key={name}><div className="program-top"><span className="program-index">0{index + 1} / {award.toLocaleUpperCase("fr-FR")}</span><span className="program-icon"><Icon size={21} /></span></div><h3>{name}</h3><p>{detail}</p><div className="program-tags">{courses.map(({ code }) => <span key={code}>{code}</span>)}</div><Link href="/formations" className="program-link">Voir les filières <ArrowUpRight size={16} /></Link><span className="program-watermark">{index === 0 ? "01" : "02"}</span></article>)}</div><div className="program-footnote"><span><Sparkles size={15} /> {formationCount} filières présentées par l’établissement</span><Link href="/formations">Explorer toutes les filières <ArrowRight size={15} /></Link></div></div></section>
      <section className="home-campus"><div className="container campus-grid"><div className="campus-copy"><span className="eyebrow eyebrow--light"><i /> LA VIE À HEMIP</span><Link className="button button--light" href="/album">Explorer la vie de campus <ArrowRight size={15} /></Link></div><div className="campus-stack"><div className="campus-photo campus-photo--one"><img src={mediaSource(media[32], "thumb")} alt="Une scène de la vie étudiante à HEMIP" /><span> Nous formons des étudiants chevronés et qualifiés</span></div><div className="campus-photo campus-photo--two"><img src={mediaSource(media[30], "thumb")} alt="Une activité sur le campus" /></div><div className="campus-sticker"></div></div></div></section>
      <section className="section story-section"><div className="container story-grid"><div className="story-visual"><img src="/media/hero/album-03.webp" alt="Étudiantes et étudiants travaillent ensemble à la bibliothèque" loading="lazy" /><div className="story-sticker"><span>LE SAVOIR</span><strong>EN<br />MOUVEMENT</strong><i>✳</i></div><span className="story-caption">DE LA SALLE DE COURS AU MONDE RÉEL</span></div><div className="story-copy"><h2>La pratique au service<br />d’une <em>ambition.</em></h2><p>Depuis 2013, HEMIP associe formation LMD, recherche appliquée et préparation à la vie professionnelle. L’établissement veut former des techniciens supérieurs et des licenciés professionnels capables d’apporter des réponses concrètes aux besoins de la société.</p><div className="story-points"><div><span>01</span><section><strong>Apprendre avec des professionnels</strong><p>Des enseignements portés par des enseignants qualifiés et expérimentés.</p></section></div><div><span>02</span><section><strong>Mettre les idées en pratique</strong><p>Des laboratoires, ateliers et projets de recherche en génie des procédés.</p></section></div><div><span>03</span><section><strong>Se préparer aux métiers</strong><p>Des visites guidées et des stages auprès d’entreprises partenaires.</p></section></div></div><Link href="/a-propos" className="text-link">Découvrir HEMIP <ArrowRight size={15} /></Link><Link href="/recherche" className="text-link">Voir les projets de recherche <ArrowRight size={15} /></Link></div></div></section>
      <section className="cta-band"><div className="container cta-band-inner"><span className="cta-spark"></span><div><h2>Une ambition mérite<br />un premier pas.</h2></div><Link href="/admissions" className="button button--white">Préparer mon dossier <ArrowUpRight size={17} /></Link><span className="cta-big-mark">H</span></div></section>
    </div>
  );
}

function FormationsPage() {
  return (
    <div className="page-wrap legacy-public-page legacy-public-page--formations">
      <div className="container">
        <PageHeading kicker="" hideKicker title={<>Choisissez votre <em>terrain de jeu.</em></>} description="Quinze filières en technologie et industrie, en gestion et en administration, dans le système LMD." />
        <div className="formation-groups">
          {formations.map(({ name, award, schedule, courses, icon: Icon, className, detail }) => (
            <section className={"formation-group " + className} key={name}>
              <div className="formation-group-head"><span className="program-icon"><Icon size={20} /></span><div><h2>{name}</h2></div><span className="formation-count">{courses.length} filières</span></div>
              <p>{detail}<br /><strong>{award}</strong> · {schedule}</p>
              <div className="formation-list">
                {courses.map(({ code, name: courseName }, i) => (
                  <article className="formation-row" key={code}><span className="formation-row-no">{String(i + 1).padStart(2, "0")}</span><div><strong>{courseName}</strong><small>{code} · {award}</small></div><span className="formation-row-status">Renseignements <i /></span><Link href="/admissions" aria-label={"S’informer sur la filière " + courseName}><ArrowUpRight size={17} /></Link></article>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="training-options">
          <section><span className="eyebrow">MASTER PROFESSIONNEL · 15 MOIS</span><h2>Approfondir son parcours.</h2><p>La présentation de HEMIP indique un Master professionnel de 15 mois en partenariat avec ENSI, au Maroc.</p></section>
          <section><span className="eyebrow">FORMATIONS MODULAIRES CERTIFIÉES</span><h2>Des formats courts et ciblés.</h2><p>Ces formations de courte durée couvrent aussi l’informatique, la gestion et l’administration, le raffinage et la pétrochimie, ainsi que les énergies renouvelables.</p><ul className="module-tags">{["Intelligence artificielle", "Ingénierie QHSE", "Logistique", "Gestion des ressources humaines", "Cybersécurité", "Gouvernance des systèmes informatiques", "Développement Web Full Stack & DevOps", "Finance, audit & contrôle de gestion"].map(item => <li key={item}>{item}</li>)}</ul></section>
        </div>
        <div className="notice-card"><ShieldCheck size={21} /><div><strong>Un projet de formation en tête ?</strong><p>Notre équipe vous guide dans le choix d’un parcours et la constitution de votre dossier.</p></div><Link className="button button--primary" href="/contact">Poser une question <ArrowRight size={15} /></Link></div>
      </div>
    </div>
  );
}

function AdmissionsPage() {
  const docs = ["Extrait d’acte de naissance", "Copie légalisée du baccalauréat", "Deux photos d’identité", "Certificat médical", "Attestation d’assurance"];
  const supplies = ["3 paquets de rames A4", "Marqueurs", "Souris USB", "Ordinateur (filières industrielles & technologiques)", "EPI (filières industrielles)", "Kit Génie Logiciel : testeur RJ45, pince à sertir, connecteurs et câble paire torsadée"];
  return <div className="page-wrap"><div className="container"><PageHeading kicker="ADMISSIONS · L’AVENTURE COMMENCE ICI" title={<>Comment s’inscrire<br />à <em>HEMIP ?</em></>} description="Un parcours en quelques étapes pour constituer votre dossier, rencontrer la scolarité et préparer votre rentrée." /><div className="admissions-layout"><div className="steps-list"><article className="admission-step"><span className="step-number">01</span><div><h2>Récupérez le dossier d’inscription</h2><p>Le formulaire officiel pourra être téléchargé ici dès sa mise à disposition par l’administration.</p><button className="button button--outline" onClick={() => window.alert("Le formulaire officiel sera ajouté par l’administration HEMIP.")}>Dossier PDF <FileText size={16} /> <span className="soon-label">Bientôt disponible</span></button></div></article><article className="admission-step"><span className="step-number">02</span><div><h2>Réunissez les pièces du dossier</h2><p>Préparez une copie de chaque document pour le dépôt à la scolarité.</p><ul className="checklist">{docs.map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul></div></article><article className="admission-step"><span className="step-number">03</span><div><h2>Réglez les frais d’inscription</h2><p>Les frais de première inscription sont à régler au moment du dépôt du dossier.</p><span className="fee-highlight">50 000 <small>FCFA</small></span></div></article><article className="admission-step"><span className="step-number">04</span><div><h2>Organisez l’écolage et le matériel</h2><p>Un échéancier de 9 à 10 mois est possible. Paiement en espèces avant le 5 du mois, selon les modalités communiquées par la scolarité.</p><div className="supply-box"><span className="eyebrow">MATÉRIEL À PRÉVOIR</span><ul className="checklist checklist--compact">{supplies.map((item) => <li key={item}><Check size={14} />{item}</li>)}</ul></div></div></article><article className="admission-step admission-step--last"><span className="step-number">05</span><div><h2>Déposez votre dossier</h2><p>Rendez-vous au bureau de la scolarité. Les jours et horaires précis seront confirmés par l’administration.</p><Link className="text-link" href="/contact">Nous contacter avant votre venue <ArrowRight size={15} /></Link></div></article></div><aside className="admissions-aside"><div className="aside-top"><span className="eyebrow eyebrow--light">VOTRE CHECKLIST</span><ClipboardCheck size={24} /></div><h3>Chaque pièce<br />vous rapproche<br />de la rentrée.</h3><div className="aside-meter"><span style={{ width: "100%" }} /></div><p>Une fois votre dossier prêt, contactez la scolarité pour connaître les modalités de dépôt.</p><a href={whatsappUrl("Bonjour, je souhaite des informations sur les admissions à HEMIP.")} className="button button--white button--full" target="_blank" rel="noreferrer"><MessageCircle size={17} /> Écrire sur WhatsApp</a><div className="aside-contact"><MapPin size={15} /><span>{contacts.location}</span></div></aside></div></div></div>;
}

function TarifsPage() {
  return <div className="page-wrap legacy-public-page legacy-public-page--tariffs"><div className="container"><PageHeading kicker="" hideKicker title={<>Investir dans votre <em>avenir.</em></>} description="Les montants ci-dessous sont présentés en francs CFA. Les frais annexes s’ajoutent aux coûts de formation." /><div className="fee-cards"><article className="fee-card"><span>PREMIÈRE INSCRIPTION</span><strong>50 000 <small>FCFA</small></strong><p>Payable au dépôt du dossier.</p></article><article className="fee-card fee-card--accent"><span>RÉINSCRIPTION</span><strong>45 000 <small>FCFA</small></strong><p>Pour les années suivantes.</p></article><article className="fee-card"><span>FRAIS D’EXAMEN</span><strong>30 000 <small>FCFA</small></strong><p>Par année académique.</p></article></div><section className="tariff-table-card"><div className="table-heading"><div><h2>Frais par parcours</h2></div><span className="table-unit">Montants annuels · FCFA</span></div><div className="table-scroll"><table className="tariff-table"><thead><tr><th>Parcours</th><th>1<sup>re</sup> année</th><th>2<sup>e</sup> année</th><th>3<sup>e</sup> année</th></tr></thead><tbody>{feeRows.map(([program, ...values]) => <tr key={program}><th>{program}</th>{values.map((value, index) => <td key={`${program}-${index}`}>{value}</td>)}</tr>)}</tbody></table></div><div className="table-foot"><ShieldCheck size={17} /><span>Écolage payable selon un échéancier possible de 9 à 10 mois. Règlement en espèces avant le 5 du mois.</span></div></section><div className="notice-card"><InfoMark /><div><strong>Une question sur votre parcours ?</strong><p>Les montants d’inscription et d’examen s’ajoutent aux frais de formation du cursus choisi.</p></div><Link href="/contact" className="button button--primary">Nous contacter <ArrowRight size={15} /></Link></div></div></div>;
}

function FaqPage() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<number | null>(0);
  const results = useMemo(() => faqsForSearch(query), [query]);
  return <div className="page-wrap legacy-public-page legacy-public-page--faq"><div className="container"><PageHeading kicker="" hideKicker title={<>Une question ?<br /><em>Commençons ici.</em></>} description="Les informations essentielles pour avancer sereinement dans votre projet d’études à HEMIP." /><div className="faq-layout"><aside className="faq-aside"><div className="faq-aside-icon"><CircleHelp size={22} /></div><h2>Vous ne trouvez pas votre réponse ?</h2><p>Notre équipe reste disponible pour répondre à vos questions sur les filières et les admissions.</p><Link href="/contact" className="text-link">Contacter HEMIP <ArrowRight size={15} /></Link></aside><div className="faq-content"><label className="faq-search"><Search size={18} /><input type="search" placeholder="Rechercher une réponse…" value={query} onChange={(e) => { setQuery(e.target.value); setActive(null); }} /><span>{results.length} résultat{results.length > 1 ? "s" : ""}</span></label>{results.length ? <div className="faq-list">{results.map((item, index) => <article className={`faq-item ${active === index ? "faq-item--open" : ""}`} key={item.q}><button onClick={() => setActive(active === index ? null : index)} aria-expanded={active === index}><span>{item.q}</span><ChevronDown size={18} /></button>{active === index && <p>{item.a}</p>}</article>)}</div> : <div className="empty-state"><Search size={22} /><strong>Aucune réponse trouvée</strong><span>Essayez un autre mot-clé ou contactez-nous.</span></div>}<div className="faq-footnote">Les informations sont fournies à titre indicatif et seront mises à jour par l’administration HEMIP.</div></div></div></div></div>;
}

function TermsPage() {
  return <div className="page-wrap legal-page"><div className="container">
    <PageHeading kicker="DOCUMENTS · CONFIDENTIALITÉ" title={<>Vos droits, <em>notre engagement.</em></>} description="Retrouvez les règles d’utilisation de la plateforme, les informations sur vos données et les moyens de demander de l’aide." />
    <div className="legal-notice"><span className="legal-notice-icon"><ShieldCheck size={21} /></span><div><strong>Documents d’information en cours de validation</strong><p>Ces textes donnent un cadre de lecture. HEMIP doit confirmer les informations propres à l’établissement et faire valider les documents avant de les présenter comme définitifs.</p></div><span className="legal-status">À VALIDER</span></div>
    <div className="terms-layout"><nav className="terms-nav" aria-label="Sommaire des documents"><span className="legal-nav-label">Dans cette page</span><a href="#cgu">GCU / CGU</a><a href="#rgpd">RGPD et données</a><a href="#usage">Politique d’utilisation</a><a href="#cookies">Cookies et médias</a><a href="#contact-dpo">Contact données</a><Link href="/aide">Aide plateforme <ArrowRight size={14} /></Link></nav>
      <article className="terms-article">
        <section className="legal-doc-card" id="cgu"><span className="legal-doc-kicker">DOCUMENT 01 · CONDITIONS GÉNÉRALES</span><h2>Conditions générales d’utilisation (GCU / CGU)</h2><p>Les conditions générales décrivent les règles d’accès à HEMIP en ligne, les services disponibles et les responsabilités de chaque utilisateur. L’accès à un espace personnel est destiné à son titulaire ; chacun doit garder ses moyens de connexion confidentiels et signaler tout accès suspect à l’établissement.</p><p>Les informations publiées sur le site public sont fournies pour orienter les étudiants et les familles. Les informations officielles de scolarité sont celles communiquées par HEMIP dans les espaces prévus à cet effet.</p><div className="legal-validation"><strong>À compléter par HEMIP avant publication</strong><span>Identité légale de l’éditeur, coordonnées de l’établissement, modalités d’accès et de fermeture des comptes, propriété des contenus, responsabilités et conditions de mise à jour.</span></div></section>
        <section className="legal-doc-card" id="rgpd"><span className="legal-doc-kicker">DOCUMENT 02 · DONNÉES PERSONNELLES</span><h2>Protection des données · RGPD</h2><p>Selon les fonctions utilisées, la plateforme peut recevoir des informations de compte et de profil, des contenus de témoignages et réactions, ainsi que des préférences de notification. Les données nécessaires, les destinataires, les fournisseurs techniques, les éventuels transferts et les durées de conservation doivent être confirmés par HEMIP.</p><p>La République du Congo dispose d’une loi portant protection des données à caractère personnel. Le RGPD européen s’applique lorsque les conditions de son champ territorial sont réunies. HEMIP doit déterminer les textes applicables à ses traitements et préciser l’entité responsable ainsi que le point de contact compétent.</p><div className="legal-link-row"><a href="https://www.sgg.cg/JO/2019/congo-jo-2019-45.pdf" target="_blank" rel="noreferrer">Loi congolaise n°29-2019 <ArrowUpRight size={14} /></a><a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679" target="_blank" rel="noreferrer">Texte officiel du RGPD <ArrowUpRight size={14} /></a></div><p className="legal-rights-note">Les demandes d’accès, de rectification, de suppression, d’opposition ou de portabilité doivent être adressées selon la procédure et les conditions prévues par les textes applicables. HEMIP doit publier le contact dédié à ces demandes avant la mise en production.</p></section>
        <section className="legal-doc-card" id="usage"><span className="legal-doc-kicker">DOCUMENT 03 · RÈGLES DE LA PLATEFORME</span><h2>Politique d’utilisation</h2><p>Pour préserver un espace utile à toute la communauté HEMIP, les utilisateurs sont invités à :</p><ul className="legal-rules"><li>utiliser leur propre compte et protéger leur mot de passe ;</li><li>respecter les autres membres et ne pas publier de propos illicites, menaçants ou discriminatoires ;</li><li>ne pas publier les coordonnées, documents ou informations privées d’une autre personne sans autorisation ;</li><li>signaler à HEMIP les erreurs, contenus préoccupants ou accès inhabituels.</li></ul><p>Les modalités de signalement, de retrait de contenu et de gestion des comptes doivent être confirmées par l’administration avant publication définitive de cette politique.</p></section>
        <section className="legal-doc-card" id="cookies"><span className="legal-doc-kicker">DOCUMENT 04 · PRÉFÉRENCES WEB</span><h2>Cookies et contenus intégrés</h2><p>Les préférences de cookies de cette version sont enregistrées sur l’appareil utilisé. Les catégories facultatives doivent rester désactivées tant que l’utilisateur ne les a pas acceptées. HEMIP devra vérifier les outils réellement installés et ajuster le bandeau de consentement en conséquence.</p></section>
        <section className="legal-doc-card legal-contact-card" id="contact-dpo"><span className="legal-doc-kicker">VOS DONNÉES · CONTACT</span><h2>Une question sur vos données ?</h2><p>Pour une demande relative à vos données personnelles, contacte d’abord HEMIP à <a href={`mailto:${contacts.email}`}>{contacts.email}</a>. Les coordonnées du responsable et du point de contact chargé de ces demandes restent à confirmer par l’établissement.</p><Link className="legal-cta" href="/aide">Voir l’aide de la plateforme <ArrowRight size={15} /></Link></section>
      </article>
    </div>
  </div></div>;
}

function HelpPage() {
  return <div className="page-wrap help-page"><div className="container">
    <PageHeading kicker="ASSISTANCE · PLATEFORME HEMIP" title={<>Un souci ?<br /><em>On vous guide.</em></>} description="Pour signaler un problème technique sur la plateforme, contacte directement le développeur par téléphone, e-mail ou WhatsApp." />
    <section className="help-contact-grid" aria-label="Contacter le développeur">
      <a className="help-contact-card help-contact-card--phone" href="tel:+242066099427"><span className="help-contact-icon"><Phone size={21} /></span><span className="help-contact-label">Appeler</span><strong>+242 066099427</strong><span className="help-contact-action">Lancer un appel <ArrowUpRight size={15} /></span></a>
      <a className="help-contact-card" href="mailto:ngoyiexauceroro@gmail.com?subject=Assistance%20plateforme%20HEMIP"><span className="help-contact-icon"><Mail size={21} /></span><span className="help-contact-label">Écrire un e-mail</span><strong>ngoyiexauceroro@gmail.com</strong><span className="help-contact-action">Ouvrir ma messagerie <ArrowUpRight size={15} /></span></a>
      <a className="help-contact-card help-contact-card--whatsapp" href="https://wa.me/qr/SPLHFNSTYNTFH1" target="_blank" rel="noreferrer"><span className="help-contact-icon"><MessageCircle size={21} /></span><span className="help-contact-label">WhatsApp</span><strong>Contacter le développeur</strong><span className="help-contact-action">Ouvrir WhatsApp <ArrowUpRight size={15} /></span></a>
    </section>
    <div className="help-guidance"><span className="help-guidance-mark"><CircleHelp size={21} /></span><div><h2>Pour accélérer le dépannage</h2><p>Indique le téléphone ou l’ordinateur utilisé, le navigateur, la page concernée et ce qui se passe. Tu peux joindre une capture d’écran en masquant tes informations personnelles. N’envoie jamais ton mot de passe ni un code de connexion.</p></div></div>
    <div className="help-bottom-links"><Link href="/terms">Conditions et confidentialité <ArrowRight size={14} /></Link><Link href="/contact">Contacter HEMIP <ArrowRight size={14} /></Link></div>
  </div></div>;
}

function AlbumPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [orbitMotion, setOrbitMotion] = useState({ x: 0, y: 0, angle: 0 });
  const [filter, setFilter] = useState("Tout");
  const activePhoto = media[activeIndex];
  const categories = ["Tout", ...Array.from(new Set(media.map((item) => item.category)))];
  const filteredMedia = useMemo(() => filter === "Tout" ? media : media.filter((item) => item.category === filter), [filter]);
  const orbitalPhotos = useMemo(() => Array.from({ length: Math.min(12, media.length - 1) }, (_, index) => media[(activeIndex + index + 1) % media.length]), [activeIndex]);
  const go = (delta: number) => setActiveIndex((current) => (current + delta + media.length) % media.length);
  const onOrbitPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const y = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    setOrbitMotion({ x: x * 12, y: y * 12, angle: Math.atan2(y, x) * (180 / Math.PI) * 0.12 });
  };
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxIndex(null);
      if (event.key === "ArrowRight") setLightboxIndex((current) => current === null ? null : (current + 1) % media.length);
      if (event.key === "ArrowLeft") setLightboxIndex((current) => current === null ? null : (current - 1 + media.length) % media.length);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxIndex]);
  return <div className="album-page">
    <div className="album-intro"><div className="container album-intro-grid"><div><span className="album-eyebrow"><i /> HEMIP · POINTE-NOIRE · DEPUIS NOS IMAGES</span><h1>Une école.<br /><em>Des trajectoires.</em></h1></div><div className="album-intro-side"><p>Quarante-neuf images, un même mouvement : apprendre, se rencontrer, bâtir la suite. Explorez les photos du dossier HEMIP dans un espace en mouvement.</p><span><span className="album-dot" /> LES IMAGES DU DOSSIER HEMIP <b>↗</b></span></div></div></div>
    <section className="orbit-feature" aria-label="Carrousel circulaire interactif">
      <div className="orbit-stage" onPointerMove={onOrbitPointerMove} onPointerLeave={() => setOrbitMotion({ x: 0, y: 0, angle: 0 })}>
        <div className="orbit-star orbit-star--one" /><div className="orbit-star orbit-star--two" /><div className="orbit-orbit orbit-orbit--outer" /><div className="orbit-orbit orbit-orbit--inner" />
        <div className="orbit-system" style={{ transform: `translate(${orbitMotion.x}px, ${orbitMotion.y}px)` }}>
          {orbitalPhotos.map((photo, index) => {
            const angle = index * (360 / orbitalPhotos.length) + orbitMotion.angle;
            return <button type="button" key={photo.id} className="orbit-satellite" style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(var(--orbit-radius)) rotate(${-angle}deg)` }} onClick={() => setActiveIndex(media.findIndex((item) => item.id === photo.id))} aria-label={`Afficher photo de la page ${photo.page}`}>
              <img src={mediaSource(photo, "thumb")} alt={photo.alt} loading="lazy" />
              <span>{String(photo.page).padStart(2, "0")}</span>
            </button>;
          })}
          <button className="orbit-core" type="button" onClick={() => setLightboxIndex(activeIndex)} aria-label={`Agrandir l’image ${activePhoto.page}`}>
            <img src={mediaSource(activePhoto)} alt={activePhoto.alt} fetchPriority="high" />
            <span className="orbit-core-shade" /><span className="orbit-core-caption"><small>PAGE {String(activePhoto.page).padStart(2, "0")} / {media.length}</small><strong>{activePhoto.category}</strong></span>
            <span className="orbit-focus"><ArrowUpRight size={18} /></span>
          </button>
        </div>
        <div className="orbit-center-label"><span>HEMIP</span><i>·</i><span>LA PERCÉE</span></div>
        <div className="orbit-hint"><span className="orbit-cursor-mark">✳</span> Déplacez le curseur pour guider l’orbite <span className="orbit-hint-mobile">Faites glisser autour de l’image</span></div>
      </div>
      <div className="container orbit-controls"><button className="orbit-arrow" onClick={() => go(-1)} aria-label="Photo précédente"><ArrowDown className="arrow-previous" size={18} /></button><div className="orbit-progress"><span>{String(activeIndex + 1).padStart(2, "0")}</span><i><b style={{ width: `${((activeIndex + 1) / media.length) * 100}%` }} /></i><span>{String(media.length).padStart(2, "0")}</span></div><button className="orbit-arrow" onClick={() => go(1)} aria-label="Photo suivante"><ArrowRight size={18} /></button><button className="orbit-open" onClick={() => setLightboxIndex(activeIndex)}>Voir en plein écran <ArrowUpRight size={15} /></button></div>
    </section>
    <section className="album-gallery" id="galerie"><div className="container"><div className="gallery-heading"><div><span className="album-eyebrow"><i /> L’ALBUM COMPLET · {media.length} IMAGES</span><h2>Un instant après <em>l’autre.</em></h2></div><p>Retrouvez toutes les photos du dossier source. Touchez une image pour la voir en grand.</p></div><div className="gallery-filter" aria-label="Filtrer par thème">{categories.map((category) => <button key={category} className={filter === category ? "gallery-filter-active" : ""} onClick={() => setFilter(category)}>{category}<span>{category === "Tout" ? media.length : media.filter((item) => item.category === category).length}</span></button>)}</div><div className="gallery-grid">{filteredMedia.map((photo, index) => <button key={photo.id} className={`gallery-tile gallery-tile--${index % 5}`} onClick={() => { const idx = media.findIndex((item) => item.id === photo.id); setActiveIndex(idx); setLightboxIndex(idx); }} aria-label={`Ouvrir image de la page ${photo.page}`}><img src={mediaSource(photo, "thumb")} data-full={mediaSource(photo)} alt={photo.alt} loading="eager" onError={(event) => event.currentTarget.parentElement?.classList.add("gallery-tile--media-error")} /><span className="gallery-tile-overlay"><small>{photo.category}</small><strong>PAGE {String(photo.page).padStart(2, "0")}</strong><i><ArrowUpRight size={17} /></i></span></button>)}</div><div className="gallery-source-note"><span className="source-mark">H</span><p><strong>Chaque image a sa place.</strong><br />Les 49 visuels ont été extraits du PDF fourni, préparés en WebP et conservés dans l’ordre d’origine.</p><a href="#video-hemip">Vers les vidéos <ArrowDown size={14} /></a></div></div></section>
    <CampusVideos />
    <section className="album-outro"><span>LA PERCÉE</span><i>✳</i><span>POINTE-NOIRE</span><a href="#galerie" aria-label="Retour à la galerie"><ArrowUpRight size={16} /></a></section>
    {lightboxIndex !== null && <div className="album-lightbox" role="dialog" aria-modal="true" aria-label={`Photo ${lightboxIndex + 1} sur ${media.length}`} onClick={() => setLightboxIndex(null)}><button className="lightbox-close" onClick={() => setLightboxIndex(null)} aria-label="Fermer"><X /></button><button className="album-lightbox-arrow album-lightbox-arrow--left" aria-label="Photo précédente" onClick={(event) => { event.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + media.length) % media.length); }}><ArrowRight /></button><figure onClick={(event) => event.stopPropagation()}><img src={mediaSource(media[lightboxIndex])} alt={media[lightboxIndex].alt} /><figcaption><span>{media[lightboxIndex].category}</span><strong>PAGE {String(media[lightboxIndex].page).padStart(2, "0")} <i>/</i> {String(media.length).padStart(2, "0")}</strong></figcaption></figure><button className="album-lightbox-arrow" aria-label="Photo suivante" onClick={(event) => { event.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % media.length); }}><ArrowRight /></button></div>}
  </div>;
}

function TeamPage() {
  return <AboutPage />;
}

function ContactPage() {
  return <div className="page-wrap legacy-public-page legacy-public-page--contact"><div className="container"><PageHeading kicker="" hideKicker title={<>Parlons de votre <em>avenir.</em></>} description="Une question sur une filière, un dossier ou la vie à HEMIP ? Notre équipe vous accompagne." /><div className="contact-layout"><div className="contact-list"><a href={`tel:${contacts.phoneOne.replaceAll(" ", "")}`} className="contact-method"><span><Phone size={19} /></span><div><small>APPELEZ-NOUS</small><strong>{contacts.phoneOne}</strong><em>{contacts.phoneTwo}</em></div><ArrowUpRight size={16} /></a><a href={whatsappUrl()} target="_blank" rel="noreferrer" className="contact-method"><span className="contact-whatsapp"><MessageCircle size={19} /></span><div><small>WHATSAPP</small><strong>{contacts.whatsapp}</strong><em>Écrivez à l’équipe HEMIP</em></div><ArrowUpRight size={16} /></a><a href={`mailto:${contacts.email}`} className="contact-method"><span><Mail size={19} /></span><div><small>ÉCRIVEZ-NOUS</small><strong>{contacts.email}</strong><em>Admissions & informations</em></div><ArrowUpRight size={16} /></a><div className="contact-address"><span><MapPin size={19} /></span><div><small>NOUS TROUVER</small><strong>{contacts.location}</strong><em>Pointe-Noire, République du Congo</em></div></div><div className="hours-note"><Clock3 size={17} /><p><strong>Horaires d’accueil à confirmer</strong><br />Contactez la scolarité avant de vous déplacer.</p></div></div><div className="map-card"><iframe title="Carte de localisation de HEMIP à Pointe-Noire" src="https://maps.google.com/maps?q=Pointe-Noire%2C%20Tour%20Mayombe%2C%20Republic%20of%20the%20Congo&t=&z=13&ie=UTF8&iwloc=&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /><div className="map-label"><span><MapPin size={16} /></span><div><small>HEMIP · LA PERCÉE</small><strong>Pointe-Noire</strong></div><a href="https://maps.google.com/?q=Pointe-Noire+Tour+Mayombe" target="_blank" rel="noreferrer" aria-label="Ouvrir la carte"><ArrowUpRight size={16} /></a></div></div></div><div className="contact-bottom"><Sparkles size={18} /><span>Nous serons heureux de vous aider à faire le premier pas.</span><Link href="/admissions">Voir les étapes d’inscription <ArrowRight size={15} /></Link></div></div></div>;
}

function dashboardForRole(role: unknown): string {
  if (role === "student") return "/student/dashboard";
  if (role === "payment_manager") return "/admin/payments";
  if (role === "academic_admin" || role === "super_admin") return "/admin/decisions";
  return "/";
}

function AuthPage() {
  const [, setLocation] = useLocation();
  const [checkingSession, setCheckingSession] = useState(true);
  const [identifier, setIdentifier] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(async response => response.ok ? response.json() : null)
      .then(payload => {
        if (!active) return;
        if (payload?.user?.role) {
          setLocation(dashboardForRole(payload.user.role));
          return;
        }
        setCheckingSession(false);
      })
      .catch(() => {
        if (active) setCheckingSession(false);
      });
    return () => { active = false; };
  }, [setLocation]);

  const requestCode = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/otp/request", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.message ?? "Impossible de demander le code. Réessayez dans un instant.");
        return;
      }
      setChallengeId(String(result.challengeId ?? ""));
      setCodeSent(true);
      setCode("");
      setMessage("Si cette adresse est préenregistrée, un code à 6 chiffres vient d’être envoyé. Vérifiez aussi vos courriers indésirables.");
    } catch {
      setMessage("Le service de connexion est momentanément inaccessible. Réessayez plus tard.");
    } finally {
      setBusy(false);
    }
  };

  const validateCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setMessage("Saisissez les 6 chiffres du code reçu par e-mail.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const csrfResponse = await fetch("/auth/csrf", { credentials: "same-origin", cache: "no-store" });
      if (!csrfResponse.ok) throw new Error("csrf");
      const { csrfToken } = await csrfResponse.json();
      const form = new URLSearchParams({
        csrfToken,
        email: identifier.trim(),
        challengeId,
        code,
        callbackUrl: "/student/dashboard",
      });
      await fetch("/auth/callback/hemip-otp", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        redirect: "follow",
      });
      const sessionResponse = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
      if (!sessionResponse.ok) {
        setMessage("Code invalide, expiré ou déjà utilisé. Vérifiez-le, ou demandez-en un nouveau.");
        return;
      }
      const { user } = await sessionResponse.json();
      setLocation(dashboardForRole(user?.role));
    } catch {
      setMessage("Impossible de vérifier ce code. Réessayez ou demandez-en un nouveau.");
    } finally {
      setBusy(false);
    }
  };

  const changeEmail = () => {
    setCodeSent(false);
    setChallengeId("");
    setCode("");
    setMessage("");
  };

  if (checkingSession) return <div className="page-wrap"><div className="container"><p role="status">Vérification de votre session…</p></div></div>;

  return <div className="auth-page"><div className="container auth-grid"><div className="auth-intro"><span className="eyebrow eyebrow--light"><i /> ESPACE HEMIP</span><h1>Un espace pour<br />avancer avec <em>vous.</em></h1><p>Retrouvez votre parcours étudiant, vos informations de scolarité et les actualités de l’établissement.</p><div className="auth-trust"><ShieldCheck size={18} /><span>Accès par code à usage unique<br /><small>Code valable 3 minutes · une seule utilisation</small></span></div><span className="auth-watermark">H</span></div><div className="auth-card"><Brand small /><span className="eyebrow">CONNEXION À VOTRE ESPACE</span><h2>{codeSent ? "Vérifiez votre code" : "Bienvenue à HEMIP."}</h2><p>{codeSent ? `Si ${identifier} est enregistré·e, un code à 6 chiffres a été envoyé.` : "Utilisez l’adresse e-mail enregistrée auprès de la scolarité."}</p>{!codeSent ? <form onSubmit={requestCode}><label htmlFor="identifier">Adresse e-mail préenregistrée</label><input id="identifier" type="email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="email" placeholder="prenom@hemip.cg" required disabled={busy} /><button className="button button--primary button--full" type="submit" disabled={busy}>{busy ? "Envoi en cours…" : "Recevoir un code"} <ArrowRight size={16} /></button></form> : <form onSubmit={validateCode}><label htmlFor="otp">Code à 6 chiffres</label><input id="otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" required disabled={busy} aria-describedby="otp-help" /><small id="otp-help">Le code expire trois minutes après son envoi.</small><button className="button button--primary button--full" type="submit" disabled={busy || code.length !== 6}>{busy ? "Vérification…" : "Continuer"} <ArrowRight size={16} /></button><div className="auth-actions-row"><button type="button" className="text-button" onClick={changeEmail} disabled={busy}>Modifier l’adresse</button><button type="button" className="text-button" onClick={() => void requestCode()} disabled={busy}>Renvoyer un code</button></div></form>}{message && <div className="inline-message" role="status" aria-live="polite"><InfoMark /><span>{message}</span></div>}<span className="auth-privacy">En continuant, vous acceptez les <Link href="/terms">conditions d’utilisation</Link> et la politique de confidentialité.</span></div></div></div>;
}

function StudentDashboardPage() {
  const [cleared, setCleared] = useState(false);
  const [tab, setTab] = useState("Aperçu");
  const tabs = ["Aperçu", "Emploi du temps", "Absences"];
  return <div className="dashboard-page"><div className="container"><div className="dashboard-top"><div><span className="eyebrow"><i /> ESPACE ÉTUDIANT · DÉMONSTRATION</span><h1>Bonjour, <em>Bienvenue.</em></h1><p>Licence · Année académique 2025–2026 · Tableau de bord simulé</p></div><span className="student-avatar">AB</span></div><div className="demo-banner"><InfoMark /><span>Interface de démonstration — données fictives. Elle n’est pas reliée au système de scolarité.</span><Link href="/auth">Quitter l’espace <ArrowUpRight size={13} /></Link></div><div className="dashboard-tabs">{tabs.map((item) => <button key={item} className={tab === item ? "dashboard-tab dashboard-tab--active" : "dashboard-tab"} onClick={() => setTab(item)}>{item}</button>)}</div>{tab === "Aperçu" ? <div className="dashboard-grid"><section className="dashboard-panel dashboard-panel--main"><div className="panel-heading"><div><span className="eyebrow">RÉSULTATS ACADÉMIQUES</span><h2>Mon relevé de notes</h2></div><span className="demo-label">EXEMPLE</span></div>{cleared ? <div className="results-unlocked"><div className="result-status"><BadgeCheck size={20} /><span>Accès autorisé · quitus financier simulé</span></div><div className="result-row"><span>Semestre 1</span><strong>13,8 / 20</strong><small>Admis · exemple non contractuel</small></div><div className="result-row"><span>Semestre 2</span><strong>14,2 / 20</strong><small>Publiés · données fictives</small></div><div className="result-row result-row--total"><span>Moyenne annuelle</span><strong>14,0 / 20</strong><small>Exemple de résultat</small></div></div> : <div className="results-locked"><span className="lock-icon"><ShieldCheck size={24} /></span><strong>Résultats indisponibles</strong><p>Votre situation administrative (paiement) ne permet pas la consultation de vos résultats. Contactez la gestionnaire pour toute question.</p><a href={`tel:${contacts.phoneOne.replaceAll(" ", "")}`}>{contacts.phoneOne}</a><small>Contrôle d’accès basé sur le quitus financier et la publication des résultats.</small></div>}<button className={`demo-toggle ${cleared ? "demo-toggle--on" : ""}`} onClick={() => setCleared(!cleared)}><span className="demo-toggle-dot" />{cleared ? "Simuler un accès bloqué" : "Simuler un quitus accordé"}</button></section><div className="dashboard-side"><section className="dashboard-panel"><div className="panel-heading"><div><span className="eyebrow">SCOLARITÉ</span><h2>Mon compte</h2></div><FileText size={18} /></div><div className="balance-line"><span>Situation financière</span><strong className={cleared ? "status-good" : "status-due"}>{cleared ? "À jour" : "À régulariser"}</strong></div><div className="balance-line"><span>Solde démo</span><strong>{cleared ? "0" : "125 000"} FCFA</strong></div><button className="panel-link" onClick={() => window.alert("Consultation des paiements : fonctionnalité à connecter au backend.")}>Voir mes paiements <ArrowRight size={14} /></button></section><section className="dashboard-panel dashboard-announcement"><span className="eyebrow">ANNONCE</span><h3>Bienvenue dans votre espace étudiant.</h3><p>Les changements d’emploi du temps et les annonces de la scolarité apparaîtront ici.</p><span><CalendarDays size={15} /> Espace de démonstration</span></section></div></div> : <div className="dashboard-panel dashboard-empty"><span className="empty-calendar"><CalendarDays size={24} /></span><h2>{tab === "Emploi du temps" ? "Votre semaine en un coup d’œil." : "Suivez votre présence."}</h2><p>{tab === "Emploi du temps" ? "L’emploi du temps sera disponible ici une fois la plateforme connectée." : "Les présences, retards et absences justifiées seront affichés dans cette rubrique."}</p><span className="demo-label">DONNÉES NON CONNECTÉES</span></div>}<div className="dashboard-security"><ShieldCheck size={16} /><span>En production, l’accès aux résultats sera contrôlé et journalisé côté serveur.</span><Link href="/terms">Confidentialité</Link></div></div></div>;
}

function InfoMark() { return <CircleHelp size={16} aria-hidden="true" />; }

type CsvRow = { matricule: string; name: string; amount: string; method: string; reference: string; status: string };
function AdminPaymentsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const preview = async () => {
    if (!file) { setNotice("Sélectionnez un fichier CSV pour afficher l’aperçu."); return; }
    const raw = await file.text();
    const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) { setErrors(["Le fichier ne contient aucune ligne de paiement."]); setRows([]); return; }
    const headers = lines[0].split(/[;,]/).map((h) => h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    const aliases: Record<string, string[]> = { matricule: ["matricule", "studentmatricule"], name: ["nom", "name", "etudiant"], amount: ["montant", "amount"], method: ["methode", "method", "mode"], reference: ["reference", "ref"] };
    const positions = Object.fromEntries(Object.entries(aliases).map(([field, names]) => [field, headers.findIndex((header) => names.includes(header))])) as Record<string, number>;
    const missing = Object.entries(positions).filter(([, pos]) => pos === -1).map(([field]) => field);
    if (missing.length) { setErrors([`Colonnes manquantes : ${missing.join(", ")}. En-têtes attendus : matricule, nom, montant, methode, reference.`]); setRows([]); return; }
    const parsed: CsvRow[] = lines.slice(1).map((line, index) => {
      const cells = line.split(/[;,]/).map((cell) => cell.trim());
      const amount = cells[positions.amount] ?? "";
      const numeric = Number(amount.replace(/\s/g, ""));
      return { matricule: cells[positions.matricule] ?? "", name: cells[positions.name] ?? "", amount, method: cells[positions.method] ?? "", reference: cells[positions.reference] ?? "", status: !cells[positions.matricule] || !Number.isFinite(numeric) || numeric <= 0 ? `Ligne ${index + 2} à vérifier` : "Valide" };
    });
    setRows(parsed); setErrors(parsed.filter((row) => row.status !== "Valide").map((row) => `${row.status} : matricule et montant positif requis.`)); setConfirmed(false); setNotice("");
  };
  return <div className="admin-page"><div className="container"><div className="admin-heading"><div><span className="eyebrow"><i /> GESTION · PAIEMENTS</span><h1>Suivi des <em>règlements.</em></h1><p>Prévisualisez les lignes importées avant toute validation. Les changements sont simulés dans cette démo.</p></div><span className="admin-badge">MAQUETTE ADMIN</span></div><div className="demo-banner"><InfoMark /><span>Les imports et validations n’enregistrent aucune donnée réelle. Un backend sécurisé et journalisé est requis.</span></div><div className="admin-stat-grid"><div className="admin-stat"><span>PAIEMENTS CE MOIS</span><strong>42</strong><small><span className="green-pulse" /> Données fictives</small></div><div className="admin-stat"><span>MONTANT ENREGISTRÉ</span><strong>4 850 000 <small>FCFA</small></strong><small>Depuis le 1<sup>er</sup> septembre</small></div><div className="admin-stat"><span>À RÉGULARISER</span><strong>18 <small>étudiants</small></strong><small>Statut de démonstration</small></div></div><section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">IMPORT GROUPÉ</span><h2>Importer un relevé CSV</h2></div><FileText size={19} /></div><div className="import-drop"><input id="csv-file" type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRows([]); setErrors([]); setConfirmed(false); }} /><label htmlFor="csv-file"><span className="upload-icon"><ArrowDown size={19} /></span><strong>{file ? file.name : "Choisissez un fichier CSV"}</strong><small>{file ? `${(file.size / 1024).toFixed(1)} Ko · aperçu local uniquement` : "ou déposez-le ici · format attendu : matricule, nom, montant, methode, reference"}</small></label></div><div className="import-actions"><a href="/templates/payments_import_template.csv" download> Télécharger le modèle CSV <ArrowUpRight size={14} /></a><button className="button button--outline" onClick={preview}>Prévisualiser l’import <ArrowRight size={15} /></button></div>{notice && <div className="inline-message"><InfoMark /><span>{notice}</span></div>}{errors.length > 0 && <div className="csv-errors" role="alert"><strong>{errors.length} point(s) à vérifier</strong>{errors.map((error) => <span key={error}>{error}</span>)}</div>}{rows.length > 0 && <div className="csv-preview"><div className="preview-title"><strong>Aperçu · {rows.length} ligne(s)</strong>{confirmed && <span className="status-good"><Check size={14} /> Validation simulée</span>}</div><div className="table-scroll"><table className="tariff-table"><thead><tr><th>Matricule</th><th>Étudiant</th><th>Montant</th><th>Méthode</th><th>Référence</th><th>Contrôle</th></tr></thead><tbody>{rows.map((row, i) => <tr key={`${row.matricule}-${i}`}><td>{row.matricule || "—"}</td><td>{row.name || "—"}</td><td>{row.amount || "—"}</td><td>{row.method || "—"}</td><td>{row.reference || "—"}</td><td>{row.status}</td></tr>)}</tbody></table></div><button className="button button--primary" disabled={errors.length > 0 || confirmed} onClick={() => setConfirmed(true)}>{confirmed ? "Import confirmé (démo)" : "Confirmer l’import"} <Check size={15} /></button></div>}</section><section className="admin-panel manual-panel"><div className="panel-heading"><div><span className="eyebrow">SAISIE INDIVIDUELLE</span><h2>Enregistrer un règlement</h2></div><button className="button button--outline" onClick={() => setManualOpen(!manualOpen)}>{manualOpen ? "Fermer" : "Ajouter un paiement"} <ArrowRight size={15} /></button></div>{manualOpen && <form className="manual-form" onSubmit={(e) => { e.preventDefault(); setNotice("Paiement manuel simulé — aucune écriture n’a été transmise."); setManualOpen(false); }}><label>Matricule<input required placeholder="HEMIP-2026-001" /></label><label>Montant (FCFA)<input required type="number" min="1" placeholder="50000" /></label><label>Méthode<select defaultValue=""><option value="" disabled>Choisir…</option><option>Espèces</option><option>Mobile Money</option><option>Virement</option></select></label><label>Référence<input required placeholder="Reçu / référence" /></label><button className="button button--primary" type="submit">Enregistrer · démo <Check size={15} /></button></form>}<p className="audit-footnote"><ShieldCheck size={15} /> Toute validation réelle devra être contrôlée côté serveur et inscrite au journal d’audit.</p></section></div></div>;
}

function AdminDecisionsPage() {
  const [saved, setSaved] = useState(false);
  return <div className="admin-page"><div className="container"><div className="admin-heading"><div><span className="eyebrow"><i /> GESTION ACADÉMIQUE</span><h1>Décisions <em>annuelles.</em></h1><p>Interface de démonstration pour saisir une décision académique et documenter son motif.</p></div><span className="admin-badge">MAQUETTE ADMIN</span></div><div className="demo-banner"><InfoMark /><span>Cette maquette ne valide ni ne publie aucune décision académique réelle.</span></div><div className="decision-layout"><section className="admin-panel decision-form-panel"><span className="eyebrow">NOUVELLE DÉCISION</span><h2>Enregistrer une décision</h2><p>Les décisions réelles sont réservées aux rôles academic_admin et super_admin.</p><form className="decision-form" onSubmit={(e) => { e.preventDefault(); setSaved(true); }}><label>Matricule étudiant<input placeholder="HEMIP-2026-001" required /></label><label>Année académique<select defaultValue="2025–2026"><option>2025–2026</option><option>2024–2025</option><option>2023–2024</option></select></label><label>Décision<select defaultValue=""><option value="" disabled>Choisissez une décision</option><option value="PASSAGE">Passage en année supérieure</option><option value="PASSAGE_AVEC_DETTES">Passage avec dettes</option><option value="REDOUBLEMENT">Redoublement</option><option value="EXCLUSION">Autre décision administrative</option></select></label><label>Motif et éléments de contexte<textarea rows={4} placeholder="Motif obligatoire — à consigner dans l’audit" required /></label><div className="decision-warning"><ShieldCheck size={17} /><span>Avant publication, une décision doit être vérifiée et validée selon le circuit habilité.</span></div><button className="button button--primary" type="submit">Enregistrer en brouillon <ArrowRight size={15} /></button>{saved && <div className="inline-message"><Check size={16} /><span>Brouillon simulé. Aucune décision n’a été transmise.</span></div>}</form></section><aside className="workflow-panel"><span className="eyebrow eyebrow--light">CIRCUIT DE PUBLICATION</span><h3>Chaque étape compte.</h3><div className="workflow-steps">{["Brouillon", "Soumis", "Vérifié", "Validé", "Publié"].map((step, i) => <div className="workflow-step" key={step}><span>{String(i + 1).padStart(2, "0")}</span><strong>{step}</strong>{i < 4 && <i />}</div>)}</div><p>Après publication, toute modification doit être motivée et conservée dans le journal d’audit.</p><div className="workflow-audit"><ShieldCheck size={16} /><span>who · when · what · reason</span></div></aside></div></div></div>;
}

function PrivateArea({ roles, children }: { roles: string[]; children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading");
  const [email, setEmail] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(async response => response.ok ? response.json() : null)
      .then(result => {
        if (!alive) return;
        if (!result?.user) {
          setStatus("denied");
          setLocation("/auth");
          return;
        }
        setEmail(String(result.user.email ?? ""));
        setStatus(roles.includes(result.user.role) ? "allowed" : "denied");
        if (!roles.includes(result.user.role)) setLocation("/");
      })
      .catch(() => {
        if (!alive) return;
        setStatus("denied");
        setLocation("/auth");
      });
    return () => { alive = false; };
  }, [roles.join(","), setLocation]);
  if (status !== "allowed") return <div className="page-wrap"><div className="container"><p role="status">{status === "loading" ? "Vérification de votre session…" : "Accès réservé aux comptes autorisés."}</p></div></div>;
  const signOut = async () => {
    setSigningOut(true);
    try {
      const csrfResponse = await fetch("/auth/csrf", { credentials: "same-origin", cache: "no-store" });
      const { csrfToken } = await csrfResponse.json();
      await fetch("/auth/signout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken, callbackUrl: "/" }).toString(),
        redirect: "follow",
      });
    } finally {
      setSigningOut(false);
      setLocation("/");
    }
  };
  return <><div className="container private-area-bar"><span>Connecté : {email}</span><button className="button button--outline" onClick={() => void signOut()} disabled={signingOut}>{signingOut ? "Déconnexion…" : "Se déconnecter"}</button></div>{children}</>;
}

function NotFoundPage() {
  return <div className="page-wrap"><div className="container not-found"><span className="eyebrow"><i /> ERREUR 404</span><h1>Cette page n’a pas<br />encore <em>trouvé sa voie.</em></h1><p>Vérifiez l’adresse ou revenez à l’accueil HEMIP.</p><Link className="button button--primary" href="/">Retour à l’accueil <ArrowRight size={16} /></Link></div></div>;
}

function App() {
  const [pathname] = useLocation();
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return <Magnetic className={`app-shell ${pathname === "/album" ? "app-shell--album" : ""}`}><Header /><main><Switch><Route path="/" component={HomePage} /><Route path="/a-propos" component={AboutPage} /><Route path="/presentation" component={() => <Redirect to="/a-propos" />} /><Route path="/equipe" component={TeamPage} /><Route path="/recherche" component={ResearchPage} /><Route path="/formations" component={FormationsPage} /><Route path="/admissions" component={AdmissionsPage} /><Route path="/tarifs" component={TarifsPage} /><Route path="/faq" component={FaqPage} /><Route path="/terms" component={TermsPage} /><Route path="/aide" component={HelpPage} /><Route path="/contact" component={ContactPage} /><Route path="/album" component={AlbumPage} /><Route path="/temoignages" component={TestimonialsPage} /><Route path="/annonces">{() => <PrivateArea roles={["student", "teacher", "academic_admin", "evaluation_manager", "payment_manager", "super_admin"]}><AnnouncementsPage /></PrivateArea>}</Route><Route path="/admin/announcements">{() => <PrivateArea roles={["academic_admin", "super_admin"]}><AdminAnnouncementsPage /></PrivateArea>}</Route><Route path="/auth" component={() => <AuthExperience />} /><Route path="/signup" component={() => <AuthExperience initialMode="signup" />} /><Route path="/account/complete" component={AccountCompletePage} /><Route path="/account/pending" component={PendingApprovalPage} /><Route path="/student/dashboard">{() => <PrivateArea roles={["student"]}><StudentDashboard /></PrivateArea>}</Route><Route path="/teacher/dashboard">{() => <PrivateArea roles={["teacher"]}><TeacherDashboard /></PrivateArea>}</Route><Route path="/admin/schedule">{() => <PrivateArea roles={["academic_admin", "super_admin"]}><SecretaryDashboard /></PrivateArea>}</Route><Route path="/admin/evaluations">{() => <PrivateArea roles={["evaluation_manager", "super_admin"]}><EvaluationDashboard /></PrivateArea>}</Route><Route path="/admin/payments">{() => <PrivateArea roles={["payment_manager", "super_admin"]}><FinanceDashboard /></PrivateArea>}</Route><Route path="/super-admin/accounts">{() => <PrivateArea roles={["super_admin"]}><SuperAdminAccountsPage /></PrivateArea>}</Route><Route component={NotFoundPage} /></Switch></main><Footer /><CookieConsent /><a className="whatsapp-float" href={whatsappUrl()} target="_blank" rel="noreferrer" aria-label="Contacter HEMIP sur WhatsApp"><MessageCircle size={19} /><span>WhatsApp</span></a></Magnetic>;
}

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }> };
export default App;
