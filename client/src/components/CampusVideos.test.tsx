import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import CampusVideos, { getPrivacyEnhancedEmbedUrl } from "./CampusVideos";
import { campusVideos } from "../data/videos";

describe("CampusVideos", () => {
  it("lists all 17 supplied videos with unique IDs", () => {
    expect(campusVideos).toHaveLength(17);
    expect(new Set(campusVideos.map(video => video.id)).size).toBe(17);
  });

  it("does not navigate away or load a third-party player before a user chooses a clip", () => {
    const html = renderToStaticMarkup(<CampusVideos />);
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("href=\"https://youtube");
    expect(html).not.toContain("target=\"_blank\"");
    expect(html.match(/class=\"campus-video-poster\"/g)).toHaveLength(17);
    expect(html).toContain("sans quitter l’application");
  });

  it("constructs a privacy-enhanced, inline player URL with a validated video ID", () => {
    const url = new URL(getPrivacyEnhancedEmbedUrl("OzFCYYeiKSk", "https://hemip.example"));
    expect(url.origin).toBe("https://www.youtube-nocookie.com");
    expect(url.pathname).toBe("/embed/OzFCYYeiKSk");
    expect(url.searchParams.get("autoplay")).toBe("1");
    expect(url.searchParams.get("playsinline")).toBe("1");
    expect(url.searchParams.get("origin")).toBe("https://hemip.example");
    expect(() => getPrivacyEnhancedEmbedUrl("not-a-valid-id")).toThrow("Invalid YouTube video ID");
  });
});
