import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/seo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { Link } from "wouter";
import { 
  ExternalLink, 
  Gift, 
  TreeDeciduous, 
  Frame, 
  BookOpen, 
  Gem,
  Heart,
  Users,
  ArrowLeft
} from "lucide-react";

interface GiftCategory {
  id: string;
  name: string;
  description: string;
  icon: typeof Gift;
  products: GiftProduct[];
}

interface GiftProduct {
  id: string;
  name: string;
  description: string;
  priceRange: string;
  link: string;
  store: string;
  popular?: boolean;
}

const giftCategories: GiftCategory[] = [
  {
    id: "ornaments",
    name: "Family Tree Ornaments",
    description: "Beautiful ornaments to celebrate your family heritage",
    icon: TreeDeciduous,
    products: [
      {
        id: "1",
        name: "Personalized Family Tree Ornament",
        description: "Custom engraved ornament with family names and birth years",
        priceRange: "$15 - $35",
        link: "https://www.awin1.com/cread.php?awinmid=6220&awinaffid=2735710&ued=https%3A%2F%2Fwww.etsy.com%2Fsearch%3Fq%3Dfamily%2Btree%2Bornament%2Bpersonalized",
        store: "Etsy",
        popular: true,
      },
      {
        id: "2",
        name: "Birthstone Family Tree Pendant",
        description: "Tree design with birthstones representing each family member",
        priceRange: "$25 - $60",
        link: "https://www.amazon.com/s?k=family+tree+birthstone+ornament&tag=pawint-20",
        store: "Amazon",
      },
      {
        id: "3",
        name: "Wooden Family Tree Display",
        description: "Handcrafted wooden tree with hanging name tags",
        priceRange: "$40 - $100",
        link: "https://www.awin1.com/cread.php?awinmid=6220&awinaffid=2735710&ued=https%3A%2F%2Fwww.etsy.com%2Fsearch%3Fq%3Dwooden%2Bfamily%2Btree%2Bdisplay",
        store: "Etsy",
      },
    ],
  },
  {
    id: "wall-art",
    name: "Wall Art & Prints",
    description: "Display your family history beautifully on your walls",
    icon: Frame,
    products: [
      {
        id: "4",
        name: "Custom Family Tree Canvas",
        description: "Large canvas print with customizable family tree design",
        priceRange: "$50 - $150",
        link: "https://www.awin1.com/cread.php?awinmid=6220&awinaffid=2735710&ued=https%3A%2F%2Fwww.etsy.com%2Fsearch%3Fq%3Dfamily%2Btree%2Bcanvas%2Bcustom",
        store: "Etsy",
        popular: true,
      },
      {
        id: "5",
        name: "Ancestry Chart Print",
        description: "Professional genealogy chart ready for framing",
        priceRange: "$30 - $80",
        link: "https://www.amazon.com/s?k=ancestry+chart+print&tag=pawint-20",
        store: "Amazon",
      },
      {
        id: "6",
        name: "Photo Family Tree Frame",
        description: "Multi-photo frame designed as a family tree",
        priceRange: "$35 - $75",
        link: "https://www.amazon.com/s?k=family+tree+photo+frame&tag=pawint-20",
        store: "Amazon",
      },
    ],
  },
  {
    id: "books",
    name: "Memory Books & Journals",
    description: "Preserve stories and memories for future generations",
    icon: BookOpen,
    products: [
      {
        id: "7",
        name: "Family History Journal",
        description: "Guided journal for recording family stories and memories",
        priceRange: "$20 - $40",
        link: "https://www.amazon.com/s?k=family+history+journal&tag=pawint-20",
        store: "Amazon",
        popular: true,
      },
      {
        id: "8",
        name: "Grandmother's Story Book",
        description: "Keepsake book for grandparents to share their life story",
        priceRange: "$15 - $30",
        link: "https://www.amazon.com/s?k=grandparents+memory+book&tag=pawint-20",
        store: "Amazon",
      },
      {
        id: "9",
        name: "Family Recipe Cookbook",
        description: "Blank cookbook for preserving family recipes",
        priceRange: "$15 - $35",
        link: "https://www.awin1.com/cread.php?awinmid=6220&awinaffid=2735710&ued=https%3A%2F%2Fwww.etsy.com%2Fsearch%3Fq%3Dfamily%2Brecipe%2Bbook%2Bblank",
        store: "Etsy",
      },
    ],
  },
  {
    id: "jewelry",
    name: "Family Jewelry",
    description: "Wearable keepsakes celebrating family bonds",
    icon: Gem,
    products: [
      {
        id: "10",
        name: "Family Tree Necklace",
        description: "Sterling silver tree of life pendant with birthstones",
        priceRange: "$30 - $100",
        link: "https://www.awin1.com/cread.php?awinmid=6220&awinaffid=2735710&ued=https%3A%2F%2Fwww.etsy.com%2Fsearch%3Fq%3Dfamily%2Btree%2Bnecklace%2Bbirthstone",
        store: "Etsy",
        popular: true,
      },
      {
        id: "11",
        name: "Personalized Family Ring",
        description: "Custom ring engraved with family names or initials",
        priceRange: "$40 - $150",
        link: "https://www.awin1.com/cread.php?awinmid=6220&awinaffid=2735710&ued=https%3A%2F%2Fwww.etsy.com%2Fsearch%3Fq%3Dpersonalized%2Bfamily%2Bring",
        store: "Etsy",
      },
      {
        id: "12",
        name: "Family Crest Pendant",
        description: "Custom pendant featuring your family coat of arms",
        priceRange: "$50 - $200",
        link: "https://www.awin1.com/cread.php?awinmid=6220&awinaffid=2735710&ued=https%3A%2F%2Fwww.etsy.com%2Fsearch%3Fq%3Dfamily%2Bcrest%2Bpendant%2Bcustom",
        store: "Etsy",
      },
    ],
  },
];

export default function Gifts() {
  const { user } = useAuth();
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Family Tree Gifts & Products | FamilyRoots"
        description="Discover beautiful family tree ornaments, wall art, memory books, and jewelry. Perfect gifts to celebrate your family heritage and preserve memories."
      />

      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href={user ? "/" : "/"}>
              <a className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity" data-testid="link-back-home">
                <ArrowLeft className="h-4 w-4" />
                {t.nav.backToHome}
              </a>
            </Link>
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              <ThemeToggle />
              <Link href="/">
                <a className="flex items-center gap-2 hover:opacity-80 transition-opacity" data-testid="link-brand-logo">
                  <TreeDeciduous className="h-6 w-6 text-primary" />
                  <span className="font-serif text-xl font-semibold">FamilyRoots</span>
                </a>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Custom Print Banner */}
        <Card className="mb-8 border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/20">
                <TreeDeciduous className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Want YOUR family tree on a product?</h3>
                <p className="text-muted-foreground">Print your actual family tree on mugs, t-shirts, posters & more!</p>
              </div>
            </div>
            <Link href="/merchandise">
              <Button size="lg" data-testid="button-custom-merchandise">
                Print My Tree
              </Button>
            </Link>
          </CardContent>
        </Card>

        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
            <Gift className="h-5 w-5" />
            <span className="font-medium">{t.gifts.giftIdeas}</span>
          </div>
          <h1 className="font-serif text-4xl font-bold text-foreground mb-4">
            {t.gifts.pageTitle}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t.gifts.pageDescription}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Note: These are curated gift ideas from external stores. For custom products with your own family tree, use "Print My Tree" above.
          </p>
        </div>

        <div className="space-y-16">
          {giftCategories.map((category) => (
            <section key={category.id} id={category.id} data-testid={`section-${category.id}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <category.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-serif text-2xl font-semibold text-foreground">
                    {category.name}
                  </h2>
                  <p className="text-muted-foreground">{category.description}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {category.products.map((product) => (
                  <Card key={product.id} className="hover-elevate" data-testid={`card-product-${product.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">{product.name}</CardTitle>
                        {product.popular && (
                          <Badge variant="secondary" className="shrink-0">
                            <Heart className="h-3 w-3 mr-1" />
                            {t.gifts.popular}
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{product.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-semibold text-foreground">
                            {product.priceRange}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {t.gifts.priceOn} {product.store}
                          </p>
                        </div>
                        <Button asChild>
                          <a 
                            href={product.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            data-testid={`link-product-${product.id}`}
                          >
                            {t.gifts.shopNow}
                            <ExternalLink className="h-4 w-4 ml-2" />
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-16 bg-card border border-border rounded-xl p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Users className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h2 className="font-serif text-2xl font-semibold text-foreground mb-3">
            {t.gifts.createTreeTitle}
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-6">
            {t.gifts.createTreeDescription}
          </p>
          <Button size="lg" asChild>
            <Link href="/">
              <a data-testid="link-start-tree">
                <TreeDeciduous className="h-5 w-5 mr-2" />
                {t.gifts.startTreeButton}
              </a>
            </Link>
          </Button>
        </section>

        <footer className="mt-16 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>
            {t.gifts.disclaimer}
          </p>
        </footer>
      </main>
    </div>
  );
}
