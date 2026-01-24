import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Crown, Users, TreeDeciduous } from "lucide-react";

interface PaymentGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "tree" | "member";
  limit: number;
  current: number;
}

export function PaymentGateDialog({ open, onOpenChange, type, limit, current }: PaymentGateDialogProps) {
  const [, navigate] = useLocation();
  
  const handleSubscribe = () => {
    onOpenChange(false);
    navigate("/pricing");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-payment-gate">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-full bg-primary/10">
              <Crown className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">Upgrade to Continue</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {type === "tree" ? (
              <>
                You've reached the free tier limit of <strong>{limit} family tree</strong>.
                Subscribe to create unlimited family trees and unlock all features.
              </>
            ) : (
              <>
                This tree has reached the free tier limit of <strong>{limit} family members</strong>.
                Subscribe to add unlimited family members and unlock all features.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            {type === "tree" ? (
              <TreeDeciduous className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Users className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">Current Usage</p>
              <p className="text-sm text-muted-foreground">
                {type === "tree" ? (
                  <>{current} of {limit} free tree{limit > 1 ? 's' : ''} used</>
                ) : (
                  <>{current} of {limit} free members used</>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">With a subscription, you get:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Unlimited family trees</li>
            <li>Unlimited family members per tree</li>
            <li>Priority support</li>
            <li>Discounts that grow with your family</li>
          </ul>
        </div>
        
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-payment-cancel">
            Maybe Later
          </Button>
          <Button onClick={handleSubscribe} data-testid="button-payment-subscribe">
            View Pricing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
