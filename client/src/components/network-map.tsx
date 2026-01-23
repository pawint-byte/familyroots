import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MapPin, User } from "lucide-react";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface LocationMember {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  currentCity: string | null;
  currentRegion: string | null;
  currentCountry: string | null;
  treeId: string;
}

interface GeocodedMember extends LocationMember {
  lat: number;
  lng: number;
}

interface NetworkMapProps {
  members: LocationMember[];
  onViewTree: (treeId: string) => void;
}

const locationCache: Record<string, { lat: number; lng: number } | null> = {};

async function geocodeLocation(city: string | null, region: string | null, country: string | null): Promise<{ lat: number; lng: number } | null> {
  const locationParts = [city, region, country].filter(Boolean);
  if (locationParts.length === 0) return null;
  
  const query = locationParts.join(", ");
  
  if (query in locationCache) {
    return locationCache[query];
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      {
        headers: {
          "User-Agent": "FamilyRoots/1.0",
        },
      }
    );
    
    if (!response.ok) {
      locationCache[query] = null;
      return null;
    }
    
    const data = await response.json();
    
    if (data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      locationCache[query] = result;
      return result;
    }
    
    locationCache[query] = null;
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    locationCache[query] = null;
    return null;
  }
}

function FitBounds({ members }: { members: GeocodedMember[] }) {
  const map = useMap();

  useEffect(() => {
    if (members.length > 0) {
      const bounds = L.latLngBounds(members.map((m) => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [members, map]);

  return null;
}

export function NetworkMap({ members, onViewTree }: NetworkMapProps) {
  const [geocodedMembers, setGeocodedMembers] = useState<GeocodedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    async function geocodeMembers() {
      setLoading(true);
      const results: GeocodedMember[] = [];

      for (const member of members) {
        const coords = await geocodeLocation(
          member.currentCity,
          member.currentRegion,
          member.currentCountry
        );
        
        if (coords) {
          results.push({ ...member, ...coords });
        }
        
        await new Promise((r) => setTimeout(r, 100));
      }

      setGeocodedMembers(results);
      setLoading(false);
    }

    if (members.length > 0) {
      geocodeMembers();
    } else {
      setGeocodedMembers([]);
      setLoading(false);
    }
  }, [members]);

  if (loading && members.length > 0) {
    return (
      <div className="h-[400px] rounded-lg border border-border bg-muted/50 flex items-center justify-center">
        <div className="text-center">
          <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2 animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading map locations...</p>
        </div>
      </div>
    );
  }

  if (geocodedMembers.length === 0 && !loading) {
    return (
      <div className="h-[400px] rounded-lg border border-border bg-muted/50 flex items-center justify-center">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Locations to Display</h3>
          <p className="text-sm text-muted-foreground">
            {members.length > 0
              ? "Could not find coordinates for the searched locations."
              : "Search for family members by location to see them on the map."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[400px] rounded-lg overflow-hidden border border-border" data-testid="network-map-container">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        style={{ height: "100%", width: "100%" }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds members={geocodedMembers} />
        {geocodedMembers.map((member) => (
          <Marker key={member.id} position={[member.lat, member.lng]}>
            <Popup>
              <div className="p-1 min-w-[180px]" data-testid={`map-popup-${member.id}`}>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.photoUrl || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {member.firstName[0]}{member.lastName?.[0] || ""}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{member.firstName} {member.lastName}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {[member.currentCity, member.currentRegion, member.currentCountry]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => onViewTree(member.treeId)}
                  data-testid={`map-button-view-tree-${member.id}`}
                >
                  <User className="h-3 w-3 mr-1" />
                  View Family Tree
                </Button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
