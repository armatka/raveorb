import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyElectronicEvent, ELECTRONIC_DISCOVERY_THRESHOLD } from "../src/services/electronicClassification.js";

const genreCases: Array<[string, string, string]> = [
  ["Tech House", "Tech House", "Tech House"],
  ["House", "House", "House"],
  ["Deep House", "Deep House", "Deep House"],
  ["Techno", "Techno", "Techno"],
  ["Hard Techno", "Hard Techno", "Hard Techno"],
  ["Melodic House & Techno", "Melodic House & Techno", "Melodic House & Techno"],
  ["Trance", "Trance", "Trance"],
  ["Drum & Bass", "Drum & Bass", "Drum & Bass"],
  ["DnB abbreviation", "DnB", "Drum & Bass"],
  ["D&B abbreviation", "D&B", "Drum & Bass"],
  ["Dubstep", "Dubstep", "Dubstep / Bass"],
  ["generic Dance/Electronic", "Dance/Electronic", "Electronic"],
];

for (const [label, subgenre, expectedCategory] of genreCases) {
  test(`classifies ${label}`, () => {
    const result = classifyElectronicEvent({ title: "Night Event", subgenre });
    assert.equal(result.category, expectedCategory);
    assert.equal(result.isElectronic, true);
    assert.ok(result.electronicScore >= ELECTRONIC_DISCOVERY_THRESHOLD);
    assert.ok(result.matchedTerms.length > 0);
    assert.ok(result.classificationReasons.length > 0);
  });
}

test("keeps generic Dance/Electronic evidence at a moderate score", () => {
  const result = classifyElectronicEvent({
    title: "Night Event",
    classifications: [{ segment: { name: "Music" }, genre: { name: "Dance/Electronic" } }],
  });
  assert.equal(result.category, "Electronic");
  assert.equal(result.electronicScore, 70);
  assert.equal(result.isElectronic, true);

  const duplicatedProviderFields = classifyElectronicEvent({
    title: "Night Event",
    genre: "Dance/Electronic",
    subgenre: "Dance/Electronic",
    classifications: [{ genre: { name: "Dance/Electronic" }, subGenre: { name: "Dance/Electronic" } }],
  });
  assert.equal(duplicatedProviderFields.electronicScore, 70);
  assert.equal(duplicatedProviderFields.classificationReasons.includes("Electronic evidence corroborated across fields"), false);
});

test("detects electronic and non-electronic festivals without inferring from lineup size", () => {
  const electronicFestival = classifyElectronicEvent({
    title: "Night Fields",
    classifications: [{ genre: { name: "Techno" }, type: { name: "Festival" } }],
  });
  assert.equal(electronicFestival.category, "Techno");
  assert.equal(electronicFestival.isElectronic, true);
  assert.equal(electronicFestival.isFestival, true);

  const nonElectronicFestival = classifyElectronicEvent({
    title: "Summer Arts Festival",
    classifications: [{ genre: { name: "Rock" }, type: { name: "Festival" } }],
    artists: ["One", "Two", "Three", "Four"],
  });
  assert.equal(nonElectronicFestival.category, "Festival");
  assert.equal(nonElectronicFestival.isElectronic, false);
  assert.equal(nonElectronicFestival.isFestival, true);

  const multiArtistShow = classifyElectronicEvent({
    title: "Late Night Showcase",
    artists: ["One", "Two", "Three", "Four"],
  });
  assert.equal(multiArtistShow.isFestival, false);
});

test("uses specific categories ahead of generic categories regardless of field order", () => {
  const techHouse = classifyElectronicEvent({ title: "After Dark", genre: "House", subgenre: "Tech House" });
  assert.equal(techHouse.category, "Tech House");

  const hardTechno = classifyElectronicEvent({ title: "After Dark", genre: "Techno", subgenre: "Hard Techno" });
  assert.equal(hardTechno.category, "Hard Techno");

  const titleSpecific = classifyElectronicEvent({ title: "Tech House After Dark", genre: "House" });
  assert.equal(titleSpecific.category, "Tech House");

  const technoOverHouse = classifyElectronicEvent({ title: "After Dark", genre: "House", subgenre: "Techno" });
  assert.equal(technoOverHouse.category, "Techno");
});

test("explicit Rock and Pop classifications are negative absent stronger electronic evidence", () => {
  for (const genre of ["Rock", "Pop"]) {
    const result = classifyElectronicEvent({ title: "House of Cards", genre });
    assert.equal(result.isElectronic, false);
    assert.equal(result.category, "Other");
    assert.ok(result.electronicScore < ELECTRONIC_DISCOVERY_THRESHOLD);
    assert.ok(result.classificationReasons.some((reason) => reason.includes(`Non-electronic classification: ${genre.toLocaleLowerCase()}`)));
  }

  const explicitTechno = classifyElectronicEvent({ title: "After Dark", genre: "Techno", classifications: [{ genre: { name: "Rock" } }] });
  assert.equal(explicitTechno.category, "Techno");
  assert.equal(explicitTechno.isElectronic, true);

  const explicitHouse = classifyElectronicEvent({ title: "House of Cards", genre: "House", classifications: [{ genre: { name: "Pop" } }] });
  assert.equal(explicitHouse.category, "House");
  assert.equal(explicitHouse.isElectronic, true);
});

test("rejects partial-word matches and leaves ambiguous events below threshold", () => {
  const warehouse = classifyElectronicEvent({ title: "Warehouse Theatre", venueName: "Warehouse Hall" });
  assert.equal(warehouse.isElectronic, false);
  assert.equal(warehouse.category, "Other");

  const ambiguous = classifyElectronicEvent({ title: "Midnight Gathering", description: "A multi-artist live event with several performers." });
  assert.equal(ambiguous.isElectronic, false);
  assert.equal(ambiguous.isFestival, false);
  assert.equal(ambiguous.category, "Other");

  const titleOnlyHouse = classifyElectronicEvent({ title: "House of Cards" });
  assert.equal(titleOnlyHouse.isElectronic, false);
  assert.ok(titleOnlyHouse.electronicScore < ELECTRONIC_DISCOVERY_THRESHOLD);
});

test("keeps artist and festival names from falsely classifying events as electronic", () => {
  const artistOnly = classifyElectronicEvent({ title: "Live Show", artists: ["House of Pain"] });
  assert.equal(artistOnly.isElectronic, false);

  const festivalTitle = classifyElectronicEvent({ title: "Electric Fields Festival" });
  assert.equal(festivalTitle.isFestival, true);
  assert.equal(festivalTitle.isElectronic, false);
});

test("strong Techno title evidence overrides a Rock genre", () => {
  const result = classifyElectronicEvent({ title: "Techno Tuesdays", genre: "Rock" });
  // The specific Techno title match is strong enough to outweigh the Rock classification.
  assert.equal(result.isElectronic, true);
  assert.equal(result.category, "Techno");
});

test("normalizes punctuation and word boundaries before matching", () => {
  const melodic = classifyElectronicEvent({ title: "Event", subgenre: "  MELODIC house / TECHNO  " });
  assert.equal(melodic.category, "Melodic House & Techno");

  const nearMatch = classifyElectronicEvent({ title: "Technoid showcase", venueName: "Clubhouse" });
  assert.equal(nearMatch.isElectronic, false);
});