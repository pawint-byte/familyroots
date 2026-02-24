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
import { TreeDeciduous, ArrowLeft, CreditCard, Users, Shield, Sparkles, HelpCircle, Gift, User, Scale, Heart, Zap, Church, Trophy, GraduationCap, Briefcase, BookOpen, Lock, EyeOff, Globe, UserCheck, Tag, Star, QrCode, Search, ShoppingBag, GitMerge, ArrowRight, BookHeart, Mic, BarChart3 } from "lucide-react";
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
        },
        {
          question: "What's the best device to view my family tree on?",
          answer: "For the best experience, we recommend viewing your family tree on a desktop computer or tablet with a larger screen. The tree visualization works on phones, but larger screens give you more space to see multiple generations and navigate your family connections. On tablets and desktops, you can also use zoom controls and drag to pan around the tree more easily."
        }
      ]
    },
    {
      title: "Why FamilyRoots",
      icon: <Heart className="h-5 w-5" />,
      items: [
        {
          question: "Why should I use FamilyRoots instead of other family tree apps?",
          answer: <>Most family tree platforms are built around dead ancestors and historical records. FamilyRoots is built for your living family. We're the only platform where family members can claim their own profiles, collaborate in real time, connect across separate trees, and actually stay in touch. Other platforms treat your family like a research project. We treat it like a living network. Visit our <Link href="/comparison" className="text-primary hover:underline font-medium">Comparison page</Link> for a full side-by-side breakdown.</>
        },
        {
          question: "How is FamilyRoots different from Ancestry?",
          answer: <>Ancestry charges $20-$50/month and focuses on DNA testing, ethnicity estimates, and searching historical records from the 1800s. FamilyRoots starts free, costs a fraction of the price, and focuses on what Ancestry ignores: connecting the family members who are alive right now. We offer profile claiming, real-time collaboration, cross-tree connections, QR code sharing for reunions, gift registries, custom merchandise, and privacy controls that actually put your family in charge of their own data. If you want to research great-great-grandparents, use Ancestry. If you want to build a living, breathing family network, use FamilyRoots. Many families use both.</>
        },
        {
          question: "How is FamilyRoots different from MyHeritage?",
          answer: "MyHeritage ($11-$25/month) offers DNA testing, photo animation, and historical record searches, similar to Ancestry. FamilyRoots doesn't compete on DNA or old records. Instead, we offer things neither MyHeritage nor Ancestry has: profile claiming so family members own their own data, a deadman switch so your trees survive you, QR codes for instant family reunion connections, cross-tree linking when families merge, custodianship for managing deceased relatives' profiles, and gift registries tied directly to your tree. We're complementary, not a replacement, for historical research tools."
        },
        {
          question: "How is FamilyRoots different from FamilySearch?",
          answer: <>FamilySearch is free and has incredible historical records, and FamilyRoots connects directly to FamilySearch so you can search records and import ancestors without leaving the app. But FamilySearch's tree is one giant shared tree where anyone can edit anyone, which leads to conflicts and errors. FamilyRoots gives each family their own private tree with clear ownership, role-based permissions, and the ability to connect trees when families want to share. You get the benefits of connection without losing control. Plus, when you import from FamilySearch, our smart conflict detection finds duplicates automatically and lets you merge, keep, or skip each one — preserving every relationship and transferring all linked data.</>
        },
        {
          question: "What can I do on FamilyRoots that I can't do anywhere else?",
          answer: <>Several things are unique to FamilyRoots: (1) Profile claiming, where family members take ownership of their own entry and keep it up to date themselves. (2) Cross-tree connections, where separate families can link their trees when they discover shared members. (3) QR code profiles for instant in-person connections at reunions. (4) A deadman switch that transfers your trees to a chosen heir if something happens to you. (5) Custodianship requests so relatives can care for a deceased member's profile. (6) Gift registries built right into the tree for birthdays, weddings, and holidays. (7) Custom merchandise: print your actual tree, uploaded images, QR codes, and custom text on blankets, mugs, shirts, and more. No other platform offers this combination.</>
        },
        {
          question: "How does FamilyRoots pricing compare to competitors?",
          answer: <>Ancestry costs $20-$50/month. MyHeritage costs $11-$25/month. FamilySearch is free but limited in collaboration. FamilyRoots starts free with your first 20 family members, and after that you buy member packs: 10 credits for $7.99, 25 for $14.99, or 50 for $24.99. Credits never expire, so you pay only when you grow. Active users earn rewards: 20% off for adding 5+ members in a month, and a free 10-pack when you hit 100 members. Optional Premium ($4.99/mo) adds unlimited media uploads and advanced features. No surprise charges, no annual lock-ins. See our <Link href="/pricing" className="text-primary hover:underline font-medium">Pricing page</Link> for details.</>
        },
        {
          question: "Can I use FamilyRoots alongside Ancestry or FamilySearch?",
          answer: "Absolutely, and many families do. Use Ancestry or FamilySearch for researching ancestors and historical records. Use FamilyRoots to manage the living side of your family: collaboration, privacy, profile ownership, event tracking, gift registries, and staying connected. FamilyRoots already integrates with FamilySearch — you can search historical records and import entire family branches directly from FamilyRoots without switching platforms."
        },
        {
          question: "Where can I see the full feature comparison?",
          answer: <>Visit our <Link href="/comparison" className="text-primary hover:underline font-medium">Comparison page</Link> for a complete side-by-side feature matrix covering Tree Building, Collaboration, Privacy & Security, Connections, AI & Technology, and Pricing. You can also click 'Compare to Ancestry' from our <Link href="/" className="text-primary hover:underline font-medium">home page</Link>.</>
        }
      ]
    },
    {
      title: "Features You Won't Find Elsewhere",
      icon: <Zap className="h-5 w-5" />,
      items: [
        {
          question: "What is Profile Claiming and why does it matter?",
          answer: "On every other family tree platform, the tree owner enters everyone's information and it stays that way unless they update it. FamilyRoots is different. Family members can claim their own profiles and keep their own information current: their photo, bio, contact details, career, and more. The tree owner still controls the tree structure and relationships, but each person is responsible for their own data. This means your family tree stays accurate without one person doing all the work."
        },
        {
          question: "What if I build a tree with just names and then invite everyone to join?",
          answer: "This is one of the most common ways to get started, and FamilyRoots handles it smoothly. Here's how it works step by step: (1) You create your tree and add everyone with just their names — no need for photos, bios, or contact info yet. (2) You share an invite link or QR code with each person to join FamilyRoots. (3) When they sign up and open your tree, they find the card you created for them and request to 'claim' it. (4) You approve the claim, and now that person owns their own card. They can add their photo, bio, contact details, education, career, and anything else — without you doing the work. (5) You still control the tree structure and relationships. They only control their personal information. There are no merge conflicts because the roles are clear: you own the tree, they own their data. If the same person is in multiple trees, Profile Sync keeps their information consistent everywhere automatically. It's like building the skeleton of your family tree and letting each person fill in their own details."
        },
        {
          question: "What happens if a member wants to leave my tree?",
          answer: "If someone who claimed their profile decides they no longer want to be part of your tree, they can disassociate themselves. But here's the key protection for you as the tree owner: when they leave, only their personal data (photo, bio, contact info) is removed. The original entry you created — their name and all the relationships you set up — stays on your tree exactly as it was. Your tree structure is never broken. Plus, you'll always know who left: their member card will show a 'Left' badge with their name and the date they disassociated. This way you know exactly who it was, even after their personal details are gone. If you want to reach out and invite them back, you still have their name as a starting point. They can always re-claim the profile later if they change their mind."
        },
        {
          question: "How does the Deadman Switch protect my family tree?",
          answer: "On other platforms, if the account holder passes away or becomes inactive, the tree is essentially frozen or lost. FamilyRoots lets you designate an heir who will automatically inherit all your trees after a period of inactivity (6 to 24 months, you choose). You'll get a reminder email with 30 days to respond before anything happens. This guarantees your family history is never lost."
        },
        {
          question: "What are Cross-Tree Connections?",
          answer: "Most platforms keep every tree completely isolated. FamilyRoots lets separate family trees connect when they discover shared members. When your daughter marries and her in-laws have their own tree, you can link the trees together and see the full extended family across both. Smart Matching can even detect shared members automatically. Each family keeps full control of their own tree while seeing how the families connect."
        },
        {
          question: "How do QR Code Profiles work at family reunions?",
          answer: <>Every FamilyRoots user gets a personal QR code that links to their profile. At a family reunion, instead of exchanging phone numbers or emails, relatives scan each other's QR codes to instantly connect on the platform. Print them on name tags, display them on your phone, or include them on reunion invitations. Each person adds their own branch, and the tree grows as a team effort. Get yours at <Link href="/my-qr" className="text-primary hover:underline font-medium">My QR Code</Link>.</>
        },
        {
          question: "What is Custodianship?",
          answer: "When a family member passes away, their profile still needs care. A direct relative (parent, child, spouse, or sibling) can request custodianship of a deceased member's profile. After a 30-day approval window, the custodian can update memorial information, death dates, and biographical details. If the tree owner doesn't respond within 30 days, the request is auto-approved so profiles are never left unmanaged."
        },
        {
          question: "Can I print my family tree on actual products?",
          answer: <>Yes. FamilyRoots is the only family tree platform that lets you put your actual tree on merchandise: mugs, t-shirts, hoodies, posters, blankets, and more. Your tree is printed exactly as it appears on screen and shipped directly to you through our print partner. But it goes beyond just tree prints — you can mix and match up to four different elements on any product: your tree or group visualization, a QR code, your own uploaded image, and custom text. Visit the <Link href="/merchandise" className="text-primary hover:underline font-medium">Merchandise page</Link> to see options.</>
        },
        {
          question: "What can I put on merchandise besides my tree?",
          answer: <>Every product in our shop lets you independently toggle up to four print elements: (1) Your tree or group visualization, printed exactly as it looks on screen. (2) A QR code linking to your site signup, your profile, or a tree invite. (3) Your own uploaded image — a saved tree export, a family photo, a logo, or any artwork up to 10MB. (4) Custom text up to 100 characters, like your family name, a motto, reunion date, or team slogan. You can use any combination: all four, just one, or anything in between. Each element has its own placement controls so you decide where everything goes on the product. The preview updates in real time as you customize.</>
        },
        {
          question: "Can I upload my own image to print on merchandise?",
          answer: "Absolutely. When customizing any product, toggle on 'Custom Image' and upload any image file up to 10MB (JPG, PNG, GIF, or WebP). This is great for adding a family crest, a reunion photo, your organization's logo, or even a saved screenshot of your tree. Your image appears on the product preview instantly so you can see exactly how it will look before ordering."
        },
        {
          question: "Can I add custom text to merchandise?",
          answer: "Yes. Toggle on 'Custom Text' in the product customizer and type up to 100 characters. Popular uses include family names ('The Johnson Family'), reunion details ('Smith Reunion 2026'), team mottos, or meaningful dates. The text appears on your product preview in real time. You can combine custom text with any of the other print elements — tree print, QR code, or uploaded image."
        },
        {
          question: "How do Gift Registries work inside a family tree?",
          answer: "FamilyRoots lets you create wishlists tied directly to family members and occasions: birthdays, weddings, baby showers, graduations, holidays. Add items from any online store with links and prices. Family members can see what's needed and mark items as purchased to avoid duplicates. It's built into the tree, so everyone in the family has access without needing a separate app or website."
        },
        {
          question: "What privacy controls does FamilyRoots offer?",
          answer: "FamilyRoots has three-tier privacy visibility (Full Access, Extended Family View, Limited) that controls how much information different family members can see. Immediate family always has full access. Tree owners can set defaults and override visibility for individual members. Family members who claim their profiles can also control their own visibility. No other platform gives this level of granular control to both the tree owner and the individual family members."
        }
      ]
    },
    {
      title: "Organizations & Groups",
      icon: <Briefcase className="h-5 w-5" />,
      items: [
        {
          question: "Can organizations build their entire membership on FamilyRoots?",
          answer: "Absolutely. FamilyRoots isn't just for families. Sororities, fraternities, churches, sports clubs, professional groups, and friend circles can use FamilyRoots to map out every member and every connection in their organization. Think of it as a private, invitation-only network where every relationship has real meaning: Big/Little, Coach/Player, Pastor/Elder, Mentor/Mentee. No public followers, no strangers, just the people who actually matter to your group."
        },
        {
          question: "How would a sorority or fraternity use FamilyRoots?",
          answer: "Imagine your entire sorority: every chapter, every pledge class, every Big/Little pair, all in one private network. When you create a fraternity/sorority tree, the relationship structure is laid out upfront: Big/Little mentor pairs, Pledge Class, Chapter President, Officer, Faculty Advisor, Active Member, and Alumni. Each member gets tagged with their class year (Class of 2024 through 2030), pledge status, or honorary designation. Chapters can connect through cross-tree links so the bigger picture takes shape across campuses. Every member claims their own profile, keeps their info updated after graduation, and stays connected for life. No more lost contact lists or outdated spreadsheets."
        },
        {
          question: "How would a church or faith community use FamilyRoots?",
          answer: "A church can map its entire congregation with meaningful roles defined upfront: Pastor/Leader, Elder/Deacon, Ministry Leader/Member, Teacher/Student, Worship Leader, Volunteer, and Mentor/Mentee. Each relationship can be tagged with a ministry assignment: Youth Ministry, Worship Team, Sunday School, Bible Study, Choir, or Outreach. See who leads which ministry, who mentors whom, and how your community is truly connected. Members can share QR codes for easy profile connections. The tree owner controls visibility with three-tier privacy settings, so you decide who sees what level of detail."
        },
        {
          question: "How would a sports team or club use FamilyRoots?",
          answer: "Build your entire roster with roles defined from the start: Head Coach, Assistant Coach, Captain, Player, Trainer/Physio, Manager/Staff, Teammate, and Alumni. Tag each member with their status: Starter, Reserve, Varsity, JV, Injured Reserve, or Retired. Need something specific like 'Water Boy' or 'Team Parent'? Add your own roles during creation. A youth league can create trees for every season and connect them, so you can trace a player's journey from little league to varsity. Coaches manage the roster, players claim their profiles and keep their own information current, and alumni stay connected long after their playing days."
        },
        {
          question: "How would a professional network use FamilyRoots?",
          answer: "Map your professional relationships the way they actually work: Manager/Direct Report, Colleague, Mentor/Mentee, Client, Business Partner, Intern/Supervisor. Tag each connection with their department: Engineering, Design, Marketing, Sales, Operations, HR, Finance, or Executive. Unlike LinkedIn where connections are shallow and public, FamilyRoots lets you build a private network where every connection is labeled with what it really means. Startup teams, consulting firms, mentorship programs, and mastermind groups can use it to visualize how their professional world is structured. You own your network, and it's nobody else's business."
        },
        {
          question: "What does it mean that I'm at the center of all my trees?",
          answer: "You are the common thread across every tree you belong to. Your family tree, your sorority, your church, your professional network, they're all separate and private, but you're the anchor in each one. Open your dashboard and you see everything: every group, every role, every connection. Nobody else sees this combined view. It's your personal map of every meaningful relationship in your life, and you own it completely."
        },
        {
          question: "How is this different from a Facebook group or GroupMe?",
          answer: "Social media groups are flat: everyone is just a \"member\" with no structure. FamilyRoots defines the structure before you even add the first person. In a sorority tree, you're not just a member — you're someone's Big, someone's Little, Class of 2027, a Chapter President. In a church, you're not just in the group — you're a Deacon tagged to Youth Ministry who mentors three young leaders. In a sports team, you're a Varsity Starter, not just another name on a list. These labeled connections with qualifier tags create a living map of how your organization actually works. Plus it's completely private. No ads, no algorithms, no strangers. Just your people."
        },
        {
          question: "Can different chapters or branches of the same organization connect?",
          answer: "Yes, and this is where FamilyRoots really shines for organizations. Each chapter, branch, or local group builds their own tree independently. Then they can connect through shared members or cross-tree links when they discover people in common. A sorority with multiple chapter trees, each with their own Big/Little lines and pledge classes, can start linking them together as members transfer or connect across campuses. Each chapter keeps full control of their own tree while being able to see how they link to others."
        },
        {
          question: "What tree types are available and what roles come with each?",
          answer: <>We support seven tree types, each with its own built-in relationship structure:
            <ul className="list-disc pl-5 mt-2 space-y-2 text-sm">
              <li><strong>Family Tree</strong> — Parent/Child, Spouse/Partner, Sibling, Co-Parent. Qualifiers: Biological, Step, Adopted, Foster, Half, In-Law.</li>
              <li><strong>Church / Faith Group</strong> — Pastor/Leader, Elder/Deacon, Ministry Leader/Member, Teacher/Student, Worship Leader, Volunteer, Mentor/Mentee. Tags: Youth Ministry, Worship Team, Sunday School, Bible Study, Choir, Outreach.</li>
              <li><strong>Sports Team</strong> — Head Coach/Player, Assistant Coach, Captain, Player, Trainer/Physio, Manager/Staff, Teammate, Alumni. Tags: Starter, Reserve, Varsity, JV, Injured Reserve, Retired.</li>
              <li><strong>Fraternity / Sorority</strong> — Big/Little (mentor pairs), Pledge Class, Chapter President, Officer, Faculty Advisor, Active Member, Alumni. Tags: Class of 2024–2030, Active, Pledge, Honorary.</li>
              <li><strong>Friend Circle</strong> — Best Friend, Close Friend, Friend, Roommate, Neighbor, Acquaintance. Tags: School, Work, Neighborhood, Online, Childhood, Mutual Friends.</li>
              <li><strong>Professional Network</strong> — Manager/Direct Report, Colleague, Mentor/Mentee, Client, Business Partner, Intern/Supervisor. Tags: Engineering, Design, Marketing, Sales, Finance, HR, Executive.</li>
              <li><strong>Custom Group</strong> — The catch-all. Starts with Leader, Co-Leader, Member, Teacher/Student, Mentor/Mentee, Connected. But you can replace or add any roles you need. Perfect for book clubs, bands, study groups, neighborhood watches, or anything else that doesn't fit the above.</li>
            </ul>
            <p className="mt-2 text-sm">Every type also lets you add your own custom roles on top of the defaults during creation.</p>
          </>
        },
        {
          question: "How are relationships defined when I create a tree?",
          answer: "When you create a new tree, we show you the full relationship structure upfront before you even name it. You'll see every role people can have: Coach and Player for sports, Big and Little for fraternities, Teacher and Student for church groups, and so on. If something's missing, there's an input right there to add your own. Type in 'Referee', 'Team Mom', 'Drum Major', whatever fits your group. These custom roles get saved to your tree and show up whenever you connect members later. You see the complete picture before you start building."
        },
        {
          question: "What if none of the tree types fit my group?",
          answer: "That's what Custom Group is for. It's the catch-all for anything that doesn't fit Family, Church, Sports, Fraternity, Friends, or Professional. You can name it anything (Book Club, Dance Crew, Neighborhood Watch, Study Group, HOA, Band), define your own roles from scratch (like Organizer, Participant, Sponsor, Instructor), and tag members however you want (Founding Member, New, Inactive, Honorary). There's no limit on what you can create. If you can describe the relationships between people, FamilyRoots can map it."
        },
        {
          question: "What are qualifier tags and how do they work?",
          answer: "Qualifier tags add extra context to a relationship. They answer 'what kind?' or 'which group?' For example, on a sports team you might mark someone as a Player and tag them 'Varsity' or 'JV'. In a fraternity, you'd tag members with their graduation year like 'Class of 2028'. In a church, you'd tag someone's ministry: 'Youth Ministry' or 'Worship Team'. In a professional network, it's the department: 'Engineering' or 'Marketing'. For friend circles, it's how you met: 'School', 'Work', or 'Childhood'. Tags are optional but help you organize and understand your group at a glance."
        },
        {
          question: "Can I add my own roles to a built-in tree type like Sports or Church?",
          answer: "Yes. Every tree type lets you add custom roles on top of the defaults. If you're building a sports team and need 'Water Boy', 'Team Parent', or 'Statistician', just type it in during creation. These custom roles are saved to that specific tree and show up alongside the built-in ones whenever you connect members. You get the convenience of a pre-built structure with the flexibility to customize it for your exact situation."
        },
        {
          question: "Does each group type look different visually?",
          answer: "Yes! Each tree type has its own unique visual layout so you can instantly tell what kind of group you're looking at. Family trees use the classic hierarchical tree shape. Friend circles arrange members in a ring. Churches use a radial starburst with leadership at the center. Sports teams use a grid formation. Fraternities and sororities use a sweeping arc chain. Professional networks use a web-style graph. Each type also has its own accent colors and connection line styles."
        },
        {
          question: "Do credits work across all tree types?",
          answer: "Yes. Your credit balance works for any tree type. Your first 20 members are free across all your trees combined, whether those members are family, sorority sisters, church members, or teammates. When you need more, credit packs can be used for any tree. One account, one balance, unlimited possibilities."
        },
        {
          question: "Why should our organization choose FamilyRoots over a spreadsheet or social media?",
          answer: "Spreadsheets go stale the moment someone graduates, moves, or changes roles. Social media groups are public, noisy, and treat everyone the same. FamilyRoots defines your organization's structure upfront — every role, every position, every qualifier — and then members fill in the map. Members own their own profiles, connections are labeled with real meaning (Coach/Player, not just 'member'), qualifier tags add context (Varsity, Class of 2028, Youth Ministry), leadership roles are visible, and the whole history is preserved. When a new pledge, player, or member joins, they see exactly where they fit. When an alumni comes back, their legacy is still there. It's the difference between a contact list and a real network."
        },
        {
          question: "What are Sub-groups and how do they work?",
          answer: "Sub-groups let you create smaller groups inside a larger one, building a natural hierarchy. Think of it like folders inside folders. A school tree can have sub-groups for 'Class of 2025', 'Class of 2026', and 'History Department'. A church can have 'Youth Ministry', 'Worship Team', and 'Bible Study' as sub-groups. A sports club can split into 'Varsity', 'JV', and 'Alumni'. Each sub-group has its own members, its own visualization, and its own page — but it's all connected under the parent group. You can navigate between them with a single click."
        },
        {
          question: "How do I create a Sub-group?",
          answer: "Open the tree you want to add a sub-group to. If you're the owner or a co-owner, you'll see a 'Create Sub-group' button below the tree header in the sub-groups bar. Click it, give your sub-group a name, and it's created instantly. The sub-group automatically inherits the same type and privacy settings as the parent. For example, if your parent tree is a sports team, the sub-group will also be a sports team with the same roles and structure available."
        },
        {
          question: "Who can create Sub-groups?",
          answer: "Only the owner and co-owners of a tree can create sub-groups. Editors and viewers cannot create them. This keeps the organizational structure under the control of the people who manage the group."
        },
        {
          question: "How do I navigate between a parent group and its Sub-groups?",
          answer: "When you're viewing a parent group, all its sub-groups appear in a navigation bar just below the header. Click any sub-group name to jump to it. When you're inside a sub-group, you'll see a breadcrumb link at the top showing the parent group's name — click it to go back up. It works just like navigating folders on your computer."
        },
        {
          question: "Can I see which groups are Sub-groups on my Dashboard?",
          answer: "Yes. On your Dashboard, any tree that is a sub-group shows a small badge with its parent group's name. This makes it easy to tell at a glance which groups are standalone and which are nested under a larger group."
        },
        {
          question: "How would a sorority or fraternity use Sub-groups?",
          answer: "Create your main chapter as the parent tree, then add sub-groups for each pledge class: 'Class of 2025', 'Class of 2026', 'Class of 2027', and so on. You could also create sub-groups by committee or role: 'Executive Board', 'Philanthropy Committee', 'Social Committee'. Each sub-group has its own members and visualization while staying connected to the chapter as a whole. Navigate between them instantly from the parent tree."
        },
        {
          question: "How would a sports club use Sub-groups?",
          answer: "Set up your main club as the parent tree, then create sub-groups for each team or division: 'Varsity', 'JV', 'U-16', 'U-14'. Or organize by season: 'Spring 2025', 'Fall 2025'. Coaches and staff can be in the parent group while players are organized into the appropriate sub-groups. Everyone can navigate between the main club and individual teams with one click."
        },
        {
          question: "How would a church use Sub-groups?",
          answer: "Your main congregation is the parent tree. Create sub-groups for each ministry or program: 'Youth Ministry', 'Worship Team', 'Sunday School', 'Women's Group', 'Men's Group', 'Bible Study'. Each ministry has its own members and structure, but they're all connected under the main church. Leaders can see the full picture from the parent tree and drill into any ministry."
        },
        {
          question: "Can Sub-groups have their own Sub-groups?",
          answer: "Yes, you can nest sub-groups if your organization needs it. For example, a university could have a 'College of Arts & Sciences' sub-group, which itself has 'History Department' and 'Biology Department' sub-groups inside it. That said, most organizations find one level of nesting is all they need — school → departments, church → ministries, club → teams. Keep it simple so everyone can navigate easily."
        },
        {
          question: "Do Sub-groups count toward my credit total?",
          answer: "Sub-groups are separate trees, so members added to a sub-group count toward your overall member total just like any other tree. Your 20 free member slots and any purchased credits apply across all your trees and sub-groups combined."
        },
        {
          question: "Can people on the Discover page see Sub-groups?",
          answer: "Yes. When browsing discoverable community trees, parent groups show a count of how many sub-groups they contain. This helps people understand the size and structure of an organization before joining. Sub-groups themselves follow the same privacy and discoverability rules as any other tree."
        },
        {
          question: "Can I move an existing tree under another tree after it's already been created?",
          answer: "Yes! You don't have to plan the hierarchy from the start. Open the tree you want to move, click the menu button (three dots), and select 'Move Under Parent'. You'll see a list of your other trees — pick the one you want as the parent and click 'Move Tree'. For example, if you started with a standalone high school tree and later created a district tree, you can move the high school under the district at any time. You must own or co-own both trees to move one under the other."
        },
        {
          question: "Can I detach a sub-group back to a standalone tree?",
          answer: "Yes. Open the sub-group, click the menu button (three dots), and select 'Detach from Parent'. The tree becomes a completely independent group again — all its members, relationships, and data stay exactly the same. This is useful when a school splits off from a district, a ministry becomes its own organization, or any group needs to stand on its own."
        },
        {
          question: "What happens to my data when I move or detach a tree?",
          answer: "Nothing is lost. Moving a tree under a parent or detaching it from one only changes the organizational link between the two groups. All members, relationships, settings, and history within the tree stay exactly the same. It's like moving a folder on your computer — the contents don't change, just where it sits in the structure."
        },
        {
          question: "What if our organization restructures — schools close, departments merge, or leadership changes?",
          answer: "FamilyRoots is built for this. You can move any tree under a new parent, detach it to stand on its own, or create new parent groups to reorganize from the top down. If a school closes, detach it from the district and it becomes an alumni archive. If two departments merge, create a new parent group and move both under it. Your members' data and history survive every change — nothing is ever lost just because the structure shifts."
        },
        {
          question: "Can I break a tree into smaller groups and assign different owners?",
          answer: "Yes! Use the 'Split Tree' option from the tree menu (three dots). You'll see a list of all members — check the ones you want to move into a new, separate tree. Name the new tree, optionally pick a different owner from your collaborators, and confirm. The selected members and their relationships move to the new tree, while everyone else stays in the original. You can also choose to keep the two trees linked after the split."
        },
        {
          question: "What happens to relationships when I split a tree?",
          answer: "Relationships between members who all move together are preserved in the new tree. Relationships between someone who stays and someone who moves are removed, since they would span two different trees. All other member data — profiles, life events, education, career history — moves with each member to whichever tree they end up in."
        },
        {
          question: "Why would I want to split a tree?",
          answer: "Common reasons include giving different people ownership and control over different parts of a group, separating finances (each tree can have its own billing), restructuring when a group outgrows a single tree, or simply organizing members into more focused groups. For example, a large family tree might split into separate branches managed by different family members, or a church might split its youth ministry into its own tree with its own leadership."
        }
      ]
    },
    {
      title: "Pricing & Credits",
      icon: <CreditCard className="h-5 w-5" />,
      items: [
        {
          question: "How does the credit system work?",
          answer: <>Your first 20 family members are completely free, no credit card needed. After that, you purchase member packs: Starter (10 credits for $7.99), Growth (25 credits for $14.99), or Family (50 credits for $24.99). Each credit lets you add one family member. Credits never expire, so you only buy when you're ready to grow. See our <Link href="/pricing" className="text-primary hover:underline font-medium">Pricing page</Link> for details.</>
        },
        {
          question: "Do credits expire?",
          answer: "No. Credits never expire. Once you purchase a member pack, those credits are yours to use whenever you want. There's no monthly deadline, no use-it-or-lose-it pressure. Add members at your own pace."
        },
        {
          question: "How do activity rewards work?",
          answer: "We reward families who are actively building their trees. Add 5 or more family members in a single month and you'll get 20% off your next member pack purchase. Reach the milestone of 100 total members and you'll receive a free Starter Pack (10 credits) as a thank-you for your dedication to preserving your family history."
        },
        {
          question: "Do credits apply across all my trees?",
          answer: "Yes. Your credit balance is tied to your account, not a specific tree. You can create unlimited trees for free and use your credits to add members to any of them. Your total member count across all trees determines when your 20 free slots are used up."
        },
        {
          question: "What is Premium and do I need it?",
          answer: <>Premium ($4.99/month) is entirely optional. Most families don't need it. It unlocks unlimited media uploads for life events, gift registries, advanced tree analytics, and priority support. The core experience, including unlimited trees, collaboration, privacy controls, profile claiming, and all relationship features, is available to every user regardless of Premium status.</>
        },
        {
          question: "What happens to my data if I stop buying credits?",
          answer: "Nothing changes. Your trees, members, relationships, photos, and everything you've built stays exactly as it is. You just won't be able to add new members beyond your free slots until you purchase more credits. Your family can still view, collaborate on, and interact with existing trees."
        },
        {
          question: "Can I cancel Premium anytime?",
          answer: "Yes. You can cancel Premium at any time and you'll keep access through the end of your billing period. After that, you'll lose access to Premium-only features like unlimited media uploads and gift registries, but all your trees, members, and data remain intact."
        }
      ]
    },
    {
      title: "Family Trees & Members",
      icon: <Users className="h-5 w-5" />,
      items: [
        {
          question: "How do I add my child's other parent without showing a marriage?",
          answer: "You can add relationships between any family members without requiring a marriage connection. Simply: 1) Add the other parent as a new family member, 2) Click on that person in the tree, 3) Click 'Add Relationship', 4) Select 'Parent' and choose your child. This creates a parent-child connection without implying any relationship between the parents. Parents of a common child are connected through their individual parent-child relationships, not through a spouse relationship."
        },
        {
          question: "How do I edit or delete a relationship?",
          answer: "Click on any family member to open their details panel, then scroll down to the 'Family Relationships' section. Each relationship shows edit (pencil) and delete (trash) buttons. Click the pencil to change the relationship type (parent, spouse, or sibling), or click the trash to remove the relationship entirely. This gives you full control to fix any mistakes or update your family connections."
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
          question: "What is the Merged Tree View?",
          answer: "The Merged Tree View combines your family tree with any trees you're connected to, showing them as one unified visualization. Toggle 'Show Connected Trees' in your tree view to see your extended family across multiple trees. This is perfect for seeing how your family connects to your spouse's family or other branches."
        },
        {
          question: "What is Selective Branch Import?",
          answer: "Selective Branch Import lets you control which members from connected trees count toward your member total. When you connect to another tree, you can choose to import just specific branches (like immediate family or descendants) rather than the entire tree. Only imported members use your credits. The rest remain viewable but don't cost you anything."
        },
        {
          question: "How does importing branches affect my credits?",
          answer: "Only your own tree members plus imported members from connected trees count toward your total. When you connect to another tree with 59 members, you don't automatically use credits for all 59. You choose which branches to import. For example, you might import just your mother-in-law's immediate family (8 members) and view the rest for free. This gives you control over costs while still seeing the full extended family."
        },
        {
          question: "Can I import different amounts from different connected trees?",
          answer: "Yes! Each tree connection is independent. You might import your dad's entire branch (descendants) from one tree, but only immediate family from another. You can also change what you've imported at any time - add more branches or remove imports to adjust your costs and features."
        },
        {
          question: "What features do imported vs view-only members have?",
          answer: "Imported members have full features: you can see their gift registries, get notifications about life events, see their location (if shared), and collaborate on their profiles. View-only members from connected trees can be seen in the merged view, but with limited features - no notifications, view-only access to basic info based on privacy settings."
        },
        {
          question: "Can I track name changes (maiden names, married names)?",
          answer: "Yes! Each family member has a Name History feature that tracks names through life events. You can record birth names, married names, names after divorce, or adoption names. The timeline shows when each name was used."
        },
        {
          question: "How do I add education and career history for family members?",
          answer: "Open any family member's profile by clicking on them in the tree view. You'll see sections for Education and Career where you can add schools attended, degrees earned, jobs held, and career achievements. This helps preserve your family's professional and educational legacy."
        },
        {
          question: "What is the Relationship Manager?",
          answer: <>The Relationship Manager is a powerful tool for viewing and editing all relationships in your family tree at once. Access it from your <Link href="/manage-relationships" className="text-primary hover:underline font-medium">Manage Relationships</Link> page. You can see every parent-child, spouse, and sibling connection in a table format, add new relationships, or delete incorrect ones. It shows email addresses next to names to help identify family members, especially when you have people with similar names.</>
        },
        {
          question: "How does FamilyRoots prevent relationship mistakes?",
          answer: "FamilyRoots includes smart validation to catch illogical relationships. For example, the system won't let you add a parent who is younger than their child based on birth dates. When you try to create an impossible relationship, you'll see a clear error message explaining the problem - like 'John (born 1990) cannot be a parent of Mary (born 1980)'. This helps keep your family tree accurate."
        },
        {
          question: "How do email addresses work for family members?",
          answer: "Email addresses serve as unique identifiers for family members across the entire FamilyRoots network. When you add an email for a family member, the system checks if that email already exists in other trees and warns you - this helps you discover connections you might not have known about! Emails are shown in the Relationship Manager and member dropdowns to help you tell apart people with similar names."
        },
        {
          question: "What happens if I add an email that already exists?",
          answer: "If you add a family member with an email that already exists in another tree, you'll see a warning showing which trees contain that email. This doesn't block you from creating the member - it's just a heads-up that this person may already be tracked elsewhere in the FamilyRoots network. This can help you discover cross-tree connections with other families!"
        },
        {
          question: "What happens when I delete a tree or member?",
          answer: "Deleted trees and members are moved to a 'Recently Deleted' area instead of being permanently removed. You have 30 days to restore them if you change your mind. For trees, check the 'Recently Deleted' section at the bottom of your dashboard. For members, look for 'Deleted Members' in the tree settings menu. After 30 days, items are automatically removed for good."
        },
        {
          question: "How do I restore a deleted tree or member?",
          answer: "To restore a deleted tree, scroll down to the 'Recently Deleted' section on your dashboard and click the restore button next to the tree you want back. To restore a deleted member, open the tree they belonged to, click the settings menu, and select 'Deleted Members' to see and restore them. You can also permanently delete items from these sections if you're sure you don't need them."
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
        },
        {
          question: "How do I invite someone to connect to my tree?",
          answer: "The easiest way is from inside the tree itself. Open your tree, tap the menu icon (three lines), and choose 'Copy Connection Invite Link'. Share that link with anyone you'd like to invite. When they open it, they'll see your tree name and who owns it — all they need to do is pick their role or relationship and send the request. You'll get a notification to approve it."
        },
        {
          question: "What's the difference between an Invite Link and a Connection Invite?",
          answer: "An Invite Link (from the Share button) gives someone a specific role in your tree — Viewer, Editor, or Co-owner — so they can see or edit it. A Connection Invite (from the menu) is a relationship request. The person tells you how they're connected to your group (e.g., 'I'm your cousin' or 'I'm a player on the team'), and you approve it. After approval, they get added as a member of the tree with their relationship established."
        },
        {
          question: "Does the connection invite work for non-family trees?",
          answer: "Yes! The connection invite page automatically adapts to your tree type. If it's a sports team, the person picks from roles like Coach, Player, or Teammate. For a church group, they see options like Pastor, Member, or Volunteer. For a professional network, they choose Manager, Colleague, Mentor, and so on."
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
      title: "Tags & Organization",
      icon: <Tag className="h-5 w-5" />,
      items: [
        {
          question: "What are tags and how do I use them?",
          answer: "Tags are color-coded labels you create at the tree level and assign to individual members. They help you organize and identify groups within a tree — like 'Class of 2025', 'Chapter Alpha', 'Worship Team', or 'Member Since 2020'. You can create as many tags as you need, each with its own name and color. Tags appear on member cards and in the tree header for quick visual identification."
        },
        {
          question: "How do I create and assign tags?",
          answer: "Open your tree and click the tag icon (or '+ Tag') in the tree header to open the Manage Tags dialog. Type a name, pick a color, and click Add. To assign a tag to members, click the tag in the dialog to expand it, then check the boxes next to the members you want to tag. You can also assign tags when adding a new member — tag options appear in the member creation form."
        },
        {
          question: "Can I assign tags to multiple members at once?",
          answer: "Yes. In the Manage Tags dialog, click any tag to expand its bulk assignment panel. You'll see a list of all members with checkboxes. Check or uncheck members and click 'Save' to apply changes. This is much faster than tagging members one at a time, especially for large trees."
        },
        {
          question: "How do I filter my tree view by tag?",
          answer: "Click any tag badge in the tree header. The tree will instantly filter to show only members with that tag. A 'Filtering' indicator appears showing how many members match, along with a 'Clear filter' link to go back to the full view. This is useful for focusing on a specific group like a pledge class, ministry team, or season roster."
        },
        {
          question: "Can I create a new tree from tagged members?",
          answer: "Yes — owners and co-owners can turn any tagged group into its own tree. In the Manage Tags dialog, click 'Create Tree' next to a tag that has members. Name the new tree and choose whether to make it a sub-group of the original or a standalone tree. All tagged members move to the new tree with their data. At least one member must remain in the original tree."
        },
        {
          question: "Can I email all members with a specific tag?",
          answer: "Yes. In the Manage Tags dialog, click 'Email' next to any tag that has members with email addresses on file. Enter a subject and message, and it's sent to everyone tagged. This is perfect for communicating with a specific group — like sending a meeting reminder to your Youth Ministry team or an update to your Class of 2025 — without emailing everyone in the tree."
        },
        {
          question: "Are tags different from qualifier tags on relationships?",
          answer: "Yes. Qualifier tags (like 'Varsity' or 'Youth Ministry') describe the nature of a specific relationship between two people. Member tags are labels on the person themselves, independent of any relationship. You might tag someone 'Class of 2025' regardless of whether they're a player, captain, or coach. Both types of tags can be used together for maximum organization."
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
          question: "How do I know when a family member's birthday is coming up?",
          answer: "FamilyRoots shows small badge indicators directly on member cards in the tree visualization. If someone has a birthday within the next 30 days, you'll see a birthday cake icon with a countdown. Members with active gift registries show a purple gift icon. These indicators appear automatically — no setup needed beyond adding birth dates. You can also check the Registries tab in your tree view to see all active gift registries at a glance, and the Timeline tab shows all upcoming and past events in chronological order."
        },
        {
          question: "Can I see my family timeline?",
          answer: "Yes! Each tree has a Timeline tab that automatically gathers every dated event into one chronological view. This includes birth dates and death dates from member profiles, plus all life events you've recorded — marriages, graduations, baptisms, career milestones, and more. Each event shows the member's photo, date, location, and event type with a color-coded icon. Events are grouped by year so you can see your family's history unfold decade by decade."
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
        },
        {
          question: "What is Personal Profile QR Code sharing?",
          answer: <>Personal Profile QR Codes are a game-changer for family reunions! Each family member has their own unique QR code that links to their profile. Visit <Link href="/my-qr" className="text-primary hover:underline font-medium">My QR Code</Link> to get yours. When you meet relatives face-to-face, they simply scan your code with their phone camera to instantly see your profile and send a connection request. This makes building your family tree a team effort where everyone contributes!</>
        },
        {
          question: "How can QR codes help at family reunions?",
          answer: <>At family reunions, personal QR codes transform how you connect! Instead of exchanging phone numbers or email addresses, family members can scan each other's QR codes to instantly connect on FamilyRoots. Print your QR code on name tags, display it on your phone, or include it on reunion materials. This way, everyone can do their part - each person adds their own branch to the tree, making the process faster and more collaborative. Get your code at <Link href="/my-qr" className="text-primary hover:underline font-medium">My QR Code</Link>.</>
        },
        {
          question: "How do I connect with family after scanning their QR code?",
          answer: "When you scan someone's personal QR code, you'll see their FamilyRoots profile with their name, photo, and how many family trees they're building. If you're logged in, you can send a connection request with one tap. Once they accept, you can collaborate on trees together, see shared family members, and stay connected. It's the fastest way to grow your family network!"
        },
        {
          question: "What is the Membership Badge?",
          answer: <>Your Membership Badge is a personalized digital card that shows your FamilyRoots stats — how many trees you belong to, your total connections, your activity level, and more. It's a fun way to see your impact and share it with others. Find yours at <Link href="/membership-badge" className="text-primary hover:underline font-medium">My Badge</Link> in the dashboard menu.</>
        },
        {
          question: "How does the Referral System work?",
          answer: "Every user gets a unique referral code. Share it with friends and family — when they sign up using your code, both of you benefit. You can track how many people you've referred and see your referral stats in your Account Settings. It's a great way to grow your family network and help others discover FamilyRoots."
        },
        {
          question: "Can I mute specific members or branches in my tree?",
          answer: "Yes. If you'd prefer not to see a particular member or an entire branch in your tree view, you can mute them. Muting hides them from your personal view without deleting them or affecting anyone else's view of the tree. Click on a member and look for the 'Mute' option. Muted members can be un-muted at any time."
        }
      ]
    },
    {
      title: "Merchandise & Gifts",
      icon: <Gift className="h-5 w-5" />,
      items: [
        {
          question: "What's the difference between 'Print My Tree on Products' and 'Browse Gift Ideas'?",
          answer: <>These are two different features! 'Print My Tree on Products' (on the <Link href="/merchandise" className="text-primary hover:underline font-medium">Merchandise page</Link>) lets you print YOUR actual family tree on custom products like mugs, t-shirts, and posters - we handle everything from printing to shipping. 'Browse Gift Ideas' (on the <Link href="/gifts" className="text-primary hover:underline font-medium">Gifts page</Link>) shows curated family tree-related products from Amazon - these are pre-made items that don't include your specific family tree. If you want your own tree printed, use the Merchandise page.</>
        },
        {
          question: "Can I put my family tree on a mug, t-shirt, or poster?",
          answer: "Yes! You can export your family tree as a high-quality image and then order custom merchandise directly through our site. Choose from mugs, t-shirts, posters, and more. Your tree is printed on the product and shipped directly to you - all without leaving FamilyRoots."
        },
        {
          question: "How does the merchandise ordering work?",
          answer: "It's simple: 1) Go to the Merchandise page, 2) Choose a product (mug, shirt, poster, etc.), 3) Click Customize and select your tree, 4) Preview how your tree looks on the item, 5) Checkout securely with your card. We handle production and shipping through our print partner. Tip: For the best experience previewing and customizing your tree on products, we recommend using a desktop or tablet - the preview is easier to see on a larger screen."
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
          question: "What are Gift Registries?",
          answer: "Gift Registries let you create wishlists for family events like birthdays, baby showers, weddings, graduations, and more. You can add items from any online store (like Amazon), and family members can see what's needed and mark items as purchased to avoid duplicates. Everyone in the tree can browse all active registries from the Registries tab."
        },
        {
          question: "How do I create a Gift Registry?",
          answer: "Click on any member in your tree to open their profile panel, then scroll to the 'Gift Registries' section. Create a registry for any occasion — birthdays, weddings, baby showers, holidays. Add items with links, prices, and quantities. Once created, the registry appears on the member's profile, on their tree card badge (purple gift icon), and in the tree-wide Registries tab so the whole family can find it."
        },
        {
          question: "Where can I see all gift registries in my tree?",
          answer: "Open your tree and click the 'Registries' tab at the top (next to Tree View, Members, Timeline, Memories, and Report). This shows all active registries across the entire tree — each one displays the member's name and photo, event type, event date with countdown, item fulfillment progress, and a link to view the full registry. Past/closed registries are shown separately below."
        },
        {
          question: "Can multiple people mark items as purchased?",
          answer: "Yes! Any family member with access to the tree can mark registry items as purchased. This prevents duplicate gifts and shows real-time progress on how many items have been fulfilled. Perfect for coordinating gifts across the whole family."
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
        },
        {
          question: "Will I get an email confirmation when I order merchandise?",
          answer: "Yes! When you order custom merchandise (like a mug or t-shirt with your family tree), you'll receive an email confirmation with your full order details including item, quantity, pricing breakdown, and shipping address. You'll also get a second email with tracking information once your order ships."
        },
        {
          question: "Do I get order emails for gift registry items from Amazon, Walmart, etc.?",
          answer: "No — gift registry items from Amazon, Walmart, Etsy, and other retailers are purchased directly through those stores using affiliate links. The retailer handles the entire purchase, so they'll send the buyer order confirmation and tracking emails directly. FamilyRoots only sends order emails for custom merchandise printed through our site."
        }
      ]
    },
    {
      title: "FamilySearch Integration",
      icon: <BookOpen className="h-5 w-5" />,
      items: [
        {
          question: "What is FamilySearch and how does FamilyRoots connect to it?",
          answer: <>FamilySearch is a free platform with over 66 billion historical records: birth certificates, marriage records, census data, immigration documents, military records, and more. FamilyRoots connects to FamilySearch so you can search those records and import ancestors directly into your family tree, all without leaving the app. Go to the <Link href="/familysearch" className="text-primary hover:underline font-medium">FamilySearch</Link> page to get started.</>
        },
        {
          question: "Is the FamilySearch connection always active?",
          answer: "Not permanently. When you connect your FamilySearch account, your session token is stored so you can search immediately. However, FamilySearch tokens expire after a period of time. If your token expires, you'll see a connection error when you try to search, and you'll just need to reconnect by clicking the Connect button again. It only takes a few seconds."
        },
        {
          question: "What's the difference between Search and Import?",
          answer: <>Both are on the same <Link href="/familysearch" className="text-primary hover:underline font-medium">FamilySearch</Link> page, just different tabs:<br/><br/><strong>Search Records</strong> lets you look up individual historical records by name, birth year, birthplace, and other details. You get a list of matching records, and you can add any result directly into one of your trees.<br/><br/><strong>Import Tree</strong> pulls your entire FamilySearch family tree, organized by ancestors, descendants, and spouses. You can select multiple people at once, and all their relationships (parent-child, spouse) are imported automatically.<br/><br/>Use Search when you're looking for a specific person. Use Import Tree when you want to bring over a whole family branch with connections intact.</>
        },
        {
          question: "When I search for a person, do I get all their family relationships too?",
          answer: "No. Search results are individual records, one person at a time, without relationships. This is because historical records (like a census entry or a birth certificate) are about a specific person, not a family tree. If you want to import a whole family branch with parent-child and spouse connections already set up, use the Tree Import feature instead. It pulls your FamilySearch family tree with all the relationships included."
        },
        {
          question: "How do I import a person from search results into my tree?",
          answer: <>When you find someone in the search results, click the "Import to Tree" button next to their name. A dialog will ask you to pick which of your trees to add them to. After importing, the person appears as a new member in your tree. You'll then need to open your tree and use "Add Relationship" to connect them to existing family members (as a parent, child, spouse, or sibling).</>
        },
        {
          question: "How do I import a whole family branch with relationships?",
          answer: <>Go to the <Link href="/familysearch?tab=import" className="text-primary hover:underline font-medium">FamilySearch page</Link> and click the "Import Tree" tab. This connects to your FamilySearch family tree and shows your ancestors, descendants, and spouses organized in groups. Check the boxes next to the people you want to import, pick a tree, and click Import. The import creates a temporary review tree first, then you review any potential duplicates, and once you confirm, all the people and their relationships (parent-child, spouse) are integrated directly into your tree with connections intact.</>
        },
        {
          question: "What happens during the import review step?",
          answer: "When you import from FamilySearch, the system first places everyone into a temporary review tree. It then compares the imported people against your existing tree members using name, birth year, birth place, and gender to find potential duplicates. You'll see a side-by-side comparison for each possible match, with differences highlighted. For each match, you choose: 'Same Person' to merge them (combining any missing data and preserving all relationships), 'Different People' to keep both, or 'Skip' to remove the imported copy. Once you confirm, all imported members and their relationships are moved into your main tree."
        },
        {
          question: "Does FamilyRoots automatically detect duplicate people during import?",
          answer: "Yes. During the tree import flow, the system automatically compares imported people against your existing tree members using fuzzy matching: same name, birth year within 5 years, similar birth place, and matching gender. Each potential duplicate is shown to you with a match score and a side-by-side comparison so you can decide whether to merge them, keep both, or skip the import. This prevents duplicates while giving you full control over the decision."
        },
        {
          question: "Are relationships preserved when I merge a duplicate during import?",
          answer: "Yes. When you choose 'Same Person (Merge)' for a duplicate, all the relationships that the imported person had — including distant ones like great-grandparents — are re-pointed to your existing member. The system uses a 7-phase process: it moves all members and relationships into your tree first, then processes merges and skips, then deduplicates, and finally runs an integrity check to verify every connection survived. Even ancestors four generations back stay fully connected."
        },
        {
          question: "What data is kept when I merge two people?",
          answer: "Everything. FamilyRoots does a true sync: if only one side has a piece of data (like a birth place or photo), it's always kept. If both sides have different values, the more complete version is used. Beyond profile fields, all linked records transfer to the merged profile — life events, education history, career history, name changes, tags, FamilySearch sources, external identifiers, voice notes, gift registries, special connections, invitations, profile claim requests, custodianship records, mute preferences, and discoverable member entries. Nothing is ever lost during a merge."
        },
        {
          question: "What happens to spouse relationships when I skip a duplicate?",
          answer: "Spouse connections are preserved. When you skip a duplicate, the system doesn't just bridge parent-child chains — it also re-routes spouse relationships. If the skipped person was married to someone, that spouse connection is transferred to the corresponding merged or kept member. No family connections are silently deleted."
        },
        {
          question: "How do I know the import worked correctly?",
          answer: "After resolving all conflicts, FamilyRoots runs an automatic integrity check and shows you a detailed summary. You'll see exactly how many members were merged, kept, or skipped; how many relationships were preserved; counts for every type of linked data transferred (events, education, career, tags, voice notes, gift registries, invitations, claims, custodianship records, and more); and whether all ancestor chains from root to most distant generation are intact. The summary also shows ancestor chain verification with generation depth and spouse connections preserved. If anything looks off, it will be flagged."
        },
        {
          question: "Will FamilyRoots notify me when new ancestors are found?",
          answer: "Not currently. The FamilySearch integration is manual, meaning you search for people and choose what to import. There's no automatic monitoring that watches for new records matching your family. This is a feature we'd like to add in the future, but for now, you'll want to periodically search FamilySearch for new records as they become available."
        },
        {
          question: "Do I need a FamilySearch account?",
          answer: "Yes, you need a free FamilySearch account to use the integration. FamilySearch is completely free and open to everyone. Once you have an account, you connect it to FamilyRoots on the Historical Records page by clicking the Connect button, which securely links the two accounts."
        },
        {
          question: "Is my FamilySearch data shared with other FamilyRoots users?",
          answer: "No. Your FamilySearch connection is private to your account. Any records you search or ancestors you import are only visible within your own trees, subject to whatever sharing and collaboration permissions you've set. Other FamilyRoots users cannot see your FamilySearch data."
        }
      ]
    },
    {
      title: "Premium Content Features",
      icon: <BookHeart className="h-5 w-5" />,
      items: [
        {
          question: "What is Memory Lane?",
          answer: "Memory Lane is a storytelling feed attached to your family tree where members can share memories, milestones, traditions, funny moments, and life lessons. Think of it as a private family journal that lives alongside your tree. Each memory can include a title, story text, photos, and a category so your family's most meaningful moments are preserved and easy to browse."
        },
        {
          question: "How do I add a memory to Memory Lane?",
          answer: "Navigate to your tree, open the Memories tab, and tap the button to add a new memory. Give it a title, write the story, choose a category, optionally attach a photo, and save. The memory is immediately visible to everyone who has access to the tree."
        },
        {
          question: "What categories are available for memories?",
          answer: "There are five categories to organize your memories: Memory (general recollections), Milestone (significant achievements or events), Tradition (recurring family customs), Funny (humorous stories and moments), and Lesson (wisdom or life lessons passed down). Categories make it easy to filter and browse specific types of stories."
        },
        {
          question: "Can I add photos to memories?",
          answer: "Yes. Each memory supports a photo attachment. When creating or editing a memory, you can upload an image that accompanies the story. This is great for pairing a written memory with the photo that captures the moment."
        },
        {
          question: "Who can see memories on Memory Lane?",
          answer: "Memories are visible to everyone who has access to the tree. Only tree members with edit permissions can add, edit, or delete memories. Visibility follows the same access rules as the rest of your tree — if someone can see the tree, they can see the memories."
        },
        {
          question: "What are Voice Notes?",
          answer: "Voice Notes let you record audio messages attached to individual family member profiles. Capture a grandparent telling a story, a parent sharing advice, or a child's first words — all saved directly on the person's profile in the tree. It's a way to preserve voices alongside the names and photos in your family history."
        },
        {
          question: "How do I record a Voice Note?",
          answer: "Open any family member's detail panel by clicking on them in the tree. Scroll to the Voice Notes section and tap the record button. Grant microphone access when prompted, record your message, and save it. The recording is attached to that member's profile and can be played back by anyone with access to the tree."
        },
        {
          question: "Where do Voice Notes appear?",
          answer: "Voice Notes appear in the member detail panel when you click on a family member in the tree view. They are listed in the Voice Notes section alongside other profile information like location, relationships, and life events."
        },
        {
          question: "Can I delete a Voice Note?",
          answer: "Yes. If you have edit permissions on the tree, you can delete any Voice Note from a member's profile. Open the member's detail panel, find the Voice Note you want to remove, and use the delete option. Deleted Voice Notes cannot be recovered."
        },
        {
          question: "What is the Annual Tree Report?",
          answer: "The Annual Tree Report is a yearly summary of your family tree's growth and activity. It shows statistics like total members, new additions, relationship breakdowns, and other insights about how your tree has evolved over the year. It's a great way to reflect on your family's growth and share highlights with relatives."
        },
        {
          question: "Can I view Annual Tree Reports from past years?",
          answer: "Yes. The Annual Tree Report section lets you select different years to review past reports. This allows you to compare growth across years and see how your family tree has expanded over time."
        },
        {
          question: "How is the Annual Tree Report generated?",
          answer: "The report is generated automatically based on the data in your tree. It analyzes member additions, relationship types, and tree structure to produce statistics and insights. No manual setup is required — just navigate to the Report tab on your tree to see the current year's summary or browse previous years."
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

        <div className="relative rounded-2xl bg-gradient-to-br from-card via-card to-primary/5 dark:from-card dark:via-card dark:to-primary/10 border-2 border-primary/30 p-6 md:p-8 shadow-lg overflow-hidden mb-8" data-testid="faq-privacy-callout">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          <div className="relative">
            <div className="flex items-start gap-4 mb-4">
              <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/15 border-2 border-primary/30 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <h3 className="font-serif text-xl md:text-2xl font-bold" data-testid="text-faq-privacy-title">Private by Default. Public Only If You Choose.</h3>
                </div>
                <p className="text-foreground/90 leading-relaxed" data-testid="text-faq-privacy-body">
                  Every tree you create is <strong className="text-primary">completely private and invitation-only</strong>. 
                  No one — not other users, not search engines, not anyone — can see your tree unless you personally invite them. 
                  Some users choose to make their trees discoverable for community connections, and that's great for them. 
                  But it's never the default, and it's never required. <strong>Your tree, your rules.</strong>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm pl-16">
              <div className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">Private by default</span>
              </div>
              <div className="flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">Invite-only access</span>
              </div>
              <div className="flex items-center gap-2">
                <EyeOff className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">Invisible to outsiders</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">Public is optional, never forced</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8" data-testid="faq-best-of-section">
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-5 w-5 text-yellow-500" />
            <h2 className="text-xl font-bold">What Makes FamilyRoots Different</h2>
          </div>
          <p className="text-muted-foreground text-sm mb-5">
            These are the features you won't find on any other platform. Click any card to jump to the full answer below.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { icon: <UserCheck className="h-5 w-5 text-green-600" />, title: "Profile Claiming", teaser: "Family members own and update their own profiles — the tree stays accurate without one person doing all the work.", categoryIdx: 2, itemIdx: 0 },
              { icon: <GitMerge className="h-5 w-5 text-blue-600" />, title: "Cross-Tree Connections", teaser: "Link separate family trees when they share members. See the full extended family across both sides.", categoryIdx: 2, itemIdx: 4 },
              { icon: <Shield className="h-5 w-5 text-red-600" />, title: "Deadman Switch", teaser: "Designate an heir so your trees are never lost if something happens to you. No other platform does this.", categoryIdx: 2, itemIdx: 3 },
              { icon: <QrCode className="h-5 w-5 text-gray-700" />, title: "QR Code Profiles", teaser: "Scan QR codes at reunions to instantly connect. Print them on name tags and invitations.", categoryIdx: 2, itemIdx: 5 },
              { icon: <Search className="h-5 w-5 text-green-700" />, title: "FamilySearch Integration", teaser: "Search 66B+ historical records and import ancestors with smart duplicate detection and true sync merge.", categoryIdx: 8, itemIdx: 0 },
              { icon: <ShoppingBag className="h-5 w-5 text-orange-600" />, title: "Custom Merchandise", teaser: "Print your actual tree on mugs, shirts, posters, and blankets. Add QR codes, custom text, and photos.", categoryIdx: 2, itemIdx: 8 },
            ].map((item, i) => (
              <button
                key={i}
                className="text-left p-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all group cursor-pointer"
                onClick={() => {
                  const el = document.querySelector(`[data-testid="faq-item-${item.categoryIdx}-${item.itemIdx}"]`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const trigger = el.querySelector('button');
                    if (trigger && el.getAttribute('data-state') !== 'open') {
                      trigger.click();
                    }
                  }
                }}
                data-testid={`faq-best-of-card-${i}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {item.icon}
                  <span className="font-semibold text-sm group-hover:text-primary transition-colors">{item.title}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.teaser}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link href="/features">
              <Button variant="outline" size="sm" className="gap-2" data-testid="faq-link-features-guide">
                See All Features
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
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
              <p className="text-sm text-muted-foreground mb-3">
                Look for the <span className="font-medium text-primary">Help</span> button at the bottom of any page.
              </p>
              <a href="/features" className="text-sm text-primary font-medium hover:underline" data-testid="link-features-guide">
                View the full Features Guide
              </a>
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
