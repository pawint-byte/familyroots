import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Bell, Baby, Heart, Milestone, Mail } from "lucide-react";
import type { NotificationPreferences as NotificationPrefs } from "@shared/models/auth";

const defaultPreferences: NotificationPrefs = {
  births: false,
  deaths: false,
  marriages: false,
  divorces: false,
  milestones: false,
  emailEnabled: false,
};

export function NotificationPreferences() {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPrefs>(defaultPreferences);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: savedPreferences, isLoading } = useQuery<NotificationPrefs>({
    queryKey: ['/api/user/notification-preferences'],
  });

  useEffect(() => {
    if (savedPreferences) {
      setPreferences(savedPreferences);
    }
  }, [savedPreferences]);

  const updateMutation = useMutation({
    mutationFn: async (prefs: NotificationPrefs) => {
      return apiRequest('PUT', '/api/user/notification-preferences', prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/notification-preferences'] });
      setHasChanges(false);
      toast({ title: "Preferences saved", description: "Your notification preferences have been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save preferences", variant: "destructive" });
    },
  });

  const handleToggle = (key: keyof NotificationPrefs) => {
    setPreferences(prev => {
      const newPrefs = { ...prev, [key]: !prev[key] };
      setHasChanges(true);
      return newPrefs;
    });
  };

  const handleSave = () => {
    updateMutation.mutate(preferences);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-10 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Choose which family events you want to receive notifications about. All notifications are opt-in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between py-2 border-b">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <Label htmlFor="email-enabled" className="font-medium">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive notifications via email</p>
            </div>
          </div>
          <Switch
            id="email-enabled"
            checked={preferences.emailEnabled}
            onCheckedChange={() => handleToggle('emailEnabled')}
            data-testid="switch-email-enabled"
          />
        </div>

        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Event Types</h4>
          
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Baby className="h-5 w-5 text-green-500" />
              <div>
                <Label htmlFor="births" className="font-medium">Births</Label>
                <p className="text-sm text-muted-foreground">When a new family member is born</p>
              </div>
            </div>
            <Switch
              id="births"
              checked={preferences.births}
              onCheckedChange={() => handleToggle('births')}
              disabled={!preferences.emailEnabled}
              data-testid="switch-births"
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 flex items-center justify-center text-gray-500">
                <span className="text-lg">&#x1F56F;</span>
              </div>
              <div>
                <Label htmlFor="deaths" className="font-medium">Deaths</Label>
                <p className="text-sm text-muted-foreground">When a family member passes away</p>
              </div>
            </div>
            <Switch
              id="deaths"
              checked={preferences.deaths}
              onCheckedChange={() => handleToggle('deaths')}
              disabled={!preferences.emailEnabled}
              data-testid="switch-deaths"
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Heart className="h-5 w-5 text-pink-500" />
              <div>
                <Label htmlFor="marriages" className="font-medium">Marriages</Label>
                <p className="text-sm text-muted-foreground">When family members get married</p>
              </div>
            </div>
            <Switch
              id="marriages"
              checked={preferences.marriages}
              onCheckedChange={() => handleToggle('marriages')}
              disabled={!preferences.emailEnabled}
              data-testid="switch-marriages"
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 flex items-center justify-center text-orange-500">
                <span className="text-sm font-bold">D</span>
              </div>
              <div>
                <Label htmlFor="divorces" className="font-medium">Divorces</Label>
                <p className="text-sm text-muted-foreground">When family members divorce</p>
              </div>
            </div>
            <Switch
              id="divorces"
              checked={preferences.divorces}
              onCheckedChange={() => handleToggle('divorces')}
              disabled={!preferences.emailEnabled}
              data-testid="switch-divorces"
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Milestone className="h-5 w-5 text-blue-500" />
              <div>
                <Label htmlFor="milestones" className="font-medium">Milestones</Label>
                <p className="text-sm text-muted-foreground">Graduations, achievements, and other milestones</p>
              </div>
            </div>
            <Switch
              id="milestones"
              checked={preferences.milestones}
              onCheckedChange={() => handleToggle('milestones')}
              disabled={!preferences.emailEnabled}
              data-testid="switch-milestones"
            />
          </div>
        </div>

        {!preferences.emailEnabled && (
          <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
            Enable email notifications above to configure individual event preferences.
          </p>
        )}

        <div className="flex justify-end pt-4">
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || updateMutation.isPending}
            data-testid="button-save-preferences"
          >
            {updateMutation.isPending ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
