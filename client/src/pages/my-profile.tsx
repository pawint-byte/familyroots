import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Download, RefreshCw, User, MapPin, Calendar, FileText, Trees } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface UserProfile {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  nickname: string | null;
  gender: "male" | "female" | "other" | null;
  birthDate: string | null;
  birthPlace: string | null;
  bio: string | null;
  currentCity: string | null;
  currentRegion: string | null;
  currentCountry: string | null;
  locationVisible: boolean | null;
}

interface ClaimedProfile {
  id: string;
  firstName: string;
  lastName: string | null;
  nickname: string | null;
  gender: "male" | "female" | "other" | null;
  birthDate: string | null;
  birthPlace: string | null;
  notes: string | null;
  currentCity: string | null;
  currentRegion: string | null;
  currentCountry: string | null;
  treeName: string;
  treeId: string;
}

export default function MyProfile() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState<string>("");
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [bio, setBio] = useState("");
  const [currentCity, setCurrentCity] = useState("");
  const [currentRegion, setCurrentRegion] = useState("");
  const [currentCountry, setCurrentCountry] = useState("");
  const [locationVisible, setLocationVisible] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/user/profile"],
    enabled: !!user,
  });

  const { data: claimedProfiles, isLoading: claimedLoading } = useQuery<ClaimedProfile[]>({
    queryKey: ["/api/user/claimed-profiles"],
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname || "");
      setGender(profile.gender || "");
      setBirthDate(profile.birthDate || "");
      setBirthPlace(profile.birthPlace || "");
      setBio(profile.bio || "");
      setCurrentCity(profile.currentCity || "");
      setCurrentRegion(profile.currentRegion || "");
      setCurrentCountry(profile.currentCountry || "");
      setLocationVisible(profile.locationVisible || false);
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<UserProfile>) => {
      return apiRequest("PUT", "/api/user/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved. Changes will sync to all trees where you're claimed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const importDataMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return apiRequest("POST", `/api/user/import-profile-data/${memberId}`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      if (data.imported) {
        toast({
          title: "Data Imported",
          description: `Imported ${data.fieldsImported.length} field(s): ${data.fieldsImported.join(", ")}`,
        });
      } else {
        toast({
          title: "No New Data",
          description: data.message,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to import data",
        variant: "destructive",
      });
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      nickname: nickname || undefined,
      gender: gender as "male" | "female" | "other" | undefined,
      birthDate: birthDate || undefined,
      birthPlace: birthPlace || undefined,
      bio: bio || undefined,
      currentCity: currentCity || undefined,
      currentRegion: currentRegion || undefined,
      currentCountry: currentCountry || undefined,
      locationVisible,
    });
  };

  const handleImportData = (memberId: string) => {
    importDataMutation.mutate(memberId);
  };

  if (authLoading || profileLoading) {
    return (
      <div className="container max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    navigate("/");
    return null;
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-muted-foreground">
            Your personal information syncs to all family trees where you're claimed
          </p>
        </div>
      </div>

      <Alert>
        <User className="h-4 w-4" />
        <AlertDescription>
          This is your single source of truth. When you update information here, it automatically 
          appears in every family tree where your profile has been claimed and approved.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
            <CardDescription>
              Basic details about you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="How you're known to family"
                data-testid="input-nickname"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger id="gender" data-testid="select-gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="birthDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Birth Date
              </Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                data-testid="input-birthdate"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="birthPlace">Birth Place</Label>
              <Input
                id="birthPlace"
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                placeholder="City, Country"
                data-testid="input-birthplace"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Current Location
            </CardTitle>
            <CardDescription>
              Where you currently live (optional)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="currentCity">City</Label>
              <Input
                id="currentCity"
                value={currentCity}
                onChange={(e) => setCurrentCity(e.target.value)}
                placeholder="Current city"
                data-testid="input-city"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="currentRegion">State/Province/Region</Label>
              <Input
                id="currentRegion"
                value={currentRegion}
                onChange={(e) => setCurrentRegion(e.target.value)}
                placeholder="State or region"
                data-testid="input-region"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="currentCountry">Country</Label>
              <Input
                id="currentCountry"
                value={currentCountry}
                onChange={(e) => setCurrentCountry(e.target.value)}
                placeholder="Country"
                data-testid="input-country"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <Label htmlFor="locationVisible">Share Location</Label>
                <p className="text-xs text-muted-foreground">
                  Allow family connections to see your location
                </p>
              </div>
              <Switch
                id="locationVisible"
                checked={locationVisible}
                onCheckedChange={setLocationVisible}
                data-testid="switch-location-visible"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            About Me
          </CardTitle>
          <CardDescription>
            Tell your family a bit about yourself
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Share a little about yourself, your interests, or anything you'd like your family to know..."
            className="min-h-32"
            data-testid="textarea-bio"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          onClick={handleSaveProfile} 
          disabled={updateProfileMutation.isPending}
          data-testid="button-save-profile"
        >
          {updateProfileMutation.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Profile
        </Button>
      </div>

      {claimedProfiles && claimedProfiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trees className="h-5 w-5" />
              Your Claimed Profiles
            </CardTitle>
            <CardDescription>
              Import data from profiles you've claimed in other family trees
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {claimedProfiles.map((claimed) => (
                <div 
                  key={claimed.id} 
                  className="flex items-center justify-between p-4 border rounded-lg"
                  data-testid={`claimed-profile-${claimed.id}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {claimed.firstName} {claimed.lastName}
                      </span>
                      <Badge variant="outline">{claimed.treeName}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {[
                        claimed.birthDate && `Born: ${claimed.birthDate}`,
                        claimed.birthPlace && `Place: ${claimed.birthPlace}`,
                        claimed.currentCity && `Lives: ${claimed.currentCity}`,
                      ].filter(Boolean).join(" | ") || "No additional data"}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleImportData(claimed.id)}
                    disabled={importDataMutation.isPending}
                    data-testid={`button-import-${claimed.id}`}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Import Data
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {claimedLoading && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
