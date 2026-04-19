import type { Place, Hotel, FoodRecommendation, TransportOption, DayItinerary, BudgetBreakdown } from "@workspace/api-zod";

export interface Coordinates {
  lat: number;
  lon: number;
}

export function getPlaceCountByDays(days: number): number {
  if (days <= 1) return 4;
  if (days === 2) return 6;
  if (days === 3) return 9;
  if (days === 4) return 12;
  return Math.min(days * 3, 20);
}

export async function getCoordinates(location: string): Promise<Coordinates | null> {
  try {
    const query = encodeURIComponent(`${location}, India`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=in`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "TravelPlannerIndia/1.0 (travel-planner@replit.app)",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

interface OverpassElement {
  tags?: {
    name?: string;
    tourism?: string;
    historic?: string;
    leisure?: string;
    "name:en"?: string;
  };
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  type?: string;
}

export async function fetchPlacesFromOverpass(
  lat: number,
  lon: number,
  destination: string,
  maxPlaces: number,
): Promise<Place[]> {
  try {
    const radius = 30000;
    const query = `
      [out:json][timeout:25];
      (
        node["tourism"~"attraction|museum|viewpoint|gallery|theme_park|zoo"](around:${radius},${lat},${lon});
        node["historic"~"monument|castle|ruins|temple|mosque|church|fort|building|archaeological_site"](around:${radius},${lat},${lon});
        node["leisure"~"park|garden|nature_reserve"](around:${radius},${lat},${lon});
        way["tourism"~"attraction|museum|viewpoint"](around:${radius},${lat},${lon});
        way["historic"~"monument|castle|ruins|temple|mosque|church|fort"](around:${radius},${lat},${lon});
      );
      out center ${maxPlaces + 10};
    `;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { elements: OverpassElement[] };
    const elements = data.elements || [];
    const places: Place[] = [];
    const seen = new Set<string>();

    for (const el of elements) {
      const name = el.tags?.["name:en"] || el.tags?.name;
      if (!name || seen.has(name.toLowerCase())) continue;
      if (name.length < 4) continue;
      seen.add(name.toLowerCase());

      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      const cat = el.tags?.tourism || el.tags?.historic || el.tags?.leisure || "attraction";
      const keyword = encodeURIComponent(`${name.replace(/ /g, "+")} ${destination}`);

      places.push({
        name,
        description: getCategoryDescription(cat, name, destination),
        image: `https://source.unsplash.com/400x300/?${keyword}`,
        category: formatCategory(cat),
        lat: elLat ?? null,
        lon: elLon ?? null,
        entryFee: getEntryFeeEstimate(cat),
        timings: getTimings(cat),
        rating: parseFloat((3.5 + Math.random() * 1.5).toFixed(1)),
      });

      if (places.length >= maxPlaces) break;
    }
    return places;
  } catch {
    return [];
  }
}

function formatCategory(cat: string): string {
  const map: Record<string, string> = {
    attraction: "Attraction",
    museum: "Museum",
    viewpoint: "Viewpoint",
    gallery: "Art Gallery",
    theme_park: "Theme Park",
    zoo: "Zoo",
    monument: "Monument",
    castle: "Fort / Castle",
    ruins: "Historical Ruins",
    temple: "Temple",
    mosque: "Mosque",
    church: "Church",
    fort: "Fort",
    building: "Heritage Building",
    park: "Park",
    garden: "Garden",
    nature_reserve: "Nature Reserve",
    archaeological_site: "Archaeological Site",
  };
  return map[cat] || "Attraction";
}

function getCategoryDescription(cat: string, name: string, destination: string): string {
  const map: Record<string, string> = {
    museum: `${name} is a fascinating museum showcasing the rich culture and history of ${destination}.`,
    monument: `${name} stands as a magnificent historical monument and one of ${destination}'s most iconic landmarks.`,
    temple: `${name} is a revered temple and an important spiritual and architectural landmark of ${destination}.`,
    fort: `${name} is an impressive fort with stunning architecture offering panoramic views of ${destination}.`,
    castle: `${name} is a majestic fort offering a vivid glimpse into the royal history of ${destination}.`,
    park: `${name} is a beautiful park in ${destination}, perfect for leisurely walks and enjoying nature.`,
    garden: `${name} is a serene garden in ${destination}, perfect for walks and photography.`,
    viewpoint: `${name} offers breathtaking panoramic views of ${destination} and the surrounding landscape.`,
    ruins: `The ancient ruins of ${name} tell the story of a rich civilisation that once thrived in ${destination}.`,
    zoo: `${name} is home to diverse wildlife and is one of the popular family destinations in ${destination}.`,
    gallery: `${name} showcases exceptional art and cultural artefacts representing the spirit of ${destination}.`,
    archaeological_site: `${name} is an important archaeological site that reveals the ancient heritage of ${destination}.`,
  };
  return map[cat] || `${name} is a renowned landmark and a must-visit destination in ${destination}.`;
}

function getEntryFeeEstimate(cat: string): number | null {
  const fees: Record<string, number> = {
    museum: 50, monument: 100, fort: 150, castle: 150, ruins: 30,
    theme_park: 500, zoo: 80, gallery: 20, temple: 0, mosque: 0,
    church: 0, park: 20, garden: 30, viewpoint: 0, attraction: 0,
  };
  return fees[cat] ?? null;
}

function getTimings(cat: string): string | null {
  const timings: Record<string, string> = {
    museum: "10:00 AM – 5:00 PM (Closed Monday)",
    monument: "6:00 AM – 6:00 PM",
    fort: "6:00 AM – 6:00 PM",
    castle: "8:00 AM – 5:30 PM",
    ruins: "Sunrise to Sunset",
    theme_park: "10:00 AM – 8:00 PM",
    zoo: "9:00 AM – 5:00 PM",
    gallery: "10:00 AM – 6:00 PM",
    temple: "6:00 AM – 12:00 PM, 4:00 PM – 9:00 PM",
    park: "6:00 AM – 8:00 PM",
    garden: "6:00 AM – 7:00 PM",
  };
  return timings[cat] ?? "Open Daily";
}

const CITY_PLACES: Record<string, Place[]> = {
  goa: [
    { name: "Baga Beach", description: "One of Goa's most popular beaches, famous for water sports, shacks, and vibrant nightlife.", image: "https://source.unsplash.com/400x300/?baga+beach+goa", category: "Beach", lat: 15.5565, lon: 73.7517, entryFee: 0, timings: "24 Hours", rating: 4.3 },
    { name: "Basilica of Bom Jesus", description: "A UNESCO World Heritage Site and one of the finest examples of Baroque architecture in India.", image: "https://source.unsplash.com/400x300/?basilica+bom+jesus+goa+church", category: "Heritage", lat: 15.5009, lon: 73.9116, entryFee: 0, timings: "9:00 AM – 6:30 PM", rating: 4.6 },
    { name: "Dudhsagar Waterfalls", description: "One of India's tallest waterfalls, a four-tiered cascade surrounded by dense forest.", image: "https://source.unsplash.com/400x300/?dudhsagar+waterfall+goa", category: "Nature", lat: 15.3144, lon: 74.3144, entryFee: 400, timings: "7:00 AM – 5:00 PM", rating: 4.5 },
    { name: "Fort Aguada", description: "A well-preserved 17th-century Portuguese fort overlooking the Arabian Sea.", image: "https://source.unsplash.com/400x300/?fort+aguada+goa", category: "Fort", lat: 15.4958, lon: 73.7749, entryFee: 0, timings: "9:30 AM – 6:00 PM", rating: 4.2 },
    { name: "Calangute Beach", description: "Known as the Queen of Beaches, Calangute is Goa's largest beach in North Goa.", image: "https://source.unsplash.com/400x300/?calangute+beach+goa+india", category: "Beach", lat: 15.5439, lon: 73.7553, entryFee: 0, timings: "24 Hours", rating: 4.0 },
    { name: "Chapora Fort", description: "An ancient fort on a hill offering sweeping views of the Arabian Sea and Vagator Beach.", image: "https://source.unsplash.com/400x300/?chapora+fort+goa+vagator", category: "Fort", lat: 15.6020, lon: 73.7349, entryFee: 0, timings: "Sunrise to Sunset", rating: 4.3 },
    { name: "Anjuna Flea Market", description: "A vibrant Wednesday market where locals and tourists trade handicrafts, clothes, and curios.", image: "https://source.unsplash.com/400x300/?goa+flea+market+anjuna", category: "Market", lat: 15.5736, lon: 73.7425, entryFee: 0, timings: "Wednesday 8:00 AM – Sunset", rating: 4.1 },
    { name: "Palolem Beach", description: "A crescent-shaped beach in South Goa, known for its calm waters and serene ambience.", image: "https://source.unsplash.com/400x300/?palolem+beach+south+goa", category: "Beach", lat: 15.0100, lon: 74.0230, entryFee: 0, timings: "24 Hours", rating: 4.5 },
    { name: "Se Cathedral", description: "One of the largest churches in Asia, an excellent example of Portuguese-Gothic architecture.", image: "https://source.unsplash.com/400x300/?se+cathedral+old+goa+church", category: "Heritage", lat: 15.5018, lon: 73.9114, entryFee: 0, timings: "7:30 AM – 6:30 PM", rating: 4.4 },
    { name: "Vagator Beach", description: "A dramatic red-cliffed beach in North Goa popular with backpackers and nature lovers.", image: "https://source.unsplash.com/400x300/?vagator+beach+goa+cliff", category: "Beach", lat: 15.5988, lon: 73.7404, entryFee: 0, timings: "24 Hours", rating: 4.2 },
    { name: "Mandrem Beach", description: "A peaceful, less-crowded beach ideal for relaxation, yoga retreats, and sunsets.", image: "https://source.unsplash.com/400x300/?mandrem+beach+goa+sunset", category: "Beach", lat: 15.6449, lon: 73.7273, entryFee: 0, timings: "24 Hours", rating: 4.4 },
    { name: "Goa State Museum", description: "Houses a rich collection of sculptures, coins, and natural history artefacts from Goa.", image: "https://source.unsplash.com/400x300/?goa+museum+history+india", category: "Museum", lat: 15.4933, lon: 73.8278, entryFee: 10, timings: "9:30 AM – 5:30 PM (Closed Monday)", rating: 3.8 },
  ],
  jaipur: [
    { name: "Amber Fort", description: "A majestic fort built with red sandstone and marble, overlooking the serene Maota Lake.", image: "https://source.unsplash.com/400x300/?amber+fort+jaipur+india", category: "Fort", lat: 26.9855, lon: 75.8513, entryFee: 200, timings: "8:00 AM – 5:30 PM", rating: 4.7 },
    { name: "Hawa Mahal", description: "The iconic Palace of Winds — a five-story honeycomb facade of 953 small windows.", image: "https://source.unsplash.com/400x300/?hawa+mahal+jaipur+palace", category: "Palace", lat: 26.9239, lon: 75.8267, entryFee: 50, timings: "9:00 AM – 5:00 PM", rating: 4.5 },
    { name: "City Palace", description: "A grand palace complex blending Rajasthani and Mughal architecture in the heart of Jaipur.", image: "https://source.unsplash.com/400x300/?city+palace+jaipur+rajasthan", category: "Palace", lat: 26.9257, lon: 75.8236, entryFee: 300, timings: "9:30 AM – 5:00 PM", rating: 4.6 },
    { name: "Jantar Mantar", description: "A UNESCO World Heritage Site featuring 19 large astronomical instruments built in the 18th century.", image: "https://source.unsplash.com/400x300/?jantar+mantar+jaipur+observatory", category: "Heritage", lat: 26.9247, lon: 75.8244, entryFee: 100, timings: "9:00 AM – 4:30 PM", rating: 4.4 },
    { name: "Nahargarh Fort", description: "A 18th-century fort on the Aravalli Hills with sweeping views over the Pink City at sunset.", image: "https://source.unsplash.com/400x300/?nahargarh+fort+jaipur+sunset", category: "Fort", lat: 26.9397, lon: 75.8083, entryFee: 100, timings: "10:00 AM – 5:30 PM", rating: 4.4 },
    { name: "Jal Mahal", description: "The Water Palace — an ethereal palace that appears to float in the middle of Man Sagar Lake.", image: "https://source.unsplash.com/400x300/?jal+mahal+jaipur+lake+palace", category: "Palace", lat: 26.9500, lon: 75.8467, entryFee: 0, timings: "Viewable from road", rating: 4.5 },
    { name: "Albert Hall Museum", description: "Rajasthan's oldest museum with a rich collection of art, coins, and historical artefacts.", image: "https://source.unsplash.com/400x300/?albert+hall+museum+jaipur", category: "Museum", lat: 26.9124, lon: 75.8157, entryFee: 40, timings: "10:00 AM – 5:30 PM", rating: 4.3 },
    { name: "Jaigarh Fort", description: "Built to protect Amber Fort, Jaigarh houses the world's largest wheeled cannon, Jai Vana.", image: "https://source.unsplash.com/400x300/?jaigarh+fort+jaipur+cannon", category: "Fort", lat: 26.9869, lon: 75.8386, entryFee: 100, timings: "9:00 AM – 4:30 PM", rating: 4.4 },
    { name: "Johari Bazaar", description: "A famous street market in Jaipur renowned for jewellery, gems, and traditional Rajasthani textiles.", image: "https://source.unsplash.com/400x300/?johari+bazaar+jaipur+market+jewellery", category: "Market", lat: 26.9197, lon: 75.8239, entryFee: 0, timings: "10:00 AM – 8:00 PM", rating: 4.2 },
    { name: "Birla Mandir", description: "A modern marble temple dedicated to Vishnu and Lakshmi, with intricate carvings and city views.", image: "https://source.unsplash.com/400x300/?birla+mandir+jaipur+temple+marble", category: "Temple", lat: 26.8997, lon: 75.8294, entryFee: 0, timings: "6:00 AM – 12:00 PM, 3:00 PM – 9:00 PM", rating: 4.5 },
    { name: "Sisodia Rani Garden", description: "A multi-terraced Mughal garden with fountains, frescoes, and pavilions on the Jaipur–Agra highway.", image: "https://source.unsplash.com/400x300/?sisodia+rani+garden+jaipur+mughal", category: "Garden", lat: 26.8956, lon: 75.9012, entryFee: 30, timings: "8:00 AM – 6:00 PM", rating: 4.1 },
    { name: "Chokhi Dhani", description: "A village-themed resort experience showcasing traditional Rajasthani culture, food, and folk art.", image: "https://source.unsplash.com/400x300/?chokhi+dhani+jaipur+rajasthani+culture", category: "Cultural Experience", lat: 26.7720, lon: 75.8614, entryFee: 600, timings: "5:00 PM – 11:00 PM", rating: 4.5 },
  ],
  mumbai: [
    { name: "Gateway of India", description: "The iconic 26-metre arch monument built in 1924, overlooking Mumbai Harbour.", image: "https://source.unsplash.com/400x300/?gateway+of+india+mumbai+harbour", category: "Monument", lat: 18.9220, lon: 72.8347, entryFee: 0, timings: "24 Hours", rating: 4.5 },
    { name: "Marine Drive", description: "A 3.6 km boulevard curving along the Arabian Sea, nicknamed the Queen's Necklace at night.", image: "https://source.unsplash.com/400x300/?marine+drive+mumbai+seafront", category: "Promenade", lat: 18.9440, lon: 72.8234, entryFee: 0, timings: "24 Hours", rating: 4.6 },
    { name: "Elephanta Caves", description: "A UNESCO World Heritage Site — rock-cut cave temples with monumental Shiva sculptures on an island.", image: "https://source.unsplash.com/400x300/?elephanta+caves+mumbai+shiva", category: "Heritage", lat: 18.9633, lon: 72.9315, entryFee: 40, timings: "9:30 AM – 5:30 PM (Closed Monday)", rating: 4.4 },
    { name: "Chhatrapati Shivaji Maharaj Terminus", description: "A UNESCO World Heritage Site and one of the finest examples of Victorian Gothic Revival architecture in India.", image: "https://source.unsplash.com/400x300/?CST+mumbai+railway+terminus+gothic", category: "Heritage", lat: 18.9399, lon: 72.8355, entryFee: 0, timings: "Open daily", rating: 4.5 },
    { name: "Juhu Beach", description: "Mumbai's most popular seaside escape, lined with chaat stalls and street food joints.", image: "https://source.unsplash.com/400x300/?juhu+beach+mumbai+sunset", category: "Beach", lat: 19.0984, lon: 72.8266, entryFee: 0, timings: "24 Hours", rating: 4.1 },
    { name: "Sanjay Gandhi National Park", description: "A protected forest reserve in the heart of Mumbai, home to the ancient Kanheri Caves.", image: "https://source.unsplash.com/400x300/?sanjay+gandhi+national+park+mumbai+forest", category: "Nature", lat: 19.2147, lon: 72.9107, entryFee: 66, timings: "7:30 AM – 6:30 PM", rating: 4.4 },
    { name: "Haji Ali Dargah", description: "An iconic mosque and dargah situated on a tiny islet in the Arabian Sea, accessible via a narrow causeway.", image: "https://source.unsplash.com/400x300/?haji+ali+dargah+mumbai+mosque+sea", category: "Mosque", lat: 18.9827, lon: 72.8089, entryFee: 0, timings: "5:30 AM – 10:00 PM", rating: 4.6 },
    { name: "Siddhivinayak Temple", description: "One of Mumbai's most revered Hindu temples, dedicated to Lord Ganesha and visited by millions.", image: "https://source.unsplash.com/400x300/?siddhivinayak+temple+mumbai+ganesha", category: "Temple", lat: 19.0165, lon: 72.8312, entryFee: 0, timings: "5:30 AM – 10:00 PM", rating: 4.7 },
    { name: "Colaba Causeway Market", description: "A vibrant street market in South Mumbai selling antiques, clothing, jewellery, and handicrafts.", image: "https://source.unsplash.com/400x300/?colaba+causeway+mumbai+market+street", category: "Market", lat: 18.9148, lon: 72.8315, entryFee: 0, timings: "10:00 AM – 10:00 PM", rating: 4.1 },
    { name: "Chhatrapati Shivaji Maharaj Vastu Sangrahalaya", description: "Mumbai's premier museum housing over 50,000 artefacts of Indian history, art, and natural history.", image: "https://source.unsplash.com/400x300/?mumbai+museum+prince+of+wales+history", category: "Museum", lat: 18.9268, lon: 72.8326, entryFee: 85, timings: "10:15 AM – 6:00 PM", rating: 4.4 },
    { name: "Bandra-Worli Sea Link", description: "A stunning eight-lane cable-stayed bridge across Mahim Bay, an engineering marvel of Mumbai.", image: "https://source.unsplash.com/400x300/?bandra+worli+sea+link+mumbai+bridge", category: "Landmark", lat: 19.0230, lon: 72.8165, entryFee: 0, timings: "24 Hours", rating: 4.5 },
    { name: "Bandstand Promenade", description: "A scenic seafront promenade in Bandra lined with heritage bungalows and Shah Rukh Khan's Mannat.", image: "https://source.unsplash.com/400x300/?bandstand+bandra+mumbai+promenade+sea", category: "Promenade", lat: 19.0480, lon: 72.8252, entryFee: 0, timings: "24 Hours", rating: 4.3 },
  ],
  delhi: [
    { name: "Red Fort", description: "A UNESCO World Heritage Site and 17th-century Mughal fort — the seat of power of the Mughal Empire.", image: "https://source.unsplash.com/400x300/?red+fort+delhi+mughal", category: "Fort", lat: 28.6562, lon: 77.2410, entryFee: 50, timings: "9:30 AM – 4:30 PM (Closed Monday)", rating: 4.5 },
    { name: "Qutub Minar", description: "A 73-metre tall UNESCO Heritage minaret — one of the finest towers in the world and built in the 12th century.", image: "https://source.unsplash.com/400x300/?qutub+minar+delhi+minaret", category: "Heritage", lat: 28.5245, lon: 77.1855, entryFee: 40, timings: "7:00 AM – 5:00 PM", rating: 4.6 },
    { name: "India Gate", description: "A war memorial honouring 70,000 soldiers, standing majestically on the Kartavya Path.", image: "https://source.unsplash.com/400x300/?india+gate+delhi+memorial", category: "Monument", lat: 28.6129, lon: 77.2295, entryFee: 0, timings: "24 Hours", rating: 4.6 },
    { name: "Humayun's Tomb", description: "A stunning UNESCO World Heritage Site garden tomb that served as the inspiration for the Taj Mahal.", image: "https://source.unsplash.com/400x300/?humayun+tomb+delhi+mughal+garden", category: "Heritage", lat: 28.5933, lon: 77.2507, entryFee: 40, timings: "Sunrise to Sunset", rating: 4.6 },
    { name: "Lotus Temple", description: "A Bahai House of Worship shaped like a blooming lotus flower, open to people of all faiths.", image: "https://source.unsplash.com/400x300/?lotus+temple+delhi+bahai", category: "Temple", lat: 28.5535, lon: 77.2588, entryFee: 0, timings: "9:00 AM – 5:30 PM (Closed Monday)", rating: 4.6 },
    { name: "Chandni Chowk", description: "One of the oldest markets in India — a labyrinth of lanes, spices, sweets, and street food.", image: "https://source.unsplash.com/400x300/?chandni+chowk+delhi+market+old", category: "Market", lat: 28.6506, lon: 77.2319, entryFee: 0, timings: "8:00 AM – 8:00 PM", rating: 4.3 },
    { name: "Akshardham Temple", description: "A magnificent Hindu temple complex — a spiritual and cultural campus spread over 100 acres.", image: "https://source.unsplash.com/400x300/?akshardham+temple+delhi+hindu", category: "Temple", lat: 28.6127, lon: 77.2773, entryFee: 0, timings: "10:00 AM – 6:30 PM (Closed Monday)", rating: 4.7 },
    { name: "Jama Masjid", description: "India's largest mosque, built by Mughal Emperor Shah Jahan, accommodating 25,000 worshippers.", image: "https://source.unsplash.com/400x300/?jama+masjid+delhi+mosque+mughal", category: "Mosque", lat: 28.6507, lon: 77.2334, entryFee: 0, timings: "7:00 AM – 12:00 PM, 1:30 PM – 6:30 PM", rating: 4.5 },
    { name: "National Museum Delhi", description: "India's largest museum housing over 2 lakh artefacts including Indus Valley, Mughal and tribal art.", image: "https://source.unsplash.com/400x300/?national+museum+delhi+india+artefacts", category: "Museum", lat: 28.6116, lon: 77.2193, entryFee: 20, timings: "10:00 AM – 6:00 PM (Closed Monday)", rating: 4.4 },
    { name: "Hauz Khas Village", description: "A trendy urban village with a 14th-century reservoir, ruins, boutiques, cafes, and art galleries.", image: "https://source.unsplash.com/400x300/?hauz+khas+village+delhi+ruins+lake", category: "Heritage", lat: 28.5494, lon: 77.2001, entryFee: 0, timings: "Open daily", rating: 4.3 },
    { name: "Purana Qila", description: "One of the oldest forts in Delhi, built by Humayun and Sher Shah Suri in the 16th century.", image: "https://source.unsplash.com/400x300/?purana+qila+delhi+old+fort+mughal", category: "Fort", lat: 28.6126, lon: 77.2428, entryFee: 20, timings: "7:00 AM – 5:00 PM", rating: 4.3 },
    { name: "Raj Ghat", description: "The memorial to Mahatma Gandhi — a simple black marble platform marking the site of his cremation.", image: "https://source.unsplash.com/400x300/?raj+ghat+delhi+gandhi+memorial", category: "Memorial", lat: 28.6398, lon: 77.2498, entryFee: 0, timings: "6:00 AM – 6:00 PM", rating: 4.5 },
  ],
  agra: [
    { name: "Taj Mahal", description: "One of the Seven Wonders of the World — an ivory-white marble mausoleum built by Emperor Shah Jahan.", image: "https://source.unsplash.com/400x300/?taj+mahal+agra+india+sunrise", category: "Heritage", lat: 27.1751, lon: 78.0421, entryFee: 250, timings: "Sunrise to Sunset (Closed Friday)", rating: 4.9 },
    { name: "Agra Fort", description: "A UNESCO World Heritage Site — a 16th-century Mughal fort that served as the main residence of emperors.", image: "https://source.unsplash.com/400x300/?agra+fort+india+mughal", category: "Fort", lat: 27.1795, lon: 78.0211, entryFee: 50, timings: "6:00 AM – 6:00 PM", rating: 4.5 },
    { name: "Fatehpur Sikri", description: "A UNESCO World Heritage Site — the former capital of the Mughal Empire, built by Emperor Akbar.", image: "https://source.unsplash.com/400x300/?fatehpur+sikri+agra+mughal+capital", category: "Heritage", lat: 27.0945, lon: 77.6611, entryFee: 40, timings: "Sunrise to Sunset", rating: 4.5 },
    { name: "Mehtab Bagh", description: "A 16th-century charbagh offering the most spectacular moonlit view of the Taj Mahal across the Yamuna.", image: "https://source.unsplash.com/400x300/?mehtab+bagh+agra+garden+taj", category: "Garden", lat: 27.1811, lon: 78.0344, entryFee: 20, timings: "Sunrise to Sunset", rating: 4.4 },
    { name: "Itimad-ud-Daulah", description: "Called the Baby Taj, this delicate mausoleum predates the Taj Mahal and introduced pietra dura work.", image: "https://source.unsplash.com/400x300/?itimad+ud+daulah+agra+tomb", category: "Heritage", lat: 27.1964, lon: 78.0347, entryFee: 20, timings: "Sunrise to Sunset", rating: 4.4 },
    { name: "Akbar's Tomb, Sikandra", description: "The tomb of Mughal Emperor Akbar, set within a large garden enclosure in Sikandra, near Agra.", image: "https://source.unsplash.com/400x300/?akbar+tomb+sikandra+agra+mughal", category: "Heritage", lat: 27.2044, lon: 77.9631, entryFee: 20, timings: "Sunrise to Sunset", rating: 4.3 },
    { name: "Agra Bear Rescue Facility", description: "A wildlife sanctuary that rescues and rehabilitates dancing bears — a unique and moving attraction.", image: "https://source.unsplash.com/400x300/?wildlife+sanctuary+bear+india", category: "Wildlife", lat: 27.1647, lon: 78.1103, entryFee: 0, timings: "9:00 AM – 5:00 PM", rating: 4.5 },
    { name: "Kinari Bazaar", description: "A colourful market near the Agra Fort known for marble crafts, zari embroidery, and street food.", image: "https://source.unsplash.com/400x300/?kinari+bazaar+agra+market+india", category: "Market", lat: 27.1804, lon: 78.0189, entryFee: 0, timings: "10:00 AM – 8:00 PM", rating: 4.0 },
  ],
  varanasi: [
    { name: "Dashashwamedh Ghat", description: "The main and most spectacular ghat in Varanasi, where the nightly Ganga Aarti is performed.", image: "https://source.unsplash.com/400x300/?dashashwamedh+ghat+varanasi+aarti", category: "Ghat", lat: 25.3050, lon: 83.0112, entryFee: 0, timings: "Aarti at 7:00 PM daily", rating: 4.8 },
    { name: "Kashi Vishwanath Temple", description: "One of the holiest Hindu temples dedicated to Lord Shiva, built on the western bank of the Ganga.", image: "https://source.unsplash.com/400x300/?kashi+vishwanath+temple+varanasi+shiva", category: "Temple", lat: 25.3109, lon: 83.0107, entryFee: 0, timings: "3:00 AM – 11:00 PM", rating: 4.7 },
    { name: "Manikarnika Ghat", description: "One of the oldest and most sacred burning ghats — the cremation ghat central to Hindu moksha beliefs.", image: "https://source.unsplash.com/400x300/?manikarnika+ghat+varanasi+burning", category: "Ghat", lat: 25.3092, lon: 83.0115, entryFee: 0, timings: "24 Hours", rating: 4.5 },
    { name: "Sarnath", description: "The site where Buddha delivered his first sermon — now home to the Dhamek Stupa and ASI Museum.", image: "https://source.unsplash.com/400x300/?sarnath+varanasi+stupa+buddhist", category: "Heritage", lat: 25.3791, lon: 83.0224, entryFee: 20, timings: "Sunrise to Sunset", rating: 4.5 },
    { name: "Assi Ghat", description: "A lively ghat at the confluence of Assi and Ganga rivers, popular for yoga sessions at sunrise.", image: "https://source.unsplash.com/400x300/?assi+ghat+varanasi+sunrise+ganga", category: "Ghat", lat: 25.2799, lon: 82.9988, entryFee: 0, timings: "24 Hours", rating: 4.4 },
    { name: "Ramnagar Fort", description: "An 18th-century fort across the Ganga from Varanasi, housing a museum with vintage cars and armoury.", image: "https://source.unsplash.com/400x300/?ramnagar+fort+varanasi+ganga", category: "Fort", lat: 25.2712, lon: 83.0288, entryFee: 15, timings: "10:00 AM – 5:00 PM", rating: 4.1 },
    { name: "Bharat Mata Mandir", description: "A unique temple dedicated to Mother India instead of a deity, featuring a marble map of undivided India.", image: "https://source.unsplash.com/400x300/?bharat+mata+mandir+varanasi+india+temple", category: "Temple", lat: 25.3306, lon: 83.0132, entryFee: 0, timings: "5:00 AM – 9:00 PM", rating: 4.3 },
    { name: "Ganga Boat Ride", description: "A sunrise or sunset boat ride along the Ganga — the most iconic Varanasi experience.", image: "https://source.unsplash.com/400x300/?ganga+boat+ride+varanasi+river+sunrise", category: "Experience", lat: 25.3050, lon: 83.0100, entryFee: 200, timings: "Sunrise & Sunset", rating: 4.8 },
  ],
  hyderabad: [
    { name: "Charminar", description: "The iconic 16th-century monument and mosque with four minarets, the symbol of Hyderabad.", image: "https://source.unsplash.com/400x300/?charminar+hyderabad+monument", category: "Monument", lat: 17.3616, lon: 78.4747, entryFee: 25, timings: "9:30 AM – 5:30 PM", rating: 4.5 },
    { name: "Golconda Fort", description: "A 13th-century fort renowned for its impressive architecture, acoustic system, and diamond trade history.", image: "https://source.unsplash.com/400x300/?golconda+fort+hyderabad+ruins", category: "Fort", lat: 17.3833, lon: 78.4011, entryFee: 15, timings: "8:00 AM – 5:30 PM", rating: 4.5 },
    { name: "Hussain Sagar Lake", description: "A heart-shaped lake in the centre of Hyderabad with a giant Buddha statue on an island.", image: "https://source.unsplash.com/400x300/?hussain+sagar+lake+hyderabad+buddha", category: "Lake", lat: 17.4239, lon: 78.4738, entryFee: 0, timings: "24 Hours", rating: 4.3 },
    { name: "Qutb Shahi Tombs", description: "The royal necropolis of the Qutb Shahi dynasty — a UNESCO tentative site with impressive domed tombs.", image: "https://source.unsplash.com/400x300/?qutb+shahi+tombs+hyderabad+heritage", category: "Heritage", lat: 17.3964, lon: 78.3978, entryFee: 15, timings: "9:00 AM – 4:30 PM (Closed Friday)", rating: 4.4 },
    { name: "Salar Jung Museum", description: "One of the largest one-man collections in the world with 43,000 artefacts spanning 35–36 galleries.", image: "https://source.unsplash.com/400x300/?salar+jung+museum+hyderabad+art", category: "Museum", lat: 17.3712, lon: 78.4787, entryFee: 20, timings: "10:00 AM – 5:00 PM (Closed Friday)", rating: 4.5 },
    { name: "Chowmahalla Palace", description: "An 18th-century palace complex that was the seat of the Nizam of Hyderabad.", image: "https://source.unsplash.com/400x300/?chowmahalla+palace+hyderabad+nizam", category: "Palace", lat: 17.3601, lon: 78.4713, entryFee: 80, timings: "10:00 AM – 5:00 PM (Closed Friday)", rating: 4.4 },
    { name: "Ramoji Film City", description: "The world's largest film studio complex certified by Guinness, offering tours and live shows.", image: "https://source.unsplash.com/400x300/?ramoji+film+city+hyderabad+studio", category: "Attraction", lat: 17.2543, lon: 78.6808, entryFee: 1150, timings: "9:00 AM – 5:30 PM", rating: 4.3 },
    { name: "Lad Bazaar (Laad Bazaar)", description: "A vibrant bazaar near Charminar famous for lacquer bangles, pearls, and traditional Hyderabadi crafts.", image: "https://source.unsplash.com/400x300/?lad+bazaar+hyderabad+bangles+market", category: "Market", lat: 17.3618, lon: 78.4745, entryFee: 0, timings: "10:00 AM – 8:00 PM", rating: 4.2 },
  ],
  bangalore: [
    { name: "Bangalore Palace", description: "A Tudor-style palace built in 1887, modelled on Windsor Castle, housing a museum with royal artefacts.", image: "https://source.unsplash.com/400x300/?bangalore+palace+tudor+karnataka", category: "Palace", lat: 12.9987, lon: 77.5920, entryFee: 230, timings: "10:00 AM – 5:30 PM", rating: 4.2 },
    { name: "Lalbagh Botanical Garden", description: "A 240-acre garden housing over 1,000 plant species, including a 3,000-year-old rock and a glasshouse.", image: "https://source.unsplash.com/400x300/?lalbagh+garden+bangalore+botanical", category: "Garden", lat: 12.9507, lon: 77.5848, entryFee: 20, timings: "6:00 AM – 7:00 PM", rating: 4.4 },
    { name: "Cubbon Park", description: "A lush 300-acre park in the heart of Bangalore, home to the State Library and High Court buildings.", image: "https://source.unsplash.com/400x300/?cubbon+park+bangalore+green", category: "Park", lat: 12.9763, lon: 77.5929, entryFee: 0, timings: "6:00 AM – 6:00 PM", rating: 4.4 },
    { name: "Tipu Sultan's Summer Palace", description: "An 18th-century Indo-Islamic wooden palace that was the summer retreat of Tipu Sultan.", image: "https://source.unsplash.com/400x300/?tipu+sultan+palace+bangalore+wooden", category: "Palace", lat: 12.9604, lon: 77.5735, entryFee: 15, timings: "8:30 AM – 5:30 PM", rating: 4.1 },
    { name: "ISKCON Temple", description: "A magnificent marble temple devoted to Lord Krishna, one of the largest ISKCON temples in the world.", image: "https://source.unsplash.com/400x300/?iskcon+temple+bangalore+krishna", category: "Temple", lat: 13.0099, lon: 77.5510, entryFee: 0, timings: "7:15 AM – 1:00 PM, 4:00 PM – 8:30 PM", rating: 4.6 },
    { name: "Wonderla Amusement Park", description: "South India's premier amusement park with over 60 land and water rides on the Mysore Road.", image: "https://source.unsplash.com/400x300/?amusement+park+water+rides+india", category: "Theme Park", lat: 12.8444, lon: 77.4057, entryFee: 999, timings: "11:00 AM – 6:00 PM", rating: 4.4 },
    { name: "Commercial Street", description: "Bangalore's busiest shopping street — a paradise for clothes, jewellery, accessories, and street food.", image: "https://source.unsplash.com/400x300/?commercial+street+bangalore+shopping", category: "Market", lat: 12.9831, lon: 77.6101, entryFee: 0, timings: "10:00 AM – 9:00 PM", rating: 4.2 },
    { name: "Vidhana Soudha", description: "Karnataka's seat of government — a grand granite building considered one of India's finest neo-Dravidian structures.", image: "https://source.unsplash.com/400x300/?vidhana+soudha+bangalore+government", category: "Landmark", lat: 12.9793, lon: 77.5906, entryFee: 0, timings: "Viewable from outside", rating: 4.4 },
  ],
  chennai: [
    { name: "Marina Beach", description: "The second longest urban beach in the world, stretching 13 km along the Bay of Bengal.", image: "https://source.unsplash.com/400x300/?marina+beach+chennai+bay+bengal", category: "Beach", lat: 13.0500, lon: 80.2824, entryFee: 0, timings: "24 Hours", rating: 4.4 },
    { name: "Kapaleeshwarar Temple", description: "A Dravidian-style temple dedicated to Lord Shiva, known for its ornate gopuram in Mylapore.", image: "https://source.unsplash.com/400x300/?kapaleeshwarar+temple+chennai+mylapore", category: "Temple", lat: 13.0338, lon: 80.2694, entryFee: 0, timings: "5:45 AM – 12:30 PM, 4:00 PM – 9:30 PM", rating: 4.6 },
    { name: "Government Museum Chennai", description: "One of the oldest museums in India, housing Bronze Gallery, National Art Gallery, and contemporary art wing.", image: "https://source.unsplash.com/400x300/?government+museum+chennai+bronze", category: "Museum", lat: 13.0680, lon: 80.2485, entryFee: 20, timings: "9:30 AM – 5:00 PM (Closed Wednesday)", rating: 4.3 },
    { name: "Fort St. George", description: "The first English fortress built in India (1644), now housing the Tamil Nadu Assembly and a museum.", image: "https://source.unsplash.com/400x300/?fort+st+george+chennai+british+museum", category: "Fort", lat: 13.0795, lon: 80.2874, entryFee: 5, timings: "9:00 AM – 5:00 PM (Closed Friday)", rating: 4.2 },
    { name: "San Thome Cathedral", description: "A minor basilica built over the tomb of St. Thomas the Apostle, one of the oldest churches in India.", image: "https://source.unsplash.com/400x300/?san+thome+cathedral+chennai+church", category: "Heritage", lat: 13.0320, lon: 80.2788, entryFee: 0, timings: "6:00 AM – 8:00 PM", rating: 4.4 },
    { name: "Elliot's Beach (Besant Nagar)", description: "A quieter, cleaner beach in Besant Nagar loved by locals for evening strolls and street food.", image: "https://source.unsplash.com/400x300/?besant+nagar+beach+chennai+south", category: "Beach", lat: 12.9988, lon: 80.2715, entryFee: 0, timings: "24 Hours", rating: 4.3 },
    { name: "Valluvar Kottam", description: "A chariot-shaped monument honouring the Tamil poet Thiruvalluvar, with inscribed Kural verses.", image: "https://source.unsplash.com/400x300/?valluvar+kottam+chennai+monument+tamil", category: "Monument", lat: 13.0544, lon: 80.2446, entryFee: 5, timings: "9:30 AM – 6:00 PM", rating: 4.1 },
  ],
  kolkata: [
    { name: "Victoria Memorial", description: "A magnificent white marble monument dedicated to Queen Victoria — Kolkata's most iconic landmark.", image: "https://source.unsplash.com/400x300/?victoria+memorial+kolkata+white+marble", category: "Monument", lat: 22.5448, lon: 88.3426, entryFee: 30, timings: "10:00 AM – 5:00 PM (Closed Monday)", rating: 4.7 },
    { name: "Howrah Bridge", description: "One of the world's busiest cantilever bridges crossing the Hooghly River — a symbol of Kolkata.", image: "https://source.unsplash.com/400x300/?howrah+bridge+kolkata+hooghly", category: "Landmark", lat: 22.5851, lon: 88.3468, entryFee: 0, timings: "24 Hours", rating: 4.7 },
    { name: "Dakshineswar Kali Temple", description: "A revered 19th-century Hindu temple on the banks of the Hooghly, associated with Sri Ramakrishna Paramahamsa.", image: "https://source.unsplash.com/400x300/?dakshineswar+kali+temple+kolkata+hooghly", category: "Temple", lat: 22.6545, lon: 88.3579, entryFee: 0, timings: "6:00 AM – 12:30 PM, 3:00 PM – 8:30 PM", rating: 4.6 },
    { name: "Indian Museum", description: "The oldest and largest museum in the Asia-Pacific region, housing 100,000+ rare artefacts.", image: "https://source.unsplash.com/400x300/?indian+museum+kolkata+art+natural+history", category: "Museum", lat: 22.5572, lon: 88.3503, entryFee: 30, timings: "10:00 AM – 5:00 PM (Closed Monday)", rating: 4.4 },
    { name: "Park Street", description: "Kolkata's social and cultural hub — a bustling street lined with cafes, clubs, restaurants, and bookshops.", image: "https://source.unsplash.com/400x300/?park+street+kolkata+nightlife", category: "Promenade", lat: 22.5512, lon: 88.3534, entryFee: 0, timings: "24 Hours", rating: 4.3 },
    { name: "Belur Math", description: "The headquarters of the Ramakrishna Mission — a serene campus blending Hindu, Islamic, and Christian architecture.", image: "https://source.unsplash.com/400x300/?belur+math+kolkata+ramakrishna", category: "Temple", lat: 22.6366, lon: 88.3565, entryFee: 0, timings: "6:30 AM – 11:30 AM, 3:30 PM – 8:00 PM", rating: 4.6 },
    { name: "Science City Kolkata", description: "One of the largest science centres in Southeast Asia, with interactive exhibits, a planetarium, and an amphitheatre.", image: "https://source.unsplash.com/400x300/?science+city+kolkata+interactive+museum", category: "Attraction", lat: 22.5356, lon: 88.3966, entryFee: 60, timings: "9:00 AM – 7:00 PM", rating: 4.3 },
  ],
};

export function getFallbackPlaces(destination: string, maxPlaces: number): Place[] {
  const dest = destination.toLowerCase().split(",")[0].trim().split(" ")[0];
  for (const [key, places] of Object.entries(CITY_PLACES)) {
    if (dest.includes(key) || key.includes(dest)) {
      return places.slice(0, maxPlaces);
    }
  }
  return getGenericPlaces(destination, maxPlaces);
}

function getGenericPlaces(destination: string, maxPlaces: number): Place[] {
  const dest = destination.split(",")[0].trim();
  const templates = [
    { suffix: "Fort", cat: "Fort", img: "fort+india+historic" },
    { suffix: "Temple", cat: "Temple", img: "temple+india+hindu" },
    { suffix: "Museum", cat: "Museum", img: "museum+india+art" },
    { suffix: "Lake", cat: "Lake", img: "lake+india+scenic" },
    { suffix: "Garden", cat: "Garden", img: "garden+india+botanical" },
    { suffix: "Market", cat: "Market", img: "market+india+bazaar" },
    { suffix: "Viewpoint", cat: "Viewpoint", img: "viewpoint+india+scenic" },
    { suffix: "Waterfall", cat: "Nature", img: "waterfall+india+nature" },
    { suffix: "Archaeological Site", cat: "Heritage", img: "heritage+india+monument" },
    { suffix: "Palace", cat: "Palace", img: "palace+india+royal" },
    { suffix: "Wildlife Sanctuary", cat: "Nature", img: "wildlife+sanctuary+india" },
    { suffix: "Cave", cat: "Heritage", img: "cave+india+historic" },
  ];
  return templates.slice(0, maxPlaces).map((t) => ({
    name: `${dest} ${t.suffix}`,
    description: `${dest} ${t.suffix} is a renowned ${t.cat.toLowerCase()} destination and a must-visit landmark in ${dest}, offering a unique cultural and historical experience.`,
    image: `https://source.unsplash.com/400x300/?${t.img}`,
    category: t.cat,
    lat: null,
    lon: null,
    entryFee: t.cat === "Temple" || t.cat === "Lake" ? 0 : 50,
    timings: "9:00 AM – 5:30 PM",
    rating: parseFloat((3.8 + Math.random() * 1.2).toFixed(1)),
  }));
}

const CITY_FOODS: Record<string, FoodRecommendation[]> = {
  goa: [
    { name: "Fish Curry Rice", type: "Local Specialty", cuisine: "Goan", pricePerPerson: 150, image: "https://source.unsplash.com/400x300/?fish+curry+rice+goa+food", mustTry: ["Kingfish Curry", "Pomfret Curry", "Clam Rice"], location: "Served in shacks and homes across Goa", rating: 4.8 },
    { name: "Bebinca", type: "Traditional Dessert", cuisine: "Goan-Portuguese", pricePerPerson: 80, image: "https://source.unsplash.com/400x300/?bebinca+goan+dessert+layered", mustTry: ["Classic Bebinca", "Coconut Bebinca"], location: "Pastelarias and sweet shops across Goa", rating: 4.6 },
    { name: "Prawn Balchão", type: "Famous Dish", cuisine: "Goan Spicy", pricePerPerson: 250, image: "https://source.unsplash.com/400x300/?prawn+balchao+goan+spicy+pickle", mustTry: ["Prawn Balchão", "Fish Balchão"], location: "Goan restaurants and beach shacks", rating: 4.5 },
    { name: "Ros Omelette", type: "Street Snack", cuisine: "Goan", pricePerPerson: 60, image: "https://source.unsplash.com/400x300/?goan+ros+omelette+bread+snack", mustTry: ["Classic Ros Omelette", "Egg Bread"], location: "Mapusa Market and local stalls", rating: 4.3 },
    { name: "Sorpotel", type: "Traditional Dish", cuisine: "Goan-Portuguese", pricePerPerson: 200, image: "https://source.unsplash.com/400x300/?sorpotel+goan+pork+dish", mustTry: ["Pork Sorpotel with Sanna"], location: "Traditional Goan eateries", rating: 4.4 },
    { name: "Feni", type: "Local Beverage", cuisine: "Goan", pricePerPerson: 100, image: "https://source.unsplash.com/400x300/?feni+cashew+goa+local+drink", mustTry: ["Cashew Feni", "Coconut Feni"], location: "Local bars and toddy shops across Goa", rating: 4.2 },
  ],
  jaipur: [
    { name: "Dal Baati Churma", type: "Signature Rajasthani Dish", cuisine: "Rajasthani", pricePerPerson: 200, image: "https://source.unsplash.com/400x300/?dal+baati+churma+rajasthani+food", mustTry: ["Dal Baati with Ghee", "Churma Ladoo"], location: "Local restaurants across Jaipur", rating: 4.8 },
    { name: "Pyaz Kachori", type: "Famous Snack", cuisine: "Rajasthani Street Food", pricePerPerson: 30, image: "https://source.unsplash.com/400x300/?pyaz+kachori+jaipur+snack", mustTry: ["Onion Kachori", "Mawa Kachori"], location: "Rawat Mishthan Bhandar, Station Road", rating: 4.7 },
    { name: "Lal Maas", type: "Traditional Meat Dish", cuisine: "Rajasthani", pricePerPerson: 350, image: "https://source.unsplash.com/400x300/?lal+maas+rajasthani+red+mutton+curry", mustTry: ["Mutton Lal Maas", "Wild Boar Lal Maas"], location: "Heritage restaurants in Jaipur", rating: 4.6 },
    { name: "Ghewar", type: "Traditional Sweet", cuisine: "Rajasthani", pricePerPerson: 80, image: "https://source.unsplash.com/400x300/?ghewar+rajasthani+sweet+dessert+honey", mustTry: ["Mawa Ghewar", "Plain Ghewar with Rabri"], location: "Sweet shops at Johari Bazaar", rating: 4.5 },
    { name: "Ker Sangri", type: "Traditional Vegetable Dish", cuisine: "Rajasthani", pricePerPerson: 150, image: "https://source.unsplash.com/400x300/?ker+sangri+rajasthani+vegetable+desert", mustTry: ["Ker Sangri with Bajra Roti"], location: "Traditional thali restaurants", rating: 4.4 },
    { name: "Mirchi Bada", type: "Spicy Snack", cuisine: "Rajasthani Street Food", pricePerPerson: 20, image: "https://source.unsplash.com/400x300/?mirchi+bada+jaipur+chilli+snack+fried", mustTry: ["Green Chilli Bada", "Aloo stuffed Bada"], location: "Street stalls near Hawa Mahal", rating: 4.4 },
  ],
  mumbai: [
    { name: "Vada Pav", type: "Mumbai's Burger", cuisine: "Mumbai Street Food", pricePerPerson: 20, image: "https://source.unsplash.com/400x300/?vada+pav+mumbai+street+food", mustTry: ["Classic Vada Pav", "Cheese Vada Pav"], location: "Every street corner of Mumbai", rating: 4.8 },
    { name: "Pav Bhaji", type: "Famous Street Dish", cuisine: "Mumbai Street Food", pricePerPerson: 80, image: "https://source.unsplash.com/400x300/?pav+bhaji+mumbai+butter+street", mustTry: ["Butter Pav Bhaji", "Cheese Pav Bhaji"], location: "Juhu Beach and Chowpatty", rating: 4.7 },
    { name: "Bhel Puri", type: "Chaat Snack", cuisine: "Mumbai Chaat", pricePerPerson: 40, image: "https://source.unsplash.com/400x300/?bhel+puri+chaat+mumbai+beach", mustTry: ["Sev Puri", "Dahi Puri", "Pani Puri"], location: "Chowpatty Beach and Juhu", rating: 4.6 },
    { name: "Bombay Sandwich", type: "Mumbai Snack", cuisine: "Mumbai Street Food", pricePerPerson: 50, image: "https://source.unsplash.com/400x300/?bombay+sandwich+mumbai+green+chutney", mustTry: ["Grilled Bombay Sandwich"], location: "Street stalls across Mumbai", rating: 4.5 },
    { name: "Modak", type: "Traditional Sweet", cuisine: "Maharashtrian", pricePerPerson: 60, image: "https://source.unsplash.com/400x300/?modak+sweet+maharashtra+ganesh", mustTry: ["Steamed Ukadiche Modak", "Chocolate Modak"], location: "Sweet shops and temples across Mumbai", rating: 4.6 },
    { name: "Thalipeeth", type: "Traditional Maharashtrian Flatbread", cuisine: "Maharashtrian", pricePerPerson: 100, image: "https://source.unsplash.com/400x300/?thalipeeth+maharashtrian+flatbread+food", mustTry: ["Multigrain Thalipeeth with Curd"], location: "Maharashtrian restaurants", rating: 4.4 },
  ],
  delhi: [
    { name: "Chole Bhature", type: "North Indian Classic", cuisine: "Punjabi", pricePerPerson: 80, image: "https://source.unsplash.com/400x300/?chole+bhature+delhi+punjabi+food", mustTry: ["Chole Bhature at Sita Ram Diwan Chand"], location: "Paharganj and Karol Bagh", rating: 4.8 },
    { name: "Paranthe", type: "Stuffed Flatbread", cuisine: "Delhi Street Food", pricePerPerson: 60, image: "https://source.unsplash.com/400x300/?stuffed+paratha+delhi+ghee+aloo", mustTry: ["Aloo Paratha", "Mooli Paratha", "Pyaz Paratha"], location: "Paranthe Wali Gali, Chandni Chowk", rating: 4.7 },
    { name: "Butter Chicken", type: "Mughlai / North Indian", cuisine: "Mughlai", pricePerPerson: 250, image: "https://source.unsplash.com/400x300/?butter+chicken+murgh+makhani+delhi", mustTry: ["Butter Chicken with Naan"], location: "Old Delhi and Connaught Place", rating: 4.7 },
    { name: "Dahi Bhalle", type: "Chaat Snack", cuisine: "Delhi Chaat", pricePerPerson: 40, image: "https://source.unsplash.com/400x300/?dahi+bhalla+chaat+delhi+yoghurt", mustTry: ["Dahi Bhalle with Tamarind Chutney"], location: "Bengali Market and street stalls", rating: 4.6 },
    { name: "Biryani (Mughlai)", type: "Mughlai Dish", cuisine: "Mughlai", pricePerPerson: 200, image: "https://source.unsplash.com/400x300/?mughlai+biryani+delhi+dum+rice", mustTry: ["Mutton Dum Biryani", "Chicken Biryani"], location: "Karim's, Jama Masjid", rating: 4.7 },
    { name: "Jalebi & Rabri", type: "Traditional Sweet", cuisine: "North Indian", pricePerPerson: 50, image: "https://source.unsplash.com/400x300/?jalebi+rabri+sweet+delhi+north+india", mustTry: ["Hot Jalebi with Rabri", "Imarti"], location: "Chandni Chowk sweet shops", rating: 4.6 },
  ],
  agra: [
    { name: "Petha", type: "Agra's Signature Sweet", cuisine: "North Indian Sweet", pricePerPerson: 50, image: "https://source.unsplash.com/400x300/?petha+agra+sweet+candy+pumpkin", mustTry: ["Angoori Petha", "Kesar Petha", "Plain Petha"], location: "Sweet shops across Agra, especially Deez Petha", rating: 4.7 },
    { name: "Bedai with Jalebi", type: "Agra Breakfast Combo", cuisine: "Agra Street Food", pricePerPerson: 40, image: "https://source.unsplash.com/400x300/?bedai+kachori+jalebi+agra+breakfast", mustTry: ["Bedai Kachori with Aloo Sabzi and Jalebi"], location: "Deviram Sweets, Sadar Bazaar", rating: 4.6 },
    { name: "Mughlai Biryani", type: "Mughlai Dish", cuisine: "Mughlai", pricePerPerson: 250, image: "https://source.unsplash.com/400x300/?mughlai+biryani+agra+dum+rice+meat", mustTry: ["Lamb Biryani", "Chicken Biryani with Raita"], location: "Landmark and Mughal Heritage restaurants", rating: 4.5 },
    { name: "Paratha with Desi Ghee", type: "North Indian Breakfast", cuisine: "North Indian", pricePerPerson: 60, image: "https://source.unsplash.com/400x300/?paratha+ghee+north+indian+breakfast", mustTry: ["Aloo Paratha with White Butter and Pickle"], location: "Local dhabas near Agra Fort", rating: 4.4 },
  ],
  varanasi: [
    { name: "Kachori Sabzi", type: "Varanasi Breakfast", cuisine: "UP Street Food", pricePerPerson: 30, image: "https://source.unsplash.com/400x300/?kachori+sabzi+varanasi+breakfast", mustTry: ["Khasta Kachori with Aloo Sabzi"], location: "Near Kashi Vishwanath Temple and ghats", rating: 4.8 },
    { name: "Thandai", type: "Traditional Beverage", cuisine: "Varanasi", pricePerPerson: 50, image: "https://source.unsplash.com/400x300/?thandai+varanasi+cold+drink+festival", mustTry: ["Plain Thandai", "Bhaang Thandai (Maha Shivratri)"], location: "Blue Lassi Shop and Kachori Gali", rating: 4.7 },
    { name: "Banarasi Paan", type: "Mouth Freshener", cuisine: "Varanasi Specialty", pricePerPerson: 20, image: "https://source.unsplash.com/400x300/?banarasi+paan+betel+leaf+varanasi", mustTry: ["Sweet Paan", "Fire Paan", "Meetha Paan"], location: "Paan stalls across the city", rating: 4.7 },
    { name: "Malaiyo / Nimish", type: "Winter Sweet", cuisine: "Varanasi", pricePerPerson: 30, image: "https://source.unsplash.com/400x300/?malaiyo+nimish+varanasi+milk+foam+sweet", mustTry: ["Malaiyo with Saffron and Pistachios"], location: "Seasonal: sold near ghats in winter mornings", rating: 4.8 },
    { name: "Baati Chokha", type: "Traditional Meal", cuisine: "Bihari/UP", pricePerPerson: 100, image: "https://source.unsplash.com/400x300/?baati+chokha+bihari+food+traditional", mustTry: ["Baati with Chokha and Dal"], location: "Local restaurants and dhabas", rating: 4.5 },
    { name: "Lassi (Varanasi Style)", type: "Iconic Drink", cuisine: "Varanasi", pricePerPerson: 40, image: "https://source.unsplash.com/400x300/?lassi+varanasi+thick+yoghurt+drink", mustTry: ["Thick Malai Lassi in a clay pot"], location: "Blue Lassi Shop, Kashi", rating: 4.9 },
  ],
  hyderabad: [
    { name: "Hyderabadi Biryani", type: "Hyderabad's Pride", cuisine: "Hyderabadi Mughlai", pricePerPerson: 250, image: "https://source.unsplash.com/400x300/?hyderabadi+biryani+dum+rice+saffron", mustTry: ["Kacchi Gosht Biryani", "Chicken Dum Biryani", "Vegetable Biryani"], location: "Paradise, Shadab and Bawarchi restaurants", rating: 4.9 },
    { name: "Haleem", type: "Iconic Slow-Cooked Dish", cuisine: "Hyderabadi", pricePerPerson: 200, image: "https://source.unsplash.com/400x300/?haleem+hyderabad+slow+cooked+meat+wheat", mustTry: ["Mutton Haleem", "Chicken Haleem"], location: "Shah Ghouse Cafe, Madina area", rating: 4.8 },
    { name: "Lukhmi", type: "Savoury Snack", cuisine: "Hyderabadi", pricePerPerson: 40, image: "https://source.unsplash.com/400x300/?lukhmi+hyderabad+savoury+pastry", mustTry: ["Mutton Lukhmi", "Chicken Lukhmi"], location: "Old City bakeries and Irani cafes", rating: 4.5 },
    { name: "Qubani ka Meetha", type: "Traditional Dessert", cuisine: "Hyderabadi", pricePerPerson: 80, image: "https://source.unsplash.com/400x300/?qubani+ka+meetha+hyderabad+apricot+dessert", mustTry: ["Qubani ka Meetha with Cream"], location: "Traditional Hyderabadi restaurants", rating: 4.6 },
    { name: "Double ka Meetha", type: "Bread Pudding Dessert", cuisine: "Hyderabadi", pricePerPerson: 70, image: "https://source.unsplash.com/400x300/?double+ka+meetha+hyderabad+bread+pudding", mustTry: ["Double ka Meetha with Rabri"], location: "Old City sweet shops", rating: 4.5 },
    { name: "Irani Chai & Osmania Biscuit", type: "Iconic Combination", cuisine: "Hyderabadi", pricePerPerson: 30, image: "https://source.unsplash.com/400x300/?irani+chai+osmania+biscuit+hyderabad+cafe", mustTry: ["Irani Chai with Osmania Biscuit"], location: "Nimrah Cafe, Charminar & Irani cafes citywide", rating: 4.8 },
  ],
  bangalore: [
    { name: "Masala Dosa", type: "South Indian Classic", cuisine: "Karnataka", pricePerPerson: 80, image: "https://source.unsplash.com/400x300/?masala+dosa+bangalore+south+indian", mustTry: ["Ghee Roast Dosa", "Set Dosa", "Paper Dosa"], location: "Vidyarthi Bhavan and MTR, Bangalore", rating: 4.8 },
    { name: "Bisi Bele Bath", type: "Karnataka Specialty", cuisine: "Karnataka", pricePerPerson: 100, image: "https://source.unsplash.com/400x300/?bisi+bele+bath+karnataka+hot+rice+lentils", mustTry: ["Classic Bisi Bele Bath with Papad and Ghee"], location: "Traditional Karnataka restaurants", rating: 4.7 },
    { name: "Idli Vada Sambar", type: "South Indian Breakfast", cuisine: "South Indian", pricePerPerson: 60, image: "https://source.unsplash.com/400x300/?idli+vada+sambar+south+indian+breakfast", mustTry: ["Soft Idli with Coconut Chutney and Sambar"], location: "Darshini joints across Bangalore", rating: 4.7 },
    { name: "Ragi Mudde", type: "Traditional Karnataka Meal", cuisine: "Karnataka", pricePerPerson: 80, image: "https://source.unsplash.com/400x300/?ragi+mudde+karnataka+millet+ball+traditional", mustTry: ["Ragi Mudde with Saaru or Chicken Curry"], location: "Local Bangalore restaurants", rating: 4.4 },
    { name: "Filter Coffee", type: "South Indian Beverage", cuisine: "South Indian", pricePerPerson: 30, image: "https://source.unsplash.com/400x300/?filter+coffee+south+india+davara+tumbler", mustTry: ["Traditional Degree Coffee in Davara-Tumbler"], location: "Darshini cafes across Bangalore", rating: 4.8 },
    { name: "Mysore Pak", type: "Traditional Sweet", cuisine: "Karnataka", pricePerPerson: 60, image: "https://source.unsplash.com/400x300/?mysore+pak+karnataka+sweet+ghee", mustTry: ["Soft Mysore Pak", "Crispy Mysore Pak"], location: "Sri Krishna Sweets and Adyar Ananda Bhavan", rating: 4.6 },
  ],
  chennai: [
    { name: "Chettinad Cuisine", type: "South Indian Specialty", cuisine: "Chettinad", pricePerPerson: 200, image: "https://source.unsplash.com/400x300/?chettinad+cuisine+chicken+curry+south+india", mustTry: ["Chettinad Chicken Curry", "Kuzhi Paniyaram"], location: "Chettinad restaurants in Chennai", rating: 4.7 },
    { name: "Filter Coffee (Madras Coffee)", type: "Chennai Staple", cuisine: "South Indian", pricePerPerson: 25, image: "https://source.unsplash.com/400x300/?madras+filter+coffee+chennai+south+indian", mustTry: ["Strong Decoction Filter Coffee with Froth"], location: "Saravana Bhavan and Sangeetha branches", rating: 4.9 },
    { name: "Idiyappam with Kurma", type: "Traditional Breakfast", cuisine: "Tamil Nadu", pricePerPerson: 80, image: "https://source.unsplash.com/400x300/?idiyappam+string+hoppers+south+india+rice", mustTry: ["Rice Idiyappam with Coconut Kurma"], location: "Vegetarian restaurants across Chennai", rating: 4.6 },
    { name: "Kothu Parotta", type: "Street Food Classic", cuisine: "Tamil Nadu", pricePerPerson: 100, image: "https://source.unsplash.com/400x300/?kothu+parotta+chennai+street+food", mustTry: ["Egg Kothu Parotta", "Mutton Kothu Parotta"], location: "Street stalls and restaurants across Chennai", rating: 4.7 },
    { name: "Murukku", type: "Traditional Snack", cuisine: "Tamil Nadu", pricePerPerson: 30, image: "https://source.unsplash.com/400x300/?murukku+south+india+rice+snack+crispy", mustTry: ["Rice Murukku", "Wheat Murukku"], location: "Sweet shops and local stores", rating: 4.5 },
    { name: "Payasam", type: "Traditional Dessert", cuisine: "South Indian", pricePerPerson: 50, image: "https://source.unsplash.com/400x300/?payasam+kheer+south+india+dessert+sweet", mustTry: ["Semiya Payasam", "Aval Payasam"], location: "Temple prasad and South Indian restaurants", rating: 4.6 },
  ],
  kolkata: [
    { name: "Kolkata Biryani", type: "Kolkata's Pride", cuisine: "Kolkata Mughlai", pricePerPerson: 200, image: "https://source.unsplash.com/400x300/?kolkata+biryani+potato+rice+dum", mustTry: ["Mutton Biryani with Aloo and Egg", "Chicken Biryani"], location: "Arsalan, Nizam's, and Shiraz Golden", rating: 4.9 },
    { name: "Kathi Roll", type: "Kolkata's Street Invention", cuisine: "Kolkata Street Food", pricePerPerson: 60, image: "https://source.unsplash.com/400x300/?kathi+roll+kolkata+street+food+egg+wrap", mustTry: ["Egg Roll", "Mutton Kathi Roll", "Paneer Roll"], location: "Nizam's and stalls across Park Street", rating: 4.8 },
    { name: "Rasgulla", type: "Bengali Sweet", cuisine: "Bengali", pricePerPerson: 30, image: "https://source.unsplash.com/400x300/?rasgulla+bengali+sweet+chhena+syrup", mustTry: ["Soft Rasgulla", "Sponge Rasgulla"], location: "K.C. Das and Balaram Mullick sweet shops", rating: 4.8 },
    { name: "Mishti Doi", type: "Bengali Fermented Sweet", cuisine: "Bengali", pricePerPerson: 40, image: "https://source.unsplash.com/400x300/?mishti+doi+bengali+sweet+yoghurt+clay+pot", mustTry: ["Mishti Doi in Clay Pot"], location: "Sweet shops across Kolkata", rating: 4.7 },
    { name: "Phuchka (Pani Puri)", type: "Kolkata's Favourite Chaat", cuisine: "Kolkata Street Food", pricePerPerson: 30, image: "https://source.unsplash.com/400x300/?phuchka+pani+puri+kolkata+tamarind+water", mustTry: ["Tamarind Water Phuchka", "Alu Masala Phuchka"], location: "Victoria Memorial area and street stalls", rating: 4.8 },
    { name: "Sandesh", type: "Bengali Milk Sweet", cuisine: "Bengali", pricePerPerson: 50, image: "https://source.unsplash.com/400x300/?sandesh+bengali+chhena+sweet+milk", mustTry: ["Nolen Gur Sandesh", "Chocolate Sandesh"], location: "Balaram Mullick & Radharaman Mullick", rating: 4.7 },
  ],
};

export function getFoodRecommendations(destination: string): FoodRecommendation[] {
  const dest = destination.toLowerCase().split(",")[0].trim().split(" ")[0];
  for (const [key, foods] of Object.entries(CITY_FOODS)) {
    if (dest.includes(key) || key.includes(dest)) {
      return foods;
    }
  }
  return getGenericFoodRecommendations(destination);
}

function getGenericFoodRecommendations(destination: string): FoodRecommendation[] {
  const dest = destination.split(",")[0].trim();
  return [
    { name: `${dest} Thali`, type: "Local Specialty", cuisine: "Regional Indian", pricePerPerson: 150, image: "https://source.unsplash.com/400x300/?indian+thali+regional+food", mustTry: ["Full Thali with Dal, Sabzi, Roti, Rice", "Seasonal Pickle"], location: `Local restaurants in ${dest}`, rating: 4.4 },
    { name: "Biryani", type: "Regional Biryani", cuisine: "Mughlai / Regional", pricePerPerson: 200, image: "https://source.unsplash.com/400x300/?biryani+indian+dum+rice+aromatic", mustTry: ["Mutton Biryani", "Chicken Biryani"], location: `Popular biryani spots in ${dest}`, rating: 4.5 },
    { name: "Street Chaat", type: "Street Food", cuisine: "North Indian Street Food", pricePerPerson: 40, image: "https://source.unsplash.com/400x300/?chaat+street+food+india+flavour", mustTry: ["Pani Puri", "Bhel Puri", "Sev Puri"], location: `Main market area, ${dest}`, rating: 4.3 },
    { name: "Local Sweets", type: "Traditional Mithai", cuisine: "Indian Sweets", pricePerPerson: 60, image: "https://source.unsplash.com/400x300/?indian+sweets+mithai+traditional", mustTry: ["Gulab Jamun", "Barfi", "Ladoo"], location: `Halwai shops in ${dest}`, rating: 4.4 },
    { name: "Dal & Roti", type: "Comfort Food", cuisine: "North / Central Indian", pricePerPerson: 80, image: "https://source.unsplash.com/400x300/?dal+roti+india+comfort+food", mustTry: ["Dal Tadka with Ghee Roti", "Dal Makhani"], location: `Dhabas along highways and in ${dest}`, rating: 4.3 },
    { name: "Masala Chai", type: "Indian Beverage", cuisine: "Pan India", pricePerPerson: 15, image: "https://source.unsplash.com/400x300/?masala+chai+indian+tea+spiced", mustTry: ["Cutting Chai", "Kulhad Chai"], location: `Tea stalls throughout ${dest}`, rating: 4.7 },
  ];
}

export function getTransportOptions(
  source: string,
  destination: string,
  people: number,
  totalBudget: number,
): TransportOption[] {
  const dist = estimateDistance(source, destination);
  const busCostPerPerson = Math.round(dist * 0.8);
  const trainCostPerPerson = Math.round(dist * 1.2);
  const flightCostPerPerson = Math.round(Math.max(2500, dist * 3.5));
  const carCostTotal = Math.round(dist * 12 + 500);

  const busTotal = busCostPerPerson * people;
  const trainTotal = trainCostPerPerson * people;
  const flightTotal = flightCostPerPerson * people;
  const transportBudget = totalBudget * 0.25;

  let bestMode = "Train";
  if (dist < 200) bestMode = "Bus";
  else if (dist > 800 && flightTotal < transportBudget) bestMode = "Flight";
  else bestMode = "Train";

  return [
    {
      mode: "Bus",
      cost: busTotal,
      duration: `${Math.ceil(dist / 60)} hrs`,
      details: `State buses (KSRTC/MSRTC/RSRTC) and luxury Volvo services. Multiple daily departures from ${source} to ${destination}.`,
      isBestOption: bestMode === "Bus",
      departureTime: "6:00 AM",
      arrivalTime: null,
    },
    {
      mode: "Train",
      cost: trainTotal,
      duration: `${Math.ceil(dist / 80)} hrs`,
      details: `Indian Railways Superfast/Express trains. Book via IRCTC 60–90 days in advance. Rajdhani/Shatabdi/Vande Bharat options available.`,
      isBestOption: bestMode === "Train",
      departureTime: "7:30 AM",
      arrivalTime: null,
    },
    {
      mode: "Flight",
      cost: flightTotal,
      duration: `${Math.max(1, Math.ceil(dist / 700))} hr ${dist < 700 ? "30 min" : ""}`.trim(),
      details: `IndiGo, Air India, SpiceJet, and Vistara flights available. Book 3–4 weeks ahead for best fares. Check airports near ${destination}.`,
      isBestOption: bestMode === "Flight",
      departureTime: "8:00 AM",
      arrivalTime: null,
    },
    {
      mode: "Car",
      cost: carCostTotal,
      duration: `${Math.ceil(dist / 70)} hrs`,
      details: `Self-drive (Zoomcar) or Ola Outstation. Comfortable for ${people <= 4 ? "small groups" : "families"}. National Highway route recommended.`,
      isBestOption: false,
      departureTime: null,
      arrivalTime: null,
    },
  ];
}

function estimateDistance(source: string, dest: string): number {
  const map: Record<string, Record<string, number>> = {
    delhi: { mumbai: 1415, jaipur: 270, agra: 230, goa: 1900, kolkata: 1500, chennai: 2200, bangalore: 2150, hyderabad: 1570, varanasi: 820, lucknow: 550 },
    mumbai: { delhi: 1415, goa: 590, pune: 150, bangalore: 980, chennai: 1340, hyderabad: 710, jaipur: 1150, agra: 1290, kolkata: 2000 },
    bangalore: { mumbai: 980, chennai: 350, hyderabad: 570, goa: 600, mysore: 145, delhi: 2150, kolkata: 1870, ooty: 270 },
    jaipur: { delhi: 270, agra: 240, mumbai: 1150, udaipur: 400, jodhpur: 330, bikaner: 330, ajmer: 135 },
    goa: { mumbai: 590, bangalore: 600, delhi: 1900, pune: 450, hyderabad: 680 },
    agra: { delhi: 230, jaipur: 240, lucknow: 340, varanasi: 680, mathura: 60 },
    kolkata: { delhi: 1500, bangalore: 1870, mumbai: 2000, hyderabad: 1500, varanasi: 680, puri: 500 },
    chennai: { bangalore: 350, mumbai: 1340, delhi: 2200, hyderabad: 630, mysore: 480, ooty: 270 },
    hyderabad: { bangalore: 570, mumbai: 710, delhi: 1570, chennai: 630, kolkata: 1500, goa: 680 },
    varanasi: { delhi: 820, agra: 680, lucknow: 320, kolkata: 680, allahabad: 130 },
  };
  const s = source.toLowerCase().split(",")[0].trim().split(" ")[0];
  const d = dest.toLowerCase().split(",")[0].trim().split(" ")[0];
  for (const [srcKey, dests] of Object.entries(map)) {
    if (s.includes(srcKey) || srcKey.includes(s)) {
      for (const [dstKey, dist] of Object.entries(dests)) {
        if (d.includes(dstKey) || dstKey.includes(d)) return dist;
      }
    }
  }
  return 800;
}

export function getHotelRecommendations(destination: string, people: number, days: number, budget: number): Hotel[] {
  const perPersonPerNight = (budget * 0.35) / (people * days);
  const dest = destination.split(",")[0].trim();
  return [
    {
      name: `Budget Stay ${dest}`,
      type: "Budget",
      pricePerNight: Math.max(500, Math.round(perPersonPerNight * people * 0.35)),
      image: "https://source.unsplash.com/400x300/?budget+hotel+india+room+clean",
      amenities: ["Free WiFi", "AC Room", "24/7 Reception", "Hot Water", "TV"],
      location: `Near ${dest} Bus Stand / Railway Station`,
      rating: 3.5,
    },
    {
      name: `${dest} Comfort Suites`,
      type: "Mid-range",
      pricePerNight: Math.max(1500, Math.round(perPersonPerNight * people * 0.65)),
      image: "https://source.unsplash.com/400x300/?comfortable+hotel+room+india+3star",
      amenities: ["Free WiFi", "Swimming Pool", "Restaurant", "AC", "Room Service", "Gym", "Parking"],
      location: `City Centre, ${dest}`,
      rating: 4.1,
    },
    {
      name: `The Grand ${dest}`,
      type: "Luxury",
      pricePerNight: Math.max(4000, Math.round(perPersonPerNight * people * 1.4)),
      image: "https://source.unsplash.com/400x300/?luxury+hotel+five+star+india+resort",
      amenities: ["Free WiFi", "Spa & Wellness", "Multiple Restaurants", "Rooftop Pool", "Concierge Service", "Airport Transfer", "Butler", "Bar & Lounge"],
      location: `Prime Location, ${dest}`,
      rating: 4.7,
    },
  ];
}

export function generateItinerary(destination: string, days: number, places: Place[]): DayItinerary[] {
  const dest = destination.split(",")[0].trim();
  const placesPerDay = Math.ceil(places.length / days);
  const themes = [
    "Arrival & Iconic Attractions",
    "Heritage & Culture Deep Dive",
    "Nature, Markets & Local Life",
    "Hidden Gems & Leisure",
    "Day Trip & Panoramic Views",
    "Art, Food & Local Experiences",
    "Farewell & Last-Minute Sightseeing",
  ];

  const itinerary: DayItinerary[] = [];

  for (let day = 1; day <= days; day++) {
    const theme = themes[(day - 1) % themes.length];
    const start = (day - 1) * placesPerDay;
    const dayPlaces = places.slice(start, start + placesPerDay);

    const activities = [];

    if (day === 1) {
      activities.push({ time: "11:00 AM", description: `Arrive in ${dest}. Check in to your hotel and freshen up.`, place: null, cost: 0 });
    } else {
      activities.push({ time: "7:30 AM", description: `Start the day with a hearty breakfast. Try a local specialty — you won't regret it.`, place: null, cost: 150 });
    }

    dayPlaces.forEach((place, idx) => {
      const times = ["9:30 AM", "12:30 PM", "3:30 PM", "5:30 PM"];
      const time = times[idx] ?? "10:00 AM";
      activities.push({
        time,
        description: `Visit ${place.name}. ${place.description}`,
        place: place.name,
        cost: place.entryFee ?? 0,
      });
      if (idx === 0) {
        activities.push({ time: "12:00 PM", description: `Lunch break — sample the famous local cuisine of ${dest}.`, place: null, cost: 200 });
      }
    });

    if (day === days) {
      activities.push({ time: "7:30 PM", description: `Farewell dinner at a recommended local restaurant. Pack up and prep for departure.`, place: null, cost: 600 });
    } else {
      activities.push({ time: "7:00 PM", description: `Evening at leisure. Explore the night markets or enjoy the local ambience of ${dest}.`, place: null, cost: 200 });
    }

    itinerary.push({ day, title: `Day ${day}: ${theme}`, activities });
  }

  return itinerary;
}

export function calculateBudget(
  budget: number,
  budgetType: string,
  people: number,
  days: number,
  transportCost: number,
): BudgetBreakdown {
  const total = budgetType === "per_person" ? budget * people : budget;
  const perPerson = budgetType === "per_person" ? budget : budget / people;

  const travelCost = Math.min(transportCost, total * 0.30);
  const remaining = total - travelCost;
  const stayBase = Math.round(remaining * 0.40);
  const foodBase = Math.round(remaining * 0.30);
  const miscBase = remaining - stayBase - foodBase;

  return {
    totalBudget: Math.round(total),
    perPersonBudget: Math.round(perPerson),
    travel: Math.round(travelCost),
    stay: stayBase,
    food: foodBase,
    misc: miscBase,
    travelPercent: Math.round((travelCost / total) * 100),
    stayPercent: Math.round((stayBase / total) * 100),
    foodPercent: Math.round((foodBase / total) * 100),
    miscPercent: Math.round((miscBase / total) * 100),
  };
}
