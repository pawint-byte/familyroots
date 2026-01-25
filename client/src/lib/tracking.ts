declare global {
  interface Window {
    rdt?: (action: string, event: string, params?: Record<string, unknown>) => void;
  }
}

export function trackRedditEvent(event: 'SignUp' | 'Lead' | 'Purchase' | 'ViewContent' | 'AddToCart' | 'PageVisit' | 'Custom', params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.rdt) {
    window.rdt('track', event, params);
  }
}

export function trackSignUp() {
  trackRedditEvent('SignUp');
}

export function trackLead() {
  trackRedditEvent('Lead');
}

export function trackPurchase(value?: number, currency?: string) {
  trackRedditEvent('Purchase', { value, currency: currency || 'USD' });
}

export function trackTreeCreation() {
  trackRedditEvent('Lead', { customEventName: 'TreeCreation' });
}

export function trackMilestone(milestone: string, memberCount?: number) {
  trackRedditEvent('ViewContent', { 
    customEventName: 'Milestone',
    milestone,
    memberCount 
  });
}

export function trackAddFamilyMember() {
  trackRedditEvent('AddToCart', { customEventName: 'AddFamilyMember' });
}
