// Email service using Resend integration
// Provides transactional email functionality for FamilyRoots

import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings?.settings?.api_key) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return { client: new Resend(apiKey), fromEmail };
}

// Generic email sending function
export async function sendEmail(to: string, subject: string, html: string) {
  const { client, fromEmail } = await getResendClient();
  const result = await client.emails.send({
    from: fromEmail || 'FamilyRoots <noreply@familyroots.family>',
    to,
    subject,
    html
  });
  return result;
}

// Welcome email for new users
export async function sendWelcomeEmail(to: string, userName: string) {
  const subject = 'Welcome to FamilyRoots!';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .content { padding: 30px; background: #f9fafb; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Welcome to FamilyRoots!</h1>
      </div>
      <div class="content">
        <p>Hi ${userName},</p>
        <p>Thank you for joining FamilyRoots! We're excited to help you discover, preserve, and share your family's unique story.</p>
        <p>Here's what you can do:</p>
        <ul>
          <li><strong>Create your family tree</strong> - Add family members and define relationships</li>
          <li><strong>Upload photos</strong> - Preserve precious family memories</li>
          <li><strong>Add important dates</strong> - Track birthdays, anniversaries, and milestones</li>
          <li><strong>Collaborate</strong> - Invite family members to contribute</li>
        </ul>
        <p style="text-align: center;">
          <a href="https://familyroots.replit.app/dashboard" class="button">Start Building Your Tree</a>
        </p>
        <p>If you have any questions, our AI assistant is available to help you navigate the app.</p>
      </div>
      <div class="footer">
        <p>© FamilyRoots - Preserve Your Family's Legacy</p>
      </div>
    </body>
    </html>
  `;
  return sendEmail(to, subject, html);
}

// Collaboration invite email
export async function sendCollaborationInvite(
  to: string, 
  inviterName: string, 
  treeName: string,
  inviteLink: string
) {
  const subject = `${inviterName} invited you to collaborate on "${treeName}"`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; background: #f9fafb; }
        .tree-card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb; }
        .tree-name { font-size: 20px; font-weight: bold; color: #4F46E5; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>You're Invited to Collaborate!</h1>
      </div>
      <div class="content">
        <p>Hi there,</p>
        <p><strong>${inviterName}</strong> has invited you to collaborate on their family tree on FamilyRoots.</p>
        <div class="tree-card">
          <div class="tree-name">${treeName}</div>
          <p style="color: #6b7280; margin-bottom: 0;">Help preserve and grow this family's story</p>
        </div>
        <p>As a collaborator, you'll be able to:</p>
        <ul>
          <li>View the complete family tree</li>
          <li>Add new family members</li>
          <li>Upload photos and documents</li>
          <li>Add notes and stories</li>
        </ul>
        <p style="text-align: center;">
          <a href="${inviteLink}" class="button">Accept Invitation</a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
      </div>
      <div class="footer">
        <p>© FamilyRoots - Preserve Your Family's Legacy</p>
      </div>
    </body>
    </html>
  `;
  return sendEmail(to, subject, html);
}

// Family event notification email
export async function sendEventNotification(
  to: string,
  userName: string,
  eventType: string,
  memberName: string,
  eventDate: string
) {
  const subject = `Upcoming: ${memberName}'s ${eventType}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; background: #f9fafb; }
        .event-card { background: white; border-radius: 8px; padding: 25px; margin: 20px 0; border: 1px solid #e5e7eb; text-align: center; }
        .event-type { font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; }
        .member-name { font-size: 24px; font-weight: bold; color: #1f2937; margin: 10px 0; }
        .event-date { font-size: 18px; color: #4F46E5; font-weight: 500; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Family Event Reminder</h1>
      </div>
      <div class="content">
        <p>Hi ${userName},</p>
        <p>This is a friendly reminder about an upcoming family event:</p>
        <div class="event-card">
          <div class="event-type">${eventType}</div>
          <div class="member-name">${memberName}</div>
          <div class="event-date">${eventDate}</div>
        </div>
        <p style="text-align: center;">
          <a href="https://familyroots.replit.app/dashboard" class="button">View Family Tree</a>
        </p>
      </div>
      <div class="footer">
        <p>© FamilyRoots - Preserve Your Family's Legacy</p>
        <p style="font-size: 12px;">You're receiving this because you enabled event notifications.</p>
      </div>
    </body>
    </html>
  `;
  return sendEmail(to, subject, html);
}

// Inactivity reminder email (for deadman switch)
export async function sendInactivityReminder(
  to: string,
  userName: string,
  heirName: string,
  daysUntilTransfer: number
) {
  const subject = 'Action Required: Your FamilyRoots Account Will Be Transferred';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; background: #f9fafb; }
        .warning-card { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .warning-title { color: #DC2626; font-weight: bold; font-size: 18px; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
        .countdown { font-size: 36px; font-weight: bold; color: #DC2626; text-align: center; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Account Transfer Warning</h1>
      </div>
      <div class="content">
        <p>Hi ${userName},</p>
        <div class="warning-card">
          <div class="warning-title">Your account has been inactive</div>
          <p>We noticed you haven't logged into FamilyRoots for an extended period. To protect your family tree data, you previously designated <strong>${heirName}</strong> as your account heir.</p>
        </div>
        <p class="countdown">${daysUntilTransfer} days remaining</p>
        <p style="text-align: center;">If you don't log in within <strong>${daysUntilTransfer} days</strong>, your account and all family trees will be transferred to ${heirName}.</p>
        <p style="text-align: center;">
          <a href="https://familyroots.replit.app/dashboard" class="button">Log In Now to Keep Your Account</a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">If you intended for this transfer to happen, you can ignore this email. Your designated heir will receive access to your family trees.</p>
      </div>
      <div class="footer">
        <p>© FamilyRoots - Preserve Your Family's Legacy</p>
        <p style="font-size: 12px;">You're receiving this because you set up an account heir for your FamilyRoots account.</p>
      </div>
    </body>
    </html>
  `;
  return sendEmail(to, subject, html);
}

// Account transfer notification to heir
export async function sendAccountTransferNotification(
  to: string,
  heirName: string,
  originalOwnerName: string,
  treeCount: number
) {
  const subject = `You've Been Granted Access to ${originalOwnerName}'s Family Trees`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; background: #f9fafb; }
        .info-card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
        .tree-count { font-size: 48px; font-weight: bold; color: #4F46E5; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Account Access Granted</h1>
      </div>
      <div class="content">
        <p>Hi ${heirName},</p>
        <p><strong>${originalOwnerName}</strong> designated you as their account heir on FamilyRoots. Due to extended inactivity, their account has been transferred to you.</p>
        <div class="info-card">
          <div class="tree-count">${treeCount}</div>
          <p style="color: #6b7280; margin: 0;">Family tree${treeCount !== 1 ? 's' : ''} now in your care</p>
        </div>
        <p>You now have full ownership of these family trees, including:</p>
        <ul>
          <li>All family member profiles and photos</li>
          <li>Relationship connections</li>
          <li>Family events and milestones</li>
          <li>Name history records</li>
        </ul>
        <p style="text-align: center;">
          <a href="https://familyroots.replit.app/dashboard" class="button">View Your Family Trees</a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">If you don't have a FamilyRoots account yet, you'll be prompted to create one when you click the button above.</p>
      </div>
      <div class="footer">
        <p>© FamilyRoots - Preserve Your Family's Legacy</p>
      </div>
    </body>
    </html>
  `;
  return sendEmail(to, subject, html);
}

// Family member invitation email (for non-registered users added to a family tree)
export async function sendFamilyMemberInvitation(
  to: string,
  memberName: string,
  treeName: string,
  inviterName: string
) {
  const subject = `You've been added to the "${treeName}" family tree!`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; background: #f9fafb; }
        .highlight-card { background: white; border-radius: 12px; padding: 25px; margin: 20px 0; border: 2px solid #4F46E5; text-align: center; }
        .tree-name { font-size: 22px; font-weight: bold; color: #4F46E5; margin-bottom: 8px; }
        .added-as { color: #6b7280; font-size: 14px; }
        .member-name { font-size: 18px; font-weight: 600; color: #1f2937; margin-top: 5px; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 500; }
        .feature-list { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb; }
        .feature-item { display: flex; align-items: flex-start; margin: 12px 0; }
        .feature-icon { color: #4F46E5; font-weight: bold; margin-right: 10px; }
        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>You're Part of a Family Tree!</h1>
      </div>
      <div class="content">
        <p>Hi there,</p>
        <p><strong>${inviterName}</strong> has added you to their family tree on FamilyRoots.</p>
        
        <div class="highlight-card">
          <div class="tree-name">${treeName}</div>
          <div class="added-as">You've been added as</div>
          <div class="member-name">${memberName}</div>
        </div>
        
        <p>This means you're part of a growing family network! By joining FamilyRoots, you can:</p>
        
        <div class="feature-list">
          <div class="feature-item">
            <span class="feature-icon">&#10003;</span>
            <span><strong>Start your own family tree</strong> - Document your side of the family</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">&#10003;</span>
            <span><strong>Connect automatically</strong> - Our smart matching links your tree to relatives</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">&#10003;</span>
            <span><strong>Preserve family stories</strong> - Add photos, dates, and memories</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">&#10003;</span>
            <span><strong>Discover relatives</strong> - Find family connections you never knew existed</span>
          </div>
        </div>
        
        <p style="text-align: center;">
          <a href="https://familyroots.replit.app" class="button">Join FamilyRoots - It's Free</a>
        </p>
        
        <p style="color: #6b7280; font-size: 14px; text-align: center;">
          When you sign up with this email address, you'll automatically be connected to ${inviterName}'s tree.
        </p>
      </div>
      <div class="footer">
        <p>© FamilyRoots - Preserve Your Family's Legacy</p>
        <p style="font-size: 12px;">You're receiving this because ${inviterName} added you as a family member. If this was a mistake, you can safely ignore this email.</p>
      </div>
    </body>
    </html>
  `;
  return sendEmail(to, subject, html);
}

// Tree update notification
export async function sendTreeUpdateNotification(
  to: string,
  userName: string,
  treeName: string,
  updaterName: string,
  updateDescription: string
) {
  const subject = `Update to "${treeName}" family tree`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; background: #f9fafb; }
        .update-card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #4F46E5; }
        .updater { font-weight: bold; color: #1f2937; }
        .update-text { color: #4b5563; margin-top: 8px; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Tree Update</h1>
      </div>
      <div class="content">
        <p>Hi ${userName},</p>
        <p>There's been an update to the <strong>${treeName}</strong> family tree:</p>
        <div class="update-card">
          <div class="updater">${updaterName}</div>
          <div class="update-text">${updateDescription}</div>
        </div>
        <p style="text-align: center;">
          <a href="https://familyroots.replit.app/dashboard" class="button">View Changes</a>
        </p>
      </div>
      <div class="footer">
        <p>© FamilyRoots - Preserve Your Family's Legacy</p>
        <p style="font-size: 12px;">You're receiving this because you're a collaborator on this tree.</p>
      </div>
    </body>
    </html>
  `;
  return sendEmail(to, subject, html);
}

// Life event notification email
export async function sendLifeEventNotification(
  to: string,
  userName: string,
  memberName: string,
  eventType: string,
  eventTitle: string,
  eventDate: string,
  treeName: string,
  treeId: string
) {
  const eventTypeColors: Record<string, string> = {
    birth: '#22c55e',
    death: '#6b7280',
    marriage: '#ec4899',
    divorce: '#f97316',
    milestone: '#3b82f6',
    graduation: '#8b5cf6',
    achievement: '#eab308',
  };
  
  const eventColor = eventTypeColors[eventType] || '#4F46E5';
  const formattedDate = new Date(eventDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = `${eventType.charAt(0).toUpperCase() + eventType.slice(1)}: ${eventTitle} - ${memberName}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: ${eventColor}; padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; background: #f9fafb; }
        .event-card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid ${eventColor}; }
        .event-type { text-transform: uppercase; font-size: 12px; color: ${eventColor}; font-weight: bold; letter-spacing: 1px; }
        .event-title { font-size: 18px; font-weight: bold; color: #1f2937; margin-top: 8px; }
        .event-date { color: #6b7280; margin-top: 4px; }
        .member-name { color: #4b5563; margin-top: 8px; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Family Event</h1>
      </div>
      <div class="content">
        <p>Hi ${userName},</p>
        <p>A new life event has been recorded in the <strong>${treeName}</strong> family tree:</p>
        <div class="event-card">
          <div class="event-type">${eventType}</div>
          <div class="event-title">${eventTitle}</div>
          <div class="event-date">${formattedDate}</div>
          <div class="member-name">For: ${memberName}</div>
        </div>
        <p style="text-align: center;">
          <a href="https://familyroots.replit.app/tree/${treeId}" class="button">View Family Tree</a>
        </p>
      </div>
      <div class="footer">
        <p>© FamilyRoots - Preserve Your Family's Legacy</p>
        <p style="font-size: 12px;">You're receiving this because you opted in to event notifications.</p>
      </div>
    </body>
    </html>
  `;
  return sendEmail(to, subject, html);
}

// Custodianship request notification email
export async function sendCustodianshipRequestNotification(
  to: string,
  ownerName: string,
  requesterEmail: string,
  memberName: string,
  relationship: string,
  treeName: string,
  expiresAt: Date
) {
  const formattedExpiry = expiresAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = `Custodianship Request for ${memberName}'s Profile`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; background: #f9fafb; }
        .request-card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb; }
        .requester { font-weight: bold; color: #1f2937; }
        .relationship { color: #6b7280; margin-top: 4px; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Custodianship Request</h1>
      </div>
      <div class="content">
        <p>Hi ${ownerName},</p>
        <p>Someone has requested custodianship of <strong>${memberName}'s</strong> profile in your <strong>${treeName}</strong> family tree:</p>
        <div class="request-card">
          <div class="requester">${requesterEmail}</div>
          <div class="relationship">Relationship: ${relationship}</div>
        </div>
        <div class="warning">
          <strong>Action Required by ${formattedExpiry}</strong>
          <p style="margin: 5px 0 0 0; font-size: 14px;">If no action is taken within 30 days, this request will be automatically approved.</p>
        </div>
        <p style="text-align: center;">
          <a href="https://familyroots.replit.app/dashboard" class="button">Review Request</a>
        </p>
      </div>
      <div class="footer">
        <p>© FamilyRoots - Preserve Your Family's Legacy</p>
      </div>
    </body>
    </html>
  `;
  return sendEmail(to, subject, html);
}

// Custodianship reminder email
export async function sendCustodianshipReminder(
  to: string,
  ownerName: string,
  memberName: string,
  daysRemaining: number,
  treeName: string
) {
  const subject = `Reminder: ${daysRemaining} days left to review custodianship request`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: #f59e0b; padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; background: #f9fafb; }
        .countdown { font-size: 48px; font-weight: bold; text-align: center; color: #f59e0b; margin: 20px 0; }
        .countdown-label { text-align: center; color: #6b7280; margin-bottom: 20px; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Reminder</h1>
      </div>
      <div class="content">
        <p>Hi ${ownerName},</p>
        <p>You have a pending custodianship request for <strong>${memberName}'s</strong> profile in your <strong>${treeName}</strong> family tree.</p>
        <div class="countdown">${daysRemaining}</div>
        <div class="countdown-label">days remaining to review</div>
        <p>If no action is taken, this request will be <strong>automatically approved</strong>.</p>
        <p style="text-align: center;">
          <a href="https://familyroots.replit.app/dashboard" class="button">Review Now</a>
        </p>
      </div>
      <div class="footer">
        <p>© FamilyRoots - Preserve Your Family's Legacy</p>
      </div>
    </body>
    </html>
  `;
  return sendEmail(to, subject, html);
}

// Custodianship approval notification email
export async function sendCustodianshipApproval(
  to: string,
  custodianName: string,
  memberName: string,
  treeName: string,
  autoApproved: boolean = false
) {
  const subject = `Custodianship ${autoApproved ? 'Auto-Approved' : 'Approved'}: You are now custodian of ${memberName}'s profile`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: #22c55e; padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; background: #f9fafb; }
        .approval-badge { background: #dcfce7; border: 2px solid #22c55e; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
        .approval-badge h2 { color: #166534; margin: 0; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .permissions { background: white; border-radius: 8px; padding: 15px; margin: 20px 0; }
        .permissions h3 { margin-top: 0; color: #1f2937; }
        .permissions ul { margin: 0; padding-left: 20px; }
        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Custodianship Approved</h1>
      </div>
      <div class="content">
        <p>Hi ${custodianName},</p>
        <div class="approval-badge">
          <h2>Request ${autoApproved ? 'Auto-Approved' : 'Approved'}</h2>
        </div>
        <p>You are now the custodian of <strong>${memberName}'s</strong> profile in the <strong>${treeName}</strong> family tree.</p>
        ${autoApproved ? '<p><em>This request was automatically approved after 30 days without a response from the tree owner.</em></p>' : ''}
        <div class="permissions">
          <h3>Your Custodian Permissions:</h3>
          <ul>
            <li>Update name and basic information</li>
            <li>Add or update death date</li>
            <li>Update notes and memorial information</li>
            <li>Change profile photo</li>
          </ul>
        </div>
        <p style="text-align: center;">
          <a href="https://familyroots.replit.app/dashboard" class="button">Go to Dashboard</a>
        </p>
      </div>
      <div class="footer">
        <p>© FamilyRoots - Preserve Your Family's Legacy</p>
      </div>
    </body>
    </html>
  `;
  return sendEmail(to, subject, html);
}

// Family referral invite email
export async function sendFamilyReferralInvite(
  to: string,
  inviterName: string,
  personalMessage: string,
  inviteLink: string
) {
  const subject = `${inviterName} wants you to join FamilyRoots!`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; background: #f9fafb; }
        .message-box { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #4F46E5; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>You're Invited to FamilyRoots!</h1>
      </div>
      <div class="content">
        <p>Hi there,</p>
        <p><strong>${inviterName}</strong> thinks you'd love FamilyRoots - a beautiful way to build and share your family tree.</p>
        ${personalMessage ? `
        <div class="message-box">
          <p style="margin: 0; font-style: italic;">"${personalMessage}"</p>
          <p style="margin: 10px 0 0; color: #6b7280; font-size: 14px;">- ${inviterName}</p>
        </div>
        ` : ''}
        <p>With FamilyRoots, you can:</p>
        <ul>
          <li>Build interactive family trees</li>
          <li>Preserve photos and memories</li>
          <li>Collaborate with family members</li>
          <li>Connect across different family trees</li>
        </ul>
        <p style="text-align: center;">
          <a href="${inviteLink}" class="button">Join FamilyRoots</a>
        </p>
        <p style="color: #6b7280; font-size: 14px; text-align: center;">It's free to get started!</p>
      </div>
      <div class="footer">
        <p>FamilyRoots - Preserve Your Family's Legacy</p>
        <p style="font-size: 12px;">You received this email because ${inviterName} invited you to join FamilyRoots.</p>
      </div>
    </body>
    </html>
  `;
  return sendEmail(to, subject, html);
}

// Notify user about potential cross-tree match
export async function sendCrossTreeMatchNotification(
  to: string,
  userName: string,
  yourMemberName: string,
  yourTreeName: string,
  matchedMemberName: string,
  matchedTreeName: string,
  matchScore: number,
  dashboardLink: string
) {
  const confidencePercent = Math.round(matchScore * 100);
  const subject = `Potential family connection found on FamilyRoots`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; background: #f9fafb; }
        .match-card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb; }
        .match-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .confidence { background: ${matchScore >= 0.8 ? '#dcfce7' : matchScore >= 0.6 ? '#fef9c3' : '#f3f4f6'}; color: ${matchScore >= 0.8 ? '#166534' : matchScore >= 0.6 ? '#854d0e' : '#374151'}; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; }
        .person { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .person:last-child { border-bottom: none; }
        .person-name { font-weight: 600; color: #4F46E5; }
        .tree-name { font-size: 14px; color: #6b7280; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Potential Family Connection Found</h1>
      </div>
      <div class="content">
        <p>Hi ${userName},</p>
        <p>We found someone in another family tree who might be the same person as someone in your tree. Take a look and let us know if they match!</p>
        
        <div class="match-card">
          <div class="match-header">
            <span style="font-weight: 600;">Potential Match</span>
            <span class="confidence">${confidencePercent}% match</span>
          </div>
          <div class="person">
            <div class="person-name">${yourMemberName}</div>
            <div class="tree-name">From your tree: ${yourTreeName}</div>
          </div>
          <div style="text-align: center; padding: 10px; color: #9ca3af;">may be the same as</div>
          <div class="person">
            <div class="person-name">${matchedMemberName}</div>
            <div class="tree-name">From tree: ${matchedTreeName}</div>
          </div>
        </div>
        
        <p>If this is the same person, connecting the trees will help both families discover more of their shared history.</p>
        
        <p style="text-align: center;">
          <a href="${dashboardLink}" class="button">Review Match</a>
        </p>
      </div>
      <div class="footer">
        <p>FamilyRoots - Preserve Your Family's Legacy</p>
        <p style="font-size: 12px;">You're receiving this because you have match notifications enabled.</p>
      </div>
    </body>
    </html>
  `;
  return sendEmail(to, subject, html);
}
