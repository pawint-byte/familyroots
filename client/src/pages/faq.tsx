import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n";
import { TreeDeciduous, ArrowLeft, CreditCard, Users, Shield, Sparkles, HelpCircle, Gift, User, Scale } from "lucide-react";
import { SEO } from "@/components/seo";

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

interface FAQCategory {
  title: string;
  icon: React.ReactNode;
  items: FAQItem[];
}

export default function FAQ() {
  const { t } = useI18n();

  const faqCategories: FAQCategory[] = [
    {
      title: "Getting Started",
      icon: <TreeDeciduous className="h-5 w-5" />,
      items: [
        {
          question: "How should I start building my family tree?",
          answer: "Start by adding yourself first! When you create a tree and add yourself as the first person, you automatically become the 'Main Person' that the tree centers around. From there, add your closest relatives: your parents, siblings, spouse/partner, and children. This creates the core structure of your tree, and you can branch out from there to grandparents, aunts, uncles, and cousins."
        },
        {
          question: "What is the 'Main Person' in my tree?",
          answer: "The Main Person is who the tree focuses on by default when you or anyone else opens it. The first person you add becomes the Main Person automatically. You can change this anytime by clicking on any family member and tapping 'Set as Main'. This is helpful if you're building a tree centered around a grandparent or another relative."
        },
        {
          question: "What order should I add family members?",
          answer: "We recommend this order: 1) Add yourself first, 2) Add your parents, 3) Add your siblings, 4) Add your spouse/partner and children, 5) Add grandparents, 6) Branch out to aunts, uncles, and cousins. This builds a strong foundation and makes it easier to add relationships correctly."
        },
        {
          question: "How do I add relationships between family members?",
          answer: "After adding family members, click on any person in the tree, then tap 'Add Relationship'. Choose the relationship type (Parent, Child, Spouse, or Sibling) and select the other person. For example, to connect yourself to your mother: click on yourself, add relationship, select 'Parent', and choose your mother."
        },
        {
          question: "Can I view the tree from a different person's perspective?",
          answer: "Yes! Click on any family member in the tree and tap 'Set as Focus'. The tree will recenter to show that person's connections. This is temporary - the tree will return to the Main Person next time you open it. To permanently change the center point, use 'Set as Main' instead."
        }
      ]
    },
    {
      title: "FamilyRoots vs Ancestry",
      icon: <Scale className="h-5 w-5" />,
      items: [
        {
          question: "How is FamilyRoots different from Ancestry?",
          answer: <>FamilyRoots focuses on living family connections and collaboration, while Ancestry focuses on historical research and DNA testing. We help families collaborate on trees together, claim their own profiles, and connect with living relatives. Visit our <Link href="/comparison" className="text-primary hover:underline font-medium">Comparison page</Link> for a detailed feature matrix.</>
        },
        {
          question: "What unique features does FamilyRoots offer?",
          answer: <>FamilyRoots offers features designed for connecting living families: Export tree as image, Education & career history tracking, Profile claiming, Custodianship for deceased members, Three-tier privacy visibility, Account heir (deadman switch), Special connections (godparents, friends), Location sharing, Cross-tree connections, Network discovery, AI video generation, QR code sharing, Tiered subscription discounts (FREE at 100+ members), and Custom merchandise. See our <Link href="/comparison" className="text-primary hover:underline font-medium">Comparison page</Link> for the full feature matrix.</>
        },
        {
          question: "What does Ancestry offer that FamilyRoots doesn't?",
          answer: <>Ancestry focuses on historical research and DNA: DNA testing & matching, Ethnicity estimates, Cemetery records, and Newspaper archives. FamilyRoots focuses on connecting living families. Both platforms share core tree-building features. See our <Link href="/comparison" className="text-primary hover:underline font-medium">Comparison page</Link> for details.</>
        },
        {
          question: "How does FamilyRoots pricing work?",
          answer: <>FamilyRoots offers family-size discounts: $9.99/month base price, 25% off at 25 members ($7.49/month), 50% off at 50 members ($4.99/month), 75% off at 75 members ($2.50/month), and completely FREE at 100+ members. The more family you add, the less you pay! See our <Link href="/pricing" className="text-primary hover:underline font-medium">Pricing page</Link> for details.</>
        },
        {
          question: "Should I use FamilyRoots or Ancestry?",
          answer: "It depends on your goals. FamilyRoots is ideal for: living family connections, collaboration, privacy controls, profile ownership, growing discounts, special connections, location sharing, and custom merchandise. Ancestry is ideal for: DNA testing and historical records. Many families use both platforms together."
        },
        {
          question: "Where can I see the full comparison?",
          answer: <>Visit our <Link href="/comparison" className="text-primary hover:underline font-medium">Comparison page</Link> for a complete side-by-side feature matrix covering: Tree Building, Collaboration, Privacy & Security, Connections, AI & Technology, and Monetization. You can also click 'Compare to Ancestry' from our <Link href="/" className="text-primary hover:underline font-medium">home page</Link>.</>
        },
        {
          question: "Is FamilySearch integration coming to FamilyRoots?",
          answer: "Yes! We're working on integrating with FamilySearch to bring historical records search to FamilyRoots. This will let you search billions of birth, marriage, death, census, immigration, and military records directly from your family tree. You'll be able to attach verified historical sources to your family members, adding depth and documentation to your family history. Stay tuned for this exciting feature!"
        }
      ]
    },
    {
      title: "Account & Subscription",
      icon: <CreditCard className="h-5 w-5" />,
      items: [
        {
          question: "How does the discount system work?",
          answer: <>The more family members you add, the bigger your discount! At 25 members you get 25% off ($7.49/month), at 50 members you get 50% off ($4.99/month), at 75 members you get 75% off ($2.50/month), and at 100+ members your subscription is FREE! Your discount tier updates automatically as your family tree grows. See our <Link href="/pricing" className="text-primary hover:underline font-medium">Pricing page</Link> for all tiers.</>
        },
        {
          question: "What happens when I reach 100+ members?",
          answer: "Congratulations! Your subscription becomes free when you reach 100 family members. For every additional 25 members you add beyond 100, there's a small one-time payment of $2.99 to unlock that milestone. This helps us maintain quality service while rewarding your dedication to preserving family history."
        },
        {
          question: "Does my discount apply across all my trees?",
          answer: "Yes! Your total member count includes all family members across all your trees combined. Whether you have one large tree or several smaller ones, every member counts toward your discount tier."
        },
        {
          question: "What happens if I stop paying my monthly subscription?",
          answer: "Your family tree data is never deleted when you stop paying. You'll be moved to our Free plan, which allows you to view 1 tree with up to 20 members. All your connections, relationships, and family history remain intact and preserved. You simply won't be able to add new members or trees beyond the free limits until you resubscribe."
        },
        {
          question: "Can my family access our shared tree if I cancel my subscription?",
          answer: "Yes! Family connections persist regardless of subscription status. If you've shared your tree with family members who have their own accounts, they retain access based on their own subscription level. Collaborators with Premium accounts can continue to edit and expand the tree."
        },
        {
          question: "Can I cancel my subscription anytime?",
          answer: "Absolutely! You can cancel your subscription at any time. You'll continue to have access until the end of your current billing period. After that, you'll be moved to the Free plan but your data stays safe and accessible within Free plan limits."
        }
      ]
    },
    {
      title: "Family Trees & Members",
      icon: <Users className="h-5 w-5" />,
      items: [
        {
          question: "How do I add my child's other parent without showing a marriage?",
          answer: "You can add relationships between any family members without requiring a marriage connection. Simply: 1) Add the other parent as a new family member, 2) Click on that person in the tree, 3) Click 'Add Relationship', 4) Select 'Parent' and choose your child. This creates a parent-child connection without implying any relationship between the parents."
        },
        {
          question: "Can I invite family members who don't have an account yet?",
          answer: "Yes! When you add a family member and include their email address, they'll receive an invitation to join FamilyRoots. Once they create an account, they can view and contribute to the shared family tree based on the permissions you've set."
        },
        {
          question: "How do I connect two separate family trees?",
          answer: "Use our Tree Connections feature. When you discover that a member in your tree also appears in another family's tree (through Smart Matching or manually), you can request to connect the trees. Once both tree owners approve, the trees are linked and you can see how the families connect."
        },
        {
          question: "Can I track name changes (maiden names, married names)?",
          answer: "Yes! Each family member has a Name History feature that tracks names through life events. You can record birth names, married names, names after divorce, or adoption names. The timeline shows when each name was used."
        },
        {
          question: "How do I add education and career history for family members?",
          answer: "Open any family member's profile by clicking on them in the tree view. You'll see sections for Education and Career where you can add schools attended, degrees earned, jobs held, and career achievements. This helps preserve your family's professional and educational legacy."
        }
      ]
    },
    {
      title: "Sharing & Collaboration",
      icon: <Users className="h-5 w-5" />,
      items: [
        {
          question: "How do I share my family tree with relatives?",
          answer: <>From your <Link href="/dashboard" className="text-primary hover:underline font-medium">Dashboard</Link>, click the 'Share' button on your tree and create an invitation link. You can set permission levels: Viewer (can only view), Editor (can add and edit members), or Co-owner (full access including sharing). You can also set expiration dates and usage limits on invitation links.</>
        },
        {
          question: "What are the different permission levels for collaborators?",
          answer: "There are three permission levels: Viewers can see the tree and all member details but cannot make changes. Editors can add new members, edit existing ones, and create relationships. Co-owners have full access including the ability to invite others, manage collaborators, and delete the tree."
        },
        {
          question: "Can I remove someone's access to my tree?",
          answer: "Yes, as the tree owner or co-owner, you can remove any collaborator's access at any time. Go to your tree settings and manage collaborators to revoke access."
        }
      ]
    },
    {
      title: "Profile Ownership",
      icon: <User className="h-5 w-5" />,
      items: [
        {
          question: "What is profile claiming and why would I want to claim my profile?",
          answer: "Profile claiming lets you take ownership of your own entry in a family tree. Once you claim your profile, you can update your own personal information (name, photo, bio, dates) directly, without needing to ask the tree owner to make changes for you. It's a way to keep your own information accurate and up-to-date."
        },
        {
          question: "How do I claim my profile in a family tree?",
          answer: "Open the family tree where you appear, click on your entry to view the member details, and look for the 'Claim This Profile' button. Submit a request with an optional message explaining who you are. The tree owner will review and approve your request."
        },
        {
          question: "What happens after I claim my profile?",
          answer: "Once approved, you'll have edit access to your own personal details in that tree - things like your name, photo, bio, birth date, and contact information. You won't be able to add or remove family members or change relationships - that stays with the tree owner and editors."
        },
        {
          question: "Can I claim someone else's profile?",
          answer: "No, you can only claim your own profile. Only living family members can claim profiles, and each person can only claim one profile. The tree owner reviews all claim requests to verify they're legitimate before approving."
        },
        {
          question: "What if my claim is denied?",
          answer: "If a tree owner denies your claim, you'll see the status update in the member profile. The owner may include a reason for the denial. You can reach out to the tree owner directly to discuss or clarify your identity."
        },
        {
          question: "As a tree owner, how do I manage profile claims?",
          answer: <>You'll see pending claims on your <Link href="/dashboard" className="text-primary hover:underline font-medium">Dashboard</Link>. Review each request - you can see who's asking to claim which profile and any message they included. Approve legitimate claims so family members can manage their own information, or deny requests that seem incorrect or suspicious.</>
        },
        {
          question: "If I claim my profile in one tree, does it apply to other trees?",
          answer: "Currently, profile claims are per-tree. If you appear in multiple family trees, you'll need to claim your profile in each one separately. The tree owners of each tree manage their own approval process."
        },
        {
          question: "What is profile custodianship for deceased family members?",
          answer: "When a family member passes away, their profile may need ongoing management. Custodianship allows a direct relative (parent, child, spouse, or sibling) to request permission to manage that person's profile - updating death dates, memorial information, and keeping their legacy accurate."
        },
        {
          question: "How do I request custodianship of a deceased relative's profile?",
          answer: "Open the profile of the deceased family member and look for the 'Request Custodianship' button. Select your relationship to them and explain why you'd like to be their custodian. The tree owner has 30 days to approve or deny your request."
        },
        {
          question: "What happens if the tree owner doesn't respond to my custodianship request?",
          answer: "If the tree owner takes no action within 30 days, your custodianship request is automatically approved. They'll receive reminder emails at regular intervals, but this 'right of first refusal' window ensures profiles aren't left unmanaged indefinitely."
        },
        {
          question: "What can a profile custodian edit?",
          answer: "As a custodian, you can update the deceased member's death date, memorial information, biography, and basic profile details. You cannot add or remove family relationships or change the family tree structure - that remains with the tree owner."
        }
      ]
    },
    {
      title: "Life Events & Notifications",
      icon: <Sparkles className="h-5 w-5" />,
      items: [
        {
          question: "What are life events and how do I record them?",
          answer: "Life events are important moments in a family member's life - births, deaths, marriages, divorces, graduations, achievements, and other milestones. To record one, click on a family member's profile and look for the 'Life Events' section. Add the event type, date, description, and even attach photos or videos."
        },
        {
          question: "Can I attach photos and videos to life events?",
          answer: "Yes! Each life event can have multiple photo and video attachments. This is a great way to preserve memories alongside the historical record - wedding photos, graduation pictures, and other cherished moments."
        },
        {
          question: "How do I get notified when family events are recorded?",
          answer: <>Go to <Link href="/account/settings" className="text-primary hover:underline font-medium">Account Settings</Link> and find the 'Notification Preferences' section. Enable email notifications, then choose which event types you want to receive updates about - births, deaths, marriages, divorces, or milestones. All notifications are opt-in, so you only receive what you want.</>
        },
        {
          question: "Who can see the life events I record?",
          answer: "Life events are visible to everyone who has access to the family tree where the event was recorded. If you're a collaborator with view-only access, you can see events but not create new ones. Editors and tree owners can add and manage events."
        }
      ]
    },
    {
      title: "Privacy & Security",
      icon: <Shield className="h-5 w-5" />,
      items: [
        {
          question: "Who can see my family tree?",
          answer: "By default, your family trees are private and only visible to you. You control exactly who has access by sending invitation links. You can also make trees 'Unlisted' (viewable by anyone with the link) or keep them strictly private."
        },
        {
          question: "Is my family's information secure?",
          answer: "Yes, we take security seriously. All data is encrypted in transit and at rest. We use secure authentication through Replit Auth, and your data is stored on secure, backed-up servers. We never sell your family information to third parties."
        },
        {
          question: "What is Smart Matching and is my data shared with others?",
          answer: "Smart Matching helps you discover when someone in your tree might also appear in another user's tree. It's completely opt-in - you choose which members can be matched and which data points (name, email, birthdate) are used for matching. No personal data is shared until both parties approve a connection."
        },
        {
          question: "How do I make a family member discoverable for Smart Matching?",
          answer: "Open the member's profile and look for the 'Family Matching' section. Toggle 'Make discoverable' to on, then select which information can be used for matching. You control whether others can find matches using the member's email, name, birthdate, or birthplace."
        },
        {
          question: "What are the privacy visibility tiers and how do they work?",
          answer: "Privacy visibility tiers control how much information is visible to different family members. There are three tiers: 'Full Access' shows everything (dates, locations, photos, notes, life events), 'Extended Family View' shows only name, birth year, relationship, and photo, and 'Limited' shows just name and relationship. Immediate family (parents, children, spouse, siblings) always have full access regardless of the tier setting."
        },
        {
          question: "How do I set the default privacy level for my family tree?",
          answer: <>Go to your <Link href="/dashboard" className="text-primary hover:underline font-medium">Dashboard</Link> and click the three dots menu on any tree you own. Select 'Privacy Settings' to choose the default visibility tier. This setting affects how much information non-immediate family members can see about people in your tree.</>
        },
        {
          question: "Can I set different privacy levels for specific family members?",
          answer: "Yes! Tree owners and people who have claimed their own profiles can set visibility overrides on individual members. When editing a family member, look for the 'Privacy Visibility Override' option. This lets you make specific members more or less visible than the tree's default."
        }
      ]
    },
    {
      title: "Special Features",
      icon: <Sparkles className="h-5 w-5" />,
      items: [
        {
          question: "What is the Deadman Switch (Account Heir) feature?",
          answer: <>The Deadman Switch ensures your family trees aren't lost if something happens to you. You can designate an heir who will inherit your trees after a period of inactivity (6-24 months, you choose). Configure this in your <Link href="/account/settings" className="text-primary hover:underline font-medium">Account Settings</Link>. If you become inactive, you'll receive a reminder email with 30 days to respond. If there's no response, ownership transfers to your designated heir.</>
        },
        {
          question: "How does the Relationship Calculator work?",
          answer: "Click on any family member, then set another member as your 'Focus'. The relationship calculator automatically determines how the two people are related - whether they're first cousins, great-aunts, second cousins once removed, or any other relationship. It traces the path through your family tree."
        },
        {
          question: "Can I see my family timeline?",
          answer: "Yes! Each tree has a Timeline view that shows all family events in chronological order - births, deaths, marriages, and other milestones. It's a beautiful way to see your family's history unfold over time."
        },
        {
          question: "Is there an AI assistant to help me?",
          answer: "Yes! Look for the Help button at the bottom of any page. Our AI assistant can answer questions about genealogy, help you understand relationship terms, give tips on researching your family history, and guide you through using FamilyRoots features."
        },
        {
          question: "What are Special Connections?",
          answer: "Special Connections let you add non-blood relationships to your family tree, like godparents, best friends, mentors, significant others (boyfriend/girlfriend/fiance), and family friends. These connections show up on each person's profile and help capture the complete picture of who's important in your family's life."
        },
        {
          question: "How do I add a godparent, best friend, or boyfriend/girlfriend?",
          answer: "Open the family member's profile by clicking on them in the tree, then scroll down to 'Special Connections'. Click 'Add' and choose the connection type (godparent, best friend, mentor, boyfriend, girlfriend, etc.), then select the person you want to connect them to. Both sides will see the connection."
        },
        {
          question: "Can I connect with people in other family trees?",
          answer: "Yes! You can send connection requests to people in other family trees. They'll receive a notification and can approve or decline the request. Once approved, both trees can see the connection. This is great for connecting family friends across different families."
        },
        {
          question: "How does location sharing work?",
          answer: "You can optionally add your current city, state/province, and country to your profile. If you enable 'Share location with connections', family members can find you when they're traveling to your area. This is completely optional - only share if you want to be discoverable."
        },
        {
          question: "Can I find family members when I travel?",
          answer: <>Yes! Visit the <Link href="/network" className="text-primary hover:underline font-medium">Network page</Link> and search by city, state, or country. You'll see family members who have chosen to share their location. This makes it easy to meet up with relatives when you're traveling.</>
        },
        {
          question: "Can I install FamilyRoots as a mobile app?",
          answer: <>Yes! FamilyRoots is a Progressive Web App (PWA) that you can install on your phone or tablet for a native app-like experience. On iPhone/iPad: Open FamilyRoots in Safari, tap the Share button, then 'Add to Home Screen'. On Android: Open in Chrome, tap the menu (three dots), then 'Add to Home Screen' or 'Install App'. Once installed, you'll have a FamilyRoots icon on your home screen that opens the app in full-screen mode - just like a regular app!</>
        },
        {
          question: "What are the benefits of installing the mobile app?",
          answer: "Installing FamilyRoots as a mobile app gives you: faster loading times with offline caching, a full-screen experience without browser bars, easy access from your home screen, and push notification support. It's completely free and takes just seconds to install - no app store required!"
        },
        {
          question: "How do I share FamilyRoots with family members?",
          answer: <>Visit the <Link href="/share" className="text-primary hover:underline font-medium">Share page</Link> to get a QR code that links directly to FamilyRoots. Family members can scan the code with their phone camera to instantly open the app. You can also copy the link, download the QR code as an image, or use your device's native share feature to send via text, email, or social media.</>
        },
        {
          question: "How do I use the QR code sharing feature?",
          answer: <>Go to the <Link href="/share" className="text-primary hover:underline font-medium">Share page</Link> and you'll see a scannable QR code. You can: 1) Show it to family members to scan with their phone, 2) Click 'Download QR Code' to save it as an image for printing or sharing, 3) Click 'Copy Link' to paste the URL in messages, or 4) Use the 'Share' button to send via your phone's share menu. The QR code is perfect for family reunions, printed invitations, or holiday cards!</>
        }
      ]
    },
    {
      title: "Merchandise & Gifts",
      icon: <Gift className="h-5 w-5" />,
      items: [
        {
          question: "What's the difference between 'Print My Tree on Products' and 'Browse Gift Ideas'?",
          answer: <>These are two different features! 'Print My Tree on Products' (on the <Link href="/merchandise" className="text-primary hover:underline font-medium">Merchandise page</Link>) lets you print YOUR actual family tree on custom products like mugs, t-shirts, and posters - we handle everything from printing to shipping. 'Browse Gift Ideas' (on the <Link href="/gifts" className="text-primary hover:underline font-medium">Gifts page</Link>) shows curated family tree-related products from external stores like Etsy and Amazon - these are pre-made items that don't include your specific family tree. If you want your own tree printed, use the Merchandise page.</>
        },
        {
          question: "Can I put my family tree on a mug, t-shirt, or poster?",
          answer: "Yes! You can export your family tree as a high-quality image and then order custom merchandise directly through our site. Choose from mugs, t-shirts, posters, and more. Your tree is printed on the product and shipped directly to you - all without leaving FamilyRoots."
        },
        {
          question: "How does the merchandise ordering work?",
          answer: "It's simple: 1) View your family tree, 2) Click 'Create Merchandise', 3) Choose a product (mug, shirt, poster, etc.), 4) Preview how your tree looks on the item, 5) Checkout securely with your card. We handle production and shipping through our print partner."
        },
        {
          question: "What products can I put my family tree on?",
          answer: "We offer a variety of products including ceramic mugs, t-shirts in various sizes, hoodies, posters, canvas prints, and more. Each product shows a live preview of your tree before you order, so you know exactly what you're getting."
        },
        {
          question: "How long does merchandise take to arrive?",
          answer: "Most orders are printed and shipped within 2-5 business days. Delivery time depends on your location - typically 5-10 business days for US addresses. You'll receive tracking information via email once your order ships."
        },
        {
          question: "Can I download my family tree as an image?",
          answer: "Absolutely! You can export your family tree as a high-resolution PNG image at any time. This is great for printing at home, sharing digitally, or using in your own creative projects. Look for the 'Export' button when viewing your tree."
        },
        {
          question: "Are the products good quality?",
          answer: "Yes! We partner with a professional print-on-demand service that uses high-quality materials and printing techniques. Products are made to order, ensuring fresh production and no excess inventory waste."
        },
        {
          question: "Can I order merchandise as a gift for family members?",
          answer: "Definitely! Family tree merchandise makes wonderful gifts for reunions, holidays, or special occasions. During checkout, you can ship to any address - perfect for surprising relatives with a personalized family keepsake."
        },
        {
          question: "What payment methods do you accept?",
          answer: "We accept all major credit and debit cards (Visa, Mastercard, American Express, Discover) as well as cryptocurrency including Bitcoin, Ethereum, and stablecoins like USDC. All payments are processed securely through Stripe."
        },
        {
          question: "How do crypto payments work?",
          answer: "When you checkout, you can choose to pay with cryptocurrency. Simply select the crypto option, connect your wallet (like MetaMask), and complete the payment. The crypto is instantly converted to USD - you don't need to worry about price changes. Your order is processed exactly the same as a credit card payment."
        },
        {
          question: "If I pay with crypto, do you receive crypto or dollars?",
          answer: "We receive US dollars. When you pay with Bitcoin, Ethereum, or any other cryptocurrency, it's instantly converted to USD at the current exchange rate. This means your payment is processed immediately and your order ships right away - no waiting for crypto confirmations."
        },
        {
          question: "Is paying with crypto safe?",
          answer: "Yes! Crypto payments are processed securely through Stripe, the same trusted payment processor used by millions of businesses worldwide. Your wallet connects directly to Stripe - we never see or store your crypto wallet information."
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="FAQ - FamilyRoots"
        description="Frequently asked questions about FamilyRoots family tree management. Learn about subscriptions, sharing, privacy, and features."
      />
      
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer" data-testid="link-home">
                <TreeDeciduous className="h-8 w-8 text-primary" />
                <span className="text-xl font-bold">FamilyRoots</span>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="gap-2 mb-4" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          
          <div className="flex items-center gap-3 mb-4">
            <HelpCircle className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Frequently Asked Questions</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Find answers to common questions about FamilyRoots. Can't find what you're looking for? 
            Use the Help button on any page to chat with our AI assistant.
          </p>
        </div>

        <div className="space-y-6">
          {faqCategories.map((category, categoryIndex) => (
            <Card key={categoryIndex} data-testid={`faq-category-${categoryIndex}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {category.icon}
                  {category.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {category.items.map((item, itemIndex) => (
                    <AccordionItem 
                      key={itemIndex} 
                      value={`item-${categoryIndex}-${itemIndex}`}
                      data-testid={`faq-item-${categoryIndex}-${itemIndex}`}
                    >
                      <AccordionTrigger className="text-left">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground leading-relaxed">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-8 bg-primary/5 border-primary/20">
          <CardContent className="py-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Still have questions?</h3>
              <p className="text-muted-foreground mb-4">
                Our AI assistant is available 24/7 to help you with any questions about FamilyRoots or genealogy research.
              </p>
              <p className="text-sm text-muted-foreground">
                Look for the <span className="font-medium text-primary">Help</span> button at the bottom of any page.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-border mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} FamilyRoots. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
