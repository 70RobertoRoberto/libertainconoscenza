// Video categories for Conoscenza Aperta.
// Kept separate from meditation categories.
export type VideoCategory = {
  name: string;
  slug: string;
};

export const VIDEO_CATEGORIES: VideoCategory[] = [
  { name: "Fisica Quantistica", slug: "fisica-quantistica" },
  { name: "Psicologia e Neuroscienze", slug: "psicologia-neuroscienze" },
  { name: "Coscienza e Spiritualità", slug: "coscienza-spiritualita" },
  { name: "Medicina Complementare", slug: "medicina-complementare" },
  { name: "Somatognostica", slug: "somatognostica" },
  { name: "Discipline Naturali e Orientali", slug: "discipline-naturali-orientali" },
  { name: "Interviste", slug: "interviste" },
];

export const VIDEO_CATEGORY_NAMES = VIDEO_CATEGORIES.map((c) => c.name);

export function findVideoCategoryBySlug(slug: string) {
  return VIDEO_CATEGORIES.find((c) => c.slug === slug);
}
