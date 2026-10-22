import { describe, it, expect } from "vitest";
import { LOCALITY_NOT_GIVEN, VENUE_NOT_NAMED, readVenueAnswer } from "./owner-venue";

// Answers are the shapes actually received on the Bengaluru / Guntur /
// Vijayawada owner forms in Oct 2026 (venue text only, no people).
const B = "Bengaluru";

describe("readVenueAnswer — venue names", () => {
  it.each([
    ["Harmony Banquets", "Harmony Banquets", LOCALITY_NOT_GIVEN, B],
    ["MANASA BANQUET & LAWNS MAGADI ROAD", "Manasa Banquet & Lawns", "Magadi Road", B],
    ["taj banquet hall HBR LAYOUT", "Taj Banquet Hall", "HBR Layout", B],
    ["Siddhartha Convention Center HSR Layout Bengaluru", "Siddhartha Convention Center", "HSR Layout", B],
    ["Sri Lakshmi Gardens, Yelahanka", "Sri Lakshmi Gardens", "Yelahanka", B],
    ["The Golden Pearl Party Hall Hormavu ✨️", "The Golden Pearl Party Hall", "Horamavu", B],
    ["sree raaga resorts budigere bypass road", "Sree Raaga Resorts Budigere Bypass Road", "Budigere Cross", B],
    ["Kingdom convention Center Tanisandra", "Kingdom convention Center", "Thanisandra", B],
    ["Aayana Greens", "Aayana Greens", LOCALITY_NOT_GIVEN, B],
    ["Pallakki farms", "Pallakki farms", LOCALITY_NOT_GIVEN, B],
    ["PSS Choultry", "PSS Choultry", LOCALITY_NOT_GIVEN, B],
    ["FLORIADE", "Floriade", LOCALITY_NOT_GIVEN, B],
    ["The Urvika", "The Urvika", LOCALITY_NOT_GIVEN, B],
    ["Arena100", "Arena100", LOCALITY_NOT_GIVEN, B],
  ])("%s", (answer, name, locality, city) => {
    const r = readVenueAnswer(answer, B);
    expect(r.propertyName).toBe(name);
    expect(r.nameIsPlaceholder).toBe(false);
    expect(r.locality).toBe(locality);
    expect(r.city).toBe(city);
  });

  it("keeps a venue that is in another town, under that town", () => {
    expect(readVenueAnswer("Ivaana nature resort mysuru", B)).toMatchObject({ propertyName: "Ivaana nature resort", city: "Mysuru", locality: "Mysuru", cityFromAnswer: true });
    expect(readVenueAnswer("Kabir convention hall it's in hassan district", B)).toMatchObject({ propertyName: "Kabir convention hall", city: "Hassan" });
    expect(readVenueAnswer("Sarvam mahaal in coimbatore", B)).toMatchObject({ propertyName: "Sarvam mahaal", city: "Coimbatore" });
    expect(readVenueAnswer("Ayra events and photography Ramanagara", B)).toMatchObject({ city: B, locality: "Ramanagara" });
  });
});

describe("readVenueAnswer — localities and towns only", () => {
  it.each([
    ["jp nagar", "JP Nagar"],
    ["Hbr", "HBR Layout"],
    ["Nagarbhavi", "Nagarbhavi"],
    ["nagarbavi,", "Nagarbhavi"],
    ["It’s in Nagarbhavi", "Nagarbhavi"],
    ["Kanakpura road", "Kanakapura Road"],
    ["kanakapura main road near art of living", "Kanakapura Road"],
    ["Venue is near Mysore Road", "Mysore Road"],
    ["bannergatta road. near jaydeva hospital", "Bannerghatta Road"],
    ["Bangalore banshankari 6stg", "Banashankari"],
    ["Electronic city", "Electronic City"],
    ["Kr Puram", "KR Puram"],
    ["Hennuru", "Hennur"],
    ["Palace ground", "Palace Grounds"],
    ["North Bangalore Near the Airport", "Near the airport"],
    ["north bangalore", "North Bengaluru"],
    ["Doddballapur North Bangalore", "Doddaballapur"],
    ["Ramanagar Bangalore South", "Ramanagara"],
    ["NYE 2027 SARJAPURA", "Sarjapur"],
  ])("%s → %s in Bengaluru", (answer, locality) => {
    const r = readVenueAnswer(answer, B);
    expect(r).toMatchObject({ locality, localityIsPlaceholder: false, city: B, propertyName: VENUE_NOT_NAMED, nameIsPlaceholder: true });
  });

  it.each([
    ["Raichur. Lingasgur taluk", "Raichur"],
    ["it's in mysore", "Mysuru"],
    ["Its in mysuru", "Mysuru"],
    ["No it's not in Bangalore & it's in Hubli", "Hubballi"],
    ["kotturu - 583134 - Vijayanagara dt Karnataka", "Vijayanagara"],
    ["Gulbarga karnataka", "Kalaburagi"],
    ["Property located at Hosur.", "Hosur"],
    ["Chennai", "Chennai"],
    ["Hyderabad", "Hyderabad"],
    ["marriage hall... mangalore", "Mangaluru"],
    ["We are in kerala Kasargod", "Kasaragod"],
    ["Not bangalor eits in goa", "Goa"],
    ["This is in Yercaud", "Salem"],
    ["सकलेशपुर", "Sakleshpur"],
    ["Huliyurdurga Kunigal Tumkur SH 33", "Tumakuru"],
    ["located in KGF kolar", "Kolar"],
    ["mantralaya ap", "Kurnool"],
    ["Adoni AP", "Kurnool"],
    ["near channpatna on Bangalore Mysore road 75kms from Bangalore", "Channapatna"],
  ])("%s → city %s", (answer, city) => {
    const r = readVenueAnswer(answer, B);
    expect(r.city).toBe(city);
    expect(r.cityFromAnswer).toBe(true);
    expect(r.localityIsPlaceholder).toBe(false);
  });

  it("reads the Vijayawada and Guntur forms' areas", () => {
    expect(readVenueAnswer("kanuru", "Vijayawada")).toMatchObject({ city: "Vijayawada", locality: "Vijayawada" });
    expect(readVenueAnswer("Palvancha( Bhadradri Kothagudem)", "Vijayawada")).toMatchObject({ city: "Kothagudem" });
    expect(readVenueAnswer("It’s in Nellore district", "Vijayawada")).toMatchObject({ city: "Nellore" });
    expect(readVenueAnswer("Tadepalligudem", "Vijayawada")).toMatchObject({ city: "Tadepalligudem" });
    expect(readVenueAnswer("chebrole", "Guntur")).toMatchObject({ city: "Guntur" });
  });

  it("'Bangalore' alone sets the city and nothing else", () => {
    expect(readVenueAnswer("Bangalore", B)).toMatchObject({ city: B, cityFromAnswer: true, locality: LOCALITY_NOT_GIVEN, propertyName: VENUE_NOT_NAMED });
  });

  it("'not in Bangalore' with no town is filed as Outside Bengaluru", () => {
    expect(readVenueAnswer("No it’s not in Bangalore", B)).toMatchObject({ city: "Outside Bengaluru", propertyName: VENUE_NOT_NAMED });
    expect(readVenueAnswer("70 km from bang", B)).toMatchObject({ city: "Outside Bengaluru" });
    expect(readVenueAnswer("200km far from bangalore", B)).toMatchObject({ city: "Outside Bengaluru" });
  });
});

describe("readVenueAnswer — messages and junk", () => {
  it.each([
    "Call us",
    "Call me for more details",
    "Give estimate plan",
    "Looking for consulting",
    "Want to be partner",
    "Hi",
    "Yes",
    "yes looking",
    ".",
    "665",
    "aa",
    "ABC",
    "Gg",
    "S",
    "Anything",
    "location",
    "New venue",
    "Not yet named",
    "Planning to start",
    "Already setup",
    "all ready open",
    "Corporate events",
    "birthday party.... Bangalore city",
    "https://maps.app.goo.gl/SFdMvxMJLpRn3mCC6?g_st=ipc",
    "I do have my own land apart from Bangalore is it possible.",
    "Hi Sir.. Iam Akshaya flower Decoration",
    "Resort",
  ])("%s → venue not named", (answer) => {
    const r = readVenueAnswer(answer, B);
    expect(r.propertyName).toBe(VENUE_NOT_NAMED);
    expect(r.nameIsPlaceholder).toBe(true);
  });

  it("a message that names a place still yields the place", () => {
    expect(readVenueAnswer("Please call we can discuss # in South Bangalore", B)).toMatchObject({ locality: "South Bengaluru", propertyName: VENUE_NOT_NAMED });
    expect(readVenueAnswer("birthday party.... Bangalore city", B)).toMatchObject({ city: B });
  });
});
