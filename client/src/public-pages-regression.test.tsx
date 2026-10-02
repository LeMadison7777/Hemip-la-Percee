import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

function componentSource(name: string) {
  const marker = `function ${name}() {`;
  const start = appSource.indexOf(marker);
  if (start < 0) throw new Error(`Missing component: ${name}`);
  const nextFunction = appSource.indexOf("\nfunction ", start + marker.length);
  const end = nextFunction >= 0 ? nextFunction : appSource.length;
  return appSource.slice(start, end);
}

describe("restored public pages", () => {
  it("hides section eyebrows on Formations, Tarifs, FAQ, and Contact", () => {
    for (const name of ["FormationsPage", "TarifsPage", "FaqPage", "ContactPage"]) {
      const source = componentSource(name);
      expect(source, name).toContain("hideKicker");
      expect(source, name).not.toMatch(/className="eyebrow/);
      expect(source, name).not.toContain("DOMAINE 0{");
      expect(source, name).not.toContain("COÛT DE FORMATION");
    }
  });

  it("restores the original home layout while leaving the campus teaser in place", () => {
    const home = componentSource("HomePage");
    const nonCampusMarkup = home.replace(/<section className="home-campus">[\s\S]*?<\/section>/, "");
    expect(nonCampusMarkup).not.toMatch(/className="(?:eyebrow|hero-kicker|partner-label)/);
    expect(home).toContain('className="home-campus"');
    expect(home).toContain("Le savoir ouvre");
  });

  it("keeps the existing campus video component wired to the album route", () => {
    expect(componentSource("AlbumPage")).toContain("<CampusVideos />");
  });

  it("restores the original five-step admissions checklist and payment/material details", () => {
    const admissions = componentSource("AdmissionsPage");
    expect(admissions).toContain("Comment s’inscrire");
    expect(admissions.match(/className="admission-step/g)).toHaveLength(5);
    expect(admissions).toContain("Récupérez le dossier d’inscription");
    expect(admissions).toContain("Réunissez les pièces du dossier");
    expect(admissions).toContain("Copie légalisée du baccalauréat");
    expect(admissions).toContain("50 000");
    expect(admissions).toContain("Kit Génie Logiciel");
    expect(admissions).toContain("Écrire sur WhatsApp");
  });
});
