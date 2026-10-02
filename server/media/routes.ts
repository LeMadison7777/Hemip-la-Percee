import express, { type Express } from "express";
import path from "node:path";

const maxAge = "1d";

export function registerPublicMediaRoutes(app: Express): void {
  const projectRoot = path.resolve(process.cwd());

  // These public assets ship with the application image, so all replicas serve
  // the same immutable source without a preview-platform storage proxy.
  app.use(
    "/media/video-thumbnails",
    express.static(path.join(projectRoot, "assets", "youtube-thumbnails"), {
      fallthrough: false,
      index: false,
      maxAge,
    }),
  );
  app.use(
    "/media",
    express.static(path.join(projectRoot, "offline-media"), {
      fallthrough: false,
      index: false,
      maxAge,
    }),
  );
}
