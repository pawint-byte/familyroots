import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "en" | "es" | "fr" | "de";

export const languages: { code: Language; name: string; shortCode: string }[] = [
  { code: "en", name: "English", shortCode: "EN" },
  { code: "es", name: "Español", shortCode: "ES" },
  { code: "fr", name: "Français", shortCode: "FR" },
  { code: "de", name: "Deutsch", shortCode: "DE" },
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
    howItWorks: string;
    testimonials: string;
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
    gdprCompliant: string;
    freePlan: string;
    howItWorksTitle: string;
    howItWorksSubtitle: string;
    step1Title: string;
    step1Desc: string;
    step2Title: string;
    step2Desc: string;
    step3Title: string;
    step3Desc: string;
    testimonialsTitle: string;
    testimonialsSubtitle: string;
    testimonial1Name: string;
    testimonial1Role: string;
    testimonial1Quote: string;
    testimonial2Name: string;
    testimonial2Role: string;
    testimonial2Quote: string;
    testimonial3Name: string;
    testimonial3Role: string;
    testimonial3Quote: string;
    testimonial4Name: string;
    testimonial4Role: string;
    testimonial4Quote: string;
    headsOfHouseholdCta: string;
    headsOfHouseholdDesc: string;
    familyConnections: string;
    heroVisualYou: string;
    heroVisualSis: string;
    heroVisualC1: string;
    heroVisualC2: string;
    heroVisualCousinsLocation: string;
    heroVisualConnected: string;
    heroVisualHouseholds: string;
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
      howItWorks: "How It Works",
      testimonials: "Stories",
    },
    landing: {
      heroTagline: "Every Family Starts Somewhere",
      heroTitle: "One Tree Becomes",
      heroTitleHighlight: "Many Connected",
      heroDescription: "Start your household's family tree today. When your relatives create theirs, our smart matching connects your branches automatically - building a complete picture of your extended family across households.",
      startTree: "Start Your Family Tree",
      watchDemo: "See How It Works",
      featuresTitle: "Powerful Features for Growing Families",
      featuresSubtitle: "Everything you need to document, connect, and preserve your family's story",
      feature1Title: "Smart Family Matching",
      feature1Desc: "Our intelligent matching finds shared relatives across different family trees, automatically connecting your branches",
      feature2Title: "Relationship Calculator",
      feature2Desc: "Instantly see how any two people are related - from first cousins to great-great-grandparents",
      feature3Title: "Easy Collaboration",
      feature3Desc: "Invite family members to contribute their knowledge and grow your tree together",
      feature4Title: "Privacy You Control",
      feature4Desc: "Decide exactly what to share and with whom. Your family data stays private until you choose to connect",
      feature5Title: "Timeline View",
      feature5Desc: "Watch your family history unfold chronologically with births, marriages, and milestones",
      feature6Title: "AI Research Assistant",
      feature6Desc: "Get help with genealogy questions and family history research from our intelligent chatbot",
      timelineTitle: "See Your Family Story Unfold",
      timelineSubtitle: "Our timeline view brings your family history to life",
      ctaTitle: "Ready to Unite Your Family?",
      ctaDescription: "As a head of household, you're the keeper of your family's story. Start your tree today, and watch as connections grow when other households join. One tree at a time, we're building something bigger - a network of connected families.",
      ctaButton: "Start Your Family Tree Free",
      gdprCompliant: "GDPR Compliant",
      freePlan: "Free Forever Plan",
      howItWorksTitle: "How Families Connect",
      howItWorksSubtitle: "It starts with you. Each household builds their piece of the puzzle.",
      step1Title: "Start Your Tree",
      step1Desc: "Create your household's family tree. Add parents, grandparents, aunts, uncles - everyone you know.",
      step2Title: "Invite Relatives",
      step2Desc: "Share your tree with family. Encourage cousins, siblings, and extended family to start their own trees.",
      step3Title: "Branches Connect",
      step3Desc: "Our smart matching finds shared relatives across trees. Suddenly, your family network expands exponentially.",
      testimonialsTitle: "Families Growing Together",
      testimonialsSubtitle: "See how households across the country are connecting their stories",
      testimonial1Name: "Maria Rodriguez",
      testimonial1Role: "Family Reunion Organizer",
      testimonial1Quote: "I started our tree with just my immediate family. Then my cousin in Texas started hers, and my aunt in Florida started hers. Within three months, we discovered we're connected to over 200 relatives we barely knew existed. Our next reunion is going to be huge!",
      testimonial2Name: "James Chen",
      testimonial2Role: "Family Historian",
      testimonial2Quote: "As the unofficial family historian, I was keeping track of everything in spreadsheets. Now my siblings each maintain their branch, and the smart matching found my wife's family connects to mine through a great-great-grandmother. We're actually distant cousins!",
      testimonial3Name: "Sarah Williams",
      testimonial3Role: "New Parent",
      testimonial3Quote: "When my daughter was born, I realized I barely knew my grandparents' stories. I started our tree, and my mom added details I never knew. When my brother started his tree on the other coast, it all connected. Now my daughter will know exactly where she comes from.",
      testimonial4Name: "Michael & David Thompson",
      testimonial4Role: "Blended Family",
      testimonial4Quote: "We each brought children from previous marriages. Creating separate trees for each family line, then watching them connect through our marriage, helped our kids understand they're part of something bigger. They love exploring 'their' tree together.",
      headsOfHouseholdCta: "Heads of Household: Start Your Legacy",
      headsOfHouseholdDesc: "You don't need to know your entire family tree to begin. Start with what you know - your parents, grandparents, siblings. Every tree starts as a seedling.",
      familyConnections: "families connected",
      heroVisualYou: "You",
      heroVisualSis: "Sis",
      heroVisualC1: "C1",
      heroVisualC2: "C2",
      heroVisualCousinsLocation: "Cousins in Texas",
      heroVisualConnected: "connected through shared ancestors",
      heroVisualHouseholds: "households",
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
      howItWorks: "Cómo Funciona",
      testimonials: "Historias",
    },
    landing: {
      heroTagline: "Toda Familia Empieza en Algún Lugar",
      heroTitle: "Un Árbol Se Convierte en",
      heroTitleHighlight: "Muchos Conectados",
      heroDescription: "Comienza el árbol genealógico de tu hogar hoy. Cuando tus familiares creen el suyo, nuestra coincidencia inteligente conecta sus ramas automáticamente.",
      startTree: "Comienza Tu Árbol Familiar",
      watchDemo: "Ver Cómo Funciona",
      featuresTitle: "Funciones Poderosas para Familias en Crecimiento",
      featuresSubtitle: "Todo lo que necesitas para documentar, conectar y preservar la historia de tu familia",
      feature1Title: "Coincidencia Familiar Inteligente",
      feature1Desc: "Nuestra coincidencia inteligente encuentra parientes compartidos entre diferentes árboles familiares",
      feature2Title: "Calculadora de Parentesco",
      feature2Desc: "Ve instantáneamente cómo están relacionadas dos personas - desde primos hasta bisabuelos",
      feature3Title: "Colaboración Fácil",
      feature3Desc: "Invita a familiares a contribuir su conocimiento y hacer crecer tu árbol juntos",
      feature4Title: "Privacidad Que Tú Controlas",
      feature4Desc: "Decide exactamente qué compartir y con quién. Tus datos familiares permanecen privados",
      feature5Title: "Vista de Cronología",
      feature5Desc: "Observa la historia de tu familia desarrollarse cronológicamente con nacimientos y matrimonios",
      feature6Title: "Asistente de Investigación IA",
      feature6Desc: "Obtén ayuda con preguntas de genealogía de nuestro chatbot inteligente",
      timelineTitle: "Mira la Historia de Tu Familia Desplegarse",
      timelineSubtitle: "Nuestra vista de cronología da vida a tu historia familiar",
      ctaTitle: "¿Listo para Unir a Tu Familia?",
      ctaDescription: "Como cabeza de hogar, eres el guardián de la historia de tu familia. Comienza tu árbol hoy y observa cómo crecen las conexiones.",
      ctaButton: "Comienza Tu Árbol Gratis",
      gdprCompliant: "Cumple con GDPR",
      freePlan: "Plan Gratis Para Siempre",
      howItWorksTitle: "Cómo Se Conectan las Familias",
      howItWorksSubtitle: "Comienza contigo. Cada hogar construye su pieza del rompecabezas.",
      step1Title: "Comienza Tu Árbol",
      step1Desc: "Crea el árbol genealógico de tu hogar. Añade padres, abuelos, tíos - todos los que conoces.",
      step2Title: "Invita a Familiares",
      step2Desc: "Comparte tu árbol con la familia. Anima a primos y hermanos a comenzar sus propios árboles.",
      step3Title: "Las Ramas Se Conectan",
      step3Desc: "Nuestra coincidencia inteligente encuentra parientes compartidos. De repente, tu red familiar crece exponencialmente.",
      testimonialsTitle: "Familias Creciendo Juntas",
      testimonialsSubtitle: "Mira cómo hogares de todo el país están conectando sus historias",
      testimonial1Name: "María Rodríguez",
      testimonial1Role: "Organizadora de Reunión Familiar",
      testimonial1Quote: "Comencé nuestro árbol solo con mi familia inmediata. En tres meses, descubrimos que estamos conectados con más de 200 parientes que apenas sabíamos que existían.",
      testimonial2Name: "Carlos García",
      testimonial2Role: "Historiador Familiar",
      testimonial2Quote: "Como historiador familiar no oficial, llevaba todo en hojas de cálculo. Ahora mis hermanos mantienen cada uno su rama y la coincidencia inteligente encontró conexiones increíbles.",
      testimonial3Name: "Ana Martínez",
      testimonial3Role: "Nueva Madre",
      testimonial3Quote: "Cuando nació mi hija, me di cuenta de que apenas conocía las historias de mis abuelos. Comencé nuestro árbol y mi mamá añadió detalles que nunca supe.",
      testimonial4Name: "Miguel y David Torres",
      testimonial4Role: "Familia Mixta",
      testimonial4Quote: "Cada uno trajo hijos de matrimonios anteriores. Crear árboles separados y luego verlos conectarse ayudó a nuestros hijos a entender que son parte de algo más grande.",
      headsOfHouseholdCta: "Cabezas de Hogar: Comiencen Su Legado",
      headsOfHouseholdDesc: "No necesitas conocer todo tu árbol familiar para empezar. Comienza con lo que sabes - tus padres, abuelos, hermanos.",
      familyConnections: "familias conectadas",
      heroVisualYou: "Tú",
      heroVisualSis: "Hna",
      heroVisualC1: "P1",
      heroVisualC2: "P2",
      heroVisualCousinsLocation: "Primos en Texas",
      heroVisualConnected: "conectados por ancestros compartidos",
      heroVisualHouseholds: "hogares",
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
      howItWorks: "Comment ça marche",
      testimonials: "Témoignages",
    },
    landing: {
      heroTagline: "Chaque Famille Commence Quelque Part",
      heroTitle: "Un Arbre Devient",
      heroTitleHighlight: "Plusieurs Connectés",
      heroDescription: "Commencez l'arbre généalogique de votre foyer aujourd'hui. Quand vos proches créent le leur, notre correspondance intelligente connecte vos branches automatiquement.",
      startTree: "Commencez Votre Arbre Familial",
      watchDemo: "Voir Comment Ça Marche",
      featuresTitle: "Des Fonctionnalités Puissantes pour les Familles",
      featuresSubtitle: "Tout ce dont vous avez besoin pour documenter, connecter et préserver l'histoire de votre famille",
      feature1Title: "Correspondance Familiale Intelligente",
      feature1Desc: "Notre correspondance intelligente trouve des parents partagés entre différents arbres généalogiques",
      feature2Title: "Calculateur de Parenté",
      feature2Desc: "Voyez instantanément comment deux personnes sont liées - des cousins aux arrière-grands-parents",
      feature3Title: "Collaboration Facile",
      feature3Desc: "Invitez les membres de la famille à contribuer leurs connaissances et faire grandir votre arbre ensemble",
      feature4Title: "Confidentialité Que Vous Contrôlez",
      feature4Desc: "Décidez exactement quoi partager et avec qui. Vos données familiales restent privées",
      feature5Title: "Vue Chronologique",
      feature5Desc: "Voyez l'histoire de votre famille se dérouler chronologiquement avec naissances et mariages",
      feature6Title: "Assistant de Recherche IA",
      feature6Desc: "Obtenez de l'aide pour vos questions de généalogie de notre chatbot intelligent",
      timelineTitle: "Voyez l'Histoire de Votre Famille Se Dérouler",
      timelineSubtitle: "Notre vue chronologique donne vie à votre histoire familiale",
      ctaTitle: "Prêt à Unir Votre Famille?",
      ctaDescription: "En tant que chef de foyer, vous êtes le gardien de l'histoire de votre famille. Commencez votre arbre aujourd'hui et regardez les connexions grandir.",
      ctaButton: "Commencez Votre Arbre Gratuitement",
      gdprCompliant: "Conforme au RGPD",
      freePlan: "Plan Gratuit Pour Toujours",
      howItWorksTitle: "Comment les Familles Se Connectent",
      howItWorksSubtitle: "Ça commence avec vous. Chaque foyer construit sa pièce du puzzle.",
      step1Title: "Commencez Votre Arbre",
      step1Desc: "Créez l'arbre généalogique de votre foyer. Ajoutez parents, grands-parents, oncles - tous ceux que vous connaissez.",
      step2Title: "Invitez des Parents",
      step2Desc: "Partagez votre arbre avec la famille. Encouragez cousins et frères et soeurs à créer leurs propres arbres.",
      step3Title: "Les Branches Se Connectent",
      step3Desc: "Notre correspondance intelligente trouve des parents partagés. Soudain, votre réseau familial grandit exponentiellement.",
      testimonialsTitle: "Des Familles Grandissant Ensemble",
      testimonialsSubtitle: "Voyez comment des foyers à travers le pays connectent leurs histoires",
      testimonial1Name: "Marie Dupont",
      testimonial1Role: "Organisatrice de Réunion Familiale",
      testimonial1Quote: "J'ai commencé notre arbre avec juste ma famille immédiate. En trois mois, nous avons découvert que nous sommes connectés à plus de 200 parents que nous connaissions à peine.",
      testimonial2Name: "Jean Martin",
      testimonial2Role: "Historien Familial",
      testimonial2Quote: "En tant qu'historien familial non officiel, je gardais tout dans des tableurs. Maintenant mes frères et soeurs maintiennent chacun leur branche et la correspondance intelligente a trouvé des connexions incroyables.",
      testimonial3Name: "Sophie Bernard",
      testimonial3Role: "Nouvelle Maman",
      testimonial3Quote: "Quand ma fille est née, j'ai réalisé que je connaissais à peine les histoires de mes grands-parents. J'ai commencé notre arbre et ma mère a ajouté des détails que je n'ai jamais sus.",
      testimonial4Name: "Michel et David Petit",
      testimonial4Role: "Famille Recomposée",
      testimonial4Quote: "Chacun de nous a amené des enfants de mariages précédents. Créer des arbres séparés puis les voir se connecter a aidé nos enfants à comprendre qu'ils font partie de quelque chose de plus grand.",
      headsOfHouseholdCta: "Chefs de Foyer: Commencez Votre Héritage",
      headsOfHouseholdDesc: "Vous n'avez pas besoin de connaître tout votre arbre familial pour commencer. Commencez avec ce que vous savez - vos parents, grands-parents, frères et soeurs.",
      familyConnections: "familles connectées",
      heroVisualYou: "Vous",
      heroVisualSis: "Soeur",
      heroVisualC1: "C1",
      heroVisualC2: "C2",
      heroVisualCousinsLocation: "Cousins au Texas",
      heroVisualConnected: "connectés par ancêtres communs",
      heroVisualHouseholds: "foyers",
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
      howItWorks: "So funktioniert es",
      testimonials: "Geschichten",
    },
    landing: {
      heroTagline: "Jede Familie Beginnt Irgendwo",
      heroTitle: "Ein Baum Wird zu",
      heroTitleHighlight: "Vielen Verbundenen",
      heroDescription: "Starten Sie heute den Stammbaum Ihres Haushalts. Wenn Ihre Verwandten ihren erstellen, verbindet unser intelligentes Matching Ihre Äste automatisch.",
      startTree: "Starten Sie Ihren Familienstammbaum",
      watchDemo: "Sehen Sie Wie Es Funktioniert",
      featuresTitle: "Leistungsstarke Funktionen für Wachsende Familien",
      featuresSubtitle: "Alles was Sie brauchen, um die Geschichte Ihrer Familie zu dokumentieren, zu verbinden und zu bewahren",
      feature1Title: "Intelligentes Familien-Matching",
      feature1Desc: "Unser intelligentes Matching findet gemeinsame Verwandte zwischen verschiedenen Stammbäumen",
      feature2Title: "Verwandtschaftsrechner",
      feature2Desc: "Sehen Sie sofort, wie zwei Personen verwandt sind - von Cousins bis zu Urgroßeltern",
      feature3Title: "Einfache Zusammenarbeit",
      feature3Desc: "Laden Sie Familienmitglieder ein, ihr Wissen beizutragen und Ihren Baum gemeinsam wachsen zu lassen",
      feature4Title: "Datenschutz Den Sie Kontrollieren",
      feature4Desc: "Entscheiden Sie genau, was Sie mit wem teilen. Ihre Familiendaten bleiben privat",
      feature5Title: "Zeitleistenansicht",
      feature5Desc: "Beobachten Sie, wie sich Ihre Familiengeschichte chronologisch mit Geburten und Hochzeiten entfaltet",
      feature6Title: "KI-Forschungsassistent",
      feature6Desc: "Erhalten Sie Hilfe bei Genealogiefragen von unserem intelligenten Chatbot",
      timelineTitle: "Sehen Sie Ihre Familiengeschichte Entfalten",
      timelineSubtitle: "Unsere Zeitleistenansicht erweckt Ihre Familiengeschichte zum Leben",
      ctaTitle: "Bereit, Ihre Familie zu Vereinen?",
      ctaDescription: "Als Haushaltsvorstand sind Sie der Hüter der Geschichte Ihrer Familie. Starten Sie heute Ihren Baum und beobachten Sie, wie Verbindungen wachsen.",
      ctaButton: "Starten Sie Ihren Baum Kostenlos",
      gdprCompliant: "DSGVO-konform",
      freePlan: "Für Immer Kostenlos",
      howItWorksTitle: "Wie Familien Sich Verbinden",
      howItWorksSubtitle: "Es beginnt mit Ihnen. Jeder Haushalt baut sein Stück des Puzzles.",
      step1Title: "Starten Sie Ihren Baum",
      step1Desc: "Erstellen Sie den Stammbaum Ihres Haushalts. Fügen Sie Eltern, Großeltern, Onkel hinzu - alle, die Sie kennen.",
      step2Title: "Laden Sie Verwandte Ein",
      step2Desc: "Teilen Sie Ihren Baum mit der Familie. Ermutigen Sie Cousins und Geschwister, ihre eigenen Bäume zu starten.",
      step3Title: "Äste Verbinden Sich",
      step3Desc: "Unser intelligentes Matching findet gemeinsame Verwandte. Plötzlich wächst Ihr Familiennetzwerk exponentiell.",
      testimonialsTitle: "Familien Wachsen Zusammen",
      testimonialsSubtitle: "Sehen Sie, wie Haushalte im ganzen Land ihre Geschichten verbinden",
      testimonial1Name: "Anna Schmidt",
      testimonial1Role: "Organisatorin des Familientreffens",
      testimonial1Quote: "Ich habe unseren Baum nur mit meiner unmittelbaren Familie begonnen. Innerhalb von drei Monaten haben wir entdeckt, dass wir mit über 200 Verwandten verbunden sind, von denen wir kaum wussten, dass sie existieren.",
      testimonial2Name: "Thomas Weber",
      testimonial2Role: "Familienhistoriker",
      testimonial2Quote: "Als inoffizieller Familienhistoriker habe ich alles in Tabellenkalkulationen festgehalten. Jetzt pflegen meine Geschwister jeweils ihren Zweig und das intelligente Matching hat unglaubliche Verbindungen gefunden.",
      testimonial3Name: "Julia Müller",
      testimonial3Role: "Junge Mutter",
      testimonial3Quote: "Als meine Tochter geboren wurde, merkte ich, dass ich die Geschichten meiner Großeltern kaum kannte. Ich startete unseren Baum und meine Mutter fügte Details hinzu, die ich nie wusste.",
      testimonial4Name: "Michael und David Braun",
      testimonial4Role: "Patchwork-Familie",
      testimonial4Quote: "Jeder von uns brachte Kinder aus früheren Ehen mit. Separate Bäume zu erstellen und sie dann verbinden zu sehen, half unseren Kindern zu verstehen, dass sie Teil von etwas Größerem sind.",
      headsOfHouseholdCta: "Haushaltsvorstände: Starten Sie Ihr Vermächtnis",
      headsOfHouseholdDesc: "Sie müssen nicht Ihren ganzen Stammbaum kennen, um anzufangen. Beginnen Sie mit dem, was Sie wissen - Ihre Eltern, Großeltern, Geschwister.",
      familyConnections: "verbundene Familien",
      heroVisualYou: "Sie",
      heroVisualSis: "Schw",
      heroVisualC1: "C1",
      heroVisualC2: "C2",
      heroVisualCousinsLocation: "Cousins in Texas",
      heroVisualConnected: "verbunden durch gemeinsame Vorfahren",
      heroVisualHouseholds: "Haushalte",
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
