import type { RequestHandler } from "express";
import {
  faqCategories,
  FAQ_HEADING,
  FAQ_DESCRIPTION,
  getFaqStructuredData,
  type FAQAnswerPart,
} from "../shared/faq";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderAnswer(parts: FAQAnswerPart[]): string {
  return parts.map((part) => {
    if (typeof part === "string") return escapeHtml(part);
    if ("href" in part) {
      return `<a href="${escapeHtml(part.href)}">${escapeHtml(part.text)}</a>`;
    }
    if (part.tag === "br") return "<br>";
    return `<${part.tag}>${renderAnswer(part.children)}</${part.tag}>`;
  }).join("");
}

// Preserve query parameters while canonicalizing only case variants of /faq.
// Checking the literal path avoids Express's default case-insensitive route loop.
export const redirectFaqCase: RequestHandler = (req, res, next) => {
  const queryStart = req.originalUrl.indexOf("?");
  const pathname = queryStart < 0 ? req.originalUrl : req.originalUrl.slice(0, queryStart);
  if (/^\/faq\/?$/i.test(pathname) && pathname !== pathname.toLowerCase()) {
    const query = queryStart < 0 ? "" : req.originalUrl.slice(queryStart);
    return res.redirect(301, `/faq${query}`);
  }
  next();
};

export function injectFaqHtml(html: string): string {
  const sections = faqCategories.map((category) => `
    <section>
      <h2>${escapeHtml(category.title)}</h2>
      ${category.items.map((item) => `
        <section>
          <h3>${escapeHtml(item.question)}</h3>
          <div data-faq-answer>${renderAnswer(item.answer)}</div>
        </section>`).join("")}
    </section>`).join("");

  const jsonLd = JSON.stringify(getFaqStructuredData())
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");

  // The existing createRoot entry replaces this visible prerender when React
  // mounts. Keeping JSON-LD here also prevents stale FAQ schema on SPA navigation.
  return html.replace(
    /(<div\b[^>]*\bid=["']root["'][^>]*>)\s*(<\/div>)/i,
    (_match, openRoot: string, closeRoot: string) => `${openRoot}<main data-faq-prerender>
      <h1>${escapeHtml(FAQ_HEADING)}</h1>
      <p>${escapeHtml(FAQ_DESCRIPTION)}</p>
      ${sections}
    </main>
    <script type="application/ld+json" data-faq-jsonld>${jsonLd}</script>${closeRoot}`,
  );
}