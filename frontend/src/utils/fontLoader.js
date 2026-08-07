// Curated Google Fonts Catalog for Shop Name Typography Customization
export const CURATED_FONTS = [
  { id: "Outfit", name: "Modern Sans (Default)", family: "'Outfit', sans-serif", query: "Outfit:wght@400;500;700", category: "sans-serif" },
  { id: "Dancing Script", name: "Elegant Script", family: "'Dancing Script', cursive", query: "Dancing+Script:wght@400;700", category: "cursive" },
  { id: "Playfair Display", name: "Classic Serif", family: "'Playfair Display', serif", query: "Playfair+Display:ital,wght@0,400..700", category: "serif" },
  { id: "Cinzel", name: "Luxury", family: "'Cinzel', serif", query: "Cinzel:wght@400;700;900", category: "serif" },
  { id: "Inter", name: "Minimal", family: "'Inter', sans-serif", query: "Inter:wght@400;500;700", category: "sans-serif" },
  { id: "Montserrat", name: "Bold", family: "'Montserrat', sans-serif", query: "Montserrat:wght@700;900", category: "sans-serif" },
  { id: "Great Vibes", name: "Handwritten", family: "'Great Vibes', cursive", query: "Great+Vibes", category: "cursive" },
  { id: "Cormorant Garamond", name: "Vintage Glamour", family: "'Cormorant Garamond', serif", query: "Cormorant+Garamond:wght@600;700", category: "serif" },
  { id: "Bodoni Moda", name: "Royal Chic", family: "'Bodoni Moda', serif", query: "Bodoni+Moda:ital,wght@0,600..900", category: "serif" },
  { id: "Syne", name: "Modern Luxury", family: "'Syne', sans-serif", query: "Syne:wght@700;800", category: "sans-serif" },
  { id: "Sacramento", name: "Soft Cursive", family: "'Sacramento', cursive", query: "Sacramento", category: "cursive" },
  { id: "Prata", name: "Boutique Serif", family: "'Prata', serif", query: "Prata", category: "serif" },
  { id: "Tenor Sans", name: "High Fashion", family: "'Tenor Sans', sans-serif", query: "Tenor+Sans", category: "sans-serif" },
  { id: "Pacifico", name: "Playful Cursive", family: "'Pacifico', cursive", query: "Pacifico", category: "cursive" },
  { id: "Marcellus", name: "Art Deco", family: "'Marcellus', serif", query: "Marcellus", category: "serif" },
  { id: "Plus Jakarta Sans", name: "Geometric Sans", family: "'Plus Jakarta Sans', sans-serif", query: "Plus+Jakarta+Sans:wght@700;800", category: "sans-serif" },
  { id: "Alex Brush", name: "Calligraphic", family: "'Alex Brush', cursive", query: "Alex+Brush", category: "cursive" },
  { id: "Lora", name: "Refined Serif", family: "'Lora', serif", query: "Lora:ital,wght@0,600;1,600", category: "serif" },
];

export const DEFAULT_TYPOGRAPHY = {
  enabled: false,
  font_family: "Outfit",
  font_size: 32,
  font_weight: "700",
  letter_spacing: 0,
};

// Cache to prevent duplicate DOM <link> tag insertions
const loadedFontsCache = new Set();

/**
 * Dynamically loads a Google Font by font ID / family name on demand.
 */
export function loadGoogleFont(fontId) {
  if (!fontId || fontId === "system") return;

  const font = CURATED_FONTS.find(f => f.id.toLowerCase() === fontId.toLowerCase() || f.name.toLowerCase() === fontId.toLowerCase()) || CURATED_FONTS[0];

  if (loadedFontsCache.has(font.id)) return;

  try {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${font.query}&display=swap`;
    document.head.appendChild(link);
    loadedFontsCache.add(font.id);
  } catch (err) {
    console.warn("Failed to dynamically load Google Font:", font.id, err);
  }
}

/**
 * Computes the inline CSS style object for the shop name based on tenant typography settings.
 * Returns an empty object if typography is disabled (reverting to system UI font).
 */
export function getShopNameStyle(typography) {
  if (!typography || typography.enabled === false) {
    return {};
  }

  const fontFamilyName = typography.font_family || "Outfit";

  // Pre-load Google Font asynchronously
  loadGoogleFont(fontFamilyName);

  const fontObj = CURATED_FONTS.find(
    f => f.id.toLowerCase() === fontFamilyName.toLowerCase() || f.name.toLowerCase() === fontFamilyName.toLowerCase()
  ) || CURATED_FONTS[0];

  const fontSize = Math.max(14, Math.min(64, Number(typography.font_size) || 32));
  const fontWeight = ["400", "500", "700"].includes(String(typography.font_weight)) ? String(typography.font_weight) : "700";
  const letterSpacing = Math.max(-2, Math.min(10, Number(typography.letter_spacing) || 0));

  return {
    fontFamily: fontObj.family,
    fontSize: `${fontSize}px`,
    fontWeight: fontWeight,
    letterSpacing: `${letterSpacing}px`,
  };
}
