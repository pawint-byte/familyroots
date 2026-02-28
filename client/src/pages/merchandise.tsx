import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  ShoppingBag, Package, Truck, ArrowLeft, TreeDeciduous, Camera,
  Shirt, Coffee, Image, Star, Check, Loader2, CreditCard, CheckCircle, XCircle,
  AlertTriangle, Info, Sparkles, Wallet, QrCode, Flame, ChevronRight, Zap,
  Users, Scan, Heart, ArrowRight, User, Crown, Plus, GraduationCap, Trophy, Type, Upload,
  RotateCcw
} from "lucide-react";
import { SiBitcoin, SiEthereum } from "react-icons/si";
import { QRCodeSVG } from "qrcode.react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { FamilyTree, MerchandiseOrder } from "@shared/schema";
import { getTreeTypeConfig, getMemberRank, type TreeType, type TreeTypeConfig } from "@shared/treeTypes";
import { type GroupLayoutMode } from "@/components/group-visualization";

const MERCHANDISE_DISABLED = false;
const MERCHANDISE_DISABLED_MESSAGE = "Merchandise ordering is temporarily unavailable while we complete setup with our print partner. We'll notify you when it's back. Any previous charges have been fully refunded.";

interface PrintPlacement {
  id: string;
  label: string;
  printfulType: string;
  description: string;
}

interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  image: string;
  maxMembers?: number;
  printArea?: string;
  recommendation?: string;
  isFeatured?: boolean;
  featuredScenario?: string;
  placements?: PrintPlacement[];
  isConnectionShirt?: boolean;
  isPromoItem?: boolean;
  bulkHint?: string;
  recommendedFor?: string[];
  bestFor?: Record<string, string>;
}

type QRCodeType = 'site' | 'profile' | 'tree';

interface QRCodeOption {
  type: QRCodeType;
  label: string;
  description: string;
  treeId?: string;
  treeName?: string;
  url: string;
}

interface Variant {
  id: number;
  product_id: number;
  name: string;
  size: string;
  color: string;
  color_code: string;
  image: string;
  price: string;
  in_stock: boolean;
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "apparel":
      return <Shirt className="h-5 w-5" />;
    case "drinkware":
      return <Coffee className="h-5 w-5" />;
    case "home-decor":
      return <Image className="h-5 w-5" />;
    default:
      return <Package className="h-5 w-5" />;
  }
}

function ProductCard({ 
  product, 
  onCustomize,
  memberCount,
  activeTreeType 
}: { 
  product: Product; 
  onCustomize: (product: Product) => void;
  memberCount?: number;
  activeTreeType?: string;
}) {
  const isSuitable = !memberCount || !product.maxMembers || memberCount <= product.maxMembers;
  const isRecommended = memberCount && product.maxMembers && memberCount <= product.maxMembers && 
    (product.printArea === 'full' || memberCount <= product.maxMembers * 0.8);
  
  return (
    <Card className="overflow-hidden hover-elevate" data-testid={`card-product-${product.id}`}>
      <div className="aspect-square bg-muted relative overflow-hidden">
        <img 
          src={product.image} 
          alt={product.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {product.isConnectionShirt && (
            <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              <Crown className="h-3 w-3 mr-1" />
              Fan Favorite
            </Badge>
          )}
          {product.isPromoItem && (
            <Badge className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
              <Zap className="h-3 w-3 mr-1" />
              Bulk Promo
            </Badge>
          )}
          {product.isFeatured && !product.isConnectionShirt && !product.isPromoItem && (
            <Badge className="bg-orange-500 text-white">
              <Flame className="h-3 w-3 mr-1" />
              Most Popular
            </Badge>
          )}
          <Badge variant="secondary">
            {product.category}
          </Badge>
          {memberCount && isRecommended && (
            <Badge className="bg-green-600 text-white">
              <Sparkles className="h-3 w-3 mr-1" />
              Recommended
            </Badge>
          )}
          {memberCount && !isSuitable && (
            <Badge variant="destructive">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Too Small
            </Badge>
          )}
        </div>
      </div>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {getCategoryIcon(product.category)}
          <CardTitle className="text-lg">{product.name}</CardTitle>
        </div>
        <CardDescription className="line-clamp-2">
          {product.description}
        </CardDescription>
        {product.recommendation && (
          <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            {product.recommendation}
          </p>
        )}
        {product.bulkHint && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-start gap-1 font-medium">
            <Zap className="h-3 w-3 mt-0.5 shrink-0" />
            {product.bulkHint}
          </p>
        )}
        {activeTreeType && product.bestFor?.[activeTreeType] && (
          <p className="text-xs text-primary mt-1 flex items-start gap-1 font-medium" data-testid={`text-bestfor-${product.id}`}>
            <Star className="h-3 w-3 mt-0.5 shrink-0 fill-primary" />
            {product.bestFor[activeTreeType]}
          </p>
        )}
      </CardHeader>
      <CardFooter className="flex justify-between items-center">
        <div className="text-lg font-semibold">
          From ${product.basePrice.toFixed(2)}
        </div>
        <Button 
          onClick={() => onCustomize(product)}
          data-testid={`button-customize-${product.id}`}
        >
          Customize
        </Button>
      </CardFooter>
    </Card>
  );
}

function MiniTreePreview({ members, relationships, treeName, treeType }: { members: any[]; relationships: any[]; treeName: string; treeType: string; layoutOverride?: GroupLayoutMode }) {
  const config = getTreeTypeConfig((treeType || "custom") as TreeType);
  const accentColor = config.visual.accentColor || "#10b981";

  const nodePositions = useMemo(() => {
    if (members.length === 0) return [];

    const memberMap = new Map<string, any>();
    members.forEach(m => memberMap.set(m.id, m));

    const adjacency = new Map<string, Set<string>>();
    members.forEach(m => adjacency.set(m.id, new Set()));
    relationships.forEach(r => {
      if (adjacency.has(r.fromMemberId) && adjacency.has(r.toMemberId)) {
        adjacency.get(r.fromMemberId)!.add(r.toMemberId);
        adjacency.get(r.toMemberId)!.add(r.fromMemberId);
      }
    });

    let rootId = members[0]?.id;
    let maxConnections = 0;
    for (const [id, neighbors] of adjacency) {
      if (neighbors.size > maxConnections) {
        maxConnections = neighbors.size;
        rootId = id;
      }
    }

    const placed = new Map<string, { x: number; y: number }>();
    const queue: string[] = [rootId];
    const visited = new Set<string>([rootId]);

    const nodeSpacingX = 140;
    const nodeSpacingY = 120;
    const levels: string[][] = [];

    while (queue.length > 0) {
      const levelSize = queue.length;
      const level: string[] = [];
      for (let i = 0; i < levelSize; i++) {
        const current = queue.shift()!;
        level.push(current);
        const neighbors = adjacency.get(current) || new Set();
        for (const n of neighbors) {
          if (!visited.has(n)) {
            visited.add(n);
            queue.push(n);
          }
        }
      }
      levels.push(level);
    }

    for (const m of members) {
      if (!visited.has(m.id)) {
        levels[levels.length - 1] = levels[levels.length - 1] || [];
        levels[levels.length - 1].push(m.id);
      }
    }

    levels.forEach((level, depth) => {
      const totalWidth = (level.length - 1) * nodeSpacingX;
      const startX = -totalWidth / 2;
      level.forEach((id, i) => {
        placed.set(id, { x: startX + i * nodeSpacingX, y: depth * nodeSpacingY });
      });
    });

    return members.map(m => {
      const pos = placed.get(m.id) || { x: 0, y: 0 };
      const initials = `${m.firstName?.[0] || ""}${m.lastName?.[0] || ""}`.toUpperCase();
      const displayName = m.firstName || "?";
      const absPhoto = m.photoUrl ? (m.photoUrl.startsWith('http') ? m.photoUrl : `${window.location.origin}${m.photoUrl}`) : undefined;
      return { id: m.id, x: pos.x, y: pos.y, initials, displayName, photoUrl: absPhoto };
    });
  }, [members, relationships]);

  const connectionLines = useMemo(() => {
    const posMap = new Map(nodePositions.map(n => [n.id, n]));
    return relationships
      .filter(r => posMap.has(r.fromMemberId) && posMap.has(r.toMemberId))
      .map(r => {
        const from = posMap.get(r.fromMemberId)!;
        const to = posMap.get(r.toMemberId)!;
        return { x1: from.x, y1: from.y, x2: to.x, y2: to.y, key: `${r.fromMemberId}-${r.toMemberId}` };
      });
  }, [nodePositions, relationships]);

  if (members.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full text-xs text-muted-foreground" data-testid="mini-tree-preview">
        No members
      </div>
    );
  }

  const padding = 50;
  const nodeRadius = 22;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodePositions.forEach(n => {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  });
  const svgW = maxX - minX + padding * 2 + nodeRadius * 2;
  const svgH = maxY - minY + padding * 2 + nodeRadius * 2 + 30;
  const offsetX = -minX + padding + nodeRadius;
  const offsetY = -minY + padding + nodeRadius + 20;

  const uniqueLines = new Map<string, typeof connectionLines[0]>();
  connectionLines.forEach(line => {
    const sortedKey = [line.x1, line.y1, line.x2, line.y2].sort().join(',');
    if (!uniqueLines.has(sortedKey)) uniqueLines.set(sortedKey, line);
  });

  return (
    <div className="w-full h-full overflow-hidden flex items-center justify-center bg-white" data-testid="mini-tree-preview">
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width="100%"
        height="100%"
        style={{ maxWidth: '100%', maxHeight: '100%' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect width={svgW} height={svgH} fill="white" />
        <defs>
          {nodePositions.map(node => {
            const cx = node.x + offsetX;
            const cy = node.y + offsetY;
            return node.photoUrl ? (
              <clipPath key={`clip-${node.id}`} id={`mini-clip-${node.id}`}>
                <circle cx={cx} cy={cy} r={nodeRadius - 2} />
              </clipPath>
            ) : null;
          })}
        </defs>
        <text x={svgW / 2} y={14} textAnchor="middle" fontSize={12} fontWeight="bold" fill="#374151">{treeName}</text>

        {Array.from(uniqueLines.values()).map(line => (
          <line
            key={line.key}
            x1={line.x1 + offsetX}
            y1={line.y1 + offsetY}
            x2={line.x2 + offsetX}
            y2={line.y2 + offsetY}
            stroke={accentColor}
            strokeWidth={1.5}
            strokeOpacity={0.5}
          />
        ))}

        {nodePositions.map(node => {
          const cx = node.x + offsetX;
          const cy = node.y + offsetY;
          return (
            <g key={node.id}>
              <circle cx={cx} cy={cy} r={nodeRadius} fill="white" stroke={accentColor} strokeWidth={2} />
              {node.photoUrl ? (
                <image
                  href={node.photoUrl}
                  x={cx - nodeRadius + 2}
                  y={cy - nodeRadius + 2}
                  width={(nodeRadius - 2) * 2}
                  height={(nodeRadius - 2) * 2}
                  clipPath={`url(#mini-clip-${node.id})`}
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight="bold" fill={accentColor}>
                  {node.initials}
                </text>
              )}
              <text x={cx} y={cy + nodeRadius + 11} textAnchor="middle" fontSize={7} fill="#4b5563">
                {node.displayName}
              </text>
            </g>
          );
        })}

        <text x={svgW / 2} y={svgH - 4} textAnchor="middle" fontSize={8} fill="#9ca3af">{config.visual.shapeName}</text>
      </svg>
    </div>
  );
}

function StaticTreeCapture({ members, relationships, treeName, treeType }: { members: any[]; relationships: any[]; treeName: string; treeType: string }) {
  const config = getTreeTypeConfig((treeType || "custom") as TreeType);
  const accentColor = config.visual.accentColor || "#10b981";

  const adjacency = new Map<string, Set<string>>();
  members.forEach(m => adjacency.set(m.id, new Set()));
  relationships.forEach(r => {
    if (adjacency.has(r.fromMemberId) && adjacency.has(r.toMemberId)) {
      adjacency.get(r.fromMemberId)!.add(r.toMemberId);
      adjacency.get(r.toMemberId)!.add(r.fromMemberId);
    }
  });

  let rootId = members[0]?.id;
  let maxConn = 0;
  for (const [id, neighbors] of adjacency) {
    if (neighbors.size > maxConn) { maxConn = neighbors.size; rootId = id; }
  }

  const queue: string[] = [rootId];
  const visited = new Set<string>([rootId]);
  const levels: string[][] = [];
  while (queue.length > 0) {
    const size = queue.length;
    const level: string[] = [];
    for (let i = 0; i < size; i++) {
      const cur = queue.shift()!;
      level.push(cur);
      for (const n of (adjacency.get(cur) || new Set())) {
        if (!visited.has(n)) { visited.add(n); queue.push(n); }
      }
    }
    levels.push(level);
  }
  for (const m of members) {
    if (!visited.has(m.id)) {
      levels[levels.length - 1] = levels[levels.length - 1] || [];
      levels[levels.length - 1].push(m.id);
    }
  }

  const nodeSpacingX = 220;
  const nodeSpacingY = 200;
  const nodeRadius = 40;
  const padding = 80;

  const placed = new Map<string, { x: number; y: number }>();
  levels.forEach((level, depth) => {
    const totalWidth = (level.length - 1) * nodeSpacingX;
    const startX = -totalWidth / 2;
    level.forEach((id, i) => {
      placed.set(id, { x: startX + i * nodeSpacingX, y: depth * nodeSpacingY });
    });
  });

  const nodes = members.map(m => {
    const pos = placed.get(m.id) || { x: 0, y: 0 };
    const initials = `${m.firstName?.[0] || ""}${m.lastName?.[0] || ""}`.toUpperCase();
    const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || "?";
    const absPhoto = m.photoUrl ? (m.photoUrl.startsWith('http') ? m.photoUrl : `${window.location.origin}${m.photoUrl}`) : undefined;
    return { id: m.id, x: pos.x, y: pos.y, initials, name, photoUrl: absPhoto };
  });

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(n => {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  });
  const svgW = maxX - minX + padding * 2 + nodeRadius * 2;
  const svgH = maxY - minY + padding * 2 + nodeRadius * 2 + 60;
  const offsetX = -minX + padding + nodeRadius;
  const offsetY = -minY + padding + nodeRadius + 40;

  const posMap = new Map(nodes.map(n => [n.id, n]));
  const uniqueLines = new Map<string, { x1: number; y1: number; x2: number; y2: number }>();
  relationships.forEach(r => {
    const from = posMap.get(r.fromMemberId);
    const to = posMap.get(r.toMemberId);
    if (from && to) {
      const key = [from.x, from.y, to.x, to.y].sort().join(',');
      if (!uniqueLines.has(key)) uniqueLines.set(key, { x1: from.x, y1: from.y, x2: to.x, y2: to.y });
    }
  });

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg">
      <rect width={svgW} height={svgH} fill="white" />
      <defs>
        {nodes.map(node => {
          const cx = node.x + offsetX;
          const cy = node.y + offsetY;
          return node.photoUrl ? (
            <clipPath key={`clip-${node.id}`} id={`print-clip-${node.id}`}>
              <circle cx={cx} cy={cy} r={nodeRadius - 3} />
            </clipPath>
          ) : null;
        })}
      </defs>
      <text x={svgW / 2} y={30} textAnchor="middle" fontSize={24} fontWeight="bold" fill="#1f2937">{treeName}</text>

      {Array.from(uniqueLines.values()).map((line, i) => (
        <line key={i} x1={line.x1 + offsetX} y1={line.y1 + offsetY} x2={line.x2 + offsetX} y2={line.y2 + offsetY}
          stroke={accentColor} strokeWidth={3} strokeOpacity={0.6} />
      ))}

      {nodes.map(node => {
        const cx = node.x + offsetX;
        const cy = node.y + offsetY;
        return (
          <g key={node.id}>
            <circle cx={cx} cy={cy} r={nodeRadius} fill="white" stroke={accentColor} strokeWidth={3} />
            {node.photoUrl ? (
              <image href={node.photoUrl} x={cx - nodeRadius + 3} y={cy - nodeRadius + 3}
                width={(nodeRadius - 3) * 2} height={(nodeRadius - 3) * 2}
                clipPath={`url(#print-clip-${node.id})`} preserveAspectRatio="xMidYMid slice" />
            ) : (
              <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={18} fontWeight="bold" fill={accentColor}>
                {node.initials}
              </text>
            )}
            <text x={cx} y={cy + nodeRadius + 18} textAnchor="middle" fontSize={13} fontWeight="500" fill="#374151">
              {node.name}
            </text>
          </g>
        );
      })}

      <text x={svgW / 2} y={svgH - 10} textAnchor="middle" fontSize={14} fill="#9ca3af">{config.visual.shapeName}</text>
    </svg>
  );
}

interface ShippingAddressForm {
  name: string;
  address1: string;
  address2: string;
  city: string;
  stateCode: string;
  countryCode: string;
  zip: string;
  phone: string;
  email: string;
}

function ProductCustomizer({
  product,
  trees,
  onClose,
  onOrderCreated,
  userId,
  prefill,
  layoutOverride,
}: {
  product: Product;
  trees: FamilyTree[];
  onClose: () => void;
  onOrderCreated: () => void;
  userId?: string;
  prefill?: { treeId?: string; includeQR?: boolean; skipToShipping?: boolean };
  layoutOverride?: GroupLayoutMode;
}) {
  const isQRFirst = !!(product.isConnectionShirt || product.isPromoItem);
  const [selectedTreeId, setSelectedTreeId] = useState<string>(prefill?.treeId || "");
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [includeTree, setIncludeTree] = useState(!isQRFirst);
  const [includeQR, setIncludeQR] = useState(prefill?.includeQR ?? isQRFirst);
  const [includeCustomImage, setIncludeCustomImage] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState<string>("");
  const [customImageName, setCustomImageName] = useState<string>("");
  const [customImagePlacement, setCustomImagePlacement] = useState<string>("front");
  const [isUploading, setIsUploading] = useState(false);
  const [includeCustomText, setIncludeCustomText] = useState(false);
  const [customText, setCustomText] = useState<string>("");
  const [customTextPlacement, setCustomTextPlacement] = useState<string>("front");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const treePreviewRef = useRef<HTMLDivElement>(null);
  const [isCapturingTree, setIsCapturingTree] = useState(false);
  const [savedTreeImageUrl, setSavedTreeImageUrl] = useState<string>("");
  const [savedQRImageUrl, setSavedQRImageUrl] = useState<string>("");
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [showShipping, setShowShipping] = useState(false);
  const [treePlacement, setTreePlacement] = useState<string>(product.placements?.[0]?.id || "front");
  const [qrPlacement, setQrPlacement] = useState<string>("");
  const [selectedQRType, setSelectedQRType] = useState<QRCodeType>('site');
  const [selectedQRTreeId, setSelectedQRTreeId] = useState<string>("");

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<string>("custom");

  const createGroupMutation = useMutation({
    mutationFn: async () => {
      if (!newGroupName.trim()) throw new Error("Please enter a group name");
      return apiRequest("POST", "/api/family-trees", {
        name: newGroupName.trim(),
        treeType: newGroupType,
        treeTypeLabel: newGroupType === 'custom' ? newGroupName.trim() : undefined,
      });
    },
    onSuccess: async (res: any) => {
      const newTree = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/family-trees'] });
      setSelectedQRType('tree');
      setSelectedQRTreeId(newTree.id);
      setShowCreateGroup(false);
      setNewGroupName("");
      toast({ title: "Group Created", description: `"${newTree.name}" is ready. The QR code will link to this group's invite.` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create group", variant: "destructive" });
    },
  });

  const qrTreeIdForInvite = selectedQRType === 'tree' ? selectedQRTreeId : '';
  const { data: inviteLinkData } = useQuery<{ inviteCode: string }>({
    queryKey: ['/api/trees', qrTreeIdForInvite, 'invite-link'],
    queryFn: async () => {
      const res = await fetch(`/api/trees/${qrTreeIdForInvite}/invite-link`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to get invite link');
      return res.json();
    },
    enabled: !!qrTreeIdForInvite,
    staleTime: Infinity,
  });
  const treeInviteCode = inviteLinkData?.inviteCode;

  const captureTreeImage = async () => {
    if (!selectedTreeId || treeMembers.length === 0) return;
    setIsCapturingTree(true);
    setSavedTreeImageUrl("");
    try {
      const photoDataUrls = new Map<string, string>();
      await Promise.all(treeMembers.filter(m => m.photoUrl).map(async (m) => {
        try {
          const absUrl = m.photoUrl!.startsWith('http') ? m.photoUrl! : `${window.location.origin}${m.photoUrl}`;
          const resp = await fetch(absUrl);
          const blob = await resp.blob();
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          photoDataUrls.set(m.id, dataUrl);
        } catch (e) {
          console.warn("Failed to load photo for member:", m.id, e);
        }
      }));

      const membersWithDataUrls = treeMembers.map(m => ({
        ...m,
        photoUrl: photoDataUrls.get(m.id) || m.photoUrl
      }));

      const captureDiv = document.createElement('div');
      captureDiv.style.position = 'absolute';
      captureDiv.style.left = '-9999px';
      captureDiv.style.top = '-9999px';
      captureDiv.style.width = '800px';
      captureDiv.style.height = '600px';
      captureDiv.style.background = '#ffffff';
      document.body.appendChild(captureDiv);

      const { createRoot } = await import('react-dom/client');
      const root = createRoot(captureDiv);
      root.render(
        <MiniTreePreview
          members={membersWithDataUrls}
          relationships={treeDetail?.relationships ?? []}
          treeName={selectedTree?.name || ''}
          treeType={selectedTree?.treeType || 'family'}
        />
      );

      await new Promise(resolve => setTimeout(resolve, 500));

      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(captureDiv, {
        quality: 0.95,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
      });

      root.unmount();
      document.body.removeChild(captureDiv);

      const captureBlob = await (await fetch(dataUrl)).blob();
      const filename = `tree-${selectedTreeId}-${Date.now()}.png`;
      const res = await apiRequest("POST", "/api/uploads/request-url", {
        name: filename,
        size: captureBlob.size,
        contentType: "image/png",
      });
      const { uploadURL, objectPath } = await res.json();
      await fetch(uploadURL, {
        method: "PUT",
        body: captureBlob,
        headers: { "Content-Type": "image/png" },
      });
      setSavedTreeImageUrl(objectPath);
      toast({ title: "Tree image captured", description: "Your tree image is ready for printing." });
    } catch (err: any) {
      console.error("Tree capture failed:", err);
      toast({ title: "Capture failed", description: err.message || "Failed to capture tree image. Please try again.", variant: "destructive" });
    } finally {
      setIsCapturingTree(false);
    }
  };

  const generateQRImage = async () => {
    setIsGeneratingQR(true);
    setSavedQRImageUrl("");
    try {
      const baseUrl = `${window.location.protocol}//${window.location.host}`;
      let qrValue = baseUrl;
      if (selectedQRType === 'profile' && userId) qrValue = `${baseUrl}/profile/${userId}`;
      else if (selectedQRType === 'tree' && treeInviteCode) qrValue = `${baseUrl}/join/${treeInviteCode}`;

      const res = await apiRequest("POST", "/api/merchandise/generate-qr", { url: qrValue });
      const { objectPath } = await res.json();
      setSavedQRImageUrl(objectPath);
      toast({ title: "QR code generated", description: "Your QR code is ready for printing." });
    } catch (err: any) {
      console.error("QR generation failed:", err);
      toast({ title: "QR generation failed", description: err.message || "Failed to generate QR code. Please try again.", variant: "destructive" });
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "File too large", description: "Please upload an image under 10MB", variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file (PNG, JPG, etc.)", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      const res = await apiRequest("POST", "/api/uploads/request-url", {
        name: file.name,
        size: file.size,
        contentType: file.type,
      });
      const { uploadURL, objectPath } = await res.json();
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      setCustomImageUrl(objectPath);
      setCustomImageName(file.name);
      toast({ title: "Image uploaded", description: `${file.name} is ready to use on your product` });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message || "Failed to upload image", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const [shippingAddress, setShippingAddress] = useState<ShippingAddressForm>({
    name: "",
    address1: "",
    address2: "",
    city: "",
    stateCode: "",
    countryCode: "US",
    zip: "",
    phone: "",
    email: "",
  });
  const { toast } = useToast();

  const { data: variants = [], isLoading: loadingVariants } = useQuery<Variant[]>({
    queryKey: ["/api/merchandise/products", product.id, "variants"],
    enabled: !!product.id,
  });

  const { data: treeDetail, isLoading: loadingTreeDetail } = useQuery<{ tree: any; members: any[]; relationships: any[] }>({
    queryKey: ["/api/trees", selectedTreeId],
    enabled: !!selectedTreeId,
  });

  useEffect(() => {
    if (!selectedVariantId && variants.length > 0) {
      const firstInStock = variants.find(v => v.in_stock);
      if (firstInStock) {
        setSelectedVariantId(firstInStock.id);
        if (prefill?.skipToShipping && selectedTreeId) {
          setShowShipping(true);
        }
      }
    }
  }, [variants, prefill, selectedVariantId, selectedTreeId]);

  const selectedVariant = variants.find(v => v.id === selectedVariantId);
  const selectedTree = trees.find(t => t.id === selectedTreeId);
  const treeMembers = treeDetail?.members ?? [];
  const treeMemberCount = treeMembers.length;

  const subtotal = selectedVariant 
    ? parseFloat(selectedVariant.price) * quantity * 100 
    : product.basePrice * quantity * 100;

  const isShippingValid = () => {
    return (
      shippingAddress.name.trim() !== "" &&
      shippingAddress.address1.trim() !== "" &&
      shippingAddress.city.trim() !== "" &&
      shippingAddress.stateCode.trim() !== "" &&
      shippingAddress.countryCode.length === 2 &&
      shippingAddress.zip.trim() !== ""
    );
  };

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVariantId || !selectedVariant) {
        throw new Error("Please select a product variant");
      }

      if (!includeTree && !includeQR && !includeCustomImage && !includeCustomText) {
        throw new Error("Please include at least one element on your product (tree print, QR code, custom image, or text)");
      }

      if (includeTree && !selectedTreeId) {
        throw new Error("Please select a tree");
      }

      if (includeCustomImage && !customImageUrl) {
        throw new Error("Please upload an image first");
      }

      if (includeCustomText && !customText.trim()) {
        throw new Error("Please enter some text");
      }

      if (includeQR) {
        if (selectedQRType === 'profile' && !userId) {
          throw new Error("You must be logged in to use the Profile QR code");
        }
        if (selectedQRType === 'tree' && !selectedQRTreeId) {
          throw new Error("Please select which tree or group the QR code should link to");
        }
        if (selectedQRType === 'tree' && !treeInviteCode) {
          throw new Error("Still generating invite link — please wait a moment and try again");
        }
        if (!savedQRImageUrl) {
          throw new Error("Please generate your QR code first using the 'Generate QR Code' button before placing an order.");
        }
      }

      if (!isShippingValid()) {
        throw new Error("Please complete all required shipping fields");
      }

      let treeImageUrl = '';
      if (includeTree && selectedTreeId && treeMembers.length > 0) {
        if (!savedTreeImageUrl) {
          throw new Error("Please capture your tree image first using the 'Capture Tree Image' button before placing an order.");
        }
        treeImageUrl = savedTreeImageUrl;
      }

      const treePrintPlacement = product.placements?.find(p => p.id === treePlacement);
      const qrPrintPlacement = qrPlacement ? product.placements?.find(p => p.id === qrPlacement) : null;

      let qrUrl: string | undefined;
      if (includeQR) {
        const orderBaseUrl = `${window.location.protocol}//${window.location.host}`;
        if (selectedQRType === 'site') qrUrl = orderBaseUrl;
        else if (selectedQRType === 'profile' && userId) qrUrl = `${orderBaseUrl}/profile/${userId}`;
        else if (selectedQRType === 'tree' && treeInviteCode) qrUrl = `${orderBaseUrl}/join/${treeInviteCode}`;
        else qrUrl = orderBaseUrl;
      }

      return apiRequest("POST", "/api/merchandise/orders", {
        treeId: selectedTreeId || undefined,
        productId: product.id,
        variantId: selectedVariantId,
        productName: product.name,
        variantName: selectedVariant.name,
        quantity,
        includeTree,
        includeQR: includeQR,
        qrUrl,
        qrImageUrl: savedQRImageUrl || undefined,
        treeImageUrl: treeImageUrl || undefined,
        treePlacement: treePrintPlacement?.printfulType || 'default',
        qrPlacement: qrPrintPlacement?.printfulType || null,
        includeCustomImage,
        customImageUrl: includeCustomImage ? customImageUrl : undefined,
        customImagePlacement: includeCustomImage ? customImagePlacement : undefined,
        includeCustomText,
        customText: includeCustomText ? customText.trim() : undefined,
        customTextPlacement: includeCustomText ? customTextPlacement : undefined,
        shippingAddress: {
          name: shippingAddress.name.trim(),
          address1: shippingAddress.address1.trim(),
          address2: shippingAddress.address2.trim() || undefined,
          city: shippingAddress.city.trim(),
          stateCode: shippingAddress.stateCode.trim().toUpperCase(),
          countryCode: shippingAddress.countryCode.toUpperCase(),
          zip: shippingAddress.zip.trim(),
          phone: shippingAddress.phone.trim() || undefined,
          email: shippingAddress.email.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Order Created",
        description: "Your merchandise order has been created. Proceed to checkout to complete your purchase.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/merchandise/orders"] });
      onOrderCreated();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create order",
        variant: "destructive",
      });
    },
  });

  const inStockVariants = variants.filter(v => v.in_stock);
  const uniqueColors = Array.from(new Set(inStockVariants.map(v => v.color).filter(Boolean)));
  const uniqueSizes = Array.from(new Set(inStockVariants.map(v => v.size).filter(Boolean)));

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="aspect-square bg-muted rounded-lg overflow-hidden relative">
            <img 
              src={selectedVariant?.image || product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            {includeTree && selectedTree && selectedTreeId && loadingTreeDetail && (
              <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/20">
                <div className="bg-white/90 dark:bg-gray-900/90 rounded-lg shadow-lg p-6 flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Loading tree preview...</span>
                </div>
              </div>
            )}
            {includeTree && savedTreeImageUrl && (
              <div className={`absolute p-4 ${
                treePlacement === 'back' ? 'inset-0 flex items-center justify-center opacity-60' :
                treePlacement === 'front_left' ? 'top-4 left-4' :
                'inset-0 flex items-center justify-center'
              }`}>
                <img
                  src={savedTreeImageUrl}
                  alt="Tree print preview"
                  className={`rounded-lg shadow-lg object-contain bg-white ${
                    treePlacement === 'front_left' ? 'w-1/3 h-1/3' :
                    product.printArea === 'wrap' ? 'w-3/4 h-1/2' : 
                    product.printArea === 'front' ? 'w-1/2 h-1/2' : 
                    'w-3/4 h-3/4'
                  }`}
                  data-testid="tree-image-preview-overlay"
                />
              </div>
            )}
            {includeTree && selectedTree && !savedTreeImageUrl && !loadingTreeDetail && treeMemberCount > 0 && (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="bg-white/90 rounded-lg shadow-lg p-4 text-center">
                  <Camera className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Capture tree image to preview</p>
                </div>
              </div>
            )}
            {includeQR && savedQRImageUrl && (
              <div 
                className={`absolute bg-white p-1.5 rounded shadow-lg border ${
                  qrPlacement === 'front_left' ? 'top-4 left-4' :
                  qrPlacement === 'back' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60' :
                  qrPlacement === 'front' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' :
                  'bottom-12 right-3'
                }`}
                data-testid="qr-preview-overlay"
              >
                <img src={savedQRImageUrl} alt="QR code preview" className={`object-contain ${qrPlacement === 'front_left' ? 'w-10 h-10' : 'w-12 h-12'}`} />
                <p className="text-[6px] text-center text-gray-500 mt-0.5">
                  {selectedQRType === 'site' ? 'Scan to sign up' : selectedQRType === 'profile' ? 'Scan to connect' : 'Scan to join'}
                </p>
              </div>
            )}
            {includeQR && !savedQRImageUrl && (
              <div className={`absolute bg-white/80 p-2 rounded shadow-lg border border-dashed ${
                qrPlacement === 'front_left' ? 'top-4 left-4' : 'bottom-12 right-3'
              }`}>
                <QrCode className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-[6px] text-center text-muted-foreground">Generate QR</p>
              </div>
            )}
            {includeCustomImage && customImageUrl && (
              <div
                className={`absolute ${
                  customImagePlacement === 'back' ? 'inset-0 flex items-center justify-center opacity-60' :
                  customImagePlacement === 'front_left' ? 'top-4 left-4' :
                  'inset-0 flex items-center justify-center'
                }`}
                data-testid="custom-image-preview-overlay"
              >
                <img
                  src={customImageUrl}
                  alt="Custom print"
                  className={`rounded shadow-lg object-contain ${
                    customImagePlacement === 'front_left' ? 'w-1/4 h-1/4' :
                    'w-1/2 h-1/2'
                  }`}
                />
              </div>
            )}
            {includeCustomText && customText.trim() && (
              <div
                className={`absolute ${
                  customTextPlacement === 'back' ? 'inset-0 flex items-center justify-center opacity-60' :
                  customTextPlacement === 'front_left' ? 'top-4 left-4' :
                  'bottom-16 left-4 right-4 flex items-center justify-center'
                }`}
                data-testid="custom-text-preview-overlay"
              >
                <div className="bg-white/90 dark:bg-gray-900/90 rounded px-3 py-1.5 shadow-lg">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100 text-center whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                    {customText}
                  </p>
                </div>
              </div>
            )}
            {(includeTree || includeQR || includeCustomImage || includeCustomText) && (
              <div className="absolute bottom-2 left-2 right-2">
                <Badge variant="secondary" className="text-xs truncate block text-center">
                  {[
                    includeTree && selectedTree && `${product.placements?.find(p => p.id === treePlacement)?.label || 'Front'}: Tree`,
                    includeQR && `QR: ${selectedQRType === 'site' ? 'Signup' : selectedQRType === 'profile' ? 'Profile' : 'Invite'}`,
                    includeCustomImage && customImageUrl && `${product.placements?.find(p => p.id === customImagePlacement)?.label || 'Front'}: Image`,
                    includeCustomText && customText.trim() && `Text`,
                  ].filter(Boolean).join(' | ')}
                </Badge>
              </div>
            )}
          </div>
          

          {includeTree && selectedTree && product.maxMembers && (
            <Alert variant={treeMemberCount > product.maxMembers ? "destructive" : "default"}>
              {treeMemberCount > product.maxMembers ? (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Tree may be too large</AlertTitle>
                  <AlertDescription>
                    Your tree has {treeMemberCount} members. This product works best with up to {product.maxMembers} members. 
                    Consider a poster or tote bag for larger trees.
                  </AlertDescription>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Great fit!</AlertTitle>
                  <AlertDescription>
                    Your tree ({treeMemberCount} members) fits well on this product (up to {product.maxMembers} members).
                  </AlertDescription>
                </>
              )}
            </Alert>
          )}
          
          {product.recommendation && (
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              {product.recommendation}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-xl flex items-center gap-2">
              {product.name}
              {product.isPromoItem && (
                <Badge className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px]">
                  <Zap className="h-3 w-3 mr-0.5" />
                  Bulk Promo
                </Badge>
              )}
            </h3>
            <p className="text-muted-foreground">{product.description}</p>
          </div>

          {product.bulkHint && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
              <p className="text-sm text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
                <Zap className="h-4 w-4 mt-0.5 shrink-0" />
                {product.bulkHint}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">What to include on your product</Label>
              <div className="border rounded-lg p-3 bg-muted/30">
                <label className="flex items-center gap-3 cursor-pointer" data-testid="toggle-include-tree">
                  <input
                    type="checkbox"
                    checked={includeTree}
                    onChange={(e) => {
                      setIncludeTree(e.target.checked);
                      if (!e.target.checked) {
                        setSelectedTreeId("");
                      }
                    }}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <TreeDeciduous className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <span className="text-sm font-medium">Tree / Group Print</span>
                    <p className="text-xs text-muted-foreground">Print your tree or group visualization on the product</p>
                  </div>
                </label>
              </div>
              <div className="border rounded-lg p-3 bg-muted/30">
                <label className="flex items-center gap-3 cursor-pointer" data-testid="toggle-include-qr">
                  <input
                    type="checkbox"
                    checked={includeQR}
                    onChange={(e) => {
                      setIncludeQR(e.target.checked);
                      if (e.target.checked) {
                        if (!qrPlacement && product.placements && product.placements.length > 1) {
                          const availablePlacement = product.placements.find(p => !includeTree || p.id !== treePlacement);
                          if (availablePlacement) setQrPlacement(availablePlacement.id);
                        }
                      } else {
                        setQrPlacement("");
                      }
                    }}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <QrCode className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <span className="text-sm font-medium">QR Code</span>
                    <p className="text-xs text-muted-foreground">Add a scannable QR code — choose what it links to below</p>
                  </div>
                </label>
              </div>
              <div className="border rounded-lg p-3 bg-muted/30">
                <label className="flex items-center gap-3 cursor-pointer" data-testid="toggle-include-custom-image">
                  <input
                    type="checkbox"
                    checked={includeCustomImage}
                    onChange={(e) => {
                      setIncludeCustomImage(e.target.checked);
                      if (!e.target.checked) {
                        setCustomImageUrl("");
                        setCustomImageName("");
                      }
                    }}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Image className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <span className="text-sm font-medium">Custom Image</span>
                    <p className="text-xs text-muted-foreground">Upload your own image — a saved tree export, logo, or artwork</p>
                  </div>
                </label>
              </div>
              <div className="border rounded-lg p-3 bg-muted/30">
                <label className="flex items-center gap-3 cursor-pointer" data-testid="toggle-include-custom-text">
                  <input
                    type="checkbox"
                    checked={includeCustomText}
                    onChange={(e) => {
                      setIncludeCustomText(e.target.checked);
                      if (!e.target.checked) {
                        setCustomText("");
                      }
                    }}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Type className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <span className="text-sm font-medium">Custom Text</span>
                    <p className="text-xs text-muted-foreground">Add a family name, motto, date, or any text to your product</p>
                  </div>
                </label>
              </div>
            </div>

            {includeTree && (
            <div className="space-y-2">
              <Label htmlFor="tree-select">Select Tree / Group</Label>
              <Select value={selectedTreeId} onValueChange={(v) => { setSelectedTreeId(v); setSavedTreeImageUrl(""); }}>
                <SelectTrigger id="tree-select" data-testid="select-tree">
                  <SelectValue placeholder="Choose a tree or group" />
                </SelectTrigger>
                <SelectContent>
                  {trees.map(tree => (
                    <SelectItem key={tree.id} value={tree.id}>
                      {tree.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTreeId && treeMembers.length > 0 && (
                <div className="space-y-2">
                  {savedTreeImageUrl ? (
                    <div className="border rounded-lg p-3 bg-green-50 dark:bg-green-950/30 space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-400">Tree image captured</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <img src={savedTreeImageUrl} alt="Captured tree" className="w-20 h-20 rounded object-contain border" data-testid="img-captured-tree" />
                        <Button variant="outline" size="sm" onClick={captureTreeImage} disabled={isCapturingTree} data-testid="button-recapture-tree">
                          {isCapturingTree ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Recapturing...</> : "Recapture"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={captureTreeImage}
                      disabled={isCapturingTree || loadingTreeDetail}
                      data-testid="button-capture-tree"
                    >
                      {isCapturingTree ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Capturing Tree Image...</>
                      ) : loadingTreeDetail ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading tree data...</>
                      ) : (
                        <><Camera className="h-4 w-4 mr-2" />Capture Tree Image</>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
            )}

            {includeCustomImage && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Image className="h-4 w-4" />
                  Upload Image
                </Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                  data-testid="input-custom-image-file"
                />
                {customImageUrl ? (
                  <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                      <span className="text-sm truncate">{customImageName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <img
                        src={customImageUrl}
                        alt="Custom upload preview"
                        className="w-16 h-16 rounded object-cover border"
                        data-testid="img-custom-preview"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        data-testid="button-replace-image"
                      >
                        Replace
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    data-testid="button-upload-image"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Choose Image File
                      </>
                    )}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">PNG, JPG, or other image files up to 10MB. Tip: Export your tree view as an image first, then upload it here.</p>
              </div>
            )}

            {includeCustomText && (
              <div className="space-y-2">
                <Label htmlFor="custom-text-input" className="flex items-center gap-1.5">
                  <Type className="h-4 w-4" />
                  Custom Text
                </Label>
                <Input
                  id="custom-text-input"
                  placeholder="e.g. The Smith Family, Est. 2024"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  maxLength={100}
                  data-testid="input-custom-text"
                />
                <p className="text-xs text-muted-foreground">{customText.length}/100 characters</p>
              </div>
            )}

            {loadingVariants ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading options...
              </div>
            ) : (
              <>
                {uniqueColors.length > 0 && (
                  <div>
                    <Label>Color</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {uniqueColors.slice(0, 8).map(color => {
                        const colorVariant = inStockVariants.find(v => v.color === color);
                        const isSelected = selectedVariant?.color === color;
                        return (
                          <button
                            key={color}
                            onClick={() => {
                              if (colorVariant) setSelectedVariantId(colorVariant.id);
                            }}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${
                              isSelected ? "border-primary ring-2 ring-primary/30" : "border-border"
                            }`}
                            style={{ backgroundColor: colorVariant?.color_code || "#ccc" }}
                            title={color}
                            data-testid={`button-color-${(color || 'default').toLowerCase().replace(/\s+/g, '-')}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {uniqueSizes.length > 1 && (
                  <div>
                    <Label>Size</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {uniqueSizes.map(size => {
                        const sizeVariant = inStockVariants.find(
                          v => v.size === size && (!selectedVariant || v.color === selectedVariant.color)
                        );
                        const isSelected = selectedVariant?.size === size;
                        return (
                          <Button
                            key={size}
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              if (sizeVariant) setSelectedVariantId(sizeVariant.id);
                            }}
                            disabled={!sizeVariant?.in_stock}
                            data-testid={`button-size-${size.toLowerCase()}`}
                          >
                            {size}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={10}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                className="w-24"
                data-testid="input-quantity"
              />
            </div>

            {includeTree && product.placements && product.placements.length > 1 && (
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  <TreeDeciduous className="h-4 w-4" />
                  Tree Placement
                </Label>
                <div className="grid grid-cols-1 gap-2">
                  {product.placements
                    .filter(p => !includeQR || p.id !== qrPlacement)
                    .map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setTreePlacement(p.id);
                        if (qrPlacement === p.id) setQrPlacement("");
                      }}
                      className={`text-left p-2.5 rounded-lg border transition-all ${
                        treePlacement === p.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border hover:border-primary/40"
                      }`}
                      data-testid={`button-tree-placement-${p.id}`}
                    >
                      <span className="text-sm font-medium">{p.label}</span>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {includeQR && (
              <div className="space-y-3">
                <Label className="flex items-center gap-1.5">
                  <QrCode className="h-4 w-4 text-primary" />
                  Choose Your QR Code
                </Label>
                <p className="text-xs text-muted-foreground -mt-1">Pick what happens when someone scans the code on your product</p>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => { setSelectedQRType('site'); setSelectedQRTreeId(''); setSavedQRImageUrl(''); }}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      selectedQRType === 'site'
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border hover:border-primary/40"
                    }`}
                    data-testid="qr-type-site"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${selectedQRType === 'site' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-sm font-medium">Site Signup</span>
                        <p className="text-xs text-muted-foreground">Links to FamilyRoots signup — anyone can join the platform</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => { setSelectedQRType('profile'); setSelectedQRTreeId(''); setSavedQRImageUrl(''); }}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      selectedQRType === 'profile'
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border hover:border-primary/40"
                    }`}
                    data-testid="qr-type-profile"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${selectedQRType === 'profile' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-sm font-medium">My Profile</span>
                        <p className="text-xs text-muted-foreground">Links to your profile — scanner sends you a connection request</p>
                      </div>
                    </div>
                  </button>
                  {trees.map(tree => {
                    const treeConfig = getTreeTypeConfig((tree.treeType || "family") as TreeType);
                    return (
                      <button
                        key={tree.id}
                        onClick={() => { setSelectedQRType('tree'); setSelectedQRTreeId(tree.id); setSavedQRImageUrl(''); }}
                        className={`text-left p-3 rounded-lg border transition-all ${
                          selectedQRType === 'tree' && selectedQRTreeId === tree.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-border hover:border-primary/40"
                        }`}
                        data-testid={`qr-type-tree-${tree.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${selectedQRType === 'tree' && selectedQRTreeId === tree.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            <TreeDeciduous className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="text-sm font-medium">{tree.name}</span>
                            <p className="text-xs text-muted-foreground">Links to your {treeConfig.label.toLowerCase()} — scanner can request to join</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {!showCreateGroup ? (
                    <button
                      onClick={() => setShowCreateGroup(true)}
                      className="text-left p-3 rounded-lg border border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 transition-all"
                      data-testid="qr-type-create-group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                          <Plus className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-primary">Create a New Group</span>
                          <p className="text-xs text-muted-foreground">Set up a blank group now, get the QR code, add members later</p>
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div className="p-3 rounded-lg border border-primary bg-primary/5 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Plus className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">New Group</span>
                      </div>
                      <div>
                        <Input
                          placeholder="e.g. Mrs. Johnson's 5th Grade, Soccer Team 2026"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          data-testid="input-new-group-name"
                        />
                      </div>
                      <div>
                        <Select value={newGroupType} onValueChange={setNewGroupType}>
                          <SelectTrigger data-testid="select-new-group-type">
                            <SelectValue placeholder="Group type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">Custom Group</SelectItem>
                            <SelectItem value="sports">Sports Team</SelectItem>
                            <SelectItem value="church">Church / Faith</SelectItem>
                            <SelectItem value="fraternity">Fraternity / Sorority</SelectItem>
                            <SelectItem value="friends">Friend Circle</SelectItem>
                            <SelectItem value="professional">Professional Network</SelectItem>
                            <SelectItem value="family">Family</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => createGroupMutation.mutate()}
                          disabled={!newGroupName.trim() || createGroupMutation.isPending}
                          data-testid="button-create-group"
                        >
                          {createGroupMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          Create & Use
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setShowCreateGroup(false); setNewGroupName(""); }}
                        >
                          Cancel
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Creates an empty group instantly. Hand out the QR stickers — when people scan and sign up, they automatically join this group.
                      </p>
                    </div>
                  )}
                </div>
                {savedQRImageUrl ? (
                  <div className="border rounded-lg p-3 bg-green-50 dark:bg-green-950/30 space-y-2 mt-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">QR code generated</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <img src={savedQRImageUrl} alt="Generated QR code" className="w-16 h-16 rounded object-contain border bg-white" data-testid="img-generated-qr" />
                      <Button variant="outline" size="sm" onClick={generateQRImage} disabled={isGeneratingQR} data-testid="button-regenerate-qr">
                        {isGeneratingQR ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Regenerating...</> : "Regenerate"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={generateQRImage}
                    disabled={isGeneratingQR || (selectedQRType === 'tree' && !treeInviteCode)}
                    data-testid="button-generate-qr"
                  >
                    {isGeneratingQR ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating QR Code...</>
                    ) : (
                      <><QrCode className="h-4 w-4 mr-2" />Generate QR Code</>
                    )}
                  </Button>
                )}
              </div>
            )}

            {includeQR && product.placements && product.placements.length > 1 && (
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  <QrCode className="h-4 w-4" />
                  QR Code Placement
                </Label>
                <div className="grid grid-cols-1 gap-2">
                  {product.placements
                    .filter(p => !includeTree || p.id !== treePlacement)
                    .map(p => (
                      <button
                        key={p.id}
                        onClick={() => setQrPlacement(p.id)}
                        className={`text-left p-2.5 rounded-lg border transition-all ${
                          qrPlacement === p.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-border hover:border-primary/40"
                        }`}
                        data-testid={`button-qr-placement-${p.id}`}
                      >
                        <span className="text-sm font-medium">{p.label}</span>
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                      </button>
                    ))}
                </div>
                {!qrPlacement && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Select where to place your QR code
                  </p>
                )}
              </div>
            )}

            {includeCustomImage && product.placements && product.placements.length > 1 && (
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  <Image className="h-4 w-4" />
                  Image Placement
                </Label>
                <div className="grid grid-cols-1 gap-2">
                  {product.placements.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setCustomImagePlacement(p.id)}
                      className={`text-left p-2.5 rounded-lg border transition-all ${
                        customImagePlacement === p.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border hover:border-primary/40"
                      }`}
                      data-testid={`button-image-placement-${p.id}`}
                    >
                      <span className="text-sm font-medium">{p.label}</span>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {includeCustomText && product.placements && product.placements.length > 1 && (
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  <Type className="h-4 w-4" />
                  Text Placement
                </Label>
                <div className="grid grid-cols-1 gap-2">
                  {product.placements.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setCustomTextPlacement(p.id)}
                      className={`text-left p-2.5 rounded-lg border transition-all ${
                        customTextPlacement === p.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border hover:border-primary/40"
                      }`}
                      data-testid={`button-text-placement-${p.id}`}
                    >
                      <span className="text-sm font-medium">{p.label}</span>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!showShipping ? (
            <>
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>${(subtotal / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Shipping + Commission</span>
                  <span>Calculated at checkout</span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => setShowShipping(true)}
                disabled={(!includeTree && !includeQR && !includeCustomImage && !includeCustomText) || (includeTree && !selectedTreeId) || (includeCustomImage && !customImageUrl) || (includeCustomText && !customText.trim()) || !selectedVariantId}
                data-testid="button-continue-shipping"
              >
                Continue to Shipping
              </Button>
            </>
          ) : (
            <>
              <div className="border-t pt-4 space-y-3">
                <h4 className="font-semibold">Shipping Address</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label htmlFor="shipping-name">Full Name *</Label>
                    <Input
                      id="shipping-name"
                      value={shippingAddress.name}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="John Smith"
                      data-testid="input-shipping-name"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="shipping-address1">Address Line 1 *</Label>
                    <Input
                      id="shipping-address1"
                      value={shippingAddress.address1}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, address1: e.target.value }))}
                      placeholder="123 Main St"
                      data-testid="input-shipping-address1"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="shipping-address2">Address Line 2</Label>
                    <Input
                      id="shipping-address2"
                      value={shippingAddress.address2}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, address2: e.target.value }))}
                      placeholder="Apt 4B (optional)"
                      data-testid="input-shipping-address2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shipping-city">City *</Label>
                    <Input
                      id="shipping-city"
                      value={shippingAddress.city}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="New York"
                      data-testid="input-shipping-city"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shipping-state">State Code *</Label>
                    <Input
                      id="shipping-state"
                      value={shippingAddress.stateCode}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, stateCode: e.target.value.toUpperCase().slice(0, 2) }))}
                      placeholder="NY"
                      maxLength={2}
                      data-testid="input-shipping-state"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shipping-zip">ZIP Code *</Label>
                    <Input
                      id="shipping-zip"
                      value={shippingAddress.zip}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, zip: e.target.value }))}
                      placeholder="10001"
                      data-testid="input-shipping-zip"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shipping-country">Country *</Label>
                    <Select 
                      value={shippingAddress.countryCode} 
                      onValueChange={(value) => setShippingAddress(prev => ({ ...prev, countryCode: value }))}
                    >
                      <SelectTrigger id="shipping-country" data-testid="select-shipping-country">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="CA">Canada</SelectItem>
                        <SelectItem value="GB">United Kingdom</SelectItem>
                        <SelectItem value="AU">Australia</SelectItem>
                        <SelectItem value="DE">Germany</SelectItem>
                        <SelectItem value="FR">France</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="shipping-phone">Phone</Label>
                    <Input
                      id="shipping-phone"
                      value={shippingAddress.phone}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+1 555-123-4567"
                      data-testid="input-shipping-phone"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shipping-email">Email</Label>
                    <Input
                      id="shipping-email"
                      type="email"
                      value={shippingAddress.email}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="john@example.com"
                      data-testid="input-shipping-email"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowShipping(false)}
                  data-testid="button-back-to-product"
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  size="lg"
                  onClick={() => createOrderMutation.mutate()}
                  disabled={!isShippingValid() || createOrderMutation.isPending || (includeTree && !savedTreeImageUrl) || (includeQR && !savedQRImageUrl)}
                  data-testid="button-place-order"
                >
                  {createOrderMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Order...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Place Order
                    </>
                  )}
                </Button>
                {((includeTree && !savedTreeImageUrl) || (includeQR && !savedQRImageUrl)) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 text-center mt-1">
                    {includeTree && !savedTreeImageUrl && includeQR && !savedQRImageUrl
                      ? "Capture your tree image and generate your QR code first"
                      : includeTree && !savedTreeImageUrl
                      ? "Capture your tree image first"
                      : "Generate your QR code first"}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: MerchandiseOrder }) {
  const { toast } = useToast();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    try {
      const response = await apiRequest("POST", `/api/merchandise/orders/${order.id}/checkout`);
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast({
        title: "Checkout Error",
        description: error.message || "Failed to start checkout",
        variant: "destructive",
      });
      setIsCheckingOut(false);
    }
  };

  const handleVerifyPayment = async () => {
    setIsVerifying(true);
    try {
      const response = await apiRequest("POST", `/api/merchandise/orders/${order.id}/confirm-payment`);
      const data = await response.json();
      if (data.status === 'paid' || data.status === 'submitted') {
        toast({ title: "Payment Verified", description: "Your payment has been confirmed." });
      } else {
        toast({ title: "Payment Not Found", description: "We couldn't verify payment yet. Try completing checkout again.", variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/merchandise/orders"] });
    } catch (error: any) {
      toast({ title: "Verification Error", description: error.message || "Failed to verify payment", variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const response = await apiRequest("POST", `/api/merchandise/orders/${order.id}/retry`);
      const data = await response.json();
      if (data.success) {
        toast({ title: "Order Resubmitted", description: "Your order has been sent to our print partner." });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/merchandise/orders"] });
    } catch (error: any) {
      toast({ title: "Retry Failed", description: error.message || "Failed to retry order", variant: "destructive" });
    } finally {
      setIsRetrying(false);
    }
  };

  const taxAmount = (order as any).taxAmount || 0;

  return (
    <Card data-testid={`card-order-${order.id}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2 flex-wrap">
          <div>
            <CardTitle className="text-lg">{order.variantName || order.productName}</CardTitle>
            {order.variantName && order.productName !== order.variantName && (
              <CardDescription>{order.productName}</CardDescription>
            )}
          </div>
          <Badge variant={
            order.status === "delivered" ? "default" :
            order.status === "shipped" ? "secondary" :
            order.status === "paid" || order.status === "submitted" ? "default" :
            order.status === "failed" || order.status === "cancelled" ? "destructive" :
            "outline"
          }>
            {order.status === "pending" ? "Awaiting Payment" : 
             order.status === "paid" ? "Payment Received" :
             order.status === "submitted" ? "Being Printed" :
             order.status === "shipped" ? "Shipped" :
             order.status === "delivered" ? "Delivered" :
             order.status === "failed" ? "Failed" :
             order.status === "cancelled" ? "Cancelled" :
             order.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-2 space-y-3">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Quantity</span>
            <span>{order.quantity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>${((order.subtotal || 0) / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <span>${((order.shippingCost || 0) / 100).toFixed(2)}</span>
          </div>
          {taxAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>${(taxAmount / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-medium border-t pt-1">
            <span>Total</span>
            <span>${(order.totalAmount / 100).toFixed(2)}</span>
          </div>
        </div>
        
        {order.status === "pending" && (
          <div className="flex gap-2">
            <Button 
              onClick={handleCheckout} 
              disabled={isCheckingOut || isVerifying}
              className="flex-1"
              data-testid={`button-checkout-${order.id}`}
            >
              {isCheckingOut ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Complete Checkout"
              )}
            </Button>
            {order.stripePaymentIntentId && (
              <Button 
                variant="outline"
                onClick={handleVerifyPayment} 
                disabled={isVerifying || isCheckingOut}
                data-testid={`button-verify-${order.id}`}
              >
                {isVerifying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Verify Payment"
                )}
              </Button>
            )}
          </div>
        )}

        {order.status === "failed" && (
          <div className="space-y-2">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Order Failed</AlertTitle>
              <AlertDescription>
                {(order as any).printfulError || "There was an issue sending your order to our print partner."}
              </AlertDescription>
            </Alert>
            <Button
              onClick={handleRetry}
              disabled={isRetrying}
              variant="outline"
              className="w-full"
              data-testid={`button-retry-${order.id}`}
            >
              {isRetrying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retry Submission
                </>
              )}
            </Button>
          </div>
        )}
        
        {order.trackingNumber && (
          <div className="flex items-center gap-2 text-sm">
            <Truck className="h-4 w-4" />
            <a 
              href={order.trackingUrl || "#"} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Track Package: {order.trackingNumber}
            </a>
          </div>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Ordered {new Date(order.createdAt).toLocaleDateString()}
      </CardFooter>
    </Card>
  );
}

function OrdersTab({ orders }: { orders: MerchandiseOrder[] }) {
  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">No Orders Yet</h3>
          <p className="text-muted-foreground">
            When you order custom merchandise, your orders will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map(order => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

export default function MerchandisePage() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productPrefill, setProductPrefill] = useState<{ treeId?: string; includeQR?: boolean; skipToShipping?: boolean } | undefined>();
  const [dialogKey, setDialogKey] = useState(0);
  const [activeTab, setActiveTab] = useState("products");
  const { toast } = useToast();

  const urlParams = new URLSearchParams(window.location.search);
  const checkoutStatus = urlParams.get("checkout");
  const orderId = urlParams.get("order");
  const tabParam = urlParams.get("tab");
  const qrTreeIdParam = urlParams.get("qrTreeId");
  const layoutParam = urlParams.get("layout") as GroupLayoutMode | null;
  const treeIdParam = urlParams.get("treeId");

  useEffect(() => {
    if (tabParam === "orders") {
      setActiveTab("orders");
      window.history.replaceState({}, '', '/merchandise');
    }
  }, [tabParam]);

  const { data: products = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ["/api/merchandise/products"],
  });

  const [preselectedTreeId, setPreselectedTreeId] = useState<string | null>(qrTreeIdParam);

  useEffect(() => {
    if (qrTreeIdParam && products.length > 0) {
      setPreselectedTreeId(qrTreeIdParam);
      const qrProduct = products.find(p => p.isConnectionShirt || p.isPromoItem);
      if (qrProduct) {
        setSelectedProduct(qrProduct);
        setProductPrefill({ treeId: qrTreeIdParam, includeQR: true });
        setDialogKey(prev => prev + 1);
      }
      window.history.replaceState({}, '', '/merchandise');
    }
  }, [qrTreeIdParam, products]);

  const { data: trees = [] } = useQuery<FamilyTree[]>({
    queryKey: ["/api/trees"],
    enabled: !!user,
  });

  const firstTree = (treeIdParam ? trees.find(t => String(t.id) === treeIdParam) : null) || (trees.length > 0 ? trees[0] : null);
  const firstTreeId = firstTree?.id ?? null;
  
  const { data: firstTreeMembers = [] } = useQuery<{ id: number }[]>({
    queryKey: ["/api/trees", firstTreeId, "members"],
    enabled: !!firstTreeId,
  });

  const { data: firstTreeDetail } = useQuery<{ tree: any; members: any[]; relationships: any[] }>({
    queryKey: ["/api/trees", firstTreeId],
    enabled: !!firstTreeId,
  });

  const effectiveLayout: GroupLayoutMode | undefined = layoutParam || (firstTreeDetail?.tree?.preferredLayout as GroupLayoutMode | undefined) || undefined;

  const memberCount = firstTreeMembers.length;

  const { data: orders = [], refetch: refetchOrders } = useQuery<MerchandiseOrder[]>({
    queryKey: ["/api/merchandise/orders"],
    enabled: !!user,
  });

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);

  const confirmPaymentMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return apiRequest("POST", `/api/merchandise/orders/${orderId}/confirm-payment`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchandise/orders"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchandise/orders"] });
    },
  });

  useEffect(() => {
    if (checkoutStatus === "success" && orderId) {
      setShowConfirmation(true);
      setConfirmedOrderId(orderId);
      window.history.replaceState({}, '', '/merchandise');
    } else if (checkoutStatus === "cancel") {
      toast({
        title: "Checkout Cancelled",
        description: "Your checkout was cancelled. You can complete it later from your orders.",
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/merchandise');
    }
  }, [checkoutStatus, orderId]);

  useEffect(() => {
    if (user && confirmedOrderId) {
      confirmPaymentMutation.mutate(confirmedOrderId);
      setConfirmedOrderId(null);
    }
  }, [user, confirmedOrderId]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (MERCHANDISE_DISABLED) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Merchandise Temporarily Unavailable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground" data-testid="text-merch-disabled">{MERCHANDISE_DISABLED_MESSAGE}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => navigate(user ? "/dashboard" : "/")} data-testid="button-back-dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(user ? "/dashboard" : "/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">Custom Merchandise</h1>
            </div>
          </div>
          
          {user && orders.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setActiveTab("orders")}
              data-testid="button-view-orders"
            >
              <Package className="h-4 w-4 mr-2" />
              My Orders ({orders.length})
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {showConfirmation ? (
          <div className="max-w-lg mx-auto text-center py-12" data-testid="order-confirmation">
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Order Confirmed!</h2>
              <p className="text-muted-foreground">
                Your payment was successful. Your custom merchandise is being prepared and will be shipped to you soon.
              </p>
            </div>
            <Card className="mb-6 text-left">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span>Payment processed</span>
                </div>
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-primary" />
                  <span>Order sent to our print partner</span>
                </div>
                <div className="flex items-center gap-3">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                  <span>Tracking info will be emailed when shipped</span>
                </div>
              </CardContent>
            </Card>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => {
                  setShowConfirmation(false);
                  setActiveTab("orders");
                }}
                data-testid="button-view-order-details"
              >
                <Package className="h-4 w-4 mr-2" />
                View My Orders
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfirmation(false);
                  setActiveTab("products");
                }}
                data-testid="button-continue-shopping"
              >
                Continue Shopping
              </Button>
            </div>
          </div>
        ) : user ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="products" data-testid="tab-products">
                <ShoppingBag className="h-4 w-4 mr-2" />
                Products
              </TabsTrigger>
              <TabsTrigger value="orders" data-testid="tab-orders">
                <Package className="h-4 w-4 mr-2" />
                My Orders
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Custom Merchandise</h2>
                <p className="text-muted-foreground">
                  Put your people on something real. Family trees, team rosters, group circles — printed on products you can wear, hang, and share with the world.
                </p>
              </div>

              {!loadingProducts && products.length > 0 && (
                <div className="mb-10 space-y-10" data-testid="featured-products-section">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="h-5 w-5 text-rose-500" />
                      <h3 className="text-xl font-bold">Bring Your People Into the Real World</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-5">
                      Your connections deserve more than a screen. Wear them, share them, show them off — and let anyone scan to join your circle.
                    </p>
                  </div>

                  {(() => {
                    const previewMembers = firstTreeDetail?.members ?? [];
                    const previewRelationships = firstTreeDetail?.relationships ?? [];
                    const previewTreeName = firstTree?.name ?? "My Tree";
                    const previewTreeType = (firstTree as any)?.treeType ?? "family";
                    const hasTree = previewMembers.length > 0;

                    const handleQuickOrder = (product: Product, includeQR: boolean) => {
                      if (firstTreeId && trees.length > 0) {
                        setProductPrefill({ treeId: firstTreeId, includeQR, skipToShipping: true });
                      }
                      setDialogKey(k => k + 1);
                      setSelectedProduct(product);
                    };

                    const themeGroups = [
                      {
                        id: 'family',
                        icon: <TreeDeciduous className="h-5 w-5" />,
                        title: 'Family Tree',
                        subtitle: 'Reunions, holidays, and everyday pride',
                        accentColor: 'emerald',
                        items: [
                          { productId: 395, tagline: 'The Whole Family in One Place', scene: 'Your entire family tree on a cozy throw blanket — drape it on the couch or hang it on the wall.', badge: 'Family Keepsake', showTree: true, showQR: false },
                          { productId: 71, tagline: 'The Reunion Conversation Starter', scene: 'Your family tree on the front, QR on the back. Relatives scan to join — the reunion starts with what you\'re wearing.', badge: 'Family Tree + QR', showTree: true, showQR: true },
                          { productId: 19, tagline: 'Morning Coffee with the Family', scene: 'Your family tree wraps around a classic white mug — start every morning looking at the people who matter most.', badge: 'Daily Reminder', showTree: true, showQR: false },
                        ],
                      },
                      {
                        id: 'basketball',
                        icon: <Trophy className="h-5 w-5" />,
                        title: 'Basketball Team',
                        subtitle: 'Locker rooms, game days, and team pride',
                        accentColor: 'orange',
                        items: [
                          { productId: 77, tagline: 'The Team Rep Snapback', scene: 'Your team name embroidered on a structured snapback — rock it at practice, games, and everywhere in between.', badge: 'Team Spirit', showTree: false, showQR: true },
                          { productId: 395, tagline: 'Every Player in Their Position', scene: 'Your full roster on a throw blanket — hang it in the locker room, bring it to tailgates, or drape it on the bench.', badge: 'Team Roster', showTree: true, showQR: false },
                          { productId: 1, tagline: 'The Roster Poster', scene: 'Museum-quality poster with your entire team laid out — frame it for the gym wall or the athletic hall of fame.', badge: 'Wall Display', showTree: true, showQR: false },
                        ],
                      },
                      {
                        id: 'friends',
                        icon: <Heart className="h-5 w-5" />,
                        title: 'Circle of Friends',
                        subtitle: 'Birthday gifts, group trips, and inside jokes',
                        accentColor: 'pink',
                        items: [
                          { productId: 214, tagline: 'Your Whole Circle on a Pillow', scene: 'All your friends on a cozy pillow — the perfect birthday gift, housewarming present, or friendiversary keepsake.', badge: 'Best Gift', showTree: true, showQR: false },
                          { productId: 84, tagline: 'The Squad Tote', scene: 'Your friend circle printed all over a spacious tote — carry your people with you everywhere you go.', badge: 'Everyday Carry', showTree: true, showQR: false },
                          { productId: 505, tagline: 'Invite the Whole World', scene: 'Die-cut stickers with your group QR — hand them out at parties, stick them on laptops, and grow your circle.', badge: 'Spread the Word', showTree: false, showQR: true },
                        ],
                      },
                      {
                        id: 'school',
                        icon: <GraduationCap className="h-5 w-5" />,
                        title: 'School Group',
                        subtitle: 'Classrooms, clubs, and end-of-year gifts',
                        accentColor: 'blue',
                        items: [
                          { productId: 300, tagline: 'The Teacher\'s Mug', scene: 'Every student in the class printed on a glossy black mug — the perfect end-of-year gift for your favorite teacher or coach.', badge: 'Teacher Gift', showTree: true, showQR: false },
                          { productId: 505, tagline: 'Club Recruitment Stickers', scene: 'Hand out QR stickers at club fairs, in hallways, or stuff them in welcome packets — new members scan and join instantly.', badge: 'Recruitment', showTree: false, showQR: true },
                          { productId: 71, tagline: 'The Class Shirt', scene: 'Your class or club on the front, join QR on the back — everyone wears one on field trips, spirit days, and class photos.', badge: 'Class Spirit', showTree: true, showQR: true },
                        ],
                      },
                    ];

                    const accentClasses: Record<string, { from: string; border: string; badge: string }> = {
                      emerald: { from: 'from-emerald-50 dark:from-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800/50', badge: 'bg-emerald-500' },
                      orange: { from: 'from-orange-50 dark:from-orange-950/30', border: 'border-orange-200 dark:border-orange-800/50', badge: 'bg-orange-500' },
                      pink: { from: 'from-pink-50 dark:from-pink-950/30', border: 'border-pink-200 dark:border-pink-800/50', badge: 'bg-pink-500' },
                      blue: { from: 'from-blue-50 dark:from-blue-950/30', border: 'border-blue-200 dark:border-blue-800/50', badge: 'bg-blue-500' },
                    };

                    return themeGroups.map(group => {
                      const accent = accentClasses[group.accentColor]!;
                      return (
                        <div key={group.id} data-testid={`theme-group-${group.id}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`p-1.5 rounded-lg ${accent.badge} text-white`}>
                              {group.icon}
                            </div>
                            <div>
                              <h4 className="font-bold text-base">{group.title}</h4>
                              <p className="text-xs text-muted-foreground">{group.subtitle}</p>
                            </div>
                          </div>
                          <div className="grid sm:grid-cols-3 gap-4 mt-3">
                            {group.items.map((item) => {
                              const product = products.find(p => p.id === item.productId);
                              if (!product) return null;
                              return (
                                <Card
                                  key={`${group.id}-${item.productId}`}
                                  className={`overflow-hidden hover-elevate cursor-pointer ${accent.border} bg-gradient-to-b ${accent.from} to-background`}
                                  onClick={() => handleQuickOrder(product, item.showQR)}
                                  data-testid={`card-theme-${group.id}-${product.id}`}
                                >
                                  <div className="relative">
                                    <div className="aspect-[4/3] overflow-hidden relative bg-gray-100 dark:bg-gray-800">
                                      <img
                                        src={product.image}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                      />
                                      {hasTree && item.showTree && (
                                        <div className="absolute top-[12%] left-[15%] w-[70%] h-[65%]">
                                          <div className="w-full h-full bg-white/85 rounded-md shadow-md overflow-hidden p-1">
                                            <MiniTreePreview
                                              members={previewMembers}
                                              relationships={previewRelationships}
                                              treeName={previewTreeName}
                                              treeType={previewTreeType}
                                              layoutOverride={(firstTreeDetail?.tree?.preferredLayout as GroupLayoutMode) || effectiveLayout}
                                            />
                                          </div>
                                        </div>
                                      )}
                                      {item.showQR && user && (
                                        <div className="absolute bottom-8 right-3">
                                          <div className="bg-white p-1.5 rounded shadow-lg border">
                                            <QRCodeSVG
                                              value={`${window.location.protocol}//${window.location.host}/profile/${user.id}`}
                                              size={36}
                                              level="M"
                                            />
                                            <p className="text-[5px] text-center text-gray-500 mt-0.5">Scan me</p>
                                          </div>
                                        </div>
                                      )}
                                      {!hasTree && item.showTree && (
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                          <div className="bg-white/90 dark:bg-gray-900/90 rounded-lg px-3 py-2 text-center">
                                            <TreeDeciduous className="h-5 w-5 mx-auto text-primary mb-1" />
                                            <p className="text-[10px] text-muted-foreground">Your group appears here</p>
                                          </div>
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                                      <div className="absolute bottom-3 left-3">
                                        <Badge variant="secondary" className={`${accent.badge} text-white border-0`}>
                                          {item.badge}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="p-4">
                                    <h4 className="font-bold text-sm mb-1">{item.tagline}</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                                      {item.scene}
                                    </p>
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="text-[11px] text-muted-foreground">{product.name}</p>
                                        <p className="font-semibold text-sm">From ${product.basePrice.toFixed(2)}</p>
                                      </div>
                                      <Button size="sm" variant="default" data-testid={`button-theme-order-${group.id}-${product.id}`}>
                                        <Zap className="h-3 w-3 mr-1" />
                                        Make It
                                      </Button>
                                    </div>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {trees.length === 0 && (
                <Card className="mb-6 border-primary/50 bg-primary/5">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <TreeDeciduous className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">Create a Group First</p>
                        <p className="text-sm text-muted-foreground">
                          You need at least one family tree, team, or group to create custom merchandise.
                        </p>
                        <Button 
                          variant="ghost" 
                          className="px-0 mt-1 text-primary hover:text-primary/80"
                          onClick={() => navigate("/dashboard")}
                        >
                          Go to Dashboard
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {loadingProducts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(() => {
                    const activeType = (firstTree as any)?.treeType || undefined;
                    const sorted = [...products].sort((a, b) => {
                      if (!activeType) return 0;
                      const aIdx = a.recommendedFor?.indexOf(activeType) ?? -1;
                      const bIdx = b.recommendedFor?.indexOf(activeType) ?? -1;
                      const aRank = aIdx === -1 ? 999 : aIdx;
                      const bRank = bIdx === -1 ? 999 : bIdx;
                      return aRank - bRank;
                    });
                    return sorted.map(product => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onCustomize={(p) => { setProductPrefill(preselectedTreeId ? { treeId: preselectedTreeId } : undefined); setDialogKey(k => k + 1); setSelectedProduct(p); }}
                        memberCount={memberCount > 0 ? memberCount : undefined}
                        activeTreeType={activeType}
                      />
                    ));
                  })()}
                </div>
              )}

              <div className="mt-12 grid md:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <Check className="h-8 w-8 mx-auto text-green-500 mb-3" />
                    <h3 className="font-semibold mb-1">Premium Quality</h3>
                    <p className="text-sm text-muted-foreground">
                      All products are made with high-quality materials
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <Truck className="h-8 w-8 mx-auto text-blue-500 mb-3" />
                    <h3 className="font-semibold mb-1">Global Shipping</h3>
                    <p className="text-sm text-muted-foreground">
                      We ship to most countries worldwide
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <Star className="h-8 w-8 mx-auto text-yellow-500 mb-3" />
                    <h3 className="font-semibold mb-1">Perfect Gift</h3>
                    <p className="text-sm text-muted-foreground">
                      Personalized gifts for families, teams, and every group
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <CreditCard className="h-6 w-6 text-primary" />
                      <SiBitcoin className="h-6 w-6 text-orange-500" />
                      <SiEthereum className="h-6 w-6 text-purple-500" />
                    </div>
                    <h3 className="font-semibold mb-1">Pay Your Way</h3>
                    <p className="text-sm text-muted-foreground">
                      Cards, Bitcoin, Ethereum & stablecoins accepted
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="orders">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">My Orders</h2>
                <p className="text-muted-foreground">
                  Track your merchandise orders and view order history.
                </p>
              </div>
              <OrdersTab orders={orders} />
            </TabsContent>
          </Tabs>
        ) : (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Custom Merchandise</h2>
              <p className="text-muted-foreground">
                Put your family tree, sports team, friend circle, or school group on real products — perfect for gifts, events, and everyday pride.
              </p>
            </div>

            <Alert className="mb-6">
              <Star className="h-4 w-4" />
              <AlertTitle>Sign In to Order</AlertTitle>
              <AlertDescription>
                Sign in to customize products with your group and place orders.
                <Button 
                  variant="ghost" 
                  className="px-1 text-primary underline"
                  onClick={() => window.location.href = "/api/login"}
                  data-testid="button-sign-in"
                >
                  Sign In Now
                </Button>
              </AlertDescription>
            </Alert>

            {loadingProducts ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onCustomize={() => window.location.href = "/api/login"}
                  />
                ))}
              </div>
            )}

            <div className="mt-12 grid md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <h3 className="font-semibold">Premium Quality</h3>
                  <p className="text-sm text-muted-foreground">
                    All products are made with high-quality materials
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Truck className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <h3 className="font-semibold">Global Shipping</h3>
                  <p className="text-sm text-muted-foreground">
                    We ship to most countries worldwide
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Star className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                  <h3 className="font-semibold">Perfect Gift</h3>
                  <p className="text-sm text-muted-foreground">
                    Personalized gifts for families, teams, and every group
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      <Dialog open={!!selectedProduct} onOpenChange={(open) => { if (!open) { setSelectedProduct(null); setProductPrefill(undefined); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{productPrefill?.skipToShipping ? "Almost There — Just Add Shipping" : "Customize Your Product"}</DialogTitle>
            <DialogDescription>
              {productPrefill?.skipToShipping 
                ? "We've pre-selected your tree and options. Enter your shipping address to complete the order."
                : "Select your family tree and product options"
              }
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <ProductCustomizer
              key={`customizer-${dialogKey}`}
              product={selectedProduct}
              trees={trees}
              onClose={() => { setSelectedProduct(null); setProductPrefill(undefined); }}
              onOrderCreated={() => setActiveTab("orders")}
              userId={user?.id}
              prefill={productPrefill}
              layoutOverride={effectiveLayout}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
