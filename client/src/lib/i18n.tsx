import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "en" | "es" | "fr" | "de";

export const languages: { code: Language; name: string; flag: string }[] = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
];

type TranslationKeys = {
  nav: {
    features: string;
    timeline: string;
    pricing: string;
    gifts: string;
    login: string;
    getStarted: string;
    dashboard: string;
    backToHome: string;
  };
  landing: {
    heroTagline: string;
    heroTitle: string;
    heroTitleHighlight: string;
    heroDescription: string;
    startTree: string;
    watchDemo: string;
    featuresTitle: string;
    featuresSubtitle: string;
    feature1Title: string;
    feature1Desc: string;
    feature2Title: string;
    feature2Desc: string;
    feature3Title: string;
    feature3Desc: string;
    feature4Title: string;
    feature4Desc: string;
    feature5Title: string;
    feature5Desc: string;
    feature6Title: string;
    feature6Desc: string;
    timelineTitle: string;
    timelineSubtitle: string;
    ctaTitle: string;
    ctaDescription: string;
    ctaButton: string;
  };
  gifts: {
    pageTitle: string;
    pageDescription: string;
    giftIdeas: string;
    shopNow: string;
    popular: string;
    priceOn: string;
    createTreeTitle: string;
    createTreeDescription: string;
    startTreeButton: string;
    disclaimer: string;
    ornaments: string;
    ornamentsDesc: string;
    wallArt: string;
    wallArtDesc: string;
    books: string;
    booksDesc: string;
    jewelry: string;
    jewelryDesc: string;
  };
  pricing: {
    title: string;
    subtitle: string;
    free: string;
    premium: string;
    perMonth: string;
    freeTier: string;
    premiumTier: string;
    currentPlan: string;
    upgrade: string;
    features: {
      trees: string;
      members: string;
      collaborators: string;
      timeline: string;
      support: string;
      unlimitedTrees: string;
      unlimitedMembers: string;
      unlimitedCollaborators: string;
      prioritySupport: string;
    };
  };
  common: {
    loading: string;
    error: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    create: string;
    search: string;
  };
};

const translations: Record<Language, TranslationKeys> = {
  en: {
    nav: {
      features: "Features",
      timeline: "Timeline",
      pricing: "Pricing",
      gifts: "Gifts",
      login: "Log In",
      getStarted: "Get Started",
      dashboard: "Dashboard",
      backToHome: "Back to Home",
    },
    landing: {
      heroTagline: "Discover Your Heritage",
      heroTitle: "Build Your Family's",
      heroTitleHighlight: "Living Legacy",
      heroDescription: "Create beautiful, interactive family trees that connect generations. Preserve stories, share memories, and discover your roots together.",
      startTree: "Start Your Tree",
      watchDemo: "Watch Demo",
      featuresTitle: "Everything you need to preserve your family history",
      featuresSubtitle: "Powerful tools designed for genealogy enthusiasts and families alike",
      feature1Title: "Interactive Family Trees",
      feature1Desc: "Build dynamic, visual family trees with drag-and-drop simplicity",
      feature2Title: "Collaborate Together",
      feature2Desc: "Invite family members to contribute and grow your tree together",
      feature3Title: "Privacy Controls",
      feature3Desc: "Control who sees your family information with granular privacy settings",
      feature4Title: "Smart Search",
      feature4Desc: "Find ancestors quickly with powerful search and filter tools",
      feature5Title: "Timeline View",
      feature5Desc: "See your family history unfold chronologically with our timeline feature",
      feature6Title: "AI Assistant",
      feature6Desc: "Get help with genealogy research from our intelligent chatbot",
      timelineTitle: "See Your Family Story Unfold",
      timelineSubtitle: "Our timeline view brings your family history to life",
      ctaTitle: "Ready to discover your roots?",
      ctaDescription: "Join thousands of families preserving their heritage with FamilyRoots",
      ctaButton: "Start Free Today",
    },
    gifts: {
      pageTitle: "Family Tree Gifts & Products",
      pageDescription: "Discover beautiful ways to celebrate and preserve your family heritage. From personalized ornaments to keepsake jewelry, find the perfect gift for yourself or loved ones.",
      giftIdeas: "Gift Ideas",
      shopNow: "Shop Now",
      popular: "Popular",
      priceOn: "on",
      createTreeTitle: "Create Your Own Family Tree",
      createTreeDescription: "Before you gift, document your family history with FamilyRoots. Build a beautiful interactive family tree that you can share with loved ones.",
      startTreeButton: "Start Your Family Tree",
      disclaimer: "Note: Product links lead to external marketplaces. Prices and availability may vary. FamilyRoots is not affiliated with these sellers.",
      ornaments: "Family Tree Ornaments",
      ornamentsDesc: "Beautiful ornaments to celebrate your family heritage",
      wallArt: "Wall Art & Prints",
      wallArtDesc: "Display your family history beautifully on your walls",
      books: "Memory Books & Journals",
      booksDesc: "Preserve stories and memories for future generations",
      jewelry: "Family Jewelry",
      jewelryDesc: "Wearable keepsakes celebrating family bonds",
    },
    pricing: {
      title: "Simple, Transparent Pricing",
      subtitle: "Choose the plan that's right for your family",
      free: "Free",
      premium: "Premium",
      perMonth: "/month",
      freeTier: "Free Forever",
      premiumTier: "$9.99/month",
      currentPlan: "Current Plan",
      upgrade: "Upgrade to Premium",
      features: {
        trees: "1 Family Tree",
        members: "Up to 20 Members",
        collaborators: "2 Collaborators",
        timeline: "Timeline View",
        support: "Email Support",
        unlimitedTrees: "Unlimited Trees",
        unlimitedMembers: "Unlimited Members",
        unlimitedCollaborators: "Unlimited Collaborators",
        prioritySupport: "Priority Support",
      },
    },
    common: {
      loading: "Loading...",
      error: "An error occurred",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      create: "Create",
      search: "Search",
    },
  },
  es: {
    nav: {
      features: "Características",
      timeline: "Cronología",
      pricing: "Precios",
      gifts: "Regalos",
      login: "Iniciar Sesión",
      getStarted: "Comenzar",
      dashboard: "Panel",
      backToHome: "Volver al Inicio",
    },
    landing: {
      heroTagline: "Descubre Tu Herencia",
      heroTitle: "Construye el Legado",
      heroTitleHighlight: "Vivo de Tu Familia",
      heroDescription: "Crea hermosos árboles genealógicos interactivos que conectan generaciones. Preserva historias, comparte recuerdos y descubre tus raíces juntos.",
      startTree: "Comienza Tu Árbol",
      watchDemo: "Ver Demo",
      featuresTitle: "Todo lo que necesitas para preservar la historia de tu familia",
      featuresSubtitle: "Herramientas poderosas diseñadas para entusiastas de la genealogía y familias",
      feature1Title: "Árboles Familiares Interactivos",
      feature1Desc: "Construye árboles familiares visuales y dinámicos con simplicidad de arrastrar y soltar",
      feature2Title: "Colabora Juntos",
      feature2Desc: "Invita a familiares a contribuir y hacer crecer tu árbol juntos",
      feature3Title: "Controles de Privacidad",
      feature3Desc: "Controla quién ve tu información familiar con configuraciones de privacidad granulares",
      feature4Title: "Búsqueda Inteligente",
      feature4Desc: "Encuentra ancestros rápidamente con potentes herramientas de búsqueda y filtro",
      feature5Title: "Vista de Cronología",
      feature5Desc: "Observa la historia de tu familia desarrollarse cronológicamente",
      feature6Title: "Asistente de IA",
      feature6Desc: "Obtén ayuda con investigación genealógica de nuestro chatbot inteligente",
      timelineTitle: "Mira la Historia de Tu Familia Desplegarse",
      timelineSubtitle: "Nuestra vista de cronología da vida a tu historia familiar",
      ctaTitle: "¿Listo para descubrir tus raíces?",
      ctaDescription: "Únete a miles de familias preservando su herencia con FamilyRoots",
      ctaButton: "Comienza Gratis Hoy",
    },
    gifts: {
      pageTitle: "Regalos y Productos de Árbol Genealógico",
      pageDescription: "Descubre hermosas formas de celebrar y preservar tu herencia familiar. Desde adornos personalizados hasta joyas de recuerdo, encuentra el regalo perfecto.",
      giftIdeas: "Ideas de Regalos",
      shopNow: "Comprar Ahora",
      popular: "Popular",
      priceOn: "en",
      createTreeTitle: "Crea Tu Propio Árbol Genealógico",
      createTreeDescription: "Antes de regalar, documenta la historia de tu familia con FamilyRoots. Construye un hermoso árbol genealógico interactivo que puedes compartir.",
      startTreeButton: "Comienza Tu Árbol Genealógico",
      disclaimer: "Nota: Los enlaces de productos llevan a mercados externos. Los precios y la disponibilidad pueden variar.",
      ornaments: "Adornos de Árbol Genealógico",
      ornamentsDesc: "Hermosos adornos para celebrar tu herencia familiar",
      wallArt: "Arte de Pared e Impresiones",
      wallArtDesc: "Muestra tu historia familiar hermosamente en tus paredes",
      books: "Libros de Recuerdos y Diarios",
      booksDesc: "Preserva historias y recuerdos para futuras generaciones",
      jewelry: "Joyas Familiares",
      jewelryDesc: "Recuerdos usables que celebran los lazos familiares",
    },
    pricing: {
      title: "Precios Simples y Transparentes",
      subtitle: "Elige el plan adecuado para tu familia",
      free: "Gratis",
      premium: "Premium",
      perMonth: "/mes",
      freeTier: "Gratis Para Siempre",
      premiumTier: "$9.99/mes",
      currentPlan: "Plan Actual",
      upgrade: "Actualizar a Premium",
      features: {
        trees: "1 Árbol Genealógico",
        members: "Hasta 20 Miembros",
        collaborators: "2 Colaboradores",
        timeline: "Vista de Cronología",
        support: "Soporte por Email",
        unlimitedTrees: "Árboles Ilimitados",
        unlimitedMembers: "Miembros Ilimitados",
        unlimitedCollaborators: "Colaboradores Ilimitados",
        prioritySupport: "Soporte Prioritario",
      },
    },
    common: {
      loading: "Cargando...",
      error: "Ocurrió un error",
      save: "Guardar",
      cancel: "Cancelar",
      delete: "Eliminar",
      edit: "Editar",
      create: "Crear",
      search: "Buscar",
    },
  },
  fr: {
    nav: {
      features: "Fonctionnalités",
      timeline: "Chronologie",
      pricing: "Tarifs",
      gifts: "Cadeaux",
      login: "Connexion",
      getStarted: "Commencer",
      dashboard: "Tableau de bord",
      backToHome: "Retour à l'accueil",
    },
    landing: {
      heroTagline: "Découvrez Votre Héritage",
      heroTitle: "Construisez l'Héritage",
      heroTitleHighlight: "Vivant de Votre Famille",
      heroDescription: "Créez de beaux arbres généalogiques interactifs qui connectent les générations. Préservez les histoires, partagez les souvenirs et découvrez vos racines ensemble.",
      startTree: "Commencez Votre Arbre",
      watchDemo: "Voir la Démo",
      featuresTitle: "Tout ce dont vous avez besoin pour préserver l'histoire de votre famille",
      featuresSubtitle: "Des outils puissants conçus pour les passionnés de généalogie et les familles",
      feature1Title: "Arbres Généalogiques Interactifs",
      feature1Desc: "Construisez des arbres familiaux visuels et dynamiques avec une simplicité glisser-déposer",
      feature2Title: "Collaborez Ensemble",
      feature2Desc: "Invitez les membres de la famille à contribuer et à faire grandir votre arbre ensemble",
      feature3Title: "Contrôles de Confidentialité",
      feature3Desc: "Contrôlez qui voit vos informations familiales avec des paramètres de confidentialité granulaires",
      feature4Title: "Recherche Intelligente",
      feature4Desc: "Trouvez rapidement vos ancêtres avec des outils de recherche et de filtrage puissants",
      feature5Title: "Vue Chronologique",
      feature5Desc: "Voyez l'histoire de votre famille se dérouler chronologiquement",
      feature6Title: "Assistant IA",
      feature6Desc: "Obtenez de l'aide pour la recherche généalogique de notre chatbot intelligent",
      timelineTitle: "Voyez l'Histoire de Votre Famille Se Dérouler",
      timelineSubtitle: "Notre vue chronologique donne vie à votre histoire familiale",
      ctaTitle: "Prêt à découvrir vos racines?",
      ctaDescription: "Rejoignez des milliers de familles qui préservent leur héritage avec FamilyRoots",
      ctaButton: "Commencez Gratuitement",
    },
    gifts: {
      pageTitle: "Cadeaux et Produits d'Arbre Généalogique",
      pageDescription: "Découvrez de belles façons de célébrer et préserver votre héritage familial. Des ornements personnalisés aux bijoux souvenirs, trouvez le cadeau parfait.",
      giftIdeas: "Idées Cadeaux",
      shopNow: "Acheter",
      popular: "Populaire",
      priceOn: "sur",
      createTreeTitle: "Créez Votre Propre Arbre Généalogique",
      createTreeDescription: "Avant d'offrir, documentez l'histoire de votre famille avec FamilyRoots. Construisez un bel arbre généalogique interactif à partager.",
      startTreeButton: "Commencez Votre Arbre Généalogique",
      disclaimer: "Note: Les liens produits mènent vers des marchés externes. Les prix et la disponibilité peuvent varier.",
      ornaments: "Ornements d'Arbre Généalogique",
      ornamentsDesc: "De beaux ornements pour célébrer votre héritage familial",
      wallArt: "Art Mural et Impressions",
      wallArtDesc: "Affichez magnifiquement votre histoire familiale sur vos murs",
      books: "Livres de Souvenirs et Journaux",
      booksDesc: "Préservez les histoires et souvenirs pour les générations futures",
      jewelry: "Bijoux Familiaux",
      jewelryDesc: "Des souvenirs portables célébrant les liens familiaux",
    },
    pricing: {
      title: "Tarification Simple et Transparente",
      subtitle: "Choisissez le plan adapté à votre famille",
      free: "Gratuit",
      premium: "Premium",
      perMonth: "/mois",
      freeTier: "Gratuit Pour Toujours",
      premiumTier: "9,99€/mois",
      currentPlan: "Plan Actuel",
      upgrade: "Passer à Premium",
      features: {
        trees: "1 Arbre Généalogique",
        members: "Jusqu'à 20 Membres",
        collaborators: "2 Collaborateurs",
        timeline: "Vue Chronologique",
        support: "Support par Email",
        unlimitedTrees: "Arbres Illimités",
        unlimitedMembers: "Membres Illimités",
        unlimitedCollaborators: "Collaborateurs Illimités",
        prioritySupport: "Support Prioritaire",
      },
    },
    common: {
      loading: "Chargement...",
      error: "Une erreur s'est produite",
      save: "Enregistrer",
      cancel: "Annuler",
      delete: "Supprimer",
      edit: "Modifier",
      create: "Créer",
      search: "Rechercher",
    },
  },
  de: {
    nav: {
      features: "Funktionen",
      timeline: "Zeitleiste",
      pricing: "Preise",
      gifts: "Geschenke",
      login: "Anmelden",
      getStarted: "Loslegen",
      dashboard: "Dashboard",
      backToHome: "Zurück zur Startseite",
    },
    landing: {
      heroTagline: "Entdecken Sie Ihr Erbe",
      heroTitle: "Bauen Sie das Lebendige",
      heroTitleHighlight: "Vermächtnis Ihrer Familie",
      heroDescription: "Erstellen Sie schöne, interaktive Stammbäume, die Generationen verbinden. Bewahren Sie Geschichten, teilen Sie Erinnerungen und entdecken Sie gemeinsam Ihre Wurzeln.",
      startTree: "Starten Sie Ihren Baum",
      watchDemo: "Demo ansehen",
      featuresTitle: "Alles was Sie brauchen, um Ihre Familiengeschichte zu bewahren",
      featuresSubtitle: "Leistungsstarke Tools für Genealogie-Enthusiasten und Familien",
      feature1Title: "Interaktive Stammbäume",
      feature1Desc: "Erstellen Sie dynamische, visuelle Stammbäume mit Drag-and-Drop-Einfachheit",
      feature2Title: "Gemeinsam Zusammenarbeiten",
      feature2Desc: "Laden Sie Familienmitglieder ein, beizutragen und Ihren Baum gemeinsam zu erweitern",
      feature3Title: "Datenschutzeinstellungen",
      feature3Desc: "Kontrollieren Sie, wer Ihre Familieninformationen sieht, mit granularen Datenschutzeinstellungen",
      feature4Title: "Intelligente Suche",
      feature4Desc: "Finden Sie Vorfahren schnell mit leistungsstarken Such- und Filterwerkzeugen",
      feature5Title: "Zeitleistenansicht",
      feature5Desc: "Sehen Sie Ihre Familiengeschichte chronologisch entfalten",
      feature6Title: "KI-Assistent",
      feature6Desc: "Erhalten Sie Hilfe bei der Genealogieforschung von unserem intelligenten Chatbot",
      timelineTitle: "Sehen Sie Ihre Familiengeschichte Entfalten",
      timelineSubtitle: "Unsere Zeitleistenansicht erweckt Ihre Familiengeschichte zum Leben",
      ctaTitle: "Bereit, Ihre Wurzeln zu entdecken?",
      ctaDescription: "Schließen Sie sich Tausenden von Familien an, die ihr Erbe mit FamilyRoots bewahren",
      ctaButton: "Heute Kostenlos Starten",
    },
    gifts: {
      pageTitle: "Stammbaum Geschenke & Produkte",
      pageDescription: "Entdecken Sie schöne Wege, Ihr Familienerbe zu feiern und zu bewahren. Von personalisierten Ornamenten bis hin zu Andenken-Schmuck, finden Sie das perfekte Geschenk.",
      giftIdeas: "Geschenkideen",
      shopNow: "Jetzt Kaufen",
      popular: "Beliebt",
      priceOn: "auf",
      createTreeTitle: "Erstellen Sie Ihren Eigenen Stammbaum",
      createTreeDescription: "Bevor Sie schenken, dokumentieren Sie Ihre Familiengeschichte mit FamilyRoots. Erstellen Sie einen schönen interaktiven Stammbaum zum Teilen.",
      startTreeButton: "Starten Sie Ihren Stammbaum",
      disclaimer: "Hinweis: Produktlinks führen zu externen Marktplätzen. Preise und Verfügbarkeit können variieren.",
      ornaments: "Stammbaum Ornamente",
      ornamentsDesc: "Schöne Ornamente um Ihr Familienerbe zu feiern",
      wallArt: "Wandkunst & Drucke",
      wallArtDesc: "Zeigen Sie Ihre Familiengeschichte schön an Ihren Wänden",
      books: "Erinnerungsbücher & Tagebücher",
      booksDesc: "Bewahren Sie Geschichten und Erinnerungen für zukünftige Generationen",
      jewelry: "Familienschmuck",
      jewelryDesc: "Tragbare Andenken, die Familienbande feiern",
    },
    pricing: {
      title: "Einfache, Transparente Preise",
      subtitle: "Wählen Sie den richtigen Plan für Ihre Familie",
      free: "Kostenlos",
      premium: "Premium",
      perMonth: "/Monat",
      freeTier: "Für Immer Kostenlos",
      premiumTier: "9,99€/Monat",
      currentPlan: "Aktueller Plan",
      upgrade: "Auf Premium Upgraden",
      features: {
        trees: "1 Stammbaum",
        members: "Bis zu 20 Mitglieder",
        collaborators: "2 Mitarbeiter",
        timeline: "Zeitleistenansicht",
        support: "E-Mail-Support",
        unlimitedTrees: "Unbegrenzte Bäume",
        unlimitedMembers: "Unbegrenzte Mitglieder",
        unlimitedCollaborators: "Unbegrenzte Mitarbeiter",
        prioritySupport: "Prioritäts-Support",
      },
    },
    common: {
      loading: "Laden...",
      error: "Ein Fehler ist aufgetreten",
      save: "Speichern",
      cancel: "Abbrechen",
      delete: "Löschen",
      edit: "Bearbeiten",
      create: "Erstellen",
      search: "Suchen",
    },
  },
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("language") as Language;
      if (saved && translations[saved]) return saved;
      const browserLang = navigator.language.split("-")[0] as Language;
      if (translations[browserLang]) return browserLang;
    }
    return "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
