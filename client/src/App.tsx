import { Switch, Route, Redirect, useLocation } from "wouter";
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
import { AppLoadingShell } from "@/components/app-loading-shell";
import { isPublicRoute } from "@/lib/public-routes";
import { initGA } from "@/lib/analytics";
import { captureAttribution } from "@/lib/attribution";
import { useAnalytics } from "@/hooks/use-analytics";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import TreeView from "@/pages/tree-view";
import Pricing from "@/pages/pricing";
import Gifts from "@/pages/gifts";
import AdminVideos from "@/pages/admin-videos";
import AdminUsers from "@/pages/admin-users";
import AdminRelationships from "@/pages/admin-relationships";
import AdminMembers from "@/pages/admin-members";
import AdminConnections from "@/pages/admin-connections";
import AdminTreeConnections from "@/pages/admin-tree-connections";
import AdminTreeManager from "@/pages/admin-tree-manager";
import AdminDuplicates from "@/pages/admin-duplicates";
import VideoPage from "@/pages/video";
import JoinTree from "@/pages/join-tree";
import AccountSettings from "@/pages/account-settings";
import FAQ from "@/pages/faq";
import Contact from "@/pages/Contact";
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
import NetworkOverview from "@/pages/network-overview";
import MembershipBadge from "@/pages/membership-badge";
import Discover from "@/pages/discover";
import FeaturesGuide from "@/pages/features-guide";
import ConnectToTree from "@/pages/connect-to-tree";
import WhatsNew from "@/pages/whats-new";
import Radar from "@/pages/radar";
import AuthLogin from "@/pages/auth-login";
import AuthRegister from "@/pages/auth-register";
import AuthForgotPassword from "@/pages/auth-forgot-password";
import AuthResetPassword from "@/pages/auth-reset-password";
import AuthVerifyEmail from "@/pages/auth-verify-email";
import NotFound from "@/pages/not-found";
import About from "@/pages/about";
import Blog from "@/pages/blog";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";

function Router() {
  const { user, isLoading, isError, refetch } = useAuth();
  const [location] = useLocation();
  useAnalytics();

  // Public pages should not be held hostage by a session request. This is
  // particularly important for direct links to policy and marketing pages.
  const canRenderWithoutAuth = isPublicRoute(location);
  if (!canRenderWithoutAuth && (isLoading || isError)) {
    return (
      <AppLoadingShell
        onRetry={() => refetch()}
        hasError={isError}
      />
    );
  }

  return (
    <Switch>
      <Route path="/" component={user ? Dashboard : Landing} />
      <Route path="/login" component={AuthLogin} />
      <Route path="/signup" component={AuthRegister} />
      <Route path="/register" component={AuthRegister} />
      <Route path="/forgot-password" component={AuthForgotPassword} />
      <Route path="/reset-password/:token" component={AuthResetPassword} />
      <Route path="/reset-password" component={AuthResetPassword} />
      <Route path="/verify-email/:token" component={AuthVerifyEmail} />
      <Route path="/dashboard">
        {user ? <Dashboard /> : <Redirect to="/login" />}
      </Route>
      <Route path="/tree/:id" component={TreeView} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/gifts" component={Gifts} />
      <Route path="/admin/videos" component={AdminVideos} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/relationships" component={AdminRelationships} />
      <Route path="/admin/members" component={AdminMembers} />
      <Route path="/admin/connections" component={AdminConnections} />
      <Route path="/admin/tree-connections" component={AdminTreeConnections} />
      <Route path="/admin/tree-manager" component={AdminTreeManager} />
      <Route path="/admin/duplicates" component={AdminDuplicates} />
      <Route path="/manage-relationships" component={AdminRelationships} />
      <Route path="/video/:id" component={VideoPage} />
      <Route path="/join/:inviteCode" component={JoinTree} />
      <Route path="/account/settings" component={AccountSettings} />
      <Route path="/faq" component={FAQ} />
      <Route path="/contact" component={Contact} />
      <Route path="/merchandise" component={Merchandise} />
      <Route path="/share" component={Share} />
      <Route path="/my-qr" component={MyQR} />
      <Route path="/my-profile" component={MyProfile} />
      <Route path="/profile/:userId" component={PublicProfile} />
      <Route path="/network" component={Network} />
      <Route path="/comparison" component={Comparison} />
      <Route path="/features" component={FeaturesGuide} />
      <Route path="/records" component={Records} />
      <Route path="/familysearch" component={Records} />
      <Route path="/familysearch/import" component={Records} />
      <Route path="/tree/:treeId/registries" component={GiftRegistry} />
      <Route path="/registry/:registryId" component={RegistryDetail} />
      <Route path="/network-overview" component={NetworkOverview} />
      <Route path="/my-badge" component={MembershipBadge} />
      <Route path="/discover" component={Discover} />
      <Route path="/connect/:treeId" component={ConnectToTree} />
      <Route path="/whats-new" component={WhatsNew} />
      <Route path="/radar" component={Radar} />
      <Route path="/about" component={About} />
      <Route path="/blog" component={Blog} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    captureAttribution();
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
