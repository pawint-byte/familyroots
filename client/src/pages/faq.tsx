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
import { TreeDeciduous, ArrowLeft, CreditCard, Users, Shield, Sparkles, HelpCircle } from "lucide-react";
import { SEO } from "@/components/seo";

interface FAQItem {
  question: string;
  answer: string;
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
      title: "Account & Subscription",
      icon: <CreditCard className="h-5 w-5" />,
      items: [
        {
          question: "What happens if I stop paying my monthly subscription?",
          answer: "Your family tree data is never deleted when you stop paying. You'll be moved to our Free plan, which allows you to view 1 tree with up to 20 members. All your connections, relationships, and family history remain intact and preserved. You simply won't be able to add new members or trees beyond the free limits until you resubscribe. If another family member has Premium access and you're part of their tree, they can still see and maintain your connection from their account."
        },
        {
          question: "Can my family access our shared tree if I cancel my subscription?",
          answer: "Yes! Family connections persist regardless of subscription status. If you've shared your tree with family members who have their own accounts, they retain access based on their own subscription level. Collaborators with Premium accounts can continue to edit and expand the tree. The family network you've built remains connected."
        },
        {
          question: "What's included in the Free plan?",
          answer: "The Free plan includes 1 family tree with up to 20 family members, basic tree visualization, the ability to add photos and notes, and access to the relationship calculator. It's perfect for getting started with your immediate family."
        },
        {
          question: "What does Premium ($9.99/month) include?",
          answer: "Premium gives you unlimited family trees and unlimited family members. You also get Smart Family Matching to discover connections with other users' trees, priority support, advanced collaboration features, and access to all future premium features we release."
        },
        {
          question: "Can I cancel my subscription anytime?",
          answer: "Absolutely! You can cancel your Premium subscription at any time. You'll continue to have Premium access until the end of your current billing period. After that, you'll be moved to the Free plan but your data stays safe and accessible within Free plan limits."
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
          answer: "Click the 'Share' button on your tree and create an invitation link. You can set permission levels: Viewer (can only view), Editor (can add and edit members), or Co-owner (full access including sharing). You can also set expiration dates and usage limits on invitation links."
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
        }
      ]
    },
    {
      title: "Special Features",
      icon: <Sparkles className="h-5 w-5" />,
      items: [
        {
          question: "What is the Deadman Switch (Account Heir) feature?",
          answer: "The Deadman Switch ensures your family trees aren't lost if something happens to you. You can designate an heir who will inherit your trees after a period of inactivity (6-24 months, you choose). If you become inactive, you'll receive a reminder email with 30 days to respond. If there's no response, ownership transfers to your designated heir."
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
