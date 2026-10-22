// ============================================================
// "Which venue is this, and in which part of Bengaluru?" → venue, locality, city.
// ------------------------------------------------------------
// One free-text box, and owners put anything in it: a venue name ("Harmony
// Banquets"), a locality ("jp nagar", "Hbr"), a town that is not Bengaluru at
// all ("Raichur. Lingasgur taluk", "it's in mysore"), or a message ("Call us",
// "Want to be partner"). The BD lead page shows the property name as its
// headline and files the lead under a city, so each answer is read as:
//
//   1. a town/city we know            → city = that town (never "Bengaluru")
//   2. a Bengaluru locality we know   → locality = canonical spelling
//   3. venue words or a proper name   → propertyName = the answer, place stripped
//   4. anything else                  → propertyName "Venue not named"
//
// Dictionaries are built from the answers actually received (Oct 2026) and
// are spelling-tolerant. Pure.
// ============================================================

export interface VenueReading {
  propertyName: string;
  /** No venue name could be read; the placeholder is in propertyName. */
  nameIsPlaceholder: boolean;
  locality: string;
  /** No locality could be read; "Not given" is in locality. */
  localityIsPlaceholder: boolean;
  city: string;
  /** The city came from the answer, not from which form it was. */
  cityFromAnswer: boolean;
}

export const VENUE_NOT_NAMED = "Venue not named";
export const LOCALITY_NOT_GIVEN = "Not given";
export const OUTSIDE_BENGALURU = "Outside Bengaluru";

/** Bengaluru localities: [pattern, canonical name]. Longer / more specific first. */
const BENGALURU_LOCALITIES: [RegExp, string][] = [
  [/kanak[a]?pura\s*(main\s*)?road/i, "Kanakapura Road"],
  [/mysore\s*road|mysuru\s*road/i, "Mysore Road"],
  [/magadi\s*road/i, "Magadi Road"],
  [/bannergh?at+a\s*road|bannergatta/i, "Bannerghatta Road"],
  [/sarjap[uo]+ra?\s*road/i, "Sarjapur Road"],
  [/thanisandra|tanisandra/i, "Thanisandra"],
  [/hbr\s*layout|\bhbr\b/i, "HBR Layout"],
  [/hsr\s*layout|\bhsr\b/i, "HSR Layout"],
  [/mahalakshmi\s*layout/i, "Mahalakshmi Layout"],
  [/smv\s*layout/i, "SMV Layout"],
  [/electronic\s*city|\be[-\s]?city\b/i, "Electronic City"],
  [/nagar[a]?bh?avi/i, "Nagarbhavi"],
  [/jp\s*nagar/i, "JP Nagar"],
  [/kalyan\s*nagar/i, "Kalyan Nagar"],
  [/vijay[a]?nagar\b/i, "Vijayanagar"],
  [/ban[a]?shankari/i, "Banashankari"],
  [/koramangala/i, "Koramangala"],
  [/indira\s*nagar/i, "Indiranagar"],
  [/whitefield/i, "Whitefield"],
  [/hebbal/i, "Hebbal"],
  [/hennur[u]?/i, "Hennur"],
  [/hor[a]?mavu/i, "Horamavu"],
  [/\bkr\s*puram|k\.\s*r\.\s*puram/i, "KR Puram"],
  [/yelahanka/i, "Yelahanka"],
  [/bellandur/i, "Bellandur"],
  [/hosa\s*road/i, "Hosa Road"],
  [/jigani/i, "Jigani"],
  [/harohalli/i, "Harohalli"],
  [/kengeri/i, "Kengeri"],
  [/peenya/i, "Peenya"],
  [/majestic/i, "Majestic"],
  [/\bcbd\b/i, "CBD"],
  [/cunningham\s*road/i, "Cunningham Road"],
  [/wilson\s*garden/i, "Wilson Garden"],
  [/nandi\s*hills/i, "Nandi Hills"],
  [/devanahalli/i, "Devanahalli"],
  [/dodd[a]?ballapur/i, "Doddaballapur"],
  [/nelamangala/i, "Nelamangala"],
  [/ramanagar[a]?/i, "Ramanagara"],
  [/budigere/i, "Budigere Cross"],
  [/abbigere/i, "Abbigere"],
  [/anjanapura/i, "Anjanapura"],
  [/varthur/i, "Varthur"],
  [/palace\s*ground/i, "Palace Grounds"],
  [/thammana\s*halli|thammanahalli/i, "Thammanahalli"],
  [/nimbekayipura/i, "Nimbekayipura"],
  [/channanayakanapalya/i, "Channanayakanapalya"],
  [/kolur|ramohalli/i, "Ramohalli"],
  [/dabaspete/i, "Dabaspete"],
  [/sarjap[uo]+ra?/i, "Sarjapur"],
  [/near\s+(the\s+)?airport|\bairport\b/i, "Near the airport"],
  [/north\s*(bangalore|bengaluru)|\bnorth\b/i, "North Bengaluru"],
  [/south\s*(bangalore|bengaluru)|\bsouth\b/i, "South Bengaluru"],
  [/east\s*(bangalore|bengaluru)|\beast\b/i, "East Bengaluru"],
  [/west\s*(bangalore|bengaluru)|\bwest\b/i, "West Bengaluru"],
];

/** Towns and cities that are NOT Bengaluru: [pattern, canonical name]. */
const OTHER_TOWNS: [RegExp, string][] = [
  [/mysuru|mysore(?!\s*road)/i, "Mysuru"],
  [/hubli|hubballi|dharwad/i, "Hubballi"],
  [/mangalore|mangaluru/i, "Mangaluru"],
  [/tumkur|tumakuru|kunigal|\bsira\b/i, "Tumakuru"],
  [/\bkgf\b|kolar/i, "Kolar"],
  [/hassan/i, "Hassan"],
  [/chintamani|chikkaballapur/i, "Chikkaballapur"],
  [/hosur|krishnagiri|shoolagiri/i, "Hosur"],
  [/tiruvannamalai/i, "Tiruvannamalai"],
  [/coimbatore/i, "Coimbatore"],
  [/chennai/i, "Chennai"],
  [/hyderabad/i, "Hyderabad"],
  [/raichur|lingas[u]?gur/i, "Raichur"],
  [/bagalkot|ilkal/i, "Bagalkot"],
  [/gadag/i, "Gadag"],
  [/gulbarga|kalaburagi/i, "Kalaburagi"],
  [/haveri/i, "Haveri"],
  [/hiriyur|chitradurga/i, "Chitradurga"],
  [/bijapur|vijayapura/i, "Vijayapura"],
  [/kotturu|vijayanagara\s*d/i, "Vijayanagara"],
  [/mantralaya|adoni|kurnool/i, "Kurnool"],
  [/nellore/i, "Nellore"],
  [/palvancha|kothagudem/i, "Kothagudem"],
  [/mylavaram|vijayawada|kanuru|panja\s*cent|ayodhya\s*nagar|100\s*feet/i, "Vijayawada"],
  [/tadepalligudem/i, "Tadepalligudem"],
  [/tadepalli/i, "Guntur"],
  [/chebrole|guntur/i, "Guntur"],
  [/kasargod|kasaragod|kerala/i, "Kasaragod"],
  [/\bgoa\b/i, "Goa"],
  [/yercaud|salem/i, "Salem"],
  [/vaniyambadi/i, "Vaniyambadi"],
  [/sakleshpur|सकलेशपुर|ಸಕಲೇಶಪುರ/i, "Sakleshpur"],
  [/channapatna|channpatna/i, "Channapatna"],
  [/mandya/i, "Mandya"],
  [/kanakapura\b(?!\s*(main\s*)?road)/i, "Kanakapura"],
];

/** Words that make an answer read as a venue name. */
const VENUE_WORDS =
  /\b(resorts?|halls?|banquets?|lawns?|gardens?|convention|palace|grand|greens?|events?|farms?|farm\s*house|villas?|inn|hotel|residency|choultry|mantapa|mandapam?|maha+l|meadows|woods|courtyard|retreats?|party\s*hall|arena|prestige|club|pickleball|venue|camp|estate|kalyana|function\s*hall)\b/i;

/** A whole answer that is just a generic word, not a name. */
const GENERIC_ONLY =
  /^(new\s+venue|resorts?|halls?|venue|corporate\s+events?|events?|farms?|lawns?|gardens?|(banquet|marriage|convention|party|function|kalyana)\s*(hall|mantapa|centre|center)?|restaurant|hotels?|villas?|inn|club|camp|estate|palace|courtyard|meadows|woods)$/i;

/** An answer that is a message to us, not a place. */
const MESSAGE =
  /\b(call|contact|discuss|estimate|consult(ing)?|explore|partner|services?|planning|looking|want|need|anything|location|not\s*yet|already|setup|set\s*up|open|birthday|hi|hello|hai|yes|no|ok|sir|iam|i\s*am|decoration|opportunit|possible|home\s*town|other\s*states)\b/i;

const CITY_WORDS = /\b(bangalore|bengaluru|bangalor|banglore)\b/gi;
const FILLER =
  /\b(it'?s\s+in|its\s+in|this\s+is\s+in|we\s+are\s+in|located\s+(in|at)|property\s+located\s+at|venue\s+is\s+near|near|in|at|the|is|its|it'?s|of|and|dt|district|taluk|karnataka|ap|tamil\s*nadu|telangana|kerala|main\s*road|road|area|city|north|south|east|west|km|kms|far|from|not|no|&|cross|highway|toll|towards|side|phase|junction|sh|nh|dist|district)\b/gi;

const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const letters = (s: string) => s.replace(/[^A-Za-zऀ-೿]/g, "");

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s\-&(])([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase());
}

function isJunk(text: string): boolean {
  const t = text.trim();
  if (letters(t).length <= 2) return true;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^(aa|abc|gg|hi+|hello|hai|yes|no|ok)\b/i.test(t) && t.split(/\s+/).length <= 2) return true;
  if (GENERIC_ONLY.test(t)) return true;
  return false;
}

/** What is left of the answer once the place words, city words and filler are gone. */
function residual(raw: string, matches: RegExp[]): string {
  let r = raw.replace(/https?:\/\/\S+/gi, "");
  for (const re of matches) r = r.replace(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"), " ");
  r = r.replace(CITY_WORDS, " ").replace(FILLER, " ").replace(/[\d.,()'’"\-#:/]+/g, " ");
  // One-letter tokens and the bare word "venue" are noise here.
  return squash(r)
    .split(" ")
    .filter((w) => letters(w).length >= 2 && !/^venues?$/i.test(w))
    .join(" ");
}

/** The owner's venue name: filler and the trailing place stripped, casing tidied. */
function cleanVenueName(raw: string, placeMatches: RegExp[]): string {
  let t = raw
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[✨️]/g, "")
    .replace(/^\s*(we\s+are\s+a\s+\w+\s+venue\s+called|called|it'?s\s+in|its\s+in|this\s+is\s+in|property\s+located\s+at|venue\s+is\s+near|located\s+(in|at)|in)\s+/i, "")
    .replace(/\s*\b(it'?s\s+in|its\s+in|located\s+(in|at)|on|behind|near|we\s+are|with)\b\s*.*$/i, (m) => (VENUE_WORDS.test(m) && !/^\s*(on|behind|near|with)\b/i.test(m) ? m : ""))
    .replace(/[.,].*$/, "")
    .trim();
  // Strip a place that ends the name: "Sri Lakshmi Gardens, Yelahanka",
  // "Ivaana nature resort mysuru", "Siddhartha Convention Center HSR Layout Bengaluru".
  for (let i = 0; i < 3; i++) {
    const before = t;
    // A trailing pincode or a direction is the place, not the name.
    t = t.replace(/\s+\d{6}\s*$/g, "").replace(/\s+(north|south|east|west)\s*$/i, "");
    t = t.replace(new RegExp(`[\\s,]*\\b(${["bangalore", "bengaluru", "banglore", "district", "dt", "karnataka", "ap"].join("|")})\\b[\\s.,]*$`, "i"), "");
    for (const re of placeMatches) {
      const tail = new RegExp(`[\\s,]*(in\\s+|near\\s+)?(?:${re.source})[\\s.,]*$`, "i");
      const stripped = t.replace(tail, "");
      if (stripped !== t && letters(stripped).length >= 3 && VENUE_WORDS.test(stripped)) t = stripped;
    }
    if (t === before) break;
  }
  t = squash(t.replace(/[.\s,]+$/g, ""));
  // "villa with 25000 sqft land", "Resort with 5 1.5 accar": a description.
  if (/(^|\s)\d+(\.\d+)?(\s|$)/.test(t)) return "";
  // "North", "In", "Bangalore": nothing but place words and filler left.
  if (letters(t.replace(CITY_WORDS, " ").replace(FILLER, " ")).length < 3) return "";
  if (t === t.toUpperCase() || t === t.toLowerCase()) t = titleCase(t);
  return t.slice(0, 200);
}

export function readVenueAnswer(text: string | null | undefined, formCity: string): VenueReading {
  const raw = squash(text ?? "");
  const base: VenueReading = {
    propertyName: VENUE_NOT_NAMED,
    nameIsPlaceholder: true,
    locality: LOCALITY_NOT_GIVEN,
    localityIsPlaceholder: true,
    city: formCity,
    cityFromAnswer: false,
  };
  if (!raw || isJunk(raw)) return base;

  const town = OTHER_TOWNS.find(([re]) => re.test(raw));
  const locs = BENGALURU_LOCALITIES.filter(([re]) => re.test(raw));
  const loc = locs[0];
  const mentionsBengaluru = CITY_WORDS.test(raw);
  CITY_WORDS.lastIndex = 0;
  const saysOutside = /not\s+(in\s+)?(bangalore|bengaluru|bangalor)|apart\s+from\s+(bangalore|bengaluru)|km(s)?\s+(far\s+)?from\s+(bang|bengaluru|electronic)/i.test(raw);

  let city = formCity;
  let cityFromAnswer = false;
  let locality = LOCALITY_NOT_GIVEN;
  let localityIsPlaceholder = true;
  const placeMatches: RegExp[] = [];

  // A road inside Bengaluru ("Mysore Road") beats the town of the same name,
  // unless the answer measures its distance from Bengaluru.
  const townWins = town && (!loc || !/road/i.test(loc[1]) || /\d+\s*km/i.test(raw));
  if (townWins && town) {
    city = town[1];
    cityFromAnswer = true;
    locality = town[1];
    localityIsPlaceholder = false;
    placeMatches.push(town[0]);
    for (const [re, name] of locs) if (!/road/i.test(name)) placeMatches.push(re);
  } else if (loc) {
    city = formCity === "Bengaluru" || mentionsBengaluru ? "Bengaluru" : formCity;
    cityFromAnswer = mentionsBengaluru;
    locality = loc[1];
    localityIsPlaceholder = false;
    for (const [re] of locs) placeMatches.push(re);
  } else if (saysOutside) {
    city = OUTSIDE_BENGALURU;
    cityFromAnswer = true;
  } else if (mentionsBengaluru) {
    city = "Bengaluru";
    cityFromAnswer = true;
  }

  // A venue name: venue words, or a short proper name, once the place is set aside.
  const hasVenueWords = VENUE_WORDS.test(raw.replace(/venue\s+is\s+near|we\s+are\s+a\s+\w+\s+venue\s+called/i, ""));
  // "near art of living", "near jaydeva hospital": a landmark, not the venue.
  const rest = residual(hasVenueWords ? raw : raw.replace(/\bnear\b.*$/i, ""), placeMatches);
  const looksLikeMessage = MESSAGE.test(raw) && !hasVenueWords;
  const restTokens = rest.split(" ").filter(Boolean);
  const restWords = restTokens.length;
  // "NYE", "SH 33", "6stg": nothing of substance unless some token has 4+ letters.
  const hasSubstance = restTokens.some((w) => letters(w).length >= 4);
  const rawWords = raw.split(/\s+/).length;
  // "10 kms from Krishnagiri toll…", "50 Kms from Electronic city": directions, not a venue.
  const isDistance = /\d+\s*(km|kms|kilomet)/i.test(raw);
  // Next to a known place, one leftover word is a finer place ("Budigere Cross",
  // "Huliyurdurga Kunigal Tumkur"), not a name; a sentence without venue words
  // is a description ("It is located near Orion uptown mall and half hector…").
  const shortProperName =
    !hasVenueWords && restWords >= (placeMatches.length ? 2 : 1) && restWords <= 4 && rawWords <= 8 && !/\d/.test(rest);
  const candidate = hasSubstance && !looksLikeMessage && !isDistance && (hasVenueWords || shortProperName);

  let propertyName = VENUE_NOT_NAMED;
  let nameIsPlaceholder = true;
  if (candidate) {
    const name = cleanVenueName(raw, placeMatches);
    if (letters(name).length >= 3 && !isJunk(name) && !GENERIC_ONLY.test(name)) {
      propertyName = name;
      nameIsPlaceholder = false;
    }
  }

  return { propertyName, nameIsPlaceholder, locality, localityIsPlaceholder, city, cityFromAnswer };
}
