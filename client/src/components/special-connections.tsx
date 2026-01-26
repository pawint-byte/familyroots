import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Link, Heart, UserPlus, Trash2, MapPin, Users } from "lucide-react";
import type { FamilyMember } from "@shared/schema";

interface SpecialConnectionsProps {
  memberId: string;
  treeId: string;
  canEdit: boolean;
  allMembers: FamilyMember[];
}

interface EnrichedConnection {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  connectionType: string;
  customLabel?: string;
  notes?: string;
  fromMember?: { id: string; firstName: string; lastName: string | null; photoUrl: string | null };
  toMember?: { id: string; firstName: string; lastName: string | null; photoUrl: string | null };
}

const connectionTypeLabels: Record<string, string> = {
  godparent: "Godparent",
  godchild: "Godchild",
  boyfriend: "Boyfriend",
  girlfriend: "Girlfriend",
  fiance: "Fiance",
  fiancee: "Fiancee",
  ex_boyfriend: "Ex-Boyfriend",
  ex_girlfriend: "Ex-Girlfriend",
  ex_spouse: "Ex-Spouse",
  best_friend: "Best Friend",
  family_friend: "Family Friend",
  mentor: "Mentor",
  mentee: "Mentee",
  guardian: "Guardian",
  ward: "Ward",
  other: "Other",
};

export function SpecialConnectionsSection({ memberId, treeId, canEdit, allMembers }: SpecialConnectionsProps) {
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedConnectionType, setSelectedConnectionType] = useState("");
  const [selectedTargetMember, setSelectedTargetMember] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [notes, setNotes] = useState("");

  const { data: connections = [], isLoading } = useQuery<EnrichedConnection[]>({
    queryKey: ["/api/members", memberId, "connections"],
  });

  const createConnectionMutation = useMutation({
    mutationFn: async (data: { 
      fromMemberId: string; 
      fromTreeId: string; 
      toMemberId: string; 
      toTreeId: string; 
      connectionType: string; 
      customLabel?: string;
      notes?: string;
    }) => {
      return apiRequest("POST", "/api/connections", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", memberId, "connections"] });
      toast({ title: "Connection added" });
      setIsAddOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to add connection", description: error.message, variant: "destructive" });
    },
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return apiRequest("DELETE", `/api/connections/${connectionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members", memberId, "connections"] });
      toast({ title: "Connection removed" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove connection", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setSelectedConnectionType("");
    setSelectedTargetMember("");
    setCustomLabel("");
    setNotes("");
  };

  const handleAddConnection = () => {
    if (!selectedConnectionType || !selectedTargetMember) {
      toast({ title: "Please select a connection type and person", variant: "destructive" });
      return;
    }

    const targetMember = allMembers.find(m => m.id === selectedTargetMember);
    if (!targetMember) return;

    createConnectionMutation.mutate({
      fromMemberId: memberId,
      fromTreeId: treeId,
      toMemberId: selectedTargetMember,
      toTreeId: targetMember.treeId,
      connectionType: selectedConnectionType,
      customLabel: customLabel || undefined,
      notes: notes || undefined,
    });
  };

  const getConnectedMember = (conn: EnrichedConnection) => {
    if (conn.fromMemberId === memberId) {
      return conn.toMember;
    }
    return conn.fromMember;
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Special Connections</h4>
        <div className="animate-pulse space-y-2">
          <div className="h-12 bg-muted rounded" />
          <div className="h-12 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Link className="h-4 w-4" />
          Special Connections
        </h4>
        {canEdit && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1" data-testid="button-add-connection">
                <UserPlus className="h-3 w-3" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Special Connection</DialogTitle>
                <DialogDescription>
                  Connect this person with others who are important to them - like godparents, best friends, mentors, or significant others.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Connection Type</Label>
                  <Select value={selectedConnectionType} onValueChange={setSelectedConnectionType}>
                    <SelectTrigger data-testid="select-connection-type">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(connectionTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Connect to Person</Label>
                  <Select value={selectedTargetMember} onValueChange={setSelectedTargetMember}>
                    <SelectTrigger data-testid="select-target-member">
                      <SelectValue placeholder="Select person..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allMembers
                        .filter(m => m.id !== memberId)
                        .map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.firstName} {m.lastName || ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedConnectionType === "other" && (
                  <div className="space-y-2">
                    <Label>Custom Label</Label>
                    <Input 
                      value={customLabel} 
                      onChange={(e) => setCustomLabel(e.target.value)}
                      placeholder="e.g., Childhood neighbor"
                      data-testid="input-custom-label"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional details..."
                    data-testid="input-connection-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button 
                  onClick={handleAddConnection} 
                  disabled={createConnectionMutation.isPending}
                  data-testid="button-save-connection"
                >
                  {createConnectionMutation.isPending ? "Adding..." : "Add Connection"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {connections.length === 0 ? (
        <p className="text-sm text-muted-foreground">No special connections yet</p>
      ) : (
        <div className="space-y-2">
          {connections.map((conn) => {
            const connectedMember = getConnectedMember(conn);
            const label = conn.customLabel || connectionTypeLabels[conn.connectionType] || conn.connectionType;
            
            return (
              <Card key={conn.id} className="hover-elevate" data-testid={`connection-card-${conn.id}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={connectedMember?.photoUrl || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {connectedMember?.firstName?.[0] || "?"}{connectedMember?.lastName?.[0] || ""}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {connectedMember?.firstName} {connectedMember?.lastName || ""}
                    </p>
                    <Badge variant="secondary" className="text-xs">{label}</Badge>
                  </div>
                  {canEdit && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => deleteConnectionMutation.mutate(conn.id)}
                      disabled={deleteConnectionMutation.isPending}
                      data-testid={`button-delete-connection-${conn.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface LocationSectionProps {
  member: FamilyMember;
  canEdit: boolean;
  onUpdate: (data: Partial<FamilyMember>) => void;
}

export function LocationSection({ member, canEdit, onUpdate }: LocationSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [city, setCity] = useState(member.currentCity || "");
  const [region, setRegion] = useState(member.currentRegion || "");
  const [country, setCountry] = useState(member.currentCountry || "");
  const [visible, setVisible] = useState(member.locationVisible || false);

  const hasLocation = member.currentCity || member.currentRegion || member.currentCountry;

  const handleSave = () => {
    onUpdate({
      currentCity: city || null,
      currentRegion: region || null,
      currentCountry: country || null,
      locationVisible: visible,
    });
    setIsEditing(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Current Location
        </h4>
        {canEdit && !isEditing && (
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-location">
            Edit
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>City</Label>
            <Input 
              value={city} 
              onChange={(e) => setCity(e.target.value)} 
              placeholder="City name"
              data-testid="input-location-city"
            />
          </div>
          <div className="space-y-2">
            <Label>State/Province</Label>
            <Input 
              value={region} 
              onChange={(e) => setRegion(e.target.value)} 
              placeholder="State or province"
              data-testid="input-location-region"
            />
          </div>
          <div className="space-y-2">
            <Label>Country</Label>
            <Input 
              value={country} 
              onChange={(e) => setCountry(e.target.value)} 
              placeholder="Country"
              data-testid="input-location-country"
            />
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="location-visible"
              checked={visible}
              onChange={(e) => setVisible(e.target.checked)}
              className="h-4 w-4"
              data-testid="checkbox-location-visible"
            />
            <Label htmlFor="location-visible" className="text-sm">
              Share location with connections (allows family to find you when traveling)
            </Label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} data-testid="button-save-location">Save</Button>
          </div>
        </div>
      ) : hasLocation ? (
        <div className="text-sm">
          <p>
            {[member.currentCity, member.currentRegion, member.currentCountry]
              .filter(Boolean)
              .join(", ")}
          </p>
          {member.locationVisible && (
            <Badge variant="outline" className="mt-1 text-xs">
              <Users className="h-3 w-3 mr-1" />
              Visible to connections
            </Badge>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No location set</p>
      )}
    </div>
  );
}
