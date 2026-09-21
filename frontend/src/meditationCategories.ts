/**
 * Categories for the "Meditazioni" section, in alphabetical order.
 * Each entry has:
 *  - name: Italian label displayed to the user (matches backend MEDITATION_CATEGORIES exactly).
 *  - slug: URL-safe identifier used in route params.
 *  - image: cover image for the category card and its detail page (placeholder — user will replace).
 *  - description: short intro shown on the category detail page (placeholder — user will replace).
 *
 * The name must match exactly what the backend stores in media.meditation_category.
 */

export type MeditationCategory = {
  name: string;
  slug: string;
  image: string;
  description: string;
};

const PLACEHOLDER_IMG = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=1200&auto=format&fit=crop&q=70`;

export const MEDITATION_CATEGORIES: MeditationCategory[] = [
  {
    name: "Armonizzazione e Radicamento",
    slug: "armonizzazione-e-radicamento",
    image: PLACEHOLDER_IMG("1518709414768-a88981a4515d"),
    description:
      "Meditazioni per riportare equilibrio tra corpo, mente e anima, ancorandoti alla Terra e alla tua natura più profonda.",
  },
  {
    name: "Autostima",
    slug: "autostima",
    image: PLACEHOLDER_IMG("1522075469751-3a6694fb2f61"),
    description:
      "Pratiche che nutrono il valore di sé, sciolgono il giudizio interiore e coltivano fiducia autentica nelle proprie qualità.",
  },
  {
    name: "Calma e Serenità",
    slug: "calma-e-serenita",
    image: PLACEHOLDER_IMG("1500375592092-40eb2168fd21"),
    description:
      "Meditazioni per attraversare la tempesta emotiva e riscoprire lo spazio quieto che abita al centro di te.",
  },
  {
    name: "Concentrazione e Attenzione",
    slug: "concentrazione-e-attenzione",
    image: PLACEHOLDER_IMG("1499209974431-9dddcece7f88"),
    description:
      "Esercizi per allenare la mente, radunare i pensieri dispersi e riportare la piena attenzione all'istante presente.",
  },
  {
    name: "Perdono",
    slug: "perdono",
    image: PLACEHOLDER_IMG("1470114716524-46bd127b03e6"),
    description:
      "Meditazioni per liberare il cuore dai pesi del passato, sciogliere risentimenti e aprirsi alla riconciliazione.",
  },
  {
    name: "Presenza e Ascolto Interiore",
    slug: "presenza-e-ascolto-interiore",
    image: PLACEHOLDER_IMG("1506126613408-eca07ce68773"),
    description:
      "Pratiche di ascolto profondo, per accogliere ciò che è, coltivare consapevolezza e dialogare con la propria voce autentica.",
  },
  {
    name: "Ricarica energetica",
    slug: "ricarica-energetica",
    image: PLACEHOLDER_IMG("1495562569060-2eec283d3391"),
    description:
      "Meditazioni che risvegliano la forza vitale, rinnovano il campo energetico e ricaricano corpo e spirito di luce.",
  },
  {
    name: "Rilassamento",
    slug: "rilassamento",
    image: PLACEHOLDER_IMG("1518604666860-9ed391f76460"),
    description:
      "Sessioni per sciogliere le tensioni fisiche ed emotive, lasciar andare il controllo e affidarti al respiro.",
  },
  {
    name: "Sonno",
    slug: "sonno",
    image: PLACEHOLDER_IMG("1519681393784-d120267933ba"),
    description:
      "Meditazioni che accompagnano dolcemente al riposo profondo, calmando il pensiero e preparando corpo e mente al sonno.",
  },
];

export const MEDITATION_HERO_IMAGE = PLACEHOLDER_IMG("1506126613408-eca07ce68773");

export const MEDITATION_ABOUT_TEXT = `La meditazione è l'arte di tornare a casa: un ritorno silenzioso al centro di sé, oltre il rumore dei pensieri e delle emozioni. Non è fuga dal mondo, ma incontro profondo con la propria essenza.

Ogni meditazione è un invito a respirare consapevolmente, ad ascoltare il corpo, a lasciar decantare la mente e a riscoprire quella quiete che è la vera natura dell'essere. Non serve saper meditare: basta permettersi di essere.

Scegli la categoria che risuona con il tuo momento presente e lasciati guidare. Anche pochi minuti al giorno, praticati con costanza, possono trasformare il modo in cui abiti la vita.`;

export function findCategoryBySlug(slug: string): MeditationCategory | undefined {
  return MEDITATION_CATEGORIES.find((c) => c.slug === slug);
}
