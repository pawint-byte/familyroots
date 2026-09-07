import express, { type Express } from "express";
import fs from "fs";
import path from "path";

const HTML_CACHE_CONTROL = "no-store, no-cache, must-revalidate, proxy-revalidate";

function setNoCacheHeaders(res: express.Response) {
  res.setHeader("Cache-Control", HTML_CACHE_CONTROL);
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

export function serveStatic(app: Express, distPath = path.resolve(__dirname, "public")) {
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, {
    fallthrough: true,
    setHeaders: (res, filePath) => {
      const relativePath = path.relative(distPath, filePath).replaceAll(path.sep, "/");

      if (relativePath === "index.html" || relativePath === "sw.js") {
        setNoCacheHeaders(res);
      } else if (/^assets\/.+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(relativePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        res.setHeader("Cache-Control", "public, max-age=3600, must-revalidate");
      }
    },
  }));

  // Missing asset-like URLs must remain 404s. Returning index.html here causes
  // browsers to parse HTML as JavaScript after a deployment.
  app.use("*", (req, res) => {
    const requestPath = new URL(req.originalUrl, "http://localhost").pathname;
    if (path.extname(requestPath)) {
      setNoCacheHeaders(res);
      return res.status(404).type("text/plain").send("Not found");
    }

    setNoCacheHeaders(res);
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
