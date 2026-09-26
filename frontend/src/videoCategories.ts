// Video categories for Libertà in Conoscenza.
// Enriched with hero image, description and benefits — same shape as
// meditationCategories.ts so the detail screen mirrors that flow.
export type VideoCategory = {
  name: string;
  slug: string;
  image: string;
  description: string; // paragraphs separated by "\n\n"
  benefits: string[];  // "Cosa troverai" bullets
};

export const VIDEO_CATEGORIES: VideoCategory[] = [
  {
    name: "Fisica Quantistica",
    slug: "fisica-quantistica",
    image:
      "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1200&auto=format&fit=crop&q=70",
    description:
      "La fisica quantistica racconta un mondo in cui la materia è vibrazione, l'osservatore partecipa alla realtà osservata e l'informazione precede la forma. In questa sezione presentiamo video divulgativi che aprono lo sguardo sui principi fondamentali della meccanica quantistica e sulle loro implicazioni per la coscienza, la biologia e la nostra esperienza quotidiana.\n\nContenuti curati per chi si avvicina per la prima volta a questi temi e per chi desidera approfondire dal punto di vista sperimentale, teorico e filosofico.",
    benefits: [
      "Comprendere in modo accessibile i principi della meccanica quantistica",
      "Scoprire i legami tra fisica, coscienza e biologia",
      "Ascoltare voci di ricercatori, docenti e divulgatori qualificati",
      "Aprire una nuova visione del reale, oltre il modello meccanicista",
    ],
  },
  {
    name: "Psicologia e Neuroscienze",
    slug: "psicologia-neuroscienze",
    image:
      "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=1200&auto=format&fit=crop&q=70",
    description:
      "Come funziona la mente? Cosa dice la neurofisiologia dei nostri stati emotivi, del pensiero, della coscienza? In questa sezione trovi video di psicologia clinica, neuroscienze contemporanee, ricerca sul cervello e sulla mente-corpo.\n\nUn viaggio nei meccanismi che ci abitano, per comprenderci meglio e trasformare comportamenti, emozioni e relazioni con maggiore consapevolezza.",
    benefits: [
      "Approfondire il funzionamento della mente e del cervello",
      "Riconoscere schemi emotivi e comportamentali",
      "Integrare psicologia, neuroscienze e discipline del benessere",
      "Strumenti pratici per l'equilibrio emotivo",
    ],
  },
  {
    name: "Coscienza e Spiritualità",
    slug: "coscienza-spiritualita",
    image:
      "https://customer-assets-0z36b82j.emergentagent.net/job_integral-wellness-2/artifacts/ruhw1qgk_image.png",
    description:
      "Che cos'è la coscienza? Da dove nasce il senso di sé? Che rapporto esiste tra il nostro nucleo interiore e le grandi tradizioni spirituali dell'umanità? Questa sezione raccoglie video su coscienza, esperienze mistiche, meditazione contemplativa, dialoghi con maestri e ricercatori spirituali.\n\nUno spazio per ascoltare, riflettere ed espandere il proprio orizzonte interiore.",
    benefits: [
      "Esplorare la natura della coscienza da più prospettive",
      "Confrontare tradizioni spirituali e ricerca contemporanea",
      "Nutrire la propria vita interiore",
      "Trovare spunti concreti per la pratica quotidiana",
    ],
  },
  {
    name: "Medicina Complementare",
    slug: "medicina-complementare",
    image:
      "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1200&auto=format&fit=crop&q=70",
    description:
      "La medicina complementare integra la medicina convenzionale con approcci naturali, energetici e informazionali. In questa sezione presentiamo video su omeopatia, agopuntura, medicina antroposofica, medicina integrata informazionale, biofisica applicata e ricerca clinica di frontiera.\n\nContenuti pensati per pazienti curiosi, operatori del benessere e professionisti sanitari che desiderano ampliare la propria visione.",
    benefits: [
      "Panoramica delle principali medicine complementari",
      "Ponte tra sapere scientifico e tradizionale",
      "Approcci integrati per la salute della persona",
      "Approfondimenti per pazienti e professionisti",
    ],
  },
  {
    name: "Somatognostica",
    slug: "somatognostica",
    image:
      "https://images.unsplash.com/photo-1552196563-55cd4e45efb3?w=1200&auto=format&fit=crop&q=70",
    description:
      "La Somatognostica Scalare Cardiocentrica è la disciplina biofisica sviluppata dal Dott. Roberto Fabbroni, che unifica fisica quantistica, biologia, psicologia e spiritualità nel riequilibrio energetico-informazionale della persona. In questa sezione trovi video dedicati ai fondamenti della disciplina, alla TB Scalare, al Metodo Summa Aurea, agli aspetti pratici del riequilibrio del campo cardiaco.\n\nContenuti didattici, dimostrativi ed esperienziali per chi desidera conoscere in profondità questo approccio.",
    benefits: [
      "Fondamenti della Somatognostica Scalare Cardiocentrica",
      "Introduzione al Metodo Summa Aurea e alla TB Scalare",
      "Applicazioni pratiche di riequilibrio energetico-informazionale",
      "Contenuti curati direttamente dal Dott. Roberto Fabbroni",
    ],
  },
  {
    name: "Discipline Naturali e Orientali",
    slug: "discipline-naturali-orientali",
    image:
      "https://images.unsplash.com/photo-1545389336-cf090694435e?w=1200&auto=format&fit=crop&q=70",
    description:
      "Yoga, tai chi, qi gong, medicina cinese, ayurveda, naturopatia europea. Questa sezione raccoglie video dedicati alle grandi discipline del benessere tradizionale, sia orientali che naturali occidentali.\n\nUn patrimonio millenario di conoscenza sul corpo, il respiro, l'energia vitale e la salute intesa come armonia dinamica dell'insieme.",
    benefits: [
      "Panoramica delle principali discipline naturali e orientali",
      "Fondamenti pratici e teorici",
      "Dimostrazioni ed esercizi introduttivi",
      "Strumenti quotidiani per il benessere del corpo",
    ],
  },
  {
    name: "Interviste",
    slug: "interviste",
    image:
      "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1200&auto=format&fit=crop&q=70",
    description:
      "Voci, storie, esperienze. In questa sezione trovi interviste a ricercatori, medici, terapeuti, insegnanti spirituali, autori e testimoni che condividono il proprio percorso, la propria disciplina e la propria visione.\n\nUn archivio di dialoghi vivi, per approfondire i temi trattati nell'app da prospettive multiple e sfaccettate.",
    benefits: [
      "Conoscenza diretta dei protagonisti dei temi trattati",
      "Storie personali e percorsi di ricerca",
      "Prospettive multiple sui grandi temi del benessere",
      "Ispirazione e strumenti concreti",
    ],
  },
];

export const VIDEO_CATEGORY_NAMES = VIDEO_CATEGORIES.map((c) => c.name);

// Hero shown on the Video tab overview.
export const VIDEO_HERO_IMAGE =
  "https://customer-assets-0z36b82j.emergentagent.net/job_integral-wellness-2/artifacts/xfb711e3_image.png";
export const VIDEO_HERO_TITLE = "Video informativi";

export const VIDEO_ABOUT_TEXT =
  `I video di Libertà in Conoscenza sono contenuti visivi curati per approfondire i temi che stanno al cuore del progetto: coscienza, biofisica, medicina integrata, spiritualità, discipline del benessere.\n\n` +
  `Ogni categoria raccoglie video pensati per una specifica area di ricerca ed esperienza. Puoi esplorare liberamente tutte le categorie o soffermarti su quella che risuona di più con il tuo percorso attuale.\n\n` +
  `Alcuni video sono liberi e accessibili a tutti; altri, di approfondimento qualificato, sono riservati agli iscritti Premium. La libertà di scelta resta sempre nelle tue mani.`;

export function findVideoCategoryBySlug(slug: string) {
  return VIDEO_CATEGORIES.find((c) => c.slug === slug);
}

export function findVideoCategoryByName(name: string) {
  return VIDEO_CATEGORIES.find((c) => c.name === name);
}
