import { useState } from "react";
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
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { SEO } from "@/components/seo";
import { Gift, Plus, Calendar, ArrowLeft, ExternalLink, Trash2, Check, ShoppingCart, DollarSign, Package } from "lucide-react";
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

  const { data: registry, isLoading } = useQuery<EnrichedRegistry>({
    queryKey: ["/api/registries", registryId],
    enabled: !!registryId,
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/registries/${registryId}/items`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/registries", registryId] });
      setIsAddItemDialogOpen(false);
      resetItemForm();
      toast({ title: "Item added", description: "The item has been added to the registry." });
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
  };

  const handleAddItem = () => {
    if (!itemName.trim()) {
      toast({ title: "Missing name", description: "Please enter an item name.", variant: "destructive" });
      return;
    }
    addItemMutation.mutate({
      name: itemName,
      description: itemDescription || null,
      productUrl: itemUrl || null,
      price: itemPrice ? parseFloat(itemPrice) : null,
      quantity: parseInt(itemQuantity) || 1,
      priority: parseInt(itemPriority) || 0,
    });
  };

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
            <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-item">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Registry Item</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="itemName">Item Name *</Label>
                    <Input
                      id="itemName"
                      placeholder="e.g., Building Blocks Set"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      data-testid="input-item-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="itemUrl">Product Link (Amazon, Etsy, etc.)</Label>
                    <Input
                      id="itemUrl"
                      type="url"
                      placeholder="https://www.amazon.com/..."
                      value={itemUrl}
                      onChange={(e) => setItemUrl(e.target.value)}
                      data-testid="input-item-url"
                    />
                    <p className="text-xs text-muted-foreground">Amazon links will automatically include affiliate tracking.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="itemPrice">Price ($)</Label>
                      <Input
                        id="itemPrice"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="29.99"
                        value={itemPrice}
                        onChange={(e) => setItemPrice(e.target.value)}
                        data-testid="input-item-price"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="itemQuantity">Quantity Needed</Label>
                      <Input
                        id="itemQuantity"
                        type="number"
                        min="1"
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(e.target.value)}
                        data-testid="input-item-quantity"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="itemDescription">Notes</Label>
                    <Textarea
                      id="itemDescription"
                      placeholder="Any preferences like size, color, etc."
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      data-testid="input-item-description"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddItemDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddItem} disabled={addItemMutation.isPending} data-testid="button-submit-item">
                    {addItemMutation.isPending ? "Adding..." : "Add Item"}
                  </Button>
                </DialogFooter>
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
                  ? "Add gift ideas to this registry. You can paste links from Amazon, Etsy, or any online store."
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
            <CardTitle className="text-lg">About Affiliate Links</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              When you click "View" to purchase an item from Amazon, the link includes our affiliate tracking. 
              This helps support FamilyRoots at no extra cost to you. Thank you for your support!
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
