// Persistent asset URLs served by our own backend (Emergent Object Storage)
// via the /api/files/<path> streaming endpoint. No preview-job-scoped URLs
// here — those get wiped when the preview environment is recycled.
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const abs = (p: string) => (p.startsWith("http") ? p : `${BACKEND}${p}`);

export const LOGO_URL = abs("/api/files/category-covers/logo-app-760bceb5.jpg");

export const CATEGORY_IMAGES: Record<string, string> = {
  "Crescita personale": abs("/api/files/category-covers/crescita-personale-673ba40f.png"),
  "Spirituale": abs("/api/files/category-covers/spirituale-098b281d.png"),
  "Fisica quantistica": abs("/api/files/category-covers/fisica-quantistica-9e5dda8e.png"),
  "Meditazione": "https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=800",
  "Discipline orientali": "https://images.unsplash.com/photo-1545389336-cf090694435e?w=800",
  "Naturopatia": abs("/api/files/category-covers/naturopatia-a539aaec.png"),
  "Psicologia": abs("/api/files/category-covers/psicologia-73a6c0b2.jpg"),
  "Medicina Integrata": abs("/api/files/category-covers/medicina-integrata-bffb6321.png"),
  "Filosofia": "https://images.unsplash.com/photo-1519791883288-dc8bd696e667?w=800",
  "Nutrizione": "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800",
  "Somatognostica": abs("/api/files/category-covers/somatognostica-15dedab4.png"),
  "Coscienza": abs("/api/files/category-covers/coscienza-1b95e084.jpg"),
  "Tradizioni Esoteriche": abs("/api/files/category-covers/tradizioni-esoteriche-3771e1ca.png"),
  "Guarigione Energetica": abs("/api/files/category-covers/guarigione-energetica-77bd9d62.png"),
  "Video": "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800",
};

export const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1636794369713-f3eb3c8a3535?w=800";
