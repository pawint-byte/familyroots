import { db } from "./db";
import { generatedVideos } from "@shared/schema";
import { eq } from "drizzle-orm";

const HEYGEN_API_BASE = "https://api.heygen.com/v2";

function getApiKey(): string {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) {
    throw new Error("HEYGEN_API_KEY environment variable is not set");
  }
  return key;
}

async function heygenFetch(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${HEYGEN_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "X-Api-Key": getApiKey(),
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HeyGen API error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

export async function getAvatars() {
  const data = await heygenFetch("/avatars");
  return data.data?.avatars || [];
}

export async function getVoices() {
  const data = await heygenFetch("/voices");
  return data.data?.voices || [];
}

export async function generateVideo(params: {
  title: string;
  script: string;
  avatarId: string;
  voiceId: string;
  backgroundUrl?: string;
  destinationUrl: string;
  createdBy: string;
}) {
  const videoPayload: any = {
    video_inputs: [
      {
        character: {
          type: "avatar",
          avatar_id: params.avatarId,
          avatar_style: "normal",
        },
        voice: {
          type: "text",
          input_text: params.script,
          voice_id: params.voiceId,
        },
      },
    ],
    dimension: {
      width: 1280,
      height: 720,
    },
  };

  if (params.backgroundUrl) {
    videoPayload.video_inputs[0].background = {
      type: "image",
      url: params.backgroundUrl,
    };
  }

  const result = await heygenFetch("/video/generate", {
    method: "POST",
    body: JSON.stringify(videoPayload),
  });

  const heygenVideoId = result.data?.video_id;

  const [video] = await db
    .insert(generatedVideos)
    .values({
      heygenVideoId,
      title: params.title,
      script: params.script,
      avatarId: params.avatarId,
      voiceId: params.voiceId,
      backgroundUrl: params.backgroundUrl,
      destinationUrl: params.destinationUrl,
      status: "processing",
      createdBy: params.createdBy,
    })
    .returning();

  return video;
}

export async function syncVideoStatus(videoId: string) {
  const [video] = await db
    .select()
    .from(generatedVideos)
    .where(eq(generatedVideos.id, videoId));

  if (!video || !video.heygenVideoId) {
    throw new Error("Video not found or no HeyGen video ID");
  }

  const result = await heygenFetch(`/video_status.get?video_id=${video.heygenVideoId}`);
  
  const status = result.data?.status;
  const videoUrl = result.data?.video_url;
  const thumbnailUrl = result.data?.thumbnail_url;
  const duration = result.data?.duration?.toString();
  const errorMessage = result.data?.error?.message;

  let newStatus: "pending" | "processing" | "completed" | "failed" = "processing";
  if (status === "completed") {
    newStatus = "completed";
  } else if (status === "failed") {
    newStatus = "failed";
  } else if (status === "pending" || status === "waiting") {
    newStatus = "pending";
  }

  const [updatedVideo] = await db
    .update(generatedVideos)
    .set({
      status: newStatus,
      videoUrl,
      thumbnailUrl,
      duration,
      errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(generatedVideos.id, videoId))
    .returning();

  return updatedVideo;
}

export async function getAllVideos() {
  return db.select().from(generatedVideos).orderBy(generatedVideos.createdAt);
}

export async function getVideoById(id: string) {
  const [video] = await db
    .select()
    .from(generatedVideos)
    .where(eq(generatedVideos.id, id));
  return video;
}

export async function deleteVideo(id: string) {
  await db.delete(generatedVideos).where(eq(generatedVideos.id, id));
}
