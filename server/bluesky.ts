import { BskyAgent, RichText } from "@atproto/api";

function getCredentials() {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  
  if (!handle || !password) {
    throw new Error("BLUESKY_HANDLE and BLUESKY_APP_PASSWORD environment variables are required");
  }
  
  return { handle, password };
}

async function createAgent() {
  const { handle, password } = getCredentials();
  
  const agent = new BskyAgent({
    service: "https://bsky.social",
  });
  
  await agent.login({
    identifier: handle,
    password: password,
  });
  
  return agent;
}

async function fetchAndUploadImage(agent: BskyAgent, imageUrl: string) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    const contentType = response.headers.get("content-type") || "image/jpeg";
    
    const uploadResponse = await agent.uploadBlob(uint8Array, {
      encoding: contentType,
    });
    
    return uploadResponse.data.blob;
  } catch (error) {
    console.error("Failed to upload image to Bluesky:", error);
    return null;
  }
}

export async function postToBluesky(params: {
  message: string;
  url: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
}) {
  const agent = await createAgent();
  
  const rt = new RichText({ text: params.message });
  await rt.detectFacets(agent);
  
  let thumb = undefined;
  if (params.thumbnailUrl) {
    thumb = await fetchAndUploadImage(agent, params.thumbnailUrl);
  }
  
  const postRecord: any = {
    $type: "app.bsky.feed.post",
    text: rt.text,
    facets: rt.facets,
    createdAt: new Date().toISOString(),
    embed: {
      $type: "app.bsky.embed.external",
      external: {
        uri: params.url,
        title: params.title,
        description: params.description,
        ...(thumb && { thumb }),
      },
    },
  };
  
  const result = await agent.post(postRecord);
  
  return {
    uri: result.uri,
    cid: result.cid,
  };
}
