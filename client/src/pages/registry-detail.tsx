import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { SEO } from "@/components/seo";
import { Gift, Plus, Calendar, ArrowLeft, ExternalLink, Trash2, Check, ShoppingCart, DollarSign, Package, Search, Loader2, Link, Store, Image as ImageIcon, CheckCircle2 } from "lucide-react";
import { SiAmazon, SiEtsy } from "react-icons/si";
import type { GiftRegistry, GiftRegistryItem } from "@shared/schema";

interface EnrichedItem extends GiftRegistryItem {
  affiliateUrl: string | null;
}

interface EnrichedRegistry extends GiftRegistry {
  memberName: string;
  memberPhoto: string | null;
  items: EnrichedItem[];
  isOwner: boolean;
}

const eventTypeLabels: Record<string, string> = {
  birthday: "Birthday",
  baby_shower: "Baby Shower",
  wedding: "Wedding",
  anniversary: "Anniversary",
  graduation: "Graduation",
  holiday: "Holiday",
  housewarming: "Housewarming",
  retirement: "Retirement",
  other: "Other",
};

export default function RegistryDetailPage() {
  const { registryId } = useParams<{ registryId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [itemPriority, setItemPriority] = useState("0");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [showItemFields, setShowItemFields] = useState(false);
  const [sessionAddedCount, setSessionAddedCount] = useState(0);
  const [addItemTab, setAddItemTab] = useState<string>("search");

  const { data: registry, isLoading } = useQuery<EnrichedRegistry>({
    queryKey: ["/api/registries", registryId],
    enabled: !!registryId,
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/registries/${registryId}/items`, data);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add item", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest("DELETE", `/api/registry-items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/registries", registryId] });
      toast({ title: "Item removed", description: "The item has been removed from the registry." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove item", variant: "destructive" });
    },
  });

  const purchaseItemMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      return apiRequest("POST", `/api/registry-items/${itemId}/purchase`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/registries", registryId] });
      toast({ title: "Item marked as purchased", description: "Thank you for getting this gift!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to mark item", variant: "destructive" });
    },
  });

  const resetItemForm = () => {
    setItemName("");
    setItemDescription("");
    setItemUrl("");
    setItemPrice("");
    setItemQuantity("1");
    setItemPriority("0");
    setItemImageUrl("");
    setShowItemFields(false);
  };

  const handleAddItem = (keepOpen: boolean = false) => {
    if (!itemName.trim()) {
      toast({ title: "Missing name", description: "Please enter an item name.", variant: "destructive" });
      return;
    }
    addItemMutation.mutate({
      name: itemName,
      description: itemDescription || null,
      productUrl: itemUrl || null,
      imageUrl: itemImageUrl || null,
      price: itemPrice ? parseFloat(itemPrice) : null,
      quantity: parseInt(itemQuantity) || 1,
      priority: parseInt(itemPriority) || 0,
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/registries", registryId] });
        setSessionAddedCount(prev => prev + 1);
        if (keepOpen) {
          resetItemForm();
          setAddItemTab("search");
          toast({ title: "Item added!", description: "You can add another item or close when done." });
        } else {
          resetItemForm();
          setIsAddItemDialogOpen(false);
          toast({ title: "Item added", description: "The item has been added to your wish list." });
        }
      },
    });
  };

  const fetchProductMetadata = useCallback(async (url: string) => {
    if (!url) return;
    try {
      new URL(url);
    } catch {
      setShowItemFields(true);
      return;
    }
    setIsFetchingMeta(true);
    try {
      const res = await fetch(`/api/product-metadata?url=${encodeURIComponent(url)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.title && !itemName) setItemName(data.title);
        if (data.image && !itemImageUrl) setItemImageUrl(data.image);
        if (data.price && !itemPrice) setItemPrice(String(data.price));
        if (data.description && !itemDescription) {
          const desc = data.description.length > 200 ? data.description.substring(0, 200) + '...' : data.description;
          setItemDescription(desc);
        }
        toast({ title: "Product details loaded", description: data.title ? `Found: ${data.title.substring(0, 60)}` : "Some details were fetched." });
      }
    } catch {
      // Silent fail - user can still fill manually
    } finally {
      setIsFetchingMeta(false);
      setShowItemFields(true);
    }
  }, [itemName, itemImageUrl, itemPrice, itemDescription, toast]);

  const AFFILIATE_STORES = [
    { name: "Amazon", icon: SiAmazon, color: "text-[#FF9900]", searchUrl: "https://www.amazon.com/s?k=" },
    { name: "Etsy", icon: SiEtsy, color: "text-[#F1641E]", searchUrl: "https://www.etsy.com/search?q=" },
    { name: "Target", icon: Store, color: "text-[#CC0000]", searchUrl: "https://www.target.com/s?searchTerm=" },
    { name: "Walmart", icon: Store, color: "text-[#0071DC]", searchUrl: "https://www.walmart.com/search?q=" },
    { name: "Best Buy", icon: Store, color: "text-[#0046BE]", searchUrl: "https://www.bestbuy.com/site/searchpage.jsp?st=" },
  ];
  const [storeSearch, setStoreSearch] = useState("");

  const formatPrice = (cents: number | null) => {
    if (!cents) return null;
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-40 w-full mb-4" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!registry) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl text-center">
        <h1 className="text-2xl font-bold mb-4">Registry Not Found</h1>
        <p className="text-muted-foreground mb-4">This registry doesn't exist or you don't have access to view it.</p>
        <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
      </div>
    );
  }

  const items = registry.items || [];
  const purchasedCount = items.filter(i => i.status === "purchased").length;
  const progress = items.length > 0 ? Math.round((purchasedCount / items.length) * 100) : 0;

  return (
    <>
      <SEO 
        title={registry.title}
        description={registry.description || `Gift registry for ${registry.memberName}`}
      />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/tree/${registry.treeId}/registries`)} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Gift className="h-6 w-6" />
              {registry.title}
            </h1>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={registry.memberPhoto || undefined} />
                <AvatarFallback className="text-lg">{registry.memberName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary">{eventTypeLabels[registry.eventType] || registry.eventType}</Badge>
                  {!registry.isActive && <Badge variant="outline">Closed</Badge>}
                </div>
                <p className="text-lg font-medium">For {registry.memberName}</p>
                {registry.eventDate && (
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(registry.eventDate)}
                  </p>
                )}
                {registry.description && (
                  <p className="text-sm text-muted-foreground mt-2">{registry.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm text-muted-foreground mb-1">
                  <span>{purchasedCount} of {items.length} items purchased</span>
                  <span>{progress}% complete</span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Registry Items</h2>
          {registry.isOwner && registry.isActive && (
            <Dialog open={isAddItemDialogOpen} onOpenChange={(open) => {
              setIsAddItemDialogOpen(open);
              if (!open) {
                resetItemForm();
                setSessionAddedCount(0);
                setStoreSearch("");
                setAddItemTab("search");
              }
            }}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-item">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between">
                    <span>Add to Wish List</span>
                    {sessionAddedCount > 0 && (
                      <Badge variant="secondary" className="ml-2" data-testid="badge-added-count">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {sessionAddedCount} added
                      </Badge>
                    )}
                  </DialogTitle>
                </DialogHeader>

                <Tabs value={addItemTab} onValueChange={setAddItemTab} className="mt-2">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="search" data-testid="tab-search-stores">
                      <Search className="h-4 w-4 mr-1" />
                      Find from Store
                    </TabsTrigger>
                    <TabsTrigger value="manual" data-testid="tab-manual-entry">
                      <Plus className="h-4 w-4 mr-1" />
                      Enter Manually
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="search" className="space-y-4 mt-4">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">What are you looking for?</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="e.g., wireless headphones, building blocks..."
                            value={storeSearch}
                            onChange={(e) => setStoreSearch(e.target.value)}
                            data-testid="input-store-search"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Search on a store, find the item, and copy its link back here</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {AFFILIATE_STORES.map((store) => (
                            <Button
                              key={store.name}
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2"
                              onClick={() => {
                                const query = storeSearch ? encodeURIComponent(storeSearch) : '';
                                window.open(store.searchUrl + query, '_blank');
                              }}
                              data-testid={`button-store-${store.name.toLowerCase().replace(/\s/g, '-')}`}
                            >
                              <store.icon className={`h-4 w-4 ${store.color}`} />
                              <span className="text-xs">{store.name}</span>
                              <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-3">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Link className="h-4 w-4" />
                        Paste the product link here
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://www.amazon.com/dp/..."
                          value={itemUrl}
                          onChange={(e) => setItemUrl(e.target.value)}
                          onPaste={(e) => {
                            const pasted = e.clipboardData.getData('text');
                            if (pasted) {
                              setItemUrl(pasted);
                              setTimeout(() => fetchProductMetadata(pasted), 100);
                            }
                          }}
                          data-testid="input-item-url"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => fetchProductMetadata(itemUrl)}
                          disabled={!itemUrl || isFetchingMeta}
                          data-testid="button-fetch-metadata"
                        >
                          {isFetchingMeta ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                      </div>
                      {isFetchingMeta && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading product details...
                        </p>
                      )}
                    </div>

                    {showItemFields && (
                      <div className="border rounded-lg p-3 bg-muted/30 space-y-3">
                        <div className="flex items-start gap-3">
                          {itemImageUrl && (
                            <img
                              src={itemImageUrl}
                              alt=""
                              className="w-16 h-16 object-cover rounded border"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-2">{itemName || "No title found"}</p>
                            {itemPrice && <p className="text-sm text-green-600 dark:text-green-400 font-medium">${itemPrice}</p>}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Item Name</Label>
                            <Input
                              value={itemName}
                              onChange={(e) => setItemName(e.target.value)}
                              className="h-8 text-sm"
                              data-testid="input-item-name"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Price ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={itemPrice}
                              onChange={(e) => setItemPrice(e.target.value)}
                              className="h-8 text-sm"
                              data-testid="input-item-price"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Quantity</Label>
                            <Input
                              type="number"
                              min="1"
                              value={itemQuantity}
                              onChange={(e) => setItemQuantity(e.target.value)}
                              className="h-8 text-sm"
                              data-testid="input-item-quantity"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Priority (0-5)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="5"
                              value={itemPriority}
                              onChange={(e) => setItemPriority(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Notes (size, color, etc.)</Label>
                          <Input
                            value={itemDescription}
                            onChange={(e) => setItemDescription(e.target.value)}
                            placeholder="Any preferences..."
                            className="h-8 text-sm"
                            data-testid="input-item-description"
                          />
                        </div>
                      </div>
                    )}

                    {showItemFields && (
                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          onClick={() => handleAddItem(true)}
                          disabled={addItemMutation.isPending || !itemName}
                          data-testid="button-add-and-continue"
                        >
                          {addItemMutation.isPending ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</>
                          ) : (
                            <><Plus className="h-4 w-4 mr-2" />Add & Find Another</>
                          )}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => handleAddItem(false)}
                          disabled={addItemMutation.isPending || !itemName}
                          data-testid="button-add-and-done"
                        >
                          Add & Done
                        </Button>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="manual" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="itemNameManual">Item Name *</Label>
                      <Input
                        id="itemNameManual"
                        placeholder="e.g., Building Blocks Set"
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        data-testid="input-item-name-manual"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="itemUrlManual">Product Link (optional)</Label>
                      <Input
                        id="itemUrlManual"
                        type="url"
                        placeholder="https://www.amazon.com/..."
                        value={itemUrl}
                        onChange={(e) => setItemUrl(e.target.value)}
                        data-testid="input-item-url-manual"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="itemPriceManual">Price ($)</Label>
                        <Input
                          id="itemPriceManual"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="29.99"
                          value={itemPrice}
                          onChange={(e) => setItemPrice(e.target.value)}
                          data-testid="input-item-price-manual"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="itemQuantityManual">Quantity Needed</Label>
                        <Input
                          id="itemQuantityManual"
                          type="number"
                          min="1"
                          value={itemQuantity}
                          onChange={(e) => setItemQuantity(e.target.value)}
                          data-testid="input-item-quantity-manual"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="itemDescManual">Notes</Label>
                      <Textarea
                        id="itemDescManual"
                        placeholder="Any preferences like size, color, etc."
                        value={itemDescription}
                        onChange={(e) => setItemDescription(e.target.value)}
                        data-testid="input-item-description-manual"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={() => handleAddItem(true)}
                        disabled={addItemMutation.isPending || !itemName}
                        data-testid="button-add-continue-manual"
                      >
                        {addItemMutation.isPending ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</>
                        ) : (
                          <><Plus className="h-4 w-4 mr-2" />Add & Continue</>
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleAddItem(false)}
                        disabled={addItemMutation.isPending || !itemName}
                        data-testid="button-add-done-manual"
                      >
                        Add & Done
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Items Yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                {registry.isOwner 
                  ? "Search for items on Amazon, Target, Walmart, and more - then paste the link to auto-fill your wish list."
                  : "The registry owner hasn't added any items yet."}
              </p>
              {registry.isOwner && registry.isActive && (
                <Button onClick={() => setIsAddItemDialogOpen(true)} data-testid="button-add-first-item">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Item
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {items.map((item) => {
              const remaining = item.quantity - (item.quantityPurchased || 0);
              const isPurchased = item.status === "purchased";
              
              return (
                <Card key={item.id} className={isPurchased ? "opacity-60" : ""} data-testid={`card-item-${item.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-16 h-16 object-cover rounded border flex-shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-medium ${isPurchased ? "line-through" : ""}`}>{item.name}</h3>
                          {isPurchased && <Badge variant="secondary"><Check className="h-3 w-3 mr-1" />Purchased</Badge>}
                          {!isPurchased && item.quantityPurchased > 0 && (
                            <Badge variant="outline">{item.quantityPurchased} of {item.quantity} purchased</Badge>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm">
                          {item.price && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <DollarSign className="h-4 w-4" />
                              {formatPrice(item.price)}
                            </span>
                          )}
                          {item.quantity > 1 && (
                            <span className="text-muted-foreground">
                              Qty: {remaining} remaining
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.affiliateUrl && !isPurchased && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            data-testid={`button-view-item-${item.id}`}
                          >
                            <a href={item.affiliateUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View
                            </a>
                          </Button>
                        )}
                        {!isPurchased && registry.isActive && (
                          <Button
                            size="sm"
                            onClick={() => purchaseItemMutation.mutate({ itemId: item.id, quantity: 1 })}
                            disabled={purchaseItemMutation.isPending}
                            data-testid={`button-purchase-item-${item.id}`}
                          >
                            <ShoppingCart className="h-4 w-4 mr-1" />
                            I'm getting this
                          </Button>
                        )}
                        {registry.isOwner && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Remove this item from the registry?")) {
                                deleteItemMutation.mutate(item.id);
                              }
                            }}
                            data-testid={`button-delete-item-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Adding items:</strong> Click "Add Item", type what you're looking for, then click a store to search. 
              Once you find the item, copy its link, paste it back here, and the name, image, and price will fill in automatically.
            </p>
            <p>
              <strong>Affiliate links:</strong> When someone clicks "View" to purchase an item, the link may include affiliate tracking. 
              This helps support FamilyRoots at no extra cost. Thank you!
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
