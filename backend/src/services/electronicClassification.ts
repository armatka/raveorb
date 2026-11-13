import type {
  ElectronicClassification,
  RaveOrbCategory,
  TicketmasterClassification,
} from "../types/index.js";

export const ELECTRONIC_DISCOVERY_THRESHOLD = 60;

export type ElectronicEventInput = {
  title: string;
  artists?: string[];
  venueName?: string;
  description?: string;
  segment?: string;
  genre?: string;
  subgenre?: string;
  classifications?: TicketmasterClassification[];
};

type CategoryRule = {
  category: RaveOrbCategory;
  specificity: number;
  terms: string[];
};

type Evidence = {
  category: RaveOrbCategory;
  specificity: number;
  term: string;
  source: string;
  group: string;
  score: number;
};

const categoryRules: CategoryRule[] = [
  { category: "Melodic House & Techno", specificity: 3, terms: ["melodic house and techno", "melodic house techno", "melodic techno", "melodic house"] },
  { category: "Hard Techno", specificity: 3, terms: ["hard techno", "industrial techno"] },
  { category: "Minimal / Deep Tech", specificity: 3, terms: ["minimal deep tech", "minimal techno", "deep tech", "minimal tech"] },
  { category: "Tech House", specificity: 3, terms: ["tech house"] },
  { category: "Deep House", specificity: 3, terms: ["deep house"] },
  { category: "Drum & Bass", specificity: 3, terms: ["drum and bass", "drum n bass", "dnb", "d and b"] },
  { category: "Dubstep / Bass", specificity: 3, terms: ["dubstep", "bass music", "future bass", "bassline"] },
  { category: "Garage", specificity: 3, terms: ["uk garage", "speed garage", "2 step", "two step", "garage"] },
  { category: "Progressive", specificity: 2, terms: ["progressive house", "progressive trance", "progressive"] },
  { category: "Trance", specificity: 2, terms: ["trance"] },
  { category: "Techno", specificity: 2, terms: ["techno"] },
  { category: "House", specificity: 1, terms: ["afro house", "organic house", "house"] },
  { category: "EDM", specificity: 1, terms: ["edm", "electronic dance music"] },
  { category: "Electronic", specificity: 0, terms: ["dance electronic", "electronic"] },
];

const nonElectronicTerms = ["rock", "pop", "country", "comedy", "theatre", "theater", "sports", "sport"];

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function includesTerm(value: string, term: string): boolean {
  const normalizedValue = ` ${normalizeText(value)} `;
  const normalizedTerm = ` ${normalizeText(term)} `;
  return normalizedValue.includes(normalizedTerm);
}

function hasFestivalSignal(event: ElectronicEventInput, classifications: TicketmasterClassification[]): { detected: boolean; reason?: string } {
  if ([...classifications].some((item) => [item.segment?.name, item.genre?.name, item.subGenre?.name, item.type?.name, item.subType?.name].some((name) => name && includesTerm(name, "festival")))) {
    return { detected: true, reason: "Ticketmaster festival classification" };
  }
  if (event.title && includesTerm(event.title, "festival")) return { detected: true, reason: "Festival term in event title" };
  if (event.description && ["music festival", "electronic festival", "festival lineup", "festival stage"].some((term) => includesTerm(event.description ?? "", term))) {
    return { detected: true, reason: "Festival language in event description" };
  }
  return { detected: false };
}

function matchingRules(value: string, source: string, group: string, score: number): Evidence[] {
  const matches: Evidence[] = [];
  for (const rule of categoryRules) {
    const term = rule.terms.find((candidate) => includesTerm(value, candidate));
    if (term) {
      const genericScore = rule.specificity === 0 ? Math.min(score, 70)
        : rule.category === "EDM" ? Math.min(score, 74)
          : rule.category === "House" && (source === "Event title" || source === "Artist or attraction") ? Math.min(score, 55)
            : score;
      matches.push({ category: rule.category, specificity: rule.specificity, term, source, group, score: genericScore });
    }
  }
  return matches;
}

function sortEvidence(first: Evidence, second: Evidence): number {
  return second.specificity - first.specificity || second.score - first.score || first.category.localeCompare(second.category);
}

function hasNonElectronicClassification(event: ElectronicEventInput, classifications: TicketmasterClassification[]): string | undefined {
  const sourceValues = [
    event.segment,
    event.genre,
    event.subgenre,
    ...classifications.flatMap((item) => [item.segment?.name, item.genre?.name, item.subGenre?.name]),
  ].filter((value): value is string => Boolean(value));
  return sourceValues.flatMap((value) => nonElectronicTerms.map((term) => ({ value, term })))
    .find(({ value, term }) => includesTerm(value, term))?.term;
}

export function classifyElectronicEvent(event: ElectronicEventInput): ElectronicClassification {
  const classifications = event.classifications ?? [];
  const evidence: Evidence[] = [];
  const addEvidence = (value: string | undefined, source: string, group: string, score: number) => {
    if (value) evidence.push(...matchingRules(value, source, group, score));
  };

  addEvidence(event.subgenre, "Ticketmaster subgenre", "ticketmaster-subgenre", 96);
  addEvidence(event.genre, "Ticketmaster genre", "ticketmaster-genre", 88);
  addEvidence(event.segment, "Ticketmaster segment", "ticketmaster-segment", 70);
  classifications.forEach((item, index) => {
    addEvidence(item.subGenre?.name, "Ticketmaster subgenre", `classification-${index}-subgenre`, 94);
    addEvidence(item.genre?.name, "Ticketmaster genre", `classification-${index}-genre`, 86);
    addEvidence(item.segment?.name, "Ticketmaster segment", `classification-${index}-segment`, 68);
    addEvidence(item.type?.name, "Ticketmaster type", `classification-${index}-type`, 62);
    addEvidence(item.subType?.name, "Ticketmaster subtype", `classification-${index}-subtype`, 62);
  });
  addEvidence(event.title, "Event title", "title", 82);
  event.artists?.forEach((artist, index) => addEvidence(artist, "Artist or attraction", `artist-${index}`, 80));
  addEvidence(event.description, "Event description", "description", 46);
  addEvidence(event.venueName, "Venue name", "venue", 24);

  const uniqueEvidence = new Map<string, Evidence>();
  for (const item of evidence) {
    const key = `${item.category}|${normalizeText(item.term)}`;
    const current = uniqueEvidence.get(key);
    if (!current || item.score > current.score) uniqueEvidence.set(key, item);
  }
  const deduplicatedEvidence = [...uniqueEvidence.values()];
  const selectedEvidence = deduplicatedEvidence.sort(sortEvidence)[0];
  const festival = hasFestivalSignal(event, classifications);
  const nonElectronicTerm = hasNonElectronicClassification(event, classifications);
  const strongestScore = Math.max(0, ...deduplicatedEvidence.map((item) => item.score));
  const hasStrongSpecificEvidence = deduplicatedEvidence.some((item) => (item.specificity >= 2 && item.score >= 80)
    || (item.specificity >= 1 && item.score >= 84 && (item.source === "Ticketmaster genre" || item.source === "Ticketmaster subgenre")));
  const relevantEvidence = selectedEvidence ? deduplicatedEvidence.filter((item) => item.category === selectedEvidence.category) : [];
  const independentGroups = new Set(relevantEvidence.map((item) => item.group)).size;
  const suppressedByNonElectronicSource = Boolean(nonElectronicTerm && !hasStrongSpecificEvidence);
  let electronicScore = selectedEvidence
    ? Math.min(100, Math.max(selectedEvidence.score, strongestScore) + Math.min(8, Math.max(0, independentGroups - 1) * 4) + (festival.detected ? 3 : 0))
    : festival.detected ? 5 : 0;

  if (nonElectronicTerm && !hasStrongSpecificEvidence) electronicScore = Math.max(0, electronicScore - 55);
  electronicScore = Math.max(0, Math.min(100, Math.round(electronicScore)));

  const matchedTerms = [...new Set([...deduplicatedEvidence].sort((first, second) => second.score - first.score).map((item) => item.term.replace(/\b\w/g, (letter) => letter.toLocaleUpperCase())))];
  const reasons = selectedEvidence
    ? [`${selectedEvidence.source} match: ${selectedEvidence.term}`]
    : [];
  if (relevantEvidence.length > 1) reasons.push("Electronic evidence corroborated across fields");
  if (festival.reason) reasons.push(festival.reason);
  if (nonElectronicTerm) reasons.push(`Non-electronic classification: ${nonElectronicTerm}`);

  const isElectronic = electronicScore >= ELECTRONIC_DISCOVERY_THRESHOLD;
  const category = suppressedByNonElectronicSource
    ? festival.detected ? "Festival" : "Other"
    : selectedEvidence?.category ?? (festival.detected ? "Festival" : "Other");

  return {
    category,
    subgenre: selectedEvidence && !suppressedByNonElectronicSource ? selectedEvidence.term.replace(/\b\w/g, (letter) => letter.toLocaleUpperCase()) : null,
    electronicScore,
    isElectronic,
    matchedTerms,
    classificationReasons: reasons,
    isFestival: festival.detected,
  };
}