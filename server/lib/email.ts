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
    from: fromEmail || 'FamilyRoots <noreply@familyroots.app>',
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
