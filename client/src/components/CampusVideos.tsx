import React, { useState } from "react";
import { Play } from "lucide-react";
import { campusVideos, type CampusVideo } from "../data/videos";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export function getPrivacyEnhancedEmbedUrl(
  videoId: string,
  origin?: string,
): string {
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    throw new Error("Invalid YouTube video ID");
  }

  const url = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
  url.searchParams.set("autoplay", "1");
  url.searchParams.set("playsinline", "1");
  url.searchParams.set("rel", "0");
  url.searchParams.set("hl", "fr");
  if (origin) url.searchParams.set("origin", origin);
  return url.toString();
}

export default function CampusVideos() {
  const [activeVideo, setActiveVideo] = useState<CampusVideo | null>(null);
  const shorts = campusVideos.filter(video => video.format === "Short");
  const films = campusVideos.filter(video => video.format === "Vidéo");
  const featured = campusVideos[0];

  const play = (video: CampusVideo) => setActiveVideo(video);
  const closePlayer = (open: boolean) => {
    if (!open) setActiveVideo(null);
  };

  const renderCard = (video: CampusVideo, index: number) => (
    <article className="campus-video-card" key={video.id}>
      <button
        className="campus-video-poster"
        type="button"
        onClick={() => play(video)}
        aria-label={`Lire ${video.title} dans la PWA`}
      >
        <img
          src={video.thumbnail}
          alt=""
          loading="lazy"
          onError={event => {
            event.currentTarget.style.display = "none";
            event.currentTarget.parentElement?.classList.add("campus-video-poster--failed");
          }}
        />
        <span className="campus-video-play" aria-hidden="true"><Play fill="currentColor" size={18} /></span>
        <span className="campus-video-format">{video.format}</span>
      </button>
      <div className="campus-video-caption">
        <span>{`${String(index).padStart(2, "0")} · ${video.title}`}</span>
        <button type="button" onClick={() => play(video)} aria-label={`Lire ${video.title} dans la PWA`}>
          <Play size={14} fill="currentColor" />
        </button>
      </div>
    </article>
  );

  return (
    <section className="album-video" id="video-hemip">
      <div className="container">
        <div className="album-video-grid">
          <div className="video-copy">
            <span className="album-eyebrow"><i /> LA SUITE EN VIDÉO · {campusVideos.length} CLIPS</span>
            <h2>Le campus<br /><em>en mouvement.</em></h2>
            <p>Regardez les 17 vidéos de la vie HEMIP sans quitter l’application. Le lecteur s’ouvre uniquement lorsque vous choisissez un clip.</p>
            <button className="campus-video-source" type="button" onClick={() => play(featured)}>
              <Play size={14} fill="currentColor" /> Lancer la première vidéo
            </button>
          </div>
          <button
            className="album-video-frame campus-feature-link"
            type="button"
            onClick={() => play(featured)}
            aria-label={`Lire ${featured.title} dans la PWA`}
          >
            <img
              src={featured.thumbnail}
              alt=""
              loading="lazy"
              onError={event => {
                event.currentTarget.style.display = "none";
                event.currentTarget.parentElement?.classList.add("campus-feature-poster--failed");
              }}
            />
            <span className="play-orbit" aria-hidden="true"><Play fill="currentColor" size={21} /></span>
            <strong>{featured.title}</strong>
            <small>Lire dans la PWA</small>
          </button>
        </div>

        <div className="campus-video-list-heading"><div><span className="album-eyebrow"><i /> {shorts.length} VIDÉOS VERTICALES</span><h3>Les Shorts HEMIP</h3></div><span>01 — {String(shorts.length).padStart(2, "0")}</span></div>
        <div className="campus-video-grid campus-video-grid--shorts">{shorts.map((video, index) => renderCard(video, index + 1))}</div>

        <div className="campus-video-list-heading campus-video-list-heading--films"><div><span className="album-eyebrow"><i /> FORMATS CLASSIQUES</span><h3>La vie de l’école</h3></div><span>{String(shorts.length + 1).padStart(2, "0")} — {String(campusVideos.length).padStart(2, "0")}</span></div>
        <div className="campus-video-grid campus-video-grid--films">{films.map((video, index) => renderCard(video, shorts.length + index + 1))}</div>
      </div>

      <Dialog open={activeVideo !== null} onOpenChange={closePlayer}>
        {activeVideo && (
          <DialogContent
            className={`campus-player-dialog ${activeVideo.format === "Short" ? "campus-player-dialog--portrait" : "campus-player-dialog--landscape"}`}
            aria-describedby="campus-player-description"
          >
            <div className="campus-player-heading">
              <DialogTitle>{activeVideo.title}</DialogTitle>
              <DialogDescription id="campus-player-description">
                Lecture intégrée à la PWA HEMIP. La connexion au lecteur YouTube ne démarre qu’après votre clic.
              </DialogDescription>
            </div>
            <div className="campus-player-frame">
              <iframe
                key={activeVideo.id}
                src={getPrivacyEnhancedEmbedUrl(
                  activeVideo.id,
                  typeof window === "undefined" ? undefined : window.location.origin,
                )}
                title={`Lecteur vidéo : ${activeVideo.title}`}
                loading="eager"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <p className="campus-player-note">Certaines vidéos peuvent rester indisponibles si leur propriétaire interdit la lecture intégrée ou si YouTube applique une restriction régionale ou d’âge.</p>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
