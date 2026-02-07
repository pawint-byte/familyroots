import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Package, Users, TreeDeciduous } from "lucide-react";

interface PaymentGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "tree" | "member" | "credits";
  limit?: number;
  current?: number;
  credits?: number;
}

export function PaymentGateDialog({ open, onOpenChange, type, limit, current, credits }: PaymentGateDialogProps) {
  const [, navigate] = useLocation();
  
  const handleViewPacks = () => {
    onOpenChange(false);
    navigate("/pricing");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-payment-gate">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-full bg-primary/10">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">Need More Member Credits</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {type === "credits" || type === "member" ? (
              <>
                You've used all your free member slots and don't have any credits remaining.
                Purchase a member pack to continue adding family members.
              </>
            ) : (
              <>
                Purchase a member pack to add more family members to your trees.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Current Status</p>
              <p className="text-sm text-muted-foreground">
                {current !== undefined && (
                  <>{current} total family members</>
                )}
                {credits !== undefined && (
                  <> &middot; {credits} credits remaining</>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Member packs include:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Starter Pack: 10 credits for $7.99</li>
            <li>Growth Pack: 25 credits for $14.99</li>
            <li>Family Pack: 50 credits for $24.99</li>
          </ul>
          <p className="text-xs mt-2">Credits never expire. Active users earn discounts.</p>
        </div>
        
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-payment-cancel">
            Maybe Later
          </Button>
          <Button onClick={handleViewPacks} data-testid="button-payment-subscribe">
            View Member Packs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
