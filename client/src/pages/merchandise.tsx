import { useState, useEffect } from "react";
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
  ShoppingBag, Package, Truck, ArrowLeft, TreeDeciduous, 
  Shirt, Coffee, Image, Star, Check, Loader2, CreditCard, CheckCircle, XCircle,
  AlertTriangle, Info, Sparkles, Wallet, QrCode, Flame, ChevronRight, Zap
} from "lucide-react";
import { SiBitcoin, SiEthereum } from "react-icons/si";
import { QRCodeSVG } from "qrcode.react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { FamilyTree, MerchandiseOrder } from "@shared/schema";
import { getTreeTypeConfig, type TreeType, type TreeTypeConfig } from "@shared/treeTypes";

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
  memberCount 
}: { 
  product: Product; 
  onCustomize: (product: Product) => void;
  memberCount?: number;
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
          {product.isFeatured && (
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

function MiniTreePreview({ members, relationships, treeName, treeType }: { members: any[]; relationships: any[]; treeName: string; treeType: string }) {
  const config = getTreeTypeConfig((treeType || "custom") as TreeType);
  const { layoutShape, accentColor, lineStyle, lineColor, nodeShape } = config.visual;
  const width = 300;
  const height = 300;
  const cx = width / 2;
  const cy = height / 2;
  const nodeRadius = 12;
  const maxDisplay = 30;
  const displayMembers = members.slice(0, maxDisplay);
  const count = displayMembers.length;

  const positions = new Map<string, { x: number; y: number }>();

  if (count === 0) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" data-testid="mini-tree-preview">
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={10} className="fill-gray-500 dark:fill-gray-400">No members</text>
      </svg>
    );
  }

  if (layoutShape === "circle") {
    const circleRadius = Math.min(cx, cy) - 40;
    displayMembers.forEach((m, i) => {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      positions.set(m.id, {
        x: cx + circleRadius * Math.cos(angle),
        y: cy + circleRadius * Math.sin(angle),
      });
    });
  } else if (layoutShape === "radial") {
    if (count > 0) {
      positions.set(displayMembers[0].id, { x: cx, y: cy });
      const rings = Math.ceil((count - 1) / 8);
      let idx = 1;
      for (let ring = 1; ring <= rings && idx < count; ring++) {
        const ringRadius = (Math.min(cx, cy) - 30) * (ring / rings);
        const spotsInRing = Math.min(count - idx, ring * 8);
        for (let s = 0; s < spotsInRing && idx < count; s++, idx++) {
          const angle = (2 * Math.PI * s) / spotsInRing - Math.PI / 2;
          positions.set(displayMembers[idx].id, {
            x: cx + ringRadius * Math.cos(angle),
            y: cy + ringRadius * Math.sin(angle),
          });
        }
      }
    }
  } else if (layoutShape === "grid") {
    const cols = Math.ceil(Math.sqrt(count * 1.5));
    const rows = Math.ceil(count / cols);
    const cellW = (width - 40) / cols;
    const cellH = (height - 60) / Math.max(rows, 1);
    displayMembers.forEach((m, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const rowCount = Math.min(cols, count - row * cols);
      const offsetX = (cols - rowCount) * cellW / 2;
      positions.set(m.id, {
        x: 20 + offsetX + col * cellW + cellW / 2,
        y: 30 + row * cellH + cellH / 2,
      });
    });
  } else if (layoutShape === "arc") {
    const arcRadius = Math.min(cx, cy) - 30;
    const arcSpan = Math.PI * 0.8;
    const startAngle = Math.PI / 2 - arcSpan / 2;
    displayMembers.forEach((m, i) => {
      const angle = count > 1
        ? startAngle + (arcSpan * i) / (count - 1)
        : Math.PI / 2;
      positions.set(m.id, {
        x: cx + arcRadius * Math.cos(angle),
        y: cy + arcRadius * Math.sin(angle) * 0.6,
      });
    });
  } else if (layoutShape === "network") {
    const seed = treeName.length;
    displayMembers.forEach((m, i) => {
      const golden = (i * 137.508 + seed) % 360;
      const r = 20 + ((i * 47 + seed * 3) % ((Math.min(cx, cy) - 40)));
      const angle = (golden * Math.PI) / 180;
      positions.set(m.id, {
        x: cx + r * Math.cos(angle) * 0.8,
        y: cy + r * Math.sin(angle) * 0.8,
      });
    });
  } else {
    const parentChildPairs = relationships
      .filter((r: any) => r.relationshipType === "parent")
      .map((r: any) => ({ from: r.fromMemberId, to: r.toMemberId }));
    const childPairs = relationships
      .filter((r: any) => r.relationshipType === "child")
      .map((r: any) => ({ from: r.toMemberId, to: r.fromMemberId }));
    const allPairs = [...parentChildPairs, ...childPairs];

    const spouseMap = new Map<string, string>();
    relationships
      .filter((r: any) => r.relationshipType === "spouse")
      .forEach((r: any) => {
        const memberIds = new Set(displayMembers.map(m => m.id));
        if (memberIds.has(r.fromMemberId) && memberIds.has(r.toMemberId)) {
          if (!spouseMap.has(r.fromMemberId)) spouseMap.set(r.fromMemberId, r.toMemberId);
          if (!spouseMap.has(r.toMemberId)) spouseMap.set(r.toMemberId, r.fromMemberId);
        }
      });

    const childrenOf = new Map<string, string[]>();
    displayMembers.forEach(m => childrenOf.set(m.id, []));
    allPairs.forEach(({ from, to }) => {
      if (childrenOf.has(from) && !childrenOf.get(from)!.includes(to)) {
        childrenOf.get(from)!.push(to);
      }
    });

    const parentIds = new Set(allPairs.map(p => p.from));
    const childIds = new Set(allPairs.map(p => p.to));
    const roots = displayMembers.filter(m => parentIds.has(m.id) && !childIds.has(m.id));
    if (roots.length === 0 && count > 0) {
      const anyParent = displayMembers.find(m => parentIds.has(m.id));
      roots.push(anyParent || displayMembers[0]);
    }

    const depths = new Map<string, number>();
    const assignDepth = (id: string, d: number) => {
      if (depths.has(id)) return;
      depths.set(id, d);
      const spouse = spouseMap.get(id);
      if (spouse && !depths.has(spouse)) depths.set(spouse, d);
      (childrenOf.get(id) || []).forEach(cid => assignDepth(cid, d + 1));
    };
    roots.forEach(r => assignDepth(r.id, 0));
    displayMembers.forEach(m => { if (!depths.has(m.id)) depths.set(m.id, 0); });

    const maxDepth = Math.max(0, ...Array.from(depths.values()));
    const depthRows = new Map<number, any[]>();
    const placed = new Set<string>();
    displayMembers.forEach(m => {
      if (placed.has(m.id)) return;
      const d = depths.get(m.id) ?? 0;
      if (!depthRows.has(d)) depthRows.set(d, []);
      depthRows.get(d)!.push(m);
      placed.add(m.id);
      const spouse = spouseMap.get(m.id);
      if (spouse && !placed.has(spouse)) {
        const spouseMember = displayMembers.find(dm => dm.id === spouse);
        if (spouseMember) {
          depthRows.get(d)!.push(spouseMember);
          placed.add(spouse);
        }
      }
    });

    const rowCount = maxDepth + 1;
    const topMargin = 24;
    const bottomMargin = 16;
    const usableHeight = height - topMargin - bottomMargin;
    const ySpacing = usableHeight / (rowCount + 1);
    depthRows.forEach((row, depth) => {
      const xSpacing = width / (row.length + 1);
      row.forEach((m: any, i: number) => {
        positions.set(m.id, { x: xSpacing * (i + 1), y: topMargin + ySpacing * (depth + 1) });
      });
    });
  }

  const connectionPairs = relationships
    .map((r: any) => ({ from: r.fromMemberId, to: r.toMemberId }))
    .filter(({ from, to }: any) => positions.has(from) && positions.has(to));
  const seen = new Set<string>();
  const uniqueConnections = connectionPairs.filter(({ from, to }: any) => {
    const key = from < to ? `${from}-${to}` : `${to}-${from}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const strokeDasharray = lineStyle === "dashed" ? "4,3" : lineStyle === "dotted" ? "2,2" : undefined;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" data-testid="mini-tree-preview">
      <text x={cx} y={14} textAnchor="middle" fontSize={10} fontWeight="bold" className="fill-gray-700 dark:fill-gray-200">{treeName}</text>
      <text x={cx} y={height - 6} textAnchor="middle" fontSize={8} className="fill-gray-500 dark:fill-gray-400">{config.visual.shapeName}</text>
      {layoutShape === "circle" && count > 1 && (
        <circle cx={cx} cy={cy} r={Math.min(cx, cy) - 40} fill="none" stroke={lineColor} strokeWidth={1} strokeDasharray={strokeDasharray} opacity={0.3} />
      )}
      {uniqueConnections.map(({ from, to }: any, i: number) => {
        const p1 = positions.get(from)!;
        const p2 = positions.get(to)!;
        return <line key={`edge-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={lineColor} strokeWidth={1.5} strokeDasharray={strokeDasharray} opacity={0.5} />;
      })}
      {displayMembers.map(m => {
        const pos = positions.get(m.id);
        if (!pos) return null;
        const initials = `${(m.firstName || "")[0] || ""}${(m.lastName || "")[0] || ""}`.toUpperCase();
        const r = nodeRadius;
        return (
          <g key={m.id}>
            {nodeShape === "hexagon" ? (
              <polygon
                points={Array.from({ length: 6 }, (_, i) => {
                  const a = (Math.PI / 3) * i - Math.PI / 6;
                  return `${pos.x + r * Math.cos(a)},${pos.y + r * Math.sin(a)}`;
                }).join(" ")}
                fill={accentColor} stroke={accentColor} strokeWidth={1}
              />
            ) : nodeShape === "rounded" ? (
              <rect x={pos.x - r} y={pos.y - r * 0.8} width={r * 2} height={r * 1.6} rx={4} fill={accentColor} stroke={accentColor} strokeWidth={1} />
            ) : (
              <circle cx={pos.x} cy={pos.y} r={r} fill={accentColor} stroke={accentColor} strokeWidth={1} />
            )}
            <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="central" fontSize={7} fontWeight="600" fill="white">{initials}</text>
            <text x={pos.x} y={pos.y + r + 9} textAnchor="middle" fontSize={6} className="fill-gray-700 dark:fill-gray-200">{m.firstName || ""}</text>
          </g>
        );
      })}
      {members.length > maxDisplay && (
        <text x={cx} y={height - 16} textAnchor="middle" fontSize={8} className="fill-gray-500 dark:fill-gray-400">+{members.length - maxDisplay} more</text>
      )}
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
}: {
  product: Product;
  trees: FamilyTree[];
  onClose: () => void;
  onOrderCreated: () => void;
  userId?: string;
}) {
  const [selectedTreeId, setSelectedTreeId] = useState<string>("");
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [includeQR, setIncludeQR] = useState(false);
  const [showShipping, setShowShipping] = useState(false);
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
      if (!selectedTreeId || !selectedVariantId || !selectedVariant) {
        throw new Error("Please select a tree and product variant");
      }

      if (!isShippingValid()) {
        throw new Error("Please complete all required shipping fields");
      }

      const treeImageUrl = `${window.location.origin}/tree/${selectedTreeId}`;

      return apiRequest("POST", "/api/merchandise/orders", {
        treeId: selectedTreeId,
        productId: product.id,
        variantId: selectedVariantId,
        productName: product.name,
        variantName: selectedVariant.name,
        quantity,
        includeQR,
        treeImageUrl,
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
  const uniqueColors = Array.from(new Set(inStockVariants.map(v => v.color)));
  const uniqueSizes = Array.from(new Set(inStockVariants.map(v => v.size)));

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
            {selectedTree && selectedTreeId && loadingTreeDetail && (
              <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/20">
                <div className="bg-white/90 dark:bg-gray-900/90 rounded-lg shadow-lg p-6 flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Loading tree preview...</span>
                </div>
              </div>
            )}
            {selectedTree && selectedTreeId && !loadingTreeDetail && treeMemberCount > 0 && (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div 
                  className={`bg-white/90 dark:bg-gray-900/90 rounded-lg shadow-lg overflow-hidden ${
                    product.printArea === 'wrap' ? 'w-3/4 h-1/2' : 
                    product.printArea === 'front' ? 'w-1/2 h-1/2' : 
                    'w-3/4 h-3/4'
                  }`}
                >
                  <MiniTreePreview members={treeMembers} relationships={treeDetail?.relationships ?? []} treeName={selectedTree.name} treeType={selectedTree.treeType || "family"} />
                </div>
              </div>
            )}
            {includeQR && userId && (
              <div className="absolute bottom-12 right-3 bg-white p-1.5 rounded shadow-lg border" data-testid="qr-preview-overlay">
                <QRCodeSVG
                  value={`${window.location.protocol}//${window.location.host}/profile/${userId}`}
                  size={48}
                  level="M"
                />
                <p className="text-[6px] text-center text-gray-500 mt-0.5">Scan to connect</p>
              </div>
            )}
            {selectedTree && (
              <div className="absolute bottom-2 left-2 right-2">
                <Badge variant="secondary" className="text-xs">
                  Print Preview: {selectedTree.name}
                  {includeQR && " + QR Code"}
                </Badge>
              </div>
            )}
          </div>
          
          {selectedTree && product.maxMembers && (
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
            <h3 className="font-semibold text-xl">{product.name}</h3>
            <p className="text-muted-foreground">{product.description}</p>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="tree-select">Select Family Tree</Label>
              <Select value={selectedTreeId} onValueChange={setSelectedTreeId}>
                <SelectTrigger id="tree-select" data-testid="select-tree">
                  <SelectValue placeholder="Choose a family tree" />
                </SelectTrigger>
                <SelectContent>
                  {trees.map(tree => (
                    <SelectItem key={tree.id} value={tree.id}>
                      {tree.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                            data-testid={`button-color-${color.toLowerCase().replace(/\s+/g, '-')}`}
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

            <div className="border rounded-lg p-3 bg-muted/30">
              <label className="flex items-center gap-3 cursor-pointer" data-testid="toggle-qr-code">
                <input
                  type="checkbox"
                  checked={includeQR}
                  onChange={(e) => setIncludeQR(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <QrCode className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="text-sm font-medium">Include my QR code</span>
                  <p className="text-xs text-muted-foreground">Add a scannable QR code linking to your profile so people can connect with you</p>
                </div>
              </label>
            </div>
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
                disabled={!selectedTreeId || !selectedVariantId}
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
                  disabled={!isShippingValid() || createOrderMutation.isPending}
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

  return (
    <Card data-testid={`card-order-${order.id}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2 flex-wrap">
          <div>
            <CardTitle className="text-lg">{order.productName}</CardTitle>
            {order.variantName && (
              <CardDescription>{order.variantName}</CardDescription>
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
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Quantity: {order.quantity}</span>
          <span className="font-medium">${(order.totalAmount / 100).toFixed(2)}</span>
        </div>
        
        {order.status === "pending" && (
          <Button 
            onClick={handleCheckout} 
            disabled={isCheckingOut}
            className="w-full"
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
  const [activeTab, setActiveTab] = useState("products");
  const { toast } = useToast();

  const urlParams = new URLSearchParams(window.location.search);
  const checkoutStatus = urlParams.get("checkout");
  const orderId = urlParams.get("order");
  const tabParam = urlParams.get("tab");

  useEffect(() => {
    if (tabParam === "orders") {
      setActiveTab("orders");
      window.history.replaceState({}, '', '/merchandise');
    }
  }, [tabParam]);

  const { data: products = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ["/api/merchandise/products"],
  });

  const { data: trees = [] } = useQuery<FamilyTree[]>({
    queryKey: ["/api/trees"],
    enabled: !!user,
  });

  const firstTreeId = trees.length > 0 ? trees[0].id : null;
  
  const { data: firstTreeMembers = [] } = useQuery<{ id: number }[]>({
    queryKey: ["/api/trees", firstTreeId, "members"],
    enabled: !!firstTreeId,
  });

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
      if (user) {
        confirmPaymentMutation.mutate(orderId);
      }
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

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                <h2 className="text-2xl font-bold mb-2">Print Your Family Tree</h2>
                <p className="text-muted-foreground">
                  Turn your family tree into beautiful custom products. Perfect for gifts or keeping your heritage close.
                </p>
              </div>

              {!loadingProducts && products.filter(p => p.isFeatured).length > 0 && (
                <div className="mb-8" data-testid="featured-products-section">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="h-5 w-5 text-orange-500" />
                    <h3 className="text-lg font-semibold">Quick Order — Popular Picks</h3>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    {products.filter(p => p.isFeatured).map(product => (
                      <Card 
                        key={`featured-${product.id}`}
                        className="overflow-hidden hover-elevate cursor-pointer border-orange-200 dark:border-orange-800/50 bg-gradient-to-br from-orange-50/50 to-background dark:from-orange-950/20 dark:to-background"
                        onClick={() => setSelectedProduct(product)}
                        data-testid={`card-featured-${product.id}`}
                      >
                        <div className="flex items-center gap-4 p-4">
                          <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0 relative">
                            <img 
                              src={product.image}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                              <div className="w-12 h-12 bg-white/90 dark:bg-gray-900/90 rounded-full flex items-center justify-center">
                                <TreeDeciduous className="h-6 w-6 text-primary" />
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className="bg-orange-500 text-white text-[10px] px-1.5 py-0">
                                <Flame className="h-2.5 w-2.5 mr-0.5" />
                                Popular
                              </Badge>
                            </div>
                            <h4 className="font-semibold text-sm truncate">{product.name}</h4>
                            <p className="text-xs text-muted-foreground line-clamp-1">{product.description}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="font-semibold text-sm">From ${product.basePrice.toFixed(2)}</span>
                              <Button size="sm" variant="outline" className="h-7 text-xs" data-testid={`button-quick-order-${product.id}`}>
                                Customize <ChevronRight className="h-3 w-3 ml-1" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {trees.length === 0 && (
                <Card className="mb-6 border-primary/50 bg-primary/5">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <TreeDeciduous className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">Create a Family Tree First</p>
                        <p className="text-sm text-muted-foreground">
                          You need at least one family tree to create custom merchandise.
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
                  {products.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onCustomize={setSelectedProduct}
                      memberCount={memberCount > 0 ? memberCount : undefined}
                    />
                  ))}
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
                      Unique personalized gifts for family members
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
              <h2 className="text-2xl font-bold mb-2">Print Your Family Tree</h2>
              <p className="text-muted-foreground">
                Turn your family tree into beautiful custom products. Perfect for gifts or keeping your heritage close.
              </p>
            </div>

            <Alert className="mb-6">
              <Star className="h-4 w-4" />
              <AlertTitle>Sign In to Order</AlertTitle>
              <AlertDescription>
                Sign in to customize products with your family tree and place orders.
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
                  <Package className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <h3 className="font-semibold">Quality Products</h3>
                  <p className="text-sm text-muted-foreground">
                    Premium merchandise printed with care
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Truck className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <h3 className="font-semibold">Fast Shipping</h3>
                  <p className="text-sm text-muted-foreground">
                    Ships directly to your door
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Star className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <h3 className="font-semibold">Your Family Story</h3>
                  <p className="text-sm text-muted-foreground">
                    Preserve your heritage beautifully
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customize Your Product</DialogTitle>
            <DialogDescription>
              Select your family tree and product options
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <ProductCustomizer
              product={selectedProduct}
              trees={trees}
              onClose={() => setSelectedProduct(null)}
              onOrderCreated={() => setActiveTab("orders")}
              userId={user?.id}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
