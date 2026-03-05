import { randomUUID } from "crypto";
import { objectStorageClient } from "./replit_integrations/object_storage/objectStorage";
import { storage } from "./storage";

const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR || "";
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

function getBucketAndPath(filename: string) {
  const fullPath = `${PRIVATE_OBJECT_DIR}/merchandise/${filename}`;
  if (!fullPath.startsWith("/")) {
    throw new Error("Invalid object path");
  }
  const parts = fullPath.split("/");
  const bucketName = parts[1];
  const objectName = parts.slice(2).join("/");
  return { bucketName, objectName, fullPath };
}

async function uploadBuffer(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  const { bucketName, objectName } = getBucketAndPath(filename);
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);

  await file.save(buffer, {
    contentType,
    resumable: false,
  });

  return `/objects/merchandise/${filename}`;
}

export async function generateAndUploadQR(url: string): Promise<string> {
  const QRCode = await import("qrcode");
  const pngBuffer = await QRCode.default.toBuffer(url, {
    type: "png",
    width: 1200,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });

  const filename = `qr-${randomUUID()}.png`;
  return uploadBuffer(pngBuffer, filename, "image/png");
}

export async function renderTextToImage(text: string): Promise<string> {
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="2400" height="800" viewBox="0 0 2400 800">
      <rect width="2400" height="800" fill="transparent"/>
      <text x="1200" y="400" text-anchor="middle" dominant-baseline="central"
        font-family="Arial, Helvetica, sans-serif" font-size="120" font-weight="bold" fill="#1a1a1a">
        ${escapeXml(text)}
      </text>
    </svg>
  `;

  const sharp = (await import("sharp")).default;
  const pngBuffer = await sharp(Buffer.from(svgContent)).png().toBuffer();

  const filename = `text-${randomUUID()}.png`;
  return uploadBuffer(pngBuffer, filename, "image/png");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function getPublicFileUrl(objectPath: string, baseUrl: string): string {
  if (objectPath.startsWith("http")) {
    return objectPath;
  }
  return `${baseUrl}${objectPath}`;
}

function resolvePrintfulType(placementId: string, productId: number): string {
  try {
    const { PrintfulService } = require("./printful");
    const service = new PrintfulService();
    const products = service.getProducts();
    const product = products.find((p: any) => p.id === productId);
    if (product?.placements) {
      const match = product.placements.find((p: any) => p.id === placementId);
      if (match?.printfulType) return match.printfulType;
    }
  } catch {}
  return "default";
}

export async function buildPrintfulFiles(
  order: any,
  baseUrl: string
): Promise<Array<{ type: string; url: string }>> {
  const files: Array<{ type: string; url: string }> = [];
  const placement = order.placementConfig as Record<string, any> | null;
  const productId = order.productId;

  if (placement?.isComposited && order.treeImageUrl) {
    const compositedUrl = getPublicFileUrl(order.treeImageUrl, baseUrl);
    const resolvedType = resolvePrintfulType(placement?.treePlacement || "front", productId);
    files.push({
      type: resolvedType,
      url: compositedUrl,
    });
    return files;
  }

  if (order.treeImageUrl) {
    const treeUrl = getPublicFileUrl(order.treeImageUrl, baseUrl);
    const resolvedType = resolvePrintfulType(placement?.treePlacement || "front", productId);
    files.push({
      type: resolvedType,
      url: treeUrl,
    });
  }

  if (placement?.qrPlacement && placement?.qrProfileUrl) {
    const qrObjectPath = await generateAndUploadQR(placement.qrProfileUrl);
    const qrUrl = getPublicFileUrl(qrObjectPath, baseUrl);
    const resolvedType = resolvePrintfulType(placement.qrPlacement, productId);
    files.push({
      type: resolvedType,
      url: qrUrl,
    });
  }

  if (placement?.customImageUrl) {
    const customImageUrl = getPublicFileUrl(placement.customImageUrl, baseUrl);
    const resolvedType = resolvePrintfulType(placement?.customImagePlacement || "front", productId);
    files.push({
      type: resolvedType,
      url: customImageUrl,
    });
  }

  if (placement?.customText) {
    const textObjectPath = await renderTextToImage(placement.customText);
    const textUrl = getPublicFileUrl(textObjectPath, baseUrl);
    const resolvedType = resolvePrintfulType(placement?.customTextPlacement || "front", productId);
    files.push({
      type: resolvedType,
      url: textUrl,
    });
  }

  if (files.length === 0 && order.treeImageUrl) {
    files.push({
      type: "default",
      url: getPublicFileUrl(order.treeImageUrl, baseUrl),
    });
  }

  return files;
}

export async function sendOrderFailureEmail(order: any, userId: string, errorMessage: string) {
  try {
    const user = await storage.getUser(userId);
    if (!user?.email) return;

    const { sendEmail } = await import("./lib/email");
    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    const shippingAddr = order.shippingAddress as any;
    const totalDisplay = ((order.totalAmount || 0) / 100).toFixed(2);

    const failureHtml = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Order Issue</h1>
          <p style="color: #fecaca; margin: 8px 0 0; font-size: 14px;">There was a problem with your FamilyRoots merchandise order</p>
        </div>
        <div style="padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
          <p style="margin: 0 0 16px; color: #374151; font-size: 14px;">Hi ${user.firstName || "there"},</p>
          <p style="margin: 0 0 20px; color: #374151; font-size: 14px;">Unfortunately, we ran into a problem submitting your order to our print partner. Don't worry — your payment has not been charged, and you can retry the order from your orders page.</p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 8px; color: #991b1b; font-size: 14px;">What happened</h3>
            <p style="margin: 0; color: #7f1d1d; font-size: 13px;">${errorMessage}</p>
          </div>
          <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 12px; color: #111827; font-size: 16px;">Order Details</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 4px 0; color: #6b7280;">Order ID</td><td style="padding: 4px 0; text-align: right; color: #111827; font-weight: 500;">${order.id.slice(0, 8).toUpperCase()}</td></tr>
              <tr><td style="padding: 4px 0; color: #6b7280;">Item</td><td style="padding: 4px 0; text-align: right; color: #111827;">${order.productName}${order.variantName ? ` - ${order.variantName}` : ""}</td></tr>
              <tr><td style="padding: 4px 0; color: #6b7280;">Quantity</td><td style="padding: 4px 0; text-align: right; color: #111827;">${order.quantity}</td></tr>
              <tr><td style="padding: 4px 0; color: #6b7280;">Total</td><td style="padding: 4px 0; text-align: right; color: #111827; font-weight: 600;">$${totalDisplay}</td></tr>
            </table>
          </div>
          ${shippingAddr ? `
          <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 8px; color: #111827; font-size: 16px;">Shipping To</h3>
            <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">
              ${shippingAddr.name || ""}<br>
              ${shippingAddr.address1 || ""}${shippingAddr.address2 ? `<br>${shippingAddr.address2}` : ""}<br>
              ${shippingAddr.city || ""}, ${shippingAddr.stateCode || shippingAddr.state_code || ""} ${shippingAddr.zip || ""}<br>
              ${shippingAddr.countryCode || shippingAddr.country_code || ""}
            </p>
          </div>` : ""}
          <p style="margin: 0 0 16px; color: #374151; font-size: 14px;">You can retry your order from the orders page. If the problem continues, please reach out and we'll help get it sorted.</p>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${baseUrl}/merchandise?tab=orders" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">View Your Orders</a>
          </div>
        </div>
        <div style="padding: 16px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">FamilyRoots — Connecting families, preserving legacies</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: user.email,
      subject: `Order Issue: ${order.productName} - #${order.id.slice(0, 8).toUpperCase()}`,
      html: failureHtml,
    });
    console.log(`[merchandise] Failure notification email sent to ${user.email} for order ${order.id}`);
  } catch (emailError) {
    console.error("[merchandise] Failed to send failure notification email:", emailError);
  }
}

export async function sendOrderConfirmationEmail(order: any, userId: string) {
  try {
    const user = await storage.getUser(userId);
    if (!user?.email) return;

    const { sendEmail } = await import("./lib/email");
    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    const shippingAddr = order.shippingAddress as any;
    const orderDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const subtotalDisplay = ((order.subtotal || 0) / 100).toFixed(2);
    const shippingDisplay = ((order.shippingCost || 0) / 100).toFixed(2);
    const taxDisplay = ((order.taxAmount || 0) / 100).toFixed(2);
    const totalDisplay = ((order.totalAmount || 0) / 100).toFixed(2);

    const confirmationHtml = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Order Confirmed!</h1>
          <p style="color: #e0e7ff; margin: 8px 0 0; font-size: 14px;">Thank you for your FamilyRoots merchandise order</p>
        </div>
        <div style="padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
          <p style="margin: 0 0 16px; color: #374151; font-size: 14px;">Hi ${user.firstName || "there"},</p>
          <p style="margin: 0 0 20px; color: #374151; font-size: 14px;">Your order has been placed successfully and is being prepared. Here are your order details:</p>
          <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 12px; color: #111827; font-size: 16px;">Order Summary</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 4px 0; color: #6b7280;">Order ID</td><td style="padding: 4px 0; text-align: right; color: #111827; font-weight: 500;">${order.id.slice(0, 8).toUpperCase()}</td></tr>
              <tr><td style="padding: 4px 0; color: #6b7280;">Date</td><td style="padding: 4px 0; text-align: right; color: #111827;">${orderDate}</td></tr>
              <tr><td style="padding: 4px 0; color: #6b7280;">Item</td><td style="padding: 4px 0; text-align: right; color: #111827;">${order.productName}${order.variantName ? ` - ${order.variantName}` : ""}</td></tr>
              <tr><td style="padding: 4px 0; color: #6b7280;">Quantity</td><td style="padding: 4px 0; text-align: right; color: #111827;">${order.quantity}</td></tr>
              <tr><td colspan="2" style="padding: 8px 0 4px;"><hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;"></td></tr>
              <tr><td style="padding: 4px 0; color: #6b7280;">Subtotal</td><td style="padding: 4px 0; text-align: right; color: #111827;">$${subtotalDisplay}</td></tr>
              <tr><td style="padding: 4px 0; color: #6b7280;">Shipping</td><td style="padding: 4px 0; text-align: right; color: #111827;">$${shippingDisplay}</td></tr>
              <tr><td style="padding: 4px 0; color: #6b7280;">Tax</td><td style="padding: 4px 0; text-align: right; color: #111827;">$${taxDisplay}</td></tr>
              <tr><td colspan="2" style="padding: 8px 0 4px;"><hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;"></td></tr>
              <tr><td style="padding: 4px 0; color: #111827; font-weight: 600;">Total</td><td style="padding: 4px 0; text-align: right; color: #111827; font-weight: 600;">$${totalDisplay}</td></tr>
            </table>
          </div>
          ${shippingAddr ? `
          <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 8px; color: #111827; font-size: 16px;">Shipping To</h3>
            <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">
              ${shippingAddr.name || ""}<br>
              ${shippingAddr.address1 || ""}${shippingAddr.address2 ? `<br>${shippingAddr.address2}` : ""}<br>
              ${shippingAddr.city || ""}, ${shippingAddr.stateCode || shippingAddr.state_code || ""} ${shippingAddr.zip || ""}<br>
              ${shippingAddr.countryCode || shippingAddr.country_code || ""}
            </p>
          </div>` : ""}
          <p style="margin: 0 0 16px; color: #374151; font-size: 14px;">Your order is now being produced and typically ships within 3-7 business days. You'll receive a tracking notification once it ships.</p>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${baseUrl}/merchandise?tab=orders" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">View Your Orders</a>
          </div>
        </div>
        <div style="padding: 16px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">FamilyRoots — Connecting families, preserving legacies</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: user.email,
      subject: `Order Confirmed: ${order.productName} - #${order.id.slice(0, 8).toUpperCase()}`,
      html: confirmationHtml,
    });
    console.log(`[merchandise] Confirmation email sent to ${user.email} for order ${order.id}`);
  } catch (emailError) {
    console.error("[merchandise] Failed to send confirmation email:", emailError);
  }
}
