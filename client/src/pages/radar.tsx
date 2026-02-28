import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Radio, Eye, Wifi, WifiOff, MapPin, Users, Loader2, LocateFixed } from "lucide-react";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const userIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const memberIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface NearbyUser {
  userId: string;
  name: string;
  profileImage: string | null;
  distance: number;
  mode: string;
  latitude: number;
  longitude: number;
}

function MapCenterUpdater({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom());
    }
  }, [position, map]);
  return null;
}

export default function Radar() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<"broadcast" | "watch">("broadcast");
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [radius, setRadius] = useState(5);
  const watchIdRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const { data: statusData } = useQuery<{ active: boolean; session: any }>({
    queryKey: ["/api/radar/status"],
    enabled: !!user,
  });

  const { data: nearbyData, refetch: refetchNearby } = useQuery<{ nearby: NearbyUser[]; radius: number }>({
    queryKey: ["/api/radar/nearby", radius],
    enabled: isActive && !!user,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (statusData?.active && statusData.session) {
      setIsActive(true);
      setMode(statusData.session.mode);
      if (!userPosition) {
        setUserPosition([statusData.session.latitude, statusData.session.longitude]);
      }
      if (!pingIntervalRef.current) {
        pingIntervalRef.current = setInterval(async () => {
          try {
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                await apiRequest("PATCH", "/api/radar/position", {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                });
              },
              () => {}
            );
          } catch {}
        }, 30000);
      }
    }
  }, [statusData]);

  const startGeolocationWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser");
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPosition(newPos);
        setGeoError(null);
      },
      (err) => {
        if (err.code === 1) setGeoError("Location access denied. Please enable location in your browser settings.");
        else if (err.code === 2) setGeoError("Location unavailable. Please try again.");
        else setGeoError("Location request timed out. Please try again.");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    watchIdRef.current = id;
  }, []);

  const stopGeolocationWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const activateRadar = useCallback(async () => {
    if (!userPosition) {
      toast({ title: "Waiting for location", description: "Please wait for your GPS position to be determined.", variant: "destructive" });
      return;
    }
    setActivating(true);
    try {
      await apiRequest("POST", "/api/radar/activate", {
        latitude: userPosition[0],
        longitude: userPosition[1],
        mode,
      });
      setIsActive(true);
      toast({ title: "Radar activated", description: mode === "broadcast" ? "You're now visible to nearby members." : "Watch mode — you can see others but remain invisible." });

      pingIntervalRef.current = setInterval(async () => {
        if (!userPosition) return;
        try {
          await apiRequest("PATCH", "/api/radar/position", {
            latitude: userPosition[0],
            longitude: userPosition[1],
          });
        } catch {}
      }, 30000);
    } catch (error) {
      toast({ title: "Failed to activate radar", variant: "destructive" });
    } finally {
      setActivating(false);
    }
  }, [userPosition, mode, toast]);

  const deactivateRadar = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/radar/deactivate");
      setIsActive(false);
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/radar/status"] });
      toast({ title: "Radar deactivated", description: "Your location is no longer being shared." });
    } catch {
      toast({ title: "Failed to deactivate radar", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    startGeolocationWatch();
    return () => {
      stopGeolocationWatch();
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [startGeolocationWatch, stopGeolocationWatch]);

  useEffect(() => {
    return () => {
      if (isActive) {
        apiRequest("POST", "/api/radar/deactivate").catch(() => {});
      }
    };
  }, [isActive]);

  useEffect(() => {
    if (isActive && userPosition) {
      apiRequest("PATCH", "/api/radar/position", {
        latitude: userPosition[0],
        longitude: userPosition[1],
      }).catch(() => {});
    }
  }, [userPosition, isActive]);

  const nearby = nearbyData?.nearby || [];

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="radar-login-required">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Radio className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Sign in Required</h2>
            <p className="text-muted-foreground mb-4">Member Radar is available only to signed-in FamilyRoots members.</p>
            <Button onClick={() => navigate("/")} data-testid="radar-sign-in-button">Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="radar-back-button">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" data-testid="radar-title">Member Radar</h1>
            <p className="text-sm text-muted-foreground">Discover nearby FamilyRoots members</p>
          </div>
          {isActive && (
            <Badge variant={mode === "broadcast" ? "default" : "secondary"} className="gap-1" data-testid="radar-status-badge">
              {mode === "broadcast" ? <Wifi className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {mode === "broadcast" ? "Broadcasting" : "Watch Mode"}
            </Badge>
          )}
        </div>

        <Card className="mb-4" data-testid="radar-controls-card">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className={`p-3 rounded-full ${isActive ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"}`}>
                  {isActive ? <Wifi className="h-5 w-5 text-green-600 dark:text-green-400" /> : <WifiOff className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div>
                  <p className="font-medium" data-testid="radar-status-text">{isActive ? "Radar is ON" : "Radar is OFF"}</p>
                  <p className="text-sm text-muted-foreground">
                    {isActive
                      ? mode === "broadcast"
                        ? "You're visible to nearby members"
                        : "You can see others but you're hidden"
                      : "Turn on to find nearby members"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {!isActive && (
                  <div className="flex items-center gap-2 mr-2">
                    <button
                      onClick={() => setMode("broadcast")}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === "broadcast" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                      data-testid="radar-mode-broadcast"
                    >
                      <Radio className="h-3.5 w-3.5 inline mr-1" />
                      Broadcast
                    </button>
                    <button
                      onClick={() => setMode("watch")}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === "watch" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                      data-testid="radar-mode-watch"
                    >
                      <Eye className="h-3.5 w-3.5 inline mr-1" />
                      Watch
                    </button>
                  </div>
                )}

                <Button
                  onClick={isActive ? deactivateRadar : activateRadar}
                  variant={isActive ? "destructive" : "default"}
                  disabled={activating || (!isActive && !userPosition)}
                  data-testid="radar-toggle-button"
                >
                  {activating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  {isActive ? "Turn Off" : "Turn On"}
                </Button>
              </div>
            </div>

            {!isActive && (
              <div className="mt-4 flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Scan radius:</label>
                <select
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="bg-background border rounded-md px-2 py-1 text-sm"
                  data-testid="radar-radius-select"
                >
                  <option value={1}>1 mile</option>
                  <option value={2}>2 miles</option>
                  <option value={5}>5 miles</option>
                  <option value={10}>10 miles</option>
                  <option value={25}>25 miles</option>
                  <option value={50}>50 miles</option>
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        {geoError && (
          <Card className="mb-4 border-destructive" data-testid="radar-geo-error">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <LocateFixed className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Location Access Required</p>
                  <p className="text-sm text-muted-foreground mt-1">{geoError}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-4 overflow-hidden" data-testid="radar-map-card">
          <div className="relative" style={{ height: 400 }}>
            {userPosition ? (
              <MapContainer
                center={userPosition}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
                whenReady={() => setMapReady(true)}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapCenterUpdater position={mapReady ? null : userPosition} />

                <Marker position={userPosition} icon={userIcon}>
                  <Popup>
                    <div className="text-center">
                      <p className="font-medium">You are here</p>
                      <p className="text-xs text-gray-500">{mode === "broadcast" ? "Broadcasting" : "Watch Mode"}</p>
                    </div>
                  </Popup>
                </Marker>

                {isActive && (
                  <Circle
                    center={userPosition}
                    radius={radius * 1609.34}
                    pathOptions={{
                      color: "#3b82f6",
                      fillColor: "#3b82f6",
                      fillOpacity: 0.05,
                      weight: 1,
                      dashArray: "5 5",
                    }}
                  />
                )}

                {isActive && (
                  <Circle
                    center={userPosition}
                    radius={200}
                    pathOptions={{
                      color: "#22c55e",
                      fillColor: "#22c55e",
                      fillOpacity: 0.15,
                      weight: 2,
                    }}
                  />
                )}

                {nearby.map((member) => (
                  <Marker
                    key={member.userId}
                    position={[member.latitude, member.longitude]}
                    icon={memberIcon}
                  >
                    <Popup>
                      <div className="text-center">
                        <p className="font-medium">{member.name}</p>
                        <p className="text-xs text-gray-500">{member.distance} mi away</p>
                        <a
                          href={`/profile/${member.userId}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View Profile
                        </a>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div className="h-full flex items-center justify-center bg-muted/30">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">Getting your location...</p>
                </div>
              </div>
            )}

            {isActive && (
              <div className="absolute top-3 right-3 z-[1000]">
                <div className="bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border flex items-center gap-2">
                  <div className="relative">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-500 animate-ping" />
                  </div>
                  <span className="text-sm font-medium" data-testid="radar-member-count">
                    {nearby.length} {nearby.length === 1 ? "member" : "members"} nearby
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>

        {isActive && (
          <Card data-testid="radar-nearby-list">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Nearby Members
                {nearby.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{nearby.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nearby.length === 0 ? (
                <div className="text-center py-8" data-testid="radar-no-members">
                  <Radio className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground font-medium">No members detected nearby</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Other FamilyRoots members need to be broadcasting within {radius} miles to appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {nearby.map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/profile/${member.userId}`)}
                      data-testid={`radar-member-${member.userId}`}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.profileImage || undefined} />
                        <AvatarFallback>{member.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{member.name}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {member.distance} {member.distance === 1 ? "mile" : "miles"} away
                        </p>
                      </div>
                      <Button variant="outline" size="sm" data-testid={`radar-view-profile-${member.userId}`}>
                        View Profile
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!isActive && (
          <Card className="mt-4" data-testid="radar-info-card">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">How Member Radar Works</h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <Radio className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <p><span className="font-medium text-foreground">Broadcast Mode:</span> Other FamilyRoots members nearby can see you, and you can see them. Great for family reunions and events.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Eye className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <p><span className="font-medium text-foreground">Watch Mode:</span> You can see who's nearby, but you stay invisible to others. Perfect for browsing privately.</p>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <p><span className="font-medium text-foreground">Privacy First:</span> Your location is only shared while Radar is turned on. It automatically expires after 5 minutes of inactivity. Turn it off anytime.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <p><span className="font-medium text-foreground">Members Only:</span> Only signed-in FamilyRoots members can use Radar. It's like a private channel — only those on the network can see each other.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
