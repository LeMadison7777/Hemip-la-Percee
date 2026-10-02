import { ArrowRight, ArrowUpRight, BookOpen, Check, GraduationCap, MapPin, ShieldCheck, Sparkles, UsersRound, Wrench } from "lucide-react";
import { Link } from "wouter";
import type { ReactNode } from "react";

const faculty = [
  ["Prof. Arthur NSEKA", "Génie des procédés et pétrochimie"],
  ["Dr. KIEMBA", "Chimie pure"],
  ["Dr. MBENGUELE Martial", "Management"],
  ["Dr. NZAOU", "Littérature française"],
  ["Dr. Fabrice KAMPIAMBA", "Génie des procédés"],
  ["Dr. Wighens NGOIE", "Génie chimique"],
  ["Dr. Lauriane MENANKUTIMA", "Raffinage et pétrochimie"],
  ["Ir. Joseph KOMBI", "Raffinage et pétrochimie"],
  ["Ir. Eugène DIAYIKA", "Génie numérique"],
  ["Ir. Junior MALATOU", "Électronique"],
  ["Ir. Ferdinand MUKOKO", "Génie électromécanique"],
  ["Ir. Thryphon MUNGONGO", "Servo-automatisme"],
  ["Ir. Dorian", "Électromécanique et production pétrolière"],
  ["Ir. Van EKOKO", "Génie des procédés"],
  ["Ir. Christian KAYEMBE", "Génie électrique et énergies renouvelables"],
];

const strengths = [
  "Enseignements dans le système LMD avec des programmes élaborés et des enseignants qualifiés et expérimentés, résidents ou venus de l’extérieur ; les autres formateurs cités possèdent au moins un Master.",
  "Enseignement bilingue en français et en anglais, en particulier dans les cours de base et le génie des procédés.",
  "Place importante accordée à la pratique en laboratoires et en ateliers, avec des classes à effectifs réduits.",
  "Horaires de cours flexibles, avec des vacations de jour et du soir.",
  "Partenariats avec des institutions d’enseignement supérieur.",
  "Recherche appliquée axée sur les besoins des communautés.",
  "Visites et stages professionnels auprès d’entreprises locales.",
  "Des stages qui peuvent déboucher sur un emploi selon les compétences démontrées ; la présentation indique que certains stagiaires ont signé des contrats CDD ou CDI.",
  "Une préparation à l’autonomie et à la création de projets ou de start-ups.",
  "Des bourses d’études possibles pour les étudiants les plus méritants.",
];

const academicPartners = ["ENGDE · France", "HESTIM · Maroc", "I.S.T.A. · RDC", "IPSAS · Tunisie"];
const internshipOrganizations = ["CORAF", "SNPC", "TotalEnergies", "Eni Congo", "Congolaise des Eaux", "Énergie Électrique du Congo", "Banques publiques et privées", "Dangoté", "BRASCO"];

function SectionTitle({ label, title, detail }: { label: string; title: string; detail?: string }) {
  return <div className="institution-section-title"><span className="eyebrow">{label}</span><h2>{title}</h2>{detail && <p>{detail}</p>}</div>;
}

function PageIntro({ kicker, title, detail }: { kicker: string; title: ReactNode; detail: string }) {
  return <header className="page-heading institution-page-intro"><span className="eyebrow"><i /> {kicker}</span><h1>{title}</h1><p>{detail}</p></header>;
}

function StatGrid() {
  const items = [
    ["2013", "année de création"],
    ["14", "salles de classe"],
    ["82", "enseignants"],
    ["760", "étudiants à Pointe-Noire"],
    ["10", "personnels administratifs"],
  ];
  return <div className="institution-stats">{items.map(([value, label]) => <div className="institution-stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>;
}

export function AboutPage() {
  return (
    <div className="page-wrap legacy-public-page institution-page">
      <div className="container">
        <PageIntro
          kicker="À PROPOS DE HEMIP · LA HAUTE ÉCOLE DE MANAGEMENT ET D’INGÉNIERIE LA PERCÉE"
          title={<>Former pour <em>faire avancer.</em></>}
          detail="HEMIP est un établissement privé d’enseignement supérieur agréé définitivement par l’État en République du Congo. Depuis 2013, l’école forme en ingénierie et en management à Pointe-Noire, avec une extension à Nkayi."
        />
        <section className="institution-section" id="effectifs">
          <SectionTitle label="NOS EFFECTIFS" title="Une communauté en croissance." detail="Quelques repères sur les apprenants et les équipes de HEMIP." />
          <StatGrid />
        </section>

        <section className="institution-section" id="histoire">
          <SectionTitle label="HISTOIRE ET STATUT" title="Une école ancrée dans son territoire." />
          <div className="institution-story-grid">
            <article className="institution-story-card"><span className="institution-symbol"><GraduationCap size={23} /></span><h3>Depuis 2013</h3><p>La Haute École de Management et d’Ingénierie La Percée — HEMIP — est une institution tertiaire privée agréée de l’Enseignement supérieur et universitaire de la République du Congo.</p></article>
            <article className="institution-story-card"><span className="institution-symbol"><MapPin size={21} /></span><h3>Pointe-Noire et Nkayi</h3><p>Le campus principal se trouve au centre-ville de Pointe-Noire, derrière la Tour Mayombe, à côté de la Clinique Netcare. HEMIP possède également une extension à Nkayi.</p></article>
            <article className="institution-story-card"><span className="institution-symbol"><UsersRound size={21} /></span><h3>Des diplômés dans la vie active</h3><p>La présentation de l’établissement indique que HEMIP a déjà diplômé des centaines de techniciens supérieurs et de licenciés professionnels, dont beaucoup travaillent comme agents ou cadres.</p></article>
          </div>
        </section>

        <section className="institution-section institution-vision" id="vision-mission">
          <SectionTitle label="VISION ET MISSION" title="Apprendre, chercher, contribuer." />
          <div className="institution-vision-grid">
            <article className="institution-feature institution-feature--vision"><span className="eyebrow eyebrow--light">NOTRE VISION</span><h3>Devenir l’une des meilleures institutions supérieures en Afrique.</h3></article>
            <article className="institution-feature"><span className="eyebrow">NOTRE MISSION</span><h3>Relier les compétences aux besoins du pays.</h3><ul className="institution-check-list"><li><Check size={16} /> Assurer une formation de qualité dans le système LMD, en ingénierie et en management, avec des enseignants qualifiés, professionnels et innovateurs.</li><li><Check size={16} /> Développer une recherche scientifique appliquée au sein d’une unité de recherche, pour répondre aux enjeux de la société.</li><li><Check size={16} /> Préparer les étudiants à la vie professionnelle dans l’industrie, les entreprises, les banques ou l’entrepreneuriat.</li></ul></article>
          </div>
        </section>

        <section className="institution-section" id="moyens">
          <SectionTitle label="ÉQUIPEMENTS ET RESSOURCES" title="Des lieux pour apprendre en faisant." detail="Les ateliers, laboratoires et ressources numériques soutiennent les enseignements pratiques." />
          <div className="institution-resource-grid">
            <article className="institution-resource"><Wrench size={22} /><h3>Ateliers et laboratoires</h3><p>Ateliers de mécanique et d’électricité ; laboratoires de chimie, d’informatique et d’électronique.</p></article>
            <article className="institution-resource"><BookOpen size={22} /><h3>Bibliothèque</h3><p>Ressources physiques et numériques pour les étudiants et les enseignants.</p></article>
            <article className="institution-resource"><ShieldCheck size={22} /><h3>Logiciels disponibles</h3><p>Visual Studio, Algobox, Cisco Packet Tracer, AutoCAD, SolidWorks, MATLAB, EnyB, Bsim-1 et Sage.</p></article>
          </div>
        </section>

        <section className="institution-section" id="equipe">
          <SectionTitle label="ÉQUIPE PÉDAGOGIQUE" title="Une équipe aux spécialités variées." detail="Enseignants et chercheurs réunissent des compétences dans plusieurs disciplines." />
          <div className="faculty-grid">{faculty.map(([name, specialty]) => <article className="faculty-card" key={name}><span className="faculty-mark">{name.startsWith("Prof") ? "P" : name.startsWith("Dr") ? "D" : "I"}</span><div><h3>{name}</h3><p>{specialty}</p></div></article>)}</div>
        </section>

        <section className="institution-section" id="partenaires">
          <SectionTitle label="PARTENARIATS ET INSERTION" title="Des liens avec le monde professionnel." detail="La Direction des Affaires Académiques organise des contacts, des visites guidées et des stages auprès d’organisations locales. Un stage peut conduire à un emploi selon les compétences démontrées."
          />
          <div className="partner-name-grid">{academicPartners.map(name => <div className="partner-name-card" key={name}><BookOpen size={17} />{name}</div>)}</div>
          <p className="institution-list-label">Entreprises et organisations citées pour les visites ou les stages (liste non exhaustive)</p>
          <ul className="institution-chip-list">{internshipOrganizations.map(name => <li key={name}>{name}</li>)}</ul>
          <p className="institution-fine-print">Les organisations mentionnées sont situées à Pointe-Noire ou à Brazzaville. Pour les modalités d’un stage ou d’une visite, contactez la scolarité.</p>
        </section>

        <section className="institution-section" id="atouts">
          <SectionTitle label="POURQUOI CHOISIR HEMIP" title="Dix atouts présentés par l’établissement." />
          <ol className="strength-grid">{strengths.map((strength, index) => <li key={strength}><span>{String(index + 1).padStart(2, "0")}</span><p>{strength}</p></li>)}</ol>
          <div className="institution-scholarship"><Sparkles size={19} /><p>La présentation mentionne la possibilité de bourses d’études pour les étudiants les plus méritants. Renseignez-vous auprès de l’administration sur les conditions en vigueur.</p></div>
        </section>

        <section className="institution-section" id="perspectives">
          <SectionTitle label="PERSPECTIVES" title="Des objectifs pour la suite." detail="Les perspectives ci-dessous sont les objectifs annoncés dans la présentation institutionnelle." />
          <ul className="perspective-list"><li>Ouvrir un cycle de Master professionnel au sein de l’établissement.</li><li>Continuer à améliorer la qualité des formations et à recruter des enseignants et chercheurs qualifiés.</li><li>Accroître les effectifs d’apprenants et améliorer les équipements techniques.</li><li>Développer la recherche pour lui donner une portée scientifique internationale.</li><li>Élargir les partenariats avec d’autres institutions d’enseignement supérieur.</li></ul>
        </section>

        <div className="institution-bottom-links"><Link className="button button--primary" href="/formations">Voir les formations <ArrowRight size={15} /></Link><Link className="button button--outline" href="/recherche">Découvrir la recherche et les projets <ArrowUpRight size={15} /></Link></div>
      </div>
    </div>
  );
}

const researchSectors = [
  {
    name: "Énergies et hydrocarbures",
    scope: "Énergies renouvelables, raffinage et pétrochimie.",
    projects: "Essence, kérosène, GPL, biogaz, biocarburants, biodiesel, bioéthanol et électricité d’origine thermique, biologique, solaire ou hydraulique.",
    clients: "CORAF, Eni, AOGC, Perenco, E2C, Congolaise des Eaux, Trident, SNPC, TotalEnergies, transporteurs et populations.",
  },
  {
    name: "Mines et minéralurgie",
    scope: "Études et projets d’exploitation minière raisonnée.",
    projects: "Élaboration de plans d’affaires et projets d’exploitation de l’or, du coltan, du cuivre, du cobalt, du palladium et du platine ; valorisation du calcaire pour produire ciment et craie.",
    clients: "Dangoté, AngloGold, GCM, CILU et entrepreneurs.",
  },
  {
    name: "Génie industriel",
    scope: "Conception et production de biens et d’équipements.",
    projects: "Eau potable, catalyseurs, craies, peintures, ciments, sucres, alcools, pièces mécaniques, détergents, biofertilisants et engrais chimiques.",
    clients: "Entreprises chimiques et pétrolières, universités, constructeurs et populations.",
  },
  {
    name: "Consultance",
    scope: "Études, accompagnement et renforcement des compétences.",
    projects: "Développement de logiciels, forage d’eau, installation de systèmes solaires photovoltaïques, formations courtes, renforcement des capacités et études techniques pour les entreprises pétrolières (production, raffinage et pétrochimie), de construction et agroalimentaires ; projets d’ingénierie et études environnementales (EIE, PGES).",
    clients: "Agriculteurs, Saris Congo, Dangoté, Congolaise des Eaux, écoles, universités et entreprises.",
  },
];

function ResearchProject({ title, children }: { title: string; children: ReactNode }) {
  return <article className="research-project"><span className="eyebrow">PROJET PRÉSENTÉ PAR HEMIP</span><h3>{title}</h3>{children}</article>;
}

export function ResearchPage() {
  return (
    <div className="page-wrap legacy-public-page institution-page research-page">
      <div className="container">
        <PageIntro kicker="RECHERCHE · INNOVATION · DÉVELOPPEMENT" title={<>Des idées à l’épreuve <em>du terrain.</em></>} detail="L’unité de recherche de HEMIP travaille en génie des procédés et en ingénierie pour explorer des solutions utiles aux entreprises et aux communautés." />

        <section className="institution-section">
          <SectionTitle label="SECTEURS D’INTERVENTION" title="Quatre domaines de recherche et d’application." />
          <div className="research-sector-grid">{researchSectors.map((sector, index) => <article className="research-sector" key={sector.name}><span className="research-sector-number">0{index + 1}</span><h3>{sector.name}</h3><p>{sector.scope}</p><strong>Activités et produits</strong><p>{sector.projects}</p><strong>Clients potentiels cités</strong><p>{sector.clients}</p></article>)}</div>
        </section>

        <section className="institution-section">
          <SectionTitle label="PROJETS PRÉSENTÉS" title="Des procédés aux prototypes." detail="La présentation de l’établissement décrit notamment les pistes et travaux suivants." />
          <div className="research-project-grid">
            <ResearchProject title="Biodiesel, bioéthanol et énergie"><p>Des chaînes pilotes et semi-industrielles sont présentées pour le biodiesel, le bioéthanol et la production d’électricité. Les produits cités comprennent l’éthanol, le biodiesel, la glycérine, des résidus de distillation du maïs, le biokérosène, ainsi que des sous-produits comme la noix de palme et sa coque, le gel hydroalcoolique, la chaux éteinte, le CO₂ et l’eau chaude. Une centrale thermique de production d’électricité de 1 MW est également illustrée.</p></ResearchProject>
            <ResearchProject title="Simulateurs et logiciels de gestion"><p>Le parcours de génie logiciel contribue à la modélisation et au développement de simulateurs et de logiciels de gestion de systèmes.</p></ResearchProject>
            <ResearchProject title="Recyclage et valorisation des déchets plastiques"><p>Une chaîne de traitement décrite dans le document transforme les déchets plastiques collectés, triés, broyés et chauffés en produits tels que gaz GPL, essence et diesel. Le schéma inclut des équipements de convoyage, broyage, génération de chaleur, réaction, condensation, pompage et distillation ; il présente aussi la production de pavés à partir de bitume et de sable.</p></ResearchProject>
            <ResearchProject title="Traitement industriel de l’eau de surface"><p>Un schéma synoptique présente une chaîne de traitement de l’eau de surface, avec plusieurs étapes de procédé et un ajustement du pH, jusqu’à l’obtention d’eau traitée.</p></ResearchProject>
          </div>
        </section>

        <section className="institution-section bone-project" id="materiaux-ecologiques">
          <SectionTitle label="GÉNIE DES PROCÉDÉS · MATÉRIAUX ÉCOLOGIQUES" title="Valoriser les os de bétail pour fabriquer un matériau de substitution à la chaux vive." detail="Un projet de recherche en génie chimique présenté par HEMIP pour les ouvrages de génie civil et d’autres applications industrielles." />
          <div className="bone-project-layout">
            <div className="bone-project-copy"><h3>Pourquoi cette recherche ?</h3><p>La présentation relève que le calcaire n’est pas réparti uniformément en République du Congo. Elle propose d’étudier des os de bétail collectés comme matière première renouvelable, pour produire un matériau à base d’oxyde de calcium et réduire la dépendance à la chaux vive commerciale dans des usages comme le ciment, la craie ou le plâtre. Le document compare l’oxyde de calcium issu du calcaire — CaCO₃ → CaO + CO₂ — à celui issu de l’hydroxyapatite des os — Ca₁₀(PO₄)₆(OH)₂ → 10 CaO + 3 P₂O₅ + H₂O — et présente cette seconde voie comme une piste de réduction du CO₂ de procédé et de création de crédits carbone. Il oppose le carbone géologique libéré par le calcaire à un cycle biogénique court associé à la matière agricole, et avance que les émissions de procédé seraient quasi nulles sans CaCO₃. Le projet vise aussi à vérifier les caractéristiques du matériau, sa conformité aux normes et sa viabilité économique.</p><h3>Du déchet au matériau</h3><ol className="process-steps"><li><span>01</span><p>Collecter et préparer les os de bétail.</p></li><li><span>02</span><p>Effectuer une calcination par pyrolyse dans un four électrique à température contrôlée, entre 450 et 900 °C selon la présentation.</p></li><li><span>03</span><p>Broyer la matière calcinée, puis étudier l’énergie de broyage à l’aide de la loi de Bond, présentée sous la forme w = 10 Wᵢ (1/P₈₀ − 1/F₈₀).</p></li><li><span>04</span><p>Préparer des mortiers et comparer leur résistance mécanique en compression avec des mortiers à liant commercial.</p></li></ol></div>
            <aside className="bone-project-results"><span className="eyebrow eyebrow--light">RÉSULTATS RAPPORTÉS DANS LA PRÉSENTATION</span><h3>Une piste de valorisation à approfondir.</h3><p>Le document indique un rendement moyen d’environ 56 % pour la production de CaO à partir d’hydroxyapatite. Il rapporte aussi une résistance en compression supérieure pour les mortiers au liant issu des os par rapport au liant commercial. Les protocoles et résultats détaillés ne sont pas fournis dans la présentation.</p><div><ShieldCheck size={17} /><span>Ces résultats sont rapportés comme des travaux de recherche de HEMIP et ne constituent pas une certification de produit.</span></div></aside>
          </div>
          <div className="carbon-note"><strong>Estimations carbone à confirmer</strong><p>La présentation avance une piste de crédits carbone pour une production annoncée de 10 000 tonnes de CaO par jour. Elle mentionne 7 850 crédits à 25 $ et inscrit 166 250 $ par jour, alors que 7 850 × 25 $ donne 196 250 $. La projection annuelle de 56 520 000 $ reprend ce second montant sur 24 jours par mois. Le calcul et les hypothèses carbone doivent être vérifiés avant toute communication financière.</p></div>
        </section>

          <div className="institution-bottom-links"><Link className="button button--primary" href="/a-propos">Découvrir HEMIP <ArrowRight size={15} /></Link><Link className="button button--outline" href="/formations">Voir les formations <ArrowUpRight size={15} /></Link></div>
      </div>
    </div>
  );
}
