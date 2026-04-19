import type { Place, Hotel, FoodRecommendation, TransportOption, DayItinerary, BudgetBreakdown } from "@workspace/api-zod";

export interface Coordinates {
  lat: number;
  lon: number;
}

function pimg(seed: string): string {
  const slug = seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `https://picsum.photos/seed/${slug}/400/300`;
}

function fimg(keywords: string, lock: number): string {
  const kw = keywords.toLowerCase().replace(/[^a-z0-9, ]+/g, "").replace(/\s+/g, ",");
  return `https://loremflickr.com/400/300/${kw}?lock=${lock}`;
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
      headers: { "User-Agent": "TravelPlannerIndia/1.0 (travel-planner@replit.app)" },
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
}

export async function fetchPlacesFromOverpass(lat: number, lon: number, destination: string, maxPlaces: number): Promise<Place[]> {
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
      if (!name || seen.has(name.toLowerCase()) || name.length < 4) continue;
      seen.add(name.toLowerCase());
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      const cat = el.tags?.tourism || el.tags?.historic || el.tags?.leisure || "attraction";

      places.push({
        name,
        description: getCategoryDescription(cat, name, destination),
        image: pimg(`${destination}-${name}`),
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
    attraction: "Attraction", museum: "Museum", viewpoint: "Viewpoint",
    gallery: "Art Gallery", theme_park: "Theme Park", zoo: "Zoo",
    monument: "Monument", castle: "Fort / Castle", ruins: "Historical Ruins",
    temple: "Temple", mosque: "Mosque", church: "Church", fort: "Fort",
    building: "Heritage Building", park: "Park", garden: "Garden",
    nature_reserve: "Nature Reserve", archaeological_site: "Archaeological Site",
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
    garden: `${name} is a serene garden in ${destination}, ideal for walks and photography.`,
    viewpoint: `${name} offers breathtaking panoramic views of ${destination} and the surrounding landscape.`,
    ruins: `The ancient ruins of ${name} reveal the story of a civilisation that once thrived in ${destination}.`,
    zoo: `${name} is home to diverse wildlife and is a popular family destination in ${destination}.`,
    gallery: `${name} showcases exceptional art and cultural artefacts representing the spirit of ${destination}.`,
    archaeological_site: `${name} is an important archaeological site revealing the ancient heritage of ${destination}.`,
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
    { name: "Baga Beach", description: "One of Goa's most popular beaches, famous for water sports, shacks, and vibrant nightlife.", image: pimg("baga-beach-goa"), category: "Beach", lat: 15.5565, lon: 73.7517, entryFee: 0, timings: "24 Hours", rating: 4.3 },
    { name: "Basilica of Bom Jesus", description: "A UNESCO World Heritage Site and one of the finest examples of Baroque architecture in India.", image: pimg("basilica-bom-jesus-goa"), category: "Heritage", lat: 15.5009, lon: 73.9116, entryFee: 0, timings: "9:00 AM – 6:30 PM", rating: 4.6 },
    { name: "Dudhsagar Waterfalls", description: "One of India's tallest waterfalls, a four-tiered cascade surrounded by dense forest.", image: pimg("dudhsagar-waterfall-goa"), category: "Nature", lat: 15.3144, lon: 74.3144, entryFee: 400, timings: "7:00 AM – 5:00 PM", rating: 4.5 },
    { name: "Fort Aguada", description: "A well-preserved 17th-century Portuguese fort overlooking the Arabian Sea.", image: pimg("fort-aguada-goa"), category: "Fort", lat: 15.4958, lon: 73.7749, entryFee: 0, timings: "9:30 AM – 6:00 PM", rating: 4.2 },
    { name: "Calangute Beach", description: "Known as the Queen of Beaches, Calangute is Goa's largest beach in North Goa.", image: pimg("calangute-beach-goa"), category: "Beach", lat: 15.5439, lon: 73.7553, entryFee: 0, timings: "24 Hours", rating: 4.0 },
    { name: "Chapora Fort", description: "An ancient fort on a hill offering sweeping views of the Arabian Sea and Vagator Beach.", image: pimg("chapora-fort-goa"), category: "Fort", lat: 15.6020, lon: 73.7349, entryFee: 0, timings: "Sunrise to Sunset", rating: 4.3 },
    { name: "Anjuna Flea Market", description: "A vibrant Wednesday market where locals and tourists trade handicrafts, clothes, and curios.", image: pimg("anjuna-flea-market-goa"), category: "Market", lat: 15.5736, lon: 73.7425, entryFee: 0, timings: "Wednesday 8:00 AM – Sunset", rating: 4.1 },
    { name: "Palolem Beach", description: "A crescent-shaped beach in South Goa, known for its calm waters and serene ambience.", image: pimg("palolem-beach-south-goa"), category: "Beach", lat: 15.0100, lon: 74.0230, entryFee: 0, timings: "24 Hours", rating: 4.5 },
    { name: "Se Cathedral", description: "One of the largest churches in Asia, an excellent example of Portuguese-Gothic architecture.", image: pimg("se-cathedral-old-goa"), category: "Heritage", lat: 15.5018, lon: 73.9114, entryFee: 0, timings: "7:30 AM – 6:30 PM", rating: 4.4 },
    { name: "Vagator Beach", description: "A dramatic red-cliffed beach in North Goa popular with backpackers and nature lovers.", image: pimg("vagator-beach-goa"), category: "Beach", lat: 15.5988, lon: 73.7404, entryFee: 0, timings: "24 Hours", rating: 4.2 },
    { name: "Mandrem Beach", description: "A peaceful, less-crowded beach ideal for relaxation, yoga retreats, and sunsets.", image: pimg("mandrem-beach-goa"), category: "Beach", lat: 15.6449, lon: 73.7273, entryFee: 0, timings: "24 Hours", rating: 4.4 },
    { name: "Goa State Museum", description: "Houses a rich collection of sculptures, coins, and natural history artefacts from Goa.", image: pimg("goa-state-museum"), category: "Museum", lat: 15.4933, lon: 73.8278, entryFee: 10, timings: "9:30 AM – 5:30 PM (Closed Monday)", rating: 3.8 },
  ],
  jaipur: [
    { name: "Amber Fort", description: "A majestic fort built with red sandstone and marble, overlooking the serene Maota Lake.", image: pimg("amber-fort-jaipur"), category: "Fort", lat: 26.9855, lon: 75.8513, entryFee: 200, timings: "8:00 AM – 5:30 PM", rating: 4.7 },
    { name: "Hawa Mahal", description: "The iconic Palace of Winds — a five-story honeycomb facade of 953 small windows.", image: pimg("hawa-mahal-jaipur"), category: "Palace", lat: 26.9239, lon: 75.8267, entryFee: 50, timings: "9:00 AM – 5:00 PM", rating: 4.5 },
    { name: "City Palace Jaipur", description: "A grand palace complex blending Rajasthani and Mughal architecture in the heart of Jaipur.", image: pimg("city-palace-jaipur"), category: "Palace", lat: 26.9257, lon: 75.8236, entryFee: 300, timings: "9:30 AM – 5:00 PM", rating: 4.6 },
    { name: "Jantar Mantar Jaipur", description: "A UNESCO World Heritage Site featuring 19 large astronomical instruments built in the 18th century.", image: pimg("jantar-mantar-jaipur"), category: "Heritage", lat: 26.9247, lon: 75.8244, entryFee: 100, timings: "9:00 AM – 4:30 PM", rating: 4.4 },
    { name: "Nahargarh Fort", description: "A 18th-century fort on the Aravalli Hills with sweeping views over the Pink City at sunset.", image: pimg("nahargarh-fort-jaipur"), category: "Fort", lat: 26.9397, lon: 75.8083, entryFee: 100, timings: "10:00 AM – 5:30 PM", rating: 4.4 },
    { name: "Jal Mahal", description: "The Water Palace — an ethereal palace that appears to float in the middle of Man Sagar Lake.", image: pimg("jal-mahal-jaipur"), category: "Palace", lat: 26.9500, lon: 75.8467, entryFee: 0, timings: "Viewable from road", rating: 4.5 },
    { name: "Albert Hall Museum", description: "Rajasthan's oldest museum with a rich collection of art, coins, and historical artefacts.", image: pimg("albert-hall-museum-jaipur"), category: "Museum", lat: 26.9124, lon: 75.8157, entryFee: 40, timings: "10:00 AM – 5:30 PM", rating: 4.3 },
    { name: "Jaigarh Fort", description: "Built to protect Amber Fort, Jaigarh houses the world's largest wheeled cannon, Jai Vana.", image: pimg("jaigarh-fort-jaipur"), category: "Fort", lat: 26.9869, lon: 75.8386, entryFee: 100, timings: "9:00 AM – 4:30 PM", rating: 4.4 },
    { name: "Johari Bazaar", description: "A famous street market in Jaipur renowned for jewellery, gems, and traditional Rajasthani textiles.", image: pimg("johari-bazaar-jaipur"), category: "Market", lat: 26.9197, lon: 75.8239, entryFee: 0, timings: "10:00 AM – 8:00 PM", rating: 4.2 },
    { name: "Birla Mandir Jaipur", description: "A modern marble temple dedicated to Vishnu and Lakshmi, with intricate carvings and city views.", image: pimg("birla-mandir-jaipur"), category: "Temple", lat: 26.8997, lon: 75.8294, entryFee: 0, timings: "6:00 AM – 12:00 PM, 3:00 PM – 9:00 PM", rating: 4.5 },
    { name: "Sisodia Rani Garden", description: "A multi-terraced Mughal garden with fountains, frescoes, and pavilions.", image: pimg("sisodia-rani-garden-jaipur"), category: "Garden", lat: 26.8956, lon: 75.9012, entryFee: 30, timings: "8:00 AM – 6:00 PM", rating: 4.1 },
    { name: "Chokhi Dhani", description: "A village-themed resort showcasing traditional Rajasthani culture, food, and folk art.", image: pimg("chokhi-dhani-jaipur"), category: "Cultural Experience", lat: 26.7720, lon: 75.8614, entryFee: 600, timings: "5:00 PM – 11:00 PM", rating: 4.5 },
  ],
  mumbai: [
    { name: "Gateway of India", description: "The iconic 26-metre arch monument built in 1924, overlooking Mumbai Harbour.", image: pimg("gateway-of-india-mumbai"), category: "Monument", lat: 18.9220, lon: 72.8347, entryFee: 0, timings: "24 Hours", rating: 4.5 },
    { name: "Marine Drive", description: "A 3.6 km boulevard curving along the Arabian Sea, nicknamed the Queen's Necklace at night.", image: pimg("marine-drive-mumbai"), category: "Promenade", lat: 18.9440, lon: 72.8234, entryFee: 0, timings: "24 Hours", rating: 4.6 },
    { name: "Elephanta Caves", description: "A UNESCO World Heritage Site — rock-cut cave temples with monumental Shiva sculptures on an island.", image: pimg("elephanta-caves-mumbai"), category: "Heritage", lat: 18.9633, lon: 72.9315, entryFee: 40, timings: "9:30 AM – 5:30 PM (Closed Monday)", rating: 4.4 },
    { name: "Chhatrapati Shivaji Terminus", description: "A UNESCO World Heritage Site — one of the finest examples of Victorian Gothic Revival architecture in India.", image: pimg("cst-mumbai-railway"), category: "Heritage", lat: 18.9399, lon: 72.8355, entryFee: 0, timings: "Open daily", rating: 4.5 },
    { name: "Juhu Beach", description: "Mumbai's most popular seaside escape, lined with chaat stalls and street food joints.", image: pimg("juhu-beach-mumbai"), category: "Beach", lat: 19.0984, lon: 72.8266, entryFee: 0, timings: "24 Hours", rating: 4.1 },
    { name: "Sanjay Gandhi National Park", description: "A protected forest reserve in the heart of Mumbai, home to the ancient Kanheri Caves.", image: pimg("sanjay-gandhi-national-park-mumbai"), category: "Nature", lat: 19.2147, lon: 72.9107, entryFee: 66, timings: "7:30 AM – 6:30 PM", rating: 4.4 },
    { name: "Haji Ali Dargah", description: "An iconic mosque and dargah situated on a tiny islet in the Arabian Sea.", image: pimg("haji-ali-dargah-mumbai"), category: "Mosque", lat: 18.9827, lon: 72.8089, entryFee: 0, timings: "5:30 AM – 10:00 PM", rating: 4.6 },
    { name: "Siddhivinayak Temple", description: "One of Mumbai's most revered Hindu temples, dedicated to Lord Ganesha and visited by millions.", image: pimg("siddhivinayak-temple-mumbai"), category: "Temple", lat: 19.0165, lon: 72.8312, entryFee: 0, timings: "5:30 AM – 10:00 PM", rating: 4.7 },
    { name: "Colaba Causeway Market", description: "A vibrant street market in South Mumbai selling antiques, clothing, jewellery, and handicrafts.", image: pimg("colaba-causeway-mumbai"), category: "Market", lat: 18.9148, lon: 72.8315, entryFee: 0, timings: "10:00 AM – 10:00 PM", rating: 4.1 },
    { name: "CSMVS Museum Mumbai", description: "Mumbai's premier museum housing over 50,000 artefacts of Indian history, art, and natural history.", image: pimg("csmvs-museum-mumbai"), category: "Museum", lat: 18.9268, lon: 72.8326, entryFee: 85, timings: "10:15 AM – 6:00 PM", rating: 4.4 },
    { name: "Bandra Worli Sea Link", description: "A stunning eight-lane cable-stayed bridge across Mahim Bay, an engineering marvel of Mumbai.", image: pimg("bandra-worli-sea-link-mumbai"), category: "Landmark", lat: 19.0230, lon: 72.8165, entryFee: 0, timings: "24 Hours", rating: 4.5 },
    { name: "Bandstand Promenade", description: "A scenic seafront promenade in Bandra lined with heritage bungalows.", image: pimg("bandstand-bandra-mumbai"), category: "Promenade", lat: 19.0480, lon: 72.8252, entryFee: 0, timings: "24 Hours", rating: 4.3 },
  ],
  delhi: [
    { name: "Red Fort", description: "A UNESCO World Heritage Site and 17th-century Mughal fort — the seat of power of the Mughal Empire.", image: pimg("red-fort-delhi"), category: "Fort", lat: 28.6562, lon: 77.2410, entryFee: 50, timings: "9:30 AM – 4:30 PM (Closed Monday)", rating: 4.5 },
    { name: "Qutub Minar", description: "A 73-metre tall UNESCO Heritage minaret — one of the finest towers in the world.", image: pimg("qutub-minar-delhi"), category: "Heritage", lat: 28.5245, lon: 77.1855, entryFee: 40, timings: "7:00 AM – 5:00 PM", rating: 4.6 },
    { name: "India Gate", description: "A war memorial honouring 70,000 soldiers, standing majestically on the Kartavya Path.", image: pimg("india-gate-delhi"), category: "Monument", lat: 28.6129, lon: 77.2295, entryFee: 0, timings: "24 Hours", rating: 4.6 },
    { name: "Humayun's Tomb", description: "A stunning UNESCO World Heritage Site garden tomb that inspired the Taj Mahal.", image: pimg("humayuns-tomb-delhi"), category: "Heritage", lat: 28.5933, lon: 77.2507, entryFee: 40, timings: "Sunrise to Sunset", rating: 4.6 },
    { name: "Lotus Temple", description: "A Bahai House of Worship shaped like a blooming lotus flower, open to all faiths.", image: pimg("lotus-temple-delhi"), category: "Temple", lat: 28.5535, lon: 77.2588, entryFee: 0, timings: "9:00 AM – 5:30 PM (Closed Monday)", rating: 4.6 },
    { name: "Chandni Chowk", description: "One of the oldest markets in India — a labyrinth of lanes, spices, sweets, and street food.", image: pimg("chandni-chowk-delhi"), category: "Market", lat: 28.6506, lon: 77.2319, entryFee: 0, timings: "8:00 AM – 8:00 PM", rating: 4.3 },
    { name: "Akshardham Temple Delhi", description: "A magnificent Hindu temple complex — a spiritual and cultural campus spread over 100 acres.", image: pimg("akshardham-temple-delhi"), category: "Temple", lat: 28.6127, lon: 77.2773, entryFee: 0, timings: "10:00 AM – 6:30 PM (Closed Monday)", rating: 4.7 },
    { name: "Jama Masjid Delhi", description: "India's largest mosque, built by Mughal Emperor Shah Jahan, accommodating 25,000 worshippers.", image: pimg("jama-masjid-delhi"), category: "Mosque", lat: 28.6507, lon: 77.2334, entryFee: 0, timings: "7:00 AM – 12:00 PM, 1:30 PM – 6:30 PM", rating: 4.5 },
    { name: "National Museum Delhi", description: "India's largest museum housing over 2 lakh artefacts including Indus Valley, Mughal and tribal art.", image: pimg("national-museum-delhi"), category: "Museum", lat: 28.6116, lon: 77.2193, entryFee: 20, timings: "10:00 AM – 6:00 PM (Closed Monday)", rating: 4.4 },
    { name: "Hauz Khas Village", description: "A 14th-century reservoir with ruins, boutiques, cafes, and art galleries.", image: pimg("hauz-khas-village-delhi"), category: "Heritage", lat: 28.5494, lon: 77.2001, entryFee: 0, timings: "Open daily", rating: 4.3 },
    { name: "Purana Qila", description: "One of the oldest forts in Delhi, built by Humayun and Sher Shah Suri in the 16th century.", image: pimg("purana-qila-delhi"), category: "Fort", lat: 28.6126, lon: 77.2428, entryFee: 20, timings: "7:00 AM – 5:00 PM", rating: 4.3 },
    { name: "Raj Ghat", description: "The memorial to Mahatma Gandhi — a black marble platform marking the site of his cremation.", image: pimg("raj-ghat-delhi"), category: "Memorial", lat: 28.6398, lon: 77.2498, entryFee: 0, timings: "6:00 AM – 6:00 PM", rating: 4.5 },
  ],
  agra: [
    { name: "Taj Mahal", description: "One of the Seven Wonders of the World — an ivory-white marble mausoleum built by Emperor Shah Jahan.", image: pimg("taj-mahal-agra"), category: "Heritage", lat: 27.1751, lon: 78.0421, entryFee: 250, timings: "Sunrise to Sunset (Closed Friday)", rating: 4.9 },
    { name: "Agra Fort", description: "A UNESCO World Heritage Site — a 16th-century Mughal fort that served as the main residence of emperors.", image: pimg("agra-fort"), category: "Fort", lat: 27.1795, lon: 78.0211, entryFee: 50, timings: "6:00 AM – 6:00 PM", rating: 4.5 },
    { name: "Fatehpur Sikri", description: "A UNESCO World Heritage Site — the former Mughal capital built by Emperor Akbar.", image: pimg("fatehpur-sikri-agra"), category: "Heritage", lat: 27.0945, lon: 77.6611, entryFee: 40, timings: "Sunrise to Sunset", rating: 4.5 },
    { name: "Mehtab Bagh", description: "A 16th-century charbagh offering the most spectacular moonlit view of the Taj Mahal.", image: pimg("mehtab-bagh-agra"), category: "Garden", lat: 27.1811, lon: 78.0344, entryFee: 20, timings: "Sunrise to Sunset", rating: 4.4 },
    { name: "Itimad ud Daulah", description: "Called the Baby Taj, this delicate mausoleum predates the Taj Mahal and introduced pietra dura work.", image: pimg("itimad-ud-daulah-agra"), category: "Heritage", lat: 27.1964, lon: 78.0347, entryFee: 20, timings: "Sunrise to Sunset", rating: 4.4 },
    { name: "Akbar's Tomb Sikandra", description: "The tomb of Mughal Emperor Akbar, set within a large garden enclosure near Agra.", image: pimg("akbars-tomb-sikandra"), category: "Heritage", lat: 27.2044, lon: 77.9631, entryFee: 20, timings: "Sunrise to Sunset", rating: 4.3 },
    { name: "Agra Bear Rescue Facility", description: "A sanctuary that rescues and rehabilitates dancing bears — a unique and moving attraction.", image: pimg("agra-bear-rescue"), category: "Wildlife", lat: 27.1647, lon: 78.1103, entryFee: 0, timings: "9:00 AM – 5:00 PM", rating: 4.5 },
    { name: "Kinari Bazaar Agra", description: "A colourful market near Agra Fort known for marble crafts, zari embroidery, and street food.", image: pimg("kinari-bazaar-agra"), category: "Market", lat: 27.1804, lon: 78.0189, entryFee: 0, timings: "10:00 AM – 8:00 PM", rating: 4.0 },
  ],
  varanasi: [
    { name: "Dashashwamedh Ghat", description: "The main ghat in Varanasi, where the nightly Ganga Aarti is performed.", image: pimg("dashashwamedh-ghat-varanasi"), category: "Ghat", lat: 25.3050, lon: 83.0112, entryFee: 0, timings: "Aarti at 7:00 PM daily", rating: 4.8 },
    { name: "Kashi Vishwanath Temple", description: "One of the holiest Hindu temples dedicated to Lord Shiva, on the western bank of the Ganga.", image: pimg("kashi-vishwanath-temple-varanasi"), category: "Temple", lat: 25.3109, lon: 83.0107, entryFee: 0, timings: "3:00 AM – 11:00 PM", rating: 4.7 },
    { name: "Manikarnika Ghat", description: "One of the oldest and most sacred burning ghats — central to Hindu moksha beliefs.", image: pimg("manikarnika-ghat-varanasi"), category: "Ghat", lat: 25.3092, lon: 83.0115, entryFee: 0, timings: "24 Hours", rating: 4.5 },
    { name: "Sarnath", description: "The site where Buddha delivered his first sermon — now home to the Dhamek Stupa.", image: pimg("sarnath-stupa-varanasi"), category: "Heritage", lat: 25.3791, lon: 83.0224, entryFee: 20, timings: "Sunrise to Sunset", rating: 4.5 },
    { name: "Assi Ghat", description: "A lively ghat at the confluence of Assi and Ganga rivers, popular for yoga at sunrise.", image: pimg("assi-ghat-varanasi"), category: "Ghat", lat: 25.2799, lon: 82.9988, entryFee: 0, timings: "24 Hours", rating: 4.4 },
    { name: "Ramnagar Fort", description: "An 18th-century fort across the Ganga from Varanasi, housing a museum with vintage cars.", image: pimg("ramnagar-fort-varanasi"), category: "Fort", lat: 25.2712, lon: 83.0288, entryFee: 15, timings: "10:00 AM – 5:00 PM", rating: 4.1 },
    { name: "Bharat Mata Mandir", description: "A unique temple dedicated to Mother India, featuring a marble map of undivided India.", image: pimg("bharat-mata-mandir-varanasi"), category: "Temple", lat: 25.3306, lon: 83.0132, entryFee: 0, timings: "5:00 AM – 9:00 PM", rating: 4.3 },
    { name: "Ganga Boat Ride", description: "A sunrise or sunset boat ride along the Ganga — the most iconic Varanasi experience.", image: pimg("ganga-boat-ride-varanasi"), category: "Experience", lat: 25.3050, lon: 83.0100, entryFee: 200, timings: "Sunrise & Sunset", rating: 4.8 },
  ],
  hyderabad: [
    { name: "Charminar", description: "The iconic 16th-century monument and mosque with four minarets, the symbol of Hyderabad.", image: pimg("charminar-hyderabad"), category: "Monument", lat: 17.3616, lon: 78.4747, entryFee: 25, timings: "9:30 AM – 5:30 PM", rating: 4.5 },
    { name: "Golconda Fort", description: "A 13th-century fort renowned for its impressive architecture, acoustic system, and diamond trade history.", image: pimg("golconda-fort-hyderabad"), category: "Fort", lat: 17.3833, lon: 78.4011, entryFee: 15, timings: "8:00 AM – 5:30 PM", rating: 4.5 },
    { name: "Hussain Sagar Lake", description: "A heart-shaped lake in the centre of Hyderabad with a giant Buddha statue on an island.", image: pimg("hussain-sagar-lake-hyderabad"), category: "Lake", lat: 17.4239, lon: 78.4738, entryFee: 0, timings: "24 Hours", rating: 4.3 },
    { name: "Qutb Shahi Tombs", description: "The royal necropolis of the Qutb Shahi dynasty — a UNESCO tentative site.", image: pimg("qutb-shahi-tombs-hyderabad"), category: "Heritage", lat: 17.3964, lon: 78.3978, entryFee: 15, timings: "9:00 AM – 4:30 PM (Closed Friday)", rating: 4.4 },
    { name: "Salar Jung Museum", description: "One of the largest one-man collections in the world with 43,000 artefacts.", image: pimg("salar-jung-museum-hyderabad"), category: "Museum", lat: 17.3712, lon: 78.4787, entryFee: 20, timings: "10:00 AM – 5:00 PM (Closed Friday)", rating: 4.5 },
    { name: "Chowmahalla Palace", description: "An 18th-century palace complex that was the seat of the Nizam of Hyderabad.", image: pimg("chowmahalla-palace-hyderabad"), category: "Palace", lat: 17.3601, lon: 78.4713, entryFee: 80, timings: "10:00 AM – 5:00 PM (Closed Friday)", rating: 4.4 },
    { name: "Ramoji Film City", description: "The world's largest film studio complex certified by Guinness, offering tours and live shows.", image: pimg("ramoji-film-city-hyderabad"), category: "Attraction", lat: 17.2543, lon: 78.6808, entryFee: 1150, timings: "9:00 AM – 5:30 PM", rating: 4.3 },
    { name: "Lad Bazaar", description: "A vibrant bazaar near Charminar famous for lacquer bangles, pearls, and traditional crafts.", image: pimg("lad-bazaar-hyderabad"), category: "Market", lat: 17.3618, lon: 78.4745, entryFee: 0, timings: "10:00 AM – 8:00 PM", rating: 4.2 },
  ],
  bangalore: [
    { name: "Bangalore Palace", description: "A Tudor-style palace built in 1887, modelled on Windsor Castle, housing a museum.", image: pimg("bangalore-palace"), category: "Palace", lat: 12.9987, lon: 77.5920, entryFee: 230, timings: "10:00 AM – 5:30 PM", rating: 4.2 },
    { name: "Lalbagh Botanical Garden", description: "A 240-acre garden housing over 1,000 plant species and a 3,000-year-old rock.", image: pimg("lalbagh-botanical-garden-bangalore"), category: "Garden", lat: 12.9507, lon: 77.5848, entryFee: 20, timings: "6:00 AM – 7:00 PM", rating: 4.4 },
    { name: "Cubbon Park", description: "A lush 300-acre park in the heart of Bangalore, home to the State Library and High Court.", image: pimg("cubbon-park-bangalore"), category: "Park", lat: 12.9763, lon: 77.5929, entryFee: 0, timings: "6:00 AM – 6:00 PM", rating: 4.4 },
    { name: "Tipu Sultan's Summer Palace", description: "An 18th-century Indo-Islamic wooden palace that was the summer retreat of Tipu Sultan.", image: pimg("tipu-sultan-palace-bangalore"), category: "Palace", lat: 12.9604, lon: 77.5735, entryFee: 15, timings: "8:30 AM – 5:30 PM", rating: 4.1 },
    { name: "ISKCON Temple Bangalore", description: "A magnificent marble temple devoted to Lord Krishna, one of the largest ISKCON temples.", image: pimg("iskcon-temple-bangalore"), category: "Temple", lat: 13.0099, lon: 77.5510, entryFee: 0, timings: "7:15 AM – 1:00 PM, 4:00 PM – 8:30 PM", rating: 4.6 },
    { name: "Wonderla Amusement Park", description: "South India's premier amusement park with over 60 land and water rides.", image: pimg("wonderla-amusement-park-bangalore"), category: "Theme Park", lat: 12.8444, lon: 77.4057, entryFee: 999, timings: "11:00 AM – 6:00 PM", rating: 4.4 },
    { name: "Commercial Street Bangalore", description: "Bangalore's busiest shopping street — a paradise for clothes, jewellery, and accessories.", image: pimg("commercial-street-bangalore"), category: "Market", lat: 12.9831, lon: 77.6101, entryFee: 0, timings: "10:00 AM – 9:00 PM", rating: 4.2 },
    { name: "Vidhana Soudha", description: "Karnataka's seat of government — a grand granite neo-Dravidian building.", image: pimg("vidhana-soudha-bangalore"), category: "Landmark", lat: 12.9793, lon: 77.5906, entryFee: 0, timings: "Viewable from outside", rating: 4.4 },
  ],
  chennai: [
    { name: "Marina Beach", description: "The second longest urban beach in the world, stretching 13 km along the Bay of Bengal.", image: pimg("marina-beach-chennai"), category: "Beach", lat: 13.0500, lon: 80.2824, entryFee: 0, timings: "24 Hours", rating: 4.4 },
    { name: "Kapaleeshwarar Temple", description: "A Dravidian-style temple dedicated to Lord Shiva, known for its ornate gopuram in Mylapore.", image: pimg("kapaleeshwarar-temple-chennai"), category: "Temple", lat: 13.0338, lon: 80.2694, entryFee: 0, timings: "5:45 AM – 12:30 PM, 4:00 PM – 9:30 PM", rating: 4.6 },
    { name: "Government Museum Chennai", description: "One of the oldest museums in India, housing the Bronze Gallery and National Art Gallery.", image: pimg("government-museum-chennai"), category: "Museum", lat: 13.0680, lon: 80.2485, entryFee: 20, timings: "9:30 AM – 5:00 PM (Closed Wednesday)", rating: 4.3 },
    { name: "Fort St George Chennai", description: "The first English fortress built in India (1644), now housing the Tamil Nadu Assembly.", image: pimg("fort-st-george-chennai"), category: "Fort", lat: 13.0795, lon: 80.2874, entryFee: 5, timings: "9:00 AM – 5:00 PM (Closed Friday)", rating: 4.2 },
    { name: "San Thome Cathedral", description: "A minor basilica built over the tomb of St. Thomas the Apostle.", image: pimg("san-thome-cathedral-chennai"), category: "Heritage", lat: 13.0320, lon: 80.2788, entryFee: 0, timings: "6:00 AM – 8:00 PM", rating: 4.4 },
    { name: "Elliot's Beach Besant Nagar", description: "A quieter, cleaner beach in Besant Nagar loved by locals for evening strolls.", image: pimg("elliots-beach-besant-nagar-chennai"), category: "Beach", lat: 12.9988, lon: 80.2715, entryFee: 0, timings: "24 Hours", rating: 4.3 },
    { name: "Valluvar Kottam", description: "A chariot-shaped monument honouring the Tamil poet Thiruvalluvar.", image: pimg("valluvar-kottam-chennai"), category: "Monument", lat: 13.0544, lon: 80.2446, entryFee: 5, timings: "9:30 AM – 6:00 PM", rating: 4.1 },
  ],
  kolkata: [
    { name: "Victoria Memorial", description: "A magnificent white marble monument dedicated to Queen Victoria — Kolkata's most iconic landmark.", image: pimg("victoria-memorial-kolkata"), category: "Monument", lat: 22.5448, lon: 88.3426, entryFee: 30, timings: "10:00 AM – 5:00 PM (Closed Monday)", rating: 4.7 },
    { name: "Howrah Bridge", description: "One of the world's busiest cantilever bridges crossing the Hooghly River — a symbol of Kolkata.", image: pimg("howrah-bridge-kolkata"), category: "Landmark", lat: 22.5851, lon: 88.3468, entryFee: 0, timings: "24 Hours", rating: 4.7 },
    { name: "Dakshineswar Kali Temple", description: "A revered 19th-century Hindu temple on the banks of the Hooghly.", image: pimg("dakshineswar-kali-temple-kolkata"), category: "Temple", lat: 22.6545, lon: 88.3579, entryFee: 0, timings: "6:00 AM – 12:30 PM, 3:00 PM – 8:30 PM", rating: 4.6 },
    { name: "Indian Museum Kolkata", description: "The oldest and largest museum in the Asia-Pacific region, housing 100,000+ rare artefacts.", image: pimg("indian-museum-kolkata"), category: "Museum", lat: 22.5572, lon: 88.3503, entryFee: 30, timings: "10:00 AM – 5:00 PM (Closed Monday)", rating: 4.4 },
    { name: "Park Street Kolkata", description: "Kolkata's social and cultural hub — a bustling street lined with cafes, clubs, and bookshops.", image: pimg("park-street-kolkata"), category: "Promenade", lat: 22.5512, lon: 88.3534, entryFee: 0, timings: "24 Hours", rating: 4.3 },
    { name: "Belur Math", description: "The headquarters of the Ramakrishna Mission — a serene campus blending Hindu, Islamic, and Christian architecture.", image: pimg("belur-math-kolkata"), category: "Temple", lat: 22.6366, lon: 88.3565, entryFee: 0, timings: "6:30 AM – 11:30 AM, 3:30 PM – 8:00 PM", rating: 4.6 },
    { name: "Science City Kolkata", description: "One of the largest science centres in Southeast Asia with interactive exhibits and a planetarium.", image: pimg("science-city-kolkata"), category: "Attraction", lat: 22.5356, lon: 88.3966, entryFee: 60, timings: "9:00 AM – 7:00 PM", rating: 4.3 },
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
    { suffix: "Fort", cat: "Fort", seed: "ancient-fort-india" },
    { suffix: "Temple", cat: "Temple", seed: "hindu-temple-india" },
    { suffix: "Museum", cat: "Museum", seed: "museum-india-art" },
    { suffix: "Lake", cat: "Lake", seed: "india-lake-scenic" },
    { suffix: "Garden", cat: "Garden", seed: "botanical-garden-india" },
    { suffix: "Market", cat: "Market", seed: "india-market-bazaar" },
    { suffix: "Viewpoint", cat: "Viewpoint", seed: "india-viewpoint-scenic" },
    { suffix: "Waterfall", cat: "Nature", seed: "india-waterfall-nature" },
    { suffix: "Archaeological Site", cat: "Heritage", seed: "india-heritage-monument" },
    { suffix: "Palace", cat: "Palace", seed: "india-palace-royal" },
    { suffix: "Wildlife Sanctuary", cat: "Nature", seed: "india-wildlife-sanctuary" },
    { suffix: "Cave", cat: "Heritage", seed: "india-cave-historic" },
  ];
  return templates.slice(0, maxPlaces).map((t, i) => ({
    name: `${dest} ${t.suffix}`,
    description: `${dest} ${t.suffix} is a renowned ${t.cat.toLowerCase()} destination and a must-visit landmark in ${dest}, offering a unique cultural experience.`,
    image: pimg(`${t.seed}-${i}`),
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
    { name: "Fish Curry Rice", type: "Local Specialty", cuisine: "Goan", pricePerPerson: 150, image: fimg("fish curry rice goa", 101), mustTry: ["Kingfish Curry", "Pomfret Curry", "Clam Rice"], location: "Served in shacks and homes across Goa", rating: 4.8 },
    { name: "Bebinca", type: "Traditional Dessert", cuisine: "Goan-Portuguese", pricePerPerson: 80, image: fimg("bebinca goan dessert layered", 102), mustTry: ["Classic Bebinca", "Coconut Bebinca"], location: "Pastelarias and sweet shops across Goa", rating: 4.6 },
    { name: "Prawn Balchão", type: "Famous Dish", cuisine: "Goan Spicy", pricePerPerson: 250, image: fimg("prawn goan spicy food", 103), mustTry: ["Prawn Balchão", "Fish Balchão"], location: "Goan restaurants and beach shacks", rating: 4.5 },
    { name: "Ros Omelette", type: "Street Snack", cuisine: "Goan", pricePerPerson: 60, image: fimg("omelette bread goan snack", 104), mustTry: ["Classic Ros Omelette", "Egg Bread"], location: "Mapusa Market and local stalls", rating: 4.3 },
    { name: "Sorpotel", type: "Traditional Dish", cuisine: "Goan-Portuguese", pricePerPerson: 200, image: fimg("pork curry goan food", 105), mustTry: ["Pork Sorpotel with Sanna"], location: "Traditional Goan eateries", rating: 4.4 },
    { name: "Feni", type: "Local Beverage", cuisine: "Goan", pricePerPerson: 100, image: fimg("cashew feni goa drink", 106), mustTry: ["Cashew Feni", "Coconut Feni"], location: "Local bars and toddy shops across Goa", rating: 4.2 },
  ],
  jaipur: [
    { name: "Dal Baati Churma", type: "Signature Rajasthani Dish", cuisine: "Rajasthani", pricePerPerson: 200, image: fimg("dal baati churma rajasthani food", 201), mustTry: ["Dal Baati with Ghee", "Churma Ladoo"], location: "Local restaurants across Jaipur", rating: 4.8 },
    { name: "Pyaz Kachori", type: "Famous Snack", cuisine: "Rajasthani Street Food", pricePerPerson: 30, image: fimg("kachori fried snack india", 202), mustTry: ["Onion Kachori", "Mawa Kachori"], location: "Rawat Mishthan Bhandar, Station Road", rating: 4.7 },
    { name: "Lal Maas", type: "Traditional Meat Dish", cuisine: "Rajasthani", pricePerPerson: 350, image: fimg("mutton red curry rajasthani", 203), mustTry: ["Mutton Lal Maas", "Wild Boar Lal Maas"], location: "Heritage restaurants in Jaipur", rating: 4.6 },
    { name: "Ghewar", type: "Traditional Sweet", cuisine: "Rajasthani", pricePerPerson: 80, image: fimg("ghewar sweet Indian dessert", 204), mustTry: ["Mawa Ghewar", "Plain Ghewar with Rabri"], location: "Sweet shops at Johari Bazaar", rating: 4.5 },
    { name: "Ker Sangri", type: "Traditional Vegetable Dish", cuisine: "Rajasthani", pricePerPerson: 150, image: fimg("indian vegetable curry traditional", 205), mustTry: ["Ker Sangri with Bajra Roti"], location: "Traditional thali restaurants", rating: 4.4 },
    { name: "Mirchi Bada", type: "Spicy Snack", cuisine: "Rajasthani Street Food", pricePerPerson: 20, image: fimg("chilli fritter indian street food", 206), mustTry: ["Green Chilli Bada", "Aloo stuffed Bada"], location: "Street stalls near Hawa Mahal", rating: 4.4 },
  ],
  mumbai: [
    { name: "Vada Pav", type: "Mumbai's Burger", cuisine: "Mumbai Street Food", pricePerPerson: 20, image: fimg("vada pav mumbai street food", 301), mustTry: ["Classic Vada Pav", "Cheese Vada Pav"], location: "Every street corner of Mumbai", rating: 4.8 },
    { name: "Pav Bhaji", type: "Famous Street Dish", cuisine: "Mumbai Street Food", pricePerPerson: 80, image: fimg("pav bhaji mumbai vegetable", 302), mustTry: ["Butter Pav Bhaji", "Cheese Pav Bhaji"], location: "Juhu Beach and Chowpatty", rating: 4.7 },
    { name: "Bhel Puri", type: "Chaat Snack", cuisine: "Mumbai Chaat", pricePerPerson: 40, image: fimg("bhel puri chaat indian snack", 303), mustTry: ["Sev Puri", "Dahi Puri", "Pani Puri"], location: "Chowpatty Beach and Juhu", rating: 4.6 },
    { name: "Bombay Sandwich", type: "Mumbai Snack", cuisine: "Mumbai Street Food", pricePerPerson: 50, image: fimg("bombay sandwich green chutney toast", 304), mustTry: ["Grilled Bombay Sandwich"], location: "Street stalls across Mumbai", rating: 4.5 },
    { name: "Modak", type: "Traditional Sweet", cuisine: "Maharashtrian", pricePerPerson: 60, image: fimg("modak sweet india", 305), mustTry: ["Steamed Ukadiche Modak", "Chocolate Modak"], location: "Sweet shops and temples across Mumbai", rating: 4.6 },
    { name: "Thalipeeth", type: "Maharashtrian Flatbread", cuisine: "Maharashtrian", pricePerPerson: 100, image: fimg("flatbread indian multigrain", 306), mustTry: ["Multigrain Thalipeeth with Curd"], location: "Maharashtrian restaurants", rating: 4.4 },
  ],
  delhi: [
    { name: "Chole Bhature", type: "North Indian Classic", cuisine: "Punjabi", pricePerPerson: 80, image: fimg("chole bhature chickpea fried bread", 401), mustTry: ["Chole Bhature at Sita Ram Diwan Chand"], location: "Paharganj and Karol Bagh", rating: 4.8 },
    { name: "Stuffed Paranthe", type: "Famous Flatbread", cuisine: "Delhi Street Food", pricePerPerson: 60, image: fimg("stuffed paratha aloo ghee india", 402), mustTry: ["Aloo Paratha", "Mooli Paratha", "Pyaz Paratha"], location: "Paranthe Wali Gali, Chandni Chowk", rating: 4.7 },
    { name: "Butter Chicken", type: "Mughlai Classic", cuisine: "Mughlai", pricePerPerson: 250, image: fimg("butter chicken murgh makhani curry", 403), mustTry: ["Butter Chicken with Naan"], location: "Old Delhi and Connaught Place", rating: 4.7 },
    { name: "Dahi Bhalle", type: "Chaat Snack", cuisine: "Delhi Chaat", pricePerPerson: 40, image: fimg("dahi bhalla yoghurt lentil chaat", 404), mustTry: ["Dahi Bhalle with Tamarind Chutney"], location: "Bengali Market and street stalls", rating: 4.6 },
    { name: "Mughlai Biryani", type: "Mughlai Dish", cuisine: "Mughlai", pricePerPerson: 200, image: fimg("biryani mughlai rice Indian", 405), mustTry: ["Mutton Dum Biryani", "Chicken Biryani"], location: "Karim's, Jama Masjid", rating: 4.7 },
    { name: "Jalebi & Rabri", type: "Traditional Sweet", cuisine: "North Indian", pricePerPerson: 50, image: fimg("jalebi rabri sweet india", 406), mustTry: ["Hot Jalebi with Rabri", "Imarti"], location: "Chandni Chowk sweet shops", rating: 4.6 },
  ],
  agra: [
    { name: "Petha", type: "Agra's Signature Sweet", cuisine: "North Indian Sweet", pricePerPerson: 50, image: fimg("petha agra sweet candy", 501), mustTry: ["Angoori Petha", "Kesar Petha", "Plain Petha"], location: "Sweet shops across Agra", rating: 4.7 },
    { name: "Bedai with Jalebi", type: "Agra Breakfast", cuisine: "Agra Street Food", pricePerPerson: 40, image: fimg("kachori jalebi breakfast india", 502), mustTry: ["Bedai Kachori with Aloo Sabzi and Jalebi"], location: "Deviram Sweets, Sadar Bazaar", rating: 4.6 },
    { name: "Mughlai Biryani", type: "Mughlai Dish", cuisine: "Mughlai", pricePerPerson: 250, image: fimg("biryani dum rice mutton india", 503), mustTry: ["Lamb Biryani", "Chicken Biryani with Raita"], location: "Landmark and Mughal Heritage restaurants", rating: 4.5 },
    { name: "Paratha with Desi Ghee", type: "North Indian Breakfast", cuisine: "North Indian", pricePerPerson: 60, image: fimg("paratha ghee breakfast india", 504), mustTry: ["Aloo Paratha with White Butter and Pickle"], location: "Local dhabas near Agra Fort", rating: 4.4 },
  ],
  varanasi: [
    { name: "Kachori Sabzi", type: "Varanasi Breakfast", cuisine: "UP Street Food", pricePerPerson: 30, image: fimg("kachori sabzi breakfast india", 601), mustTry: ["Khasta Kachori with Aloo Sabzi"], location: "Near Kashi Vishwanath Temple and ghats", rating: 4.8 },
    { name: "Thandai", type: "Traditional Beverage", cuisine: "Varanasi", pricePerPerson: 50, image: fimg("thandai milk drink festival india", 602), mustTry: ["Plain Thandai", "Bhaang Thandai"], location: "Blue Lassi Shop and Kachori Gali", rating: 4.7 },
    { name: "Banarasi Paan", type: "Mouth Freshener", cuisine: "Varanasi Specialty", pricePerPerson: 20, image: fimg("paan betel leaf india", 603), mustTry: ["Sweet Paan", "Fire Paan", "Meetha Paan"], location: "Paan stalls across the city", rating: 4.7 },
    { name: "Malaiyo", type: "Winter Sweet", cuisine: "Varanasi", pricePerPerson: 30, image: fimg("malaiyo milk foam sweet india", 604), mustTry: ["Malaiyo with Saffron and Pistachios"], location: "Seasonal: near ghats in winter mornings", rating: 4.8 },
    { name: "Baati Chokha", type: "Traditional Meal", cuisine: "Bihari/UP", pricePerPerson: 100, image: fimg("baati chokha bihari food india", 605), mustTry: ["Baati with Chokha and Dal"], location: "Local restaurants and dhabas", rating: 4.5 },
    { name: "Varanasi Lassi", type: "Iconic Drink", cuisine: "Varanasi", pricePerPerson: 40, image: fimg("lassi thick yoghurt drink india", 606), mustTry: ["Thick Malai Lassi in a clay pot"], location: "Blue Lassi Shop, Kashi", rating: 4.9 },
  ],
  hyderabad: [
    { name: "Hyderabadi Biryani", type: "Hyderabad's Pride", cuisine: "Hyderabadi Mughlai", pricePerPerson: 250, image: fimg("hyderabadi biryani dum rice saffron", 701), mustTry: ["Kacchi Gosht Biryani", "Chicken Dum Biryani", "Vegetable Biryani"], location: "Paradise, Shadab and Bawarchi restaurants", rating: 4.9 },
    { name: "Haleem", type: "Iconic Slow-Cooked Dish", cuisine: "Hyderabadi", pricePerPerson: 200, image: fimg("haleem slow cooked meat wheat india", 702), mustTry: ["Mutton Haleem", "Chicken Haleem"], location: "Shah Ghouse Cafe, Madina area", rating: 4.8 },
    { name: "Lukhmi", type: "Savoury Snack", cuisine: "Hyderabadi", pricePerPerson: 40, image: fimg("lukhmi hyderabadi savoury pastry", 703), mustTry: ["Mutton Lukhmi", "Chicken Lukhmi"], location: "Old City bakeries and Irani cafes", rating: 4.5 },
    { name: "Qubani ka Meetha", type: "Traditional Dessert", cuisine: "Hyderabadi", pricePerPerson: 80, image: fimg("apricot dessert hyderabadi sweet", 704), mustTry: ["Qubani ka Meetha with Cream"], location: "Traditional Hyderabadi restaurants", rating: 4.6 },
    { name: "Double ka Meetha", type: "Bread Pudding Dessert", cuisine: "Hyderabadi", pricePerPerson: 70, image: fimg("bread pudding sweet india dessert", 705), mustTry: ["Double ka Meetha with Rabri"], location: "Old City sweet shops", rating: 4.5 },
    { name: "Irani Chai & Osmania Biscuit", type: "Iconic Combination", cuisine: "Hyderabadi", pricePerPerson: 30, image: fimg("irani chai tea biscuit india", 706), mustTry: ["Irani Chai with Osmania Biscuit"], location: "Nimrah Cafe, Charminar and Irani cafes citywide", rating: 4.8 },
  ],
  bangalore: [
    { name: "Masala Dosa", type: "South Indian Classic", cuisine: "Karnataka", pricePerPerson: 80, image: fimg("masala dosa south indian breakfast", 801), mustTry: ["Ghee Roast Dosa", "Set Dosa", "Paper Dosa"], location: "Vidyarthi Bhavan and MTR, Bangalore", rating: 4.8 },
    { name: "Bisi Bele Bath", type: "Karnataka Specialty", cuisine: "Karnataka", pricePerPerson: 100, image: fimg("bisi bele bath karnataka rice lentils", 802), mustTry: ["Classic Bisi Bele Bath with Papad and Ghee"], location: "Traditional Karnataka restaurants", rating: 4.7 },
    { name: "Idli Vada Sambar", type: "South Indian Breakfast", cuisine: "South Indian", pricePerPerson: 60, image: fimg("idli vada sambar south indian food", 803), mustTry: ["Soft Idli with Coconut Chutney and Sambar"], location: "Darshini joints across Bangalore", rating: 4.7 },
    { name: "Ragi Mudde", type: "Traditional Karnataka Meal", cuisine: "Karnataka", pricePerPerson: 80, image: fimg("ragi mudde karnataka millet ball", 804), mustTry: ["Ragi Mudde with Saaru or Chicken Curry"], location: "Local Bangalore restaurants", rating: 4.4 },
    { name: "Filter Coffee", type: "South Indian Beverage", cuisine: "South Indian", pricePerPerson: 30, image: fimg("filter coffee south india tumbler", 805), mustTry: ["Traditional Degree Coffee in Davara-Tumbler"], location: "Darshini cafes across Bangalore", rating: 4.8 },
    { name: "Mysore Pak", type: "Traditional Sweet", cuisine: "Karnataka", pricePerPerson: 60, image: fimg("mysore pak karnataka sweet ghee", 806), mustTry: ["Soft Mysore Pak", "Crispy Mysore Pak"], location: "Sri Krishna Sweets and Adyar Ananda Bhavan", rating: 4.6 },
  ],
  chennai: [
    { name: "Chettinad Chicken Curry", type: "South Indian Specialty", cuisine: "Chettinad", pricePerPerson: 200, image: fimg("chettinad chicken curry spicy south india", 901), mustTry: ["Chettinad Chicken Curry", "Kuzhi Paniyaram"], location: "Chettinad restaurants in Chennai", rating: 4.7 },
    { name: "Filter Coffee (Madras)", type: "Chennai Staple", cuisine: "South Indian", pricePerPerson: 25, image: fimg("filter coffee madras south indian", 902), mustTry: ["Strong Decoction Filter Coffee with Froth"], location: "Saravana Bhavan and Sangeetha branches", rating: 4.9 },
    { name: "Idiyappam with Kurma", type: "Traditional Breakfast", cuisine: "Tamil Nadu", pricePerPerson: 80, image: fimg("idiyappam string hoppers south india", 903), mustTry: ["Rice Idiyappam with Coconut Kurma"], location: "Vegetarian restaurants across Chennai", rating: 4.6 },
    { name: "Kothu Parotta", type: "Street Food Classic", cuisine: "Tamil Nadu", pricePerPerson: 100, image: fimg("kothu parotta street food tamil", 904), mustTry: ["Egg Kothu Parotta", "Mutton Kothu Parotta"], location: "Street stalls and restaurants across Chennai", rating: 4.7 },
    { name: "Murukku", type: "Traditional Snack", cuisine: "Tamil Nadu", pricePerPerson: 30, image: fimg("murukku south india rice snack crispy", 905), mustTry: ["Rice Murukku", "Wheat Murukku"], location: "Sweet shops and local stores", rating: 4.5 },
    { name: "Payasam", type: "Traditional Dessert", cuisine: "South Indian", pricePerPerson: 50, image: fimg("payasam kheer south india dessert", 906), mustTry: ["Semiya Payasam", "Aval Payasam"], location: "Temple prasad and South Indian restaurants", rating: 4.6 },
  ],
  kolkata: [
    { name: "Kolkata Biryani", type: "Kolkata's Pride", cuisine: "Kolkata Mughlai", pricePerPerson: 200, image: fimg("kolkata biryani potato rice dum", 1001), mustTry: ["Mutton Biryani with Aloo and Egg", "Chicken Biryani"], location: "Arsalan, Nizam's, and Shiraz Golden", rating: 4.9 },
    { name: "Kathi Roll", type: "Kolkata's Street Invention", cuisine: "Kolkata Street Food", pricePerPerson: 60, image: fimg("kathi roll egg wrap street india", 1002), mustTry: ["Egg Roll", "Mutton Kathi Roll", "Paneer Roll"], location: "Nizam's and stalls across Park Street", rating: 4.8 },
    { name: "Rasgulla", type: "Bengali Sweet", cuisine: "Bengali", pricePerPerson: 30, image: fimg("rasgulla bengali sweet chhena syrup", 1003), mustTry: ["Soft Rasgulla", "Sponge Rasgulla"], location: "K.C. Das and Balaram Mullick sweet shops", rating: 4.8 },
    { name: "Mishti Doi", type: "Bengali Fermented Sweet", cuisine: "Bengali", pricePerPerson: 40, image: fimg("mishti doi bengali yoghurt clay pot", 1004), mustTry: ["Mishti Doi in Clay Pot"], location: "Sweet shops across Kolkata", rating: 4.7 },
    { name: "Phuchka", type: "Kolkata's Favourite Chaat", cuisine: "Kolkata Street Food", pricePerPerson: 30, image: fimg("phuchka pani puri kolkata tamarind", 1005), mustTry: ["Tamarind Water Phuchka", "Alu Masala Phuchka"], location: "Victoria Memorial area and street stalls", rating: 4.8 },
    { name: "Sandesh", type: "Bengali Milk Sweet", cuisine: "Bengali", pricePerPerson: 50, image: fimg("sandesh bengali chhena sweet milk", 1006), mustTry: ["Nolen Gur Sandesh", "Chocolate Sandesh"], location: "Balaram Mullick & Radharaman Mullick", rating: 4.7 },
  ],
};

export function getFoodRecommendations(destination: string): FoodRecommendation[] {
  const dest = destination.toLowerCase().split(",")[0].trim().split(" ")[0];
  for (const [key, foods] of Object.entries(CITY_FOODS)) {
    if (dest.includes(key) || key.includes(dest)) return foods;
  }
  return getGenericFoodRecommendations(destination);
}

function getGenericFoodRecommendations(destination: string): FoodRecommendation[] {
  const dest = destination.split(",")[0].trim();
  return [
    { name: `${dest} Thali`, type: "Local Specialty", cuisine: "Regional Indian", pricePerPerson: 150, image: fimg("indian thali regional food", 1101), mustTry: ["Full Thali with Dal, Sabzi, Roti, Rice"], location: `Local restaurants in ${dest}`, rating: 4.4 },
    { name: "Biryani", type: "Regional Biryani", cuisine: "Mughlai / Regional", pricePerPerson: 200, image: fimg("biryani rice aromatic india", 1102), mustTry: ["Mutton Biryani", "Chicken Biryani"], location: `Popular biryani spots in ${dest}`, rating: 4.5 },
    { name: "Street Chaat", type: "Street Food", cuisine: "North Indian Street Food", pricePerPerson: 40, image: fimg("chaat street food india flavour", 1103), mustTry: ["Pani Puri", "Bhel Puri", "Sev Puri"], location: `Main market area, ${dest}`, rating: 4.3 },
    { name: "Local Sweets", type: "Traditional Mithai", cuisine: "Indian Sweets", pricePerPerson: 60, image: fimg("indian sweets mithai traditional", 1104), mustTry: ["Gulab Jamun", "Barfi", "Ladoo"], location: `Halwai shops in ${dest}`, rating: 4.4 },
    { name: "Dal & Roti", type: "Comfort Food", cuisine: "North / Central Indian", pricePerPerson: 80, image: fimg("dal roti india comfort food", 1105), mustTry: ["Dal Tadka with Ghee Roti", "Dal Makhani"], location: `Dhabas in ${dest}`, rating: 4.3 },
    { name: "Masala Chai", type: "Indian Beverage", cuisine: "Pan India", pricePerPerson: 15, image: fimg("masala chai indian tea spiced", 1106), mustTry: ["Cutting Chai", "Kulhad Chai"], location: `Tea stalls throughout ${dest}`, rating: 4.7 },
  ];
}

export function getTransportOptions(source: string, destination: string, people: number, totalBudget: number): TransportOption[] {
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
    { mode: "Bus", cost: busTotal, duration: `${Math.ceil(dist / 60)} hrs`, details: `State buses (KSRTC/MSRTC/RSRTC) and luxury Volvo services. Multiple daily departures from ${source} to ${destination}.`, isBestOption: bestMode === "Bus", departureTime: "6:00 AM", arrivalTime: null },
    { mode: "Train", cost: trainTotal, duration: `${Math.ceil(dist / 80)} hrs`, details: `Indian Railways Superfast/Express trains. Book via IRCTC 60–90 days in advance. Rajdhani/Shatabdi/Vande Bharat options available.`, isBestOption: bestMode === "Train", departureTime: "7:30 AM", arrivalTime: null },
    { mode: "Flight", cost: flightTotal, duration: `${Math.max(1, Math.ceil(dist / 700))} hr ${dist < 700 ? "30 min" : ""}`.trim(), details: `IndiGo, Air India, SpiceJet, and Vistara flights available. Book 3–4 weeks ahead for best fares.`, isBestOption: bestMode === "Flight", departureTime: "8:00 AM", arrivalTime: null },
    { mode: "Car", cost: carCostTotal, duration: `${Math.ceil(dist / 70)} hrs`, details: `Self-drive (Zoomcar) or Ola Outstation. Comfortable for ${people <= 4 ? "small groups" : "families"}. National Highway route recommended.`, isBestOption: false, departureTime: null, arrivalTime: null },
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
    { name: `Budget Stay ${dest}`, type: "Budget", pricePerNight: Math.max(500, Math.round(perPersonPerNight * people * 0.35)), image: pimg("budget-hotel-india-clean"), amenities: ["Free WiFi", "AC Room", "24/7 Reception", "Hot Water", "TV"], location: `Near ${dest} Bus Stand / Railway Station`, rating: 3.5 },
    { name: `${dest} Comfort Suites`, type: "Mid-range", pricePerNight: Math.max(1500, Math.round(perPersonPerNight * people * 0.65)), image: pimg("comfortable-hotel-india-3star"), amenities: ["Free WiFi", "Swimming Pool", "Restaurant", "AC", "Room Service", "Gym", "Parking"], location: `City Centre, ${dest}`, rating: 4.1 },
    { name: `The Grand ${dest}`, type: "Luxury", pricePerNight: Math.max(4000, Math.round(perPersonPerNight * people * 1.4)), image: pimg("luxury-hotel-five-star-india-resort"), amenities: ["Free WiFi", "Spa & Wellness", "Multiple Restaurants", "Rooftop Pool", "Concierge", "Airport Transfer", "Butler", "Bar & Lounge"], location: `Prime Location, ${dest}`, rating: 4.7 },
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
      activities.push({ time: "7:30 AM", description: `Start the day with a hearty local breakfast. Try a famous dish from the area.`, place: null, cost: 150 });
    }

    dayPlaces.forEach((place, idx) => {
      const times = ["9:30 AM", "12:30 PM", "3:30 PM", "5:30 PM"];
      const time = times[idx] ?? "10:00 AM";
      activities.push({ time, description: `Visit ${place.name}. ${place.description}`, place: place.name, cost: place.entryFee ?? 0 });
      if (idx === 0) {
        activities.push({ time: "12:00 PM", description: `Lunch break — sample the famous local cuisine of ${dest}.`, place: null, cost: 200 });
      }
    });

    if (day === days) {
      activities.push({ time: "7:30 PM", description: `Farewell dinner at a recommended local restaurant. Pack up and prep for departure.`, place: null, cost: 600 });
    } else {
      activities.push({ time: "7:00 PM", description: `Evening at leisure. Explore the local night markets or enjoy the ambience of ${dest}.`, place: null, cost: 200 });
    }

    itinerary.push({ day, title: `Day ${day}: ${theme}`, activities });
  }
  return itinerary;
}

export function calculateBudget(budget: number, budgetType: string, people: number, days: number, transportCost: number): BudgetBreakdown {
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
