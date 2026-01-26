// Discord integration for FamilyRoots community notifications
// Uses Replit's Discord connector for OAuth-based access

import { Client, GatewayIntentBits, TextChannel } from 'discord.js';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=discord',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Discord not connected');
  }
  return accessToken;
}

async function getUncachableDiscordClient() {
  const token = await getAccessToken();

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
  });

  await client.login(token);
  return client;
}

export async function testDiscordConnection() {
  try {
    const client = await getUncachableDiscordClient();
    const guilds = await client.guilds.fetch();
    const guildList = guilds.map(g => ({ id: g.id, name: g.name }));
    client.destroy();
    return {
      success: true,
      guilds: guildList,
      message: `Connected to ${guildList.length} server(s)`
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function sendDiscordNotification(params: {
  channelId: string;
  message: string;
  embed?: {
    title?: string;
    description?: string;
    color?: number;
    url?: string;
    thumbnail?: string;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
  };
}) {
  const client = await getUncachableDiscordClient();
  
  try {
    const channel = await client.channels.fetch(params.channelId);
    
    if (!channel || !channel.isTextBased()) {
      throw new Error('Channel not found or is not a text channel');
    }
    
    const textChannel = channel as TextChannel;
    
    if (params.embed) {
      await textChannel.send({
        content: params.message,
        embeds: [{
          title: params.embed.title,
          description: params.embed.description,
          color: params.embed.color || 0x4F46E5,
          url: params.embed.url,
          thumbnail: params.embed.thumbnail ? { url: params.embed.thumbnail } : undefined,
          fields: params.embed.fields,
          timestamp: new Date().toISOString()
        }]
      });
    } else {
      await textChannel.send(params.message);
    }
    
    client.destroy();
    return { success: true };
  } catch (error: any) {
    client.destroy();
    throw error;
  }
}

export async function notifyNewSignup(userName: string, baseUrl: string) {
  const channelId = process.env.DISCORD_NOTIFICATIONS_CHANNEL;
  if (!channelId) return;
  
  try {
    await sendDiscordNotification({
      channelId,
      message: '',
      embed: {
        title: 'New Member Joined FamilyRoots!',
        description: `Welcome **${userName}** to the FamilyRoots community!`,
        color: 0x22C55E,
        url: baseUrl,
        fields: [
          { name: 'Action', value: 'Start building your family tree today!', inline: false }
        ]
      }
    });
  } catch (error) {
    console.error('Failed to send Discord signup notification:', error);
  }
}

export async function notifyNewTree(treeName: string, ownerName: string, baseUrl: string) {
  const channelId = process.env.DISCORD_NOTIFICATIONS_CHANNEL;
  if (!channelId) return;
  
  try {
    await sendDiscordNotification({
      channelId,
      message: '',
      embed: {
        title: 'New Family Tree Created!',
        description: `**${ownerName}** just created a new family tree: "${treeName}"`,
        color: 0x3B82F6,
        url: baseUrl,
        fields: [
          { name: 'Growing Together', value: 'More families are connecting on FamilyRoots!', inline: false }
        ]
      }
    });
  } catch (error) {
    console.error('Failed to send Discord tree notification:', error);
  }
}

export async function notifyMilestone(userName: string, memberCount: number, baseUrl: string) {
  const channelId = process.env.DISCORD_NOTIFICATIONS_CHANNEL;
  if (!channelId) return;
  
  const milestones = [10, 25, 50, 75, 100];
  const milestone = milestones.find(m => m === memberCount);
  if (!milestone) return;
  
  try {
    await sendDiscordNotification({
      channelId,
      message: '',
      embed: {
        title: `Milestone Reached: ${milestone} Family Members!`,
        description: `Congratulations to **${userName}** for adding ${milestone} family members to their tree!`,
        color: 0xF59E0B,
        url: baseUrl,
        fields: [
          { name: 'Achievement Unlocked', value: `${milestone} members milestone!`, inline: true }
        ]
      }
    });
  } catch (error) {
    console.error('Failed to send Discord milestone notification:', error);
  }
}
