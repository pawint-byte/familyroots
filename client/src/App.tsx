import { Switch, Route } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { I18nProvider } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { Chatbot } from "@/components/chatbot";
import { MaintenanceMode } from "@/components/maintenance-mode";
import { initGA } from "@/lib/analytics";
import { useAnalytics } from "@/hooks/use-analytics";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import TreeView from "@/pages/tree-view";
import Pricing from "@/pages/pricing";
import Gifts from "@/pages/gifts";
import AdminVideos from "@/pages/admin-videos";
import AdminUsers from "@/pages/admin-users";
import AdminRelationships from "@/pages/admin-relationships";
import VideoPage from "@/pages/video";
import JoinTree from "@/pages/join-tree";
import AccountSettings from "@/pages/account-settings";
import FAQ from "@/pages/faq";
import Merchandise from "@/pages/merchandise";
import Share from "@/pages/share";
import MyQR from "@/pages/my-qr";
import MyProfile from "@/pages/my-profile";
import PublicProfile from "@/pages/public-profile";
import Network from "@/pages/network";
import Comparison from "@/pages/comparison";
import Records from "@/pages/records";
import GiftRegistry from "@/pages/gift-registry";
import RegistryDetail from "@/pages/registry-detail";
import NotFound from "@/pages/not-found";

function Router() {
  const { user, isLoading } = useAuth();
  useAnalytics();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/20" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={user ? Dashboard : Landing} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/tree/:id" component={TreeView} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/gifts" component={Gifts} />
      <Route path="/admin/videos" component={AdminVideos} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/relationships" component={AdminRelationships} />
      <Route path="/manage-relationships" component={AdminRelationships} />
      <Route path="/video/:id" component={VideoPage} />
      <Route path="/join/:inviteCode" component={JoinTree} />
      <Route path="/account/settings" component={AccountSettings} />
      <Route path="/faq" component={FAQ} />
      <Route path="/merchandise" component={Merchandise} />
      <Route path="/share" component={Share} />
      <Route path="/my-qr" component={MyQR} />
      <Route path="/my-profile" component={MyProfile} />
      <Route path="/profile/:userId" component={PublicProfile} />
      <Route path="/network" component={Network} />
      <Route path="/comparison" component={Comparison} />
      <Route path="/records" component={Records} />
      <Route path="/tree/:treeId/registries" component={GiftRegistry} />
      <Route path="/registry/:registryId" component={RegistryDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    initGA();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <MaintenanceMode>
            <TooltipProvider>
              <Toaster />
              <Router />
              <Chatbot />
            </TooltipProvider>
          </MaintenanceMode>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
