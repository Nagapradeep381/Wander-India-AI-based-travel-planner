import type { Place, Hotel, FoodRecommendation, TransportOption, DayItinerary, BudgetBreakdown } from "@workspace/api-zod";

export interface Coordinates {
  lat: number;
  lon: number;
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

export async function fetchPlacesFromOverpass(lat: number, lon: number, _destination: string): Promise<Place[]> {
  try {
    const radius = 25000;
    const query = `
      [out:json][timeout:25];
      (
        node["tourism"~"attraction|museum|viewpoint|gallery|theme_park|zoo"](around:${radius},${lat},${lon});
        node["historic"~"monument|castle|ruins|temple|mosque|church|fort|building"](around:${radius},${lat},${lon});
        node["leisure"~"park|garden|nature_reserve"](around:${radius},${lat},${lon});
        way["tourism"~"attraction|museum|viewpoint"](around:${radius},${lat},${lon});
        way["historic"~"monument|castle|ruins|temple|mosque|church|fort"](around:${radius},${lat},${lon});
      );
      out center 20;
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
      seen.add(name.toLowerCase());
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      const cat = el.tags?.tourism || el.tags?.historic || el.tags?.leisure || "attraction";
      const imageKeyword = encodeURIComponent(`${name},india`);
      places.push({
        name,
        description: getCategoryDescription(cat, name),
        image: `https://source.unsplash.com/400x300/?${imageKeyword}`,
        category: formatCategory(cat),
        lat: elLat ?? null,
        lon: elLon ?? null,
        entryFee: getEntryFeeEstimate(cat),
        timings: getTimings(cat),
        rating: parseFloat((3.5 + Math.random() * 1.5).toFixed(1)),
      });
      if (places.length >= 10) break;
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
    castle: "Fort/Castle",
    ruins: "Historical Ruins",
    temple: "Temple",
    mosque: "Mosque",
    church: "Church",
    fort: "Fort",
    building: "Heritage Building",
    park: "Park",
    garden: "Garden",
    nature_reserve: "Nature Reserve",
  };
  return map[cat] || "Attraction";
}

function getCategoryDescription(cat: string, name: string): string {
  const descriptions: Record<string, string> = {
    museum: `${name} is a fascinating museum showcasing the rich history and culture of the region.`,
    monument: `${name} is a magnificent historical monument that stands as a testament to India's glorious past.`,
    temple: `${name} is a revered temple and an important spiritual and architectural landmark.`,
    fort: `${name} is an impressive fort with stunning architecture and panoramic views.`,
    castle: `${name} is a majestic fort/castle offering a glimpse into royal history.`,
    park: `${name} is a beautiful park perfect for relaxation and enjoying nature.`,
    viewpoint: `${name} offers breathtaking panoramic views of the surrounding landscape.`,
    ruins: `${name} are ancient ruins that tell the story of a bygone civilization.`,
    attraction: `${name} is a must-visit attraction offering unique experiences and memories.`,
    garden: `${name} is a serene garden, perfect for leisurely walks and photography.`,
  };
  return descriptions[cat] || `${name} is a renowned destination and a must-visit place in the area.`;
}

function getEntryFeeEstimate(cat: string): number | null {
  const fees: Record<string, number> = {
    museum: 50,
    monument: 100,
    fort: 150,
    castle: 150,
    ruins: 30,
    theme_park: 500,
    zoo: 80,
    gallery: 20,
    temple: 0,
    mosque: 0,
    church: 0,
    park: 20,
    garden: 30,
    viewpoint: 0,
    attraction: 0,
  };
  return fees[cat] ?? null;
}

function getTimings(cat: string): string | null {
  const timings: Record<string, string> = {
    museum: "10:00 AM - 5:00 PM (Closed Monday)",
    monument: "6:00 AM - 6:00 PM",
    fort: "6:00 AM - 6:00 PM",
    castle: "8:00 AM - 5:30 PM",
    ruins: "Sunrise to Sunset",
    theme_park: "10:00 AM - 8:00 PM",
    zoo: "9:00 AM - 5:00 PM",
    gallery: "10:00 AM - 6:00 PM",
    temple: "6:00 AM - 12:00 PM, 4:00 PM - 9:00 PM",
    park: "6:00 AM - 8:00 PM",
    garden: "6:00 AM - 7:00 PM",
  };
  return timings[cat] ?? "Open Daily";
}

export function getFallbackPlaces(destination: string): Place[] {
  const dest = destination.toLowerCase();
  const placesMap: Record<string, Place[]> = {
    goa: [
      { name: "Baga Beach", description: "One of Goa's most popular beaches, famous for its water sports and vibrant nightlife.", image: "https://source.unsplash.com/400x300/?baga+beach,goa", category: "Beach", lat: 15.5565, lon: 73.7517, entryFee: 0, timings: "24 Hours", rating: 4.3 },
      { name: "Basilica of Bom Jesus", description: "A UNESCO World Heritage Site and one of the finest examples of Baroque architecture in India.", image: "https://source.unsplash.com/400x300/?basilica+bom+jesus,goa", category: "Heritage", lat: 15.5009, lon: 73.9116, entryFee: 0, timings: "9:00 AM - 6:30 PM", rating: 4.6 },
      { name: "Dudhsagar Falls", description: "One of India's tallest waterfalls, a magnificent four-tiered waterfall on the Mandovi River.", image: "https://source.unsplash.com/400x300/?dudhsagar+falls,waterfall,india", category: "Nature", lat: 15.3144, lon: 74.3144, entryFee: 400, timings: "7:00 AM - 5:00 PM", rating: 4.5 },
      { name: "Fort Aguada", description: "A well-preserved 17th century Portuguese fort standing as a testimony to Goan history.", image: "https://source.unsplash.com/400x300/?fort+aguada,goa", category: "Fort", lat: 15.4958, lon: 73.7749, entryFee: 0, timings: "9:30 AM - 6:00 PM", rating: 4.2 },
      { name: "Calangute Beach", description: "The largest beach in North Goa, known as the Queen of Beaches.", image: "https://source.unsplash.com/400x300/?calangute+beach,goa", category: "Beach", lat: 15.5439, lon: 73.7553, entryFee: 0, timings: "24 Hours", rating: 4.0 },
      { name: "Anjuna Flea Market", description: "A famous weekly flea market where you can shop for handicrafts, clothes, and local goods.", image: "https://source.unsplash.com/400x300/?flea+market,goa,india", category: "Market", lat: 15.5736, lon: 73.7425, entryFee: 0, timings: "Wednesday 8:00 AM - Sunset", rating: 4.1 },
      { name: "Chapora Fort", description: "An ancient fort with panoramic views of the Arabian Sea and surrounding villages.", image: "https://source.unsplash.com/400x300/?chapora+fort,goa", category: "Fort", lat: 15.6020, lon: 73.7349, entryFee: 0, timings: "Sunrise to Sunset", rating: 4.3 },
    ],
    jaipur: [
      { name: "Amber Fort", description: "A majestic fort built with red sandstone and marble, overlooking Maota Lake.", image: "https://source.unsplash.com/400x300/?amber+fort,jaipur", category: "Fort", lat: 26.9855, lon: 75.8513, entryFee: 200, timings: "8:00 AM - 5:30 PM", rating: 4.7 },
      { name: "Hawa Mahal", description: "The iconic Palace of Winds with its unique five-story facade of red and pink sandstone.", image: "https://source.unsplash.com/400x300/?hawa+mahal,jaipur", category: "Palace", lat: 26.9239, lon: 75.8267, entryFee: 50, timings: "9:00 AM - 5:00 PM", rating: 4.5 },
      { name: "City Palace", description: "A magnificent palace complex in the heart of Jaipur, blend of Rajasthani and Mughal architecture.", image: "https://source.unsplash.com/400x300/?city+palace,jaipur,india", category: "Palace", lat: 26.9257, lon: 75.8236, entryFee: 300, timings: "9:30 AM - 5:00 PM", rating: 4.6 },
      { name: "Jantar Mantar", description: "A UNESCO World Heritage Site featuring a collection of 19 astronomical instruments.", image: "https://source.unsplash.com/400x300/?jantar+mantar,jaipur", category: "Heritage", lat: 26.9247, lon: 75.8244, entryFee: 100, timings: "9:00 AM - 4:30 PM", rating: 4.4 },
      { name: "Nahargarh Fort", description: "A fort standing on the Aravalli Hills overlooking Jaipur city with stunning sunset views.", image: "https://source.unsplash.com/400x300/?nahargarh+fort,jaipur", category: "Fort", lat: 26.9397, lon: 75.8083, entryFee: 100, timings: "10:00 AM - 5:30 PM", rating: 4.4 },
      { name: "Jal Mahal", description: "The Water Palace, a stunning palace located in the middle of Man Sagar Lake.", image: "https://source.unsplash.com/400x300/?jal+mahal,jaipur", category: "Palace", lat: 26.9500, lon: 75.8467, entryFee: 0, timings: "Viewable from road", rating: 4.5 },
      { name: "Albert Hall Museum", description: "The oldest museum in Rajasthan, housing an extensive collection of art and historical artifacts.", image: "https://source.unsplash.com/400x300/?museum,jaipur,rajasthan", category: "Museum", lat: 26.9124, lon: 75.8157, entryFee: 40, timings: "10:00 AM - 5:30 PM", rating: 4.3 },
    ],
    mumbai: [
      { name: "Gateway of India", description: "The iconic arch monument built during the British Raj, overlooking the Mumbai harbor.", image: "https://source.unsplash.com/400x300/?gateway+of+india,mumbai", category: "Monument", lat: 18.9220, lon: 72.8347, entryFee: 0, timings: "24 Hours", rating: 4.5 },
      { name: "Marine Drive", description: "A 3.6 km long boulevard known as the Queen's Necklace due to its night view.", image: "https://source.unsplash.com/400x300/?marine+drive,mumbai", category: "Landmark", lat: 18.9440, lon: 72.8234, entryFee: 0, timings: "24 Hours", rating: 4.6 },
      { name: "Elephanta Caves", description: "A UNESCO World Heritage Site with rock-cut sculptures and cave temples dedicated to Shiva.", image: "https://source.unsplash.com/400x300/?elephanta+caves,mumbai", category: "Heritage", lat: 18.9633, lon: 72.9315, entryFee: 40, timings: "9:30 AM - 5:30 PM (Closed Monday)", rating: 4.4 },
      { name: "Chhatrapati Shivaji Maharaj Terminus", description: "A UNESCO World Heritage Site and an outstanding example of Victorian Gothic Revival architecture.", image: "https://source.unsplash.com/400x300/?CST+mumbai+railway+station", category: "Heritage", lat: 18.9399, lon: 72.8355, entryFee: 0, timings: "Open daily", rating: 4.5 },
      { name: "Juhu Beach", description: "Mumbai's most popular beach and a favorite hangout spot for locals and tourists.", image: "https://source.unsplash.com/400x300/?juhu+beach,mumbai", category: "Beach", lat: 19.0984, lon: 72.8266, entryFee: 0, timings: "24 Hours", rating: 4.1 },
      { name: "Sanjay Gandhi National Park", description: "A large protected area in the suburbs of Mumbai with a rich ecosystem and the Kanheri Caves.", image: "https://source.unsplash.com/400x300/?national+park,mumbai,forest", category: "Nature", lat: 19.2147, lon: 72.9107, entryFee: 66, timings: "7:30 AM - 6:30 PM", rating: 4.4 },
    ],
    delhi: [
      { name: "Red Fort", description: "A UNESCO World Heritage Site, the historical fort that served as the main residence of Mughal emperors.", image: "https://source.unsplash.com/400x300/?red+fort,delhi", category: "Fort", lat: 28.6562, lon: 77.2410, entryFee: 50, timings: "9:30 AM - 4:30 PM (Closed Monday)", rating: 4.5 },
      { name: "Qutub Minar", description: "A 73-metre tall minaret, one of the finest towers in the world and a UNESCO World Heritage Site.", image: "https://source.unsplash.com/400x300/?qutub+minar,delhi", category: "Heritage", lat: 28.5245, lon: 77.1855, entryFee: 40, timings: "7:00 AM - 5:00 PM", rating: 4.6 },
      { name: "India Gate", description: "A war memorial located on the Rajpath, commemorating the 70,000 soldiers of the British Indian Army.", image: "https://source.unsplash.com/400x300/?india+gate,delhi", category: "Monument", lat: 28.6129, lon: 77.2295, entryFee: 0, timings: "24 Hours", rating: 4.6 },
      { name: "Humayun's Tomb", description: "A magnificent UNESCO World Heritage Site, the tomb of Mughal Emperor Humayun.", image: "https://source.unsplash.com/400x300/?humayun+tomb,delhi", category: "Heritage", lat: 28.5933, lon: 77.2507, entryFee: 40, timings: "Sunrise to Sunset", rating: 4.6 },
      { name: "Lotus Temple", description: "A Bahai House of Worship shaped like a lotus flower, open to people of all religions.", image: "https://source.unsplash.com/400x300/?lotus+temple,delhi", category: "Temple", lat: 28.5535, lon: 77.2588, entryFee: 0, timings: "9:00 AM - 5:30 PM (Closed Monday)", rating: 4.6 },
      { name: "Chandni Chowk", description: "One of the oldest and busiest markets in Old Delhi, a perfect place to experience street food and culture.", image: "https://source.unsplash.com/400x300/?chandni+chowk,delhi,market", category: "Market", lat: 28.6506, lon: 77.2319, entryFee: 0, timings: "8:00 AM - 8:00 PM", rating: 4.3 },
      { name: "Akshardham Temple", description: "A Hindu temple complex and spiritual-cultural campus with magnificent architecture.", image: "https://source.unsplash.com/400x300/?akshardham+temple,delhi", category: "Temple", lat: 28.6127, lon: 77.2773, entryFee: 0, timings: "10:00 AM - 6:30 PM (Closed Monday)", rating: 4.7 },
    ],
    agra: [
      { name: "Taj Mahal", description: "One of the Seven Wonders of the World, an ivory-white marble mausoleum, a UNESCO World Heritage Site.", image: "https://source.unsplash.com/400x300/?taj+mahal,agra,india", category: "Heritage", lat: 27.1751, lon: 78.0421, entryFee: 250, timings: "Sunrise to Sunset (Closed Friday)", rating: 4.9 },
      { name: "Agra Fort", description: "A UNESCO World Heritage Site, this 16th-century Mughal monument was the main residence of emperors.", image: "https://source.unsplash.com/400x300/?agra+fort,india", category: "Fort", lat: 27.1795, lon: 78.0211, entryFee: 50, timings: "6:00 AM - 6:00 PM", rating: 4.5 },
      { name: "Fatehpur Sikri", description: "A UNESCO World Heritage Site, the former capital of the Mughal Empire, built by Emperor Akbar.", image: "https://source.unsplash.com/400x300/?fatehpur+sikri,india", category: "Heritage", lat: 27.0945, lon: 77.6611, entryFee: 40, timings: "Sunrise to Sunset", rating: 4.5 },
      { name: "Mehtab Bagh", description: "A charbagh complex that offers one of the best views of the Taj Mahal during sunset.", image: "https://source.unsplash.com/400x300/?mehtab+bagh,agra", category: "Garden", lat: 27.1811, lon: 78.0344, entryFee: 20, timings: "Sunrise to Sunset", rating: 4.4 },
      { name: "Itimad-ud-Daulah", description: "Often called the Baby Taj, this delicate Mughal mausoleum is considered a draft of the Taj Mahal.", image: "https://source.unsplash.com/400x300/?itimad+ud+daulah,agra", category: "Heritage", lat: 27.1964, lon: 78.0347, entryFee: 20, timings: "Sunrise to Sunset", rating: 4.4 },
    ],
  };

  for (const [key, places] of Object.entries(placesMap)) {
    if (dest.includes(key) || key.includes(dest.split(" ")[0].toLowerCase())) {
      return places;
    }
  }

  return getGenericPlaces(destination);
}

function getGenericPlaces(destination: string): Place[] {
  const categories = ["Monument", "Temple", "Museum", "Garden", "Fort", "Market", "Viewpoint", "Lake"];
  const names = [
    `${destination} Fort`,
    `Central Museum ${destination}`,
    `${destination} Temple Complex`,
    `${destination} Botanical Garden`,
    `Old City Market ${destination}`,
    `${destination} Lake`,
    `Heritage Walk ${destination}`,
    `${destination} Viewpoint`,
    `Shiva Temple ${destination}`,
    `${destination} Archaeological Site`,
  ];
  return names.map((name, i) => ({
    name,
    description: `${name} is one of the most visited attractions in ${destination}, offering a unique blend of history, culture, and scenic beauty.`,
    image: `https://source.unsplash.com/400x300/?${encodeURIComponent(categories[i % categories.length].toLowerCase())},india,tourism`,
    category: categories[i % categories.length],
    lat: null,
    lon: null,
    entryFee: i % 3 === 0 ? 0 : (i + 1) * 25,
    timings: "9:00 AM - 5:00 PM",
    rating: parseFloat((3.8 + Math.random() * 1.2).toFixed(1)),
  }));
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
  const carCost = Math.round(dist * 12 + 500);

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
      details: `KSRTC/MSRTC/RSRTC state bus or luxury Volvo bus. Multiple daily services from ${source} to ${destination}.`,
      isBestOption: bestMode === "Bus",
      departureTime: "6:00 AM",
      arrivalTime: `${6 + Math.ceil(dist / 60)}:00 AM`,
    },
    {
      mode: "Train",
      cost: trainTotal,
      duration: `${Math.ceil(dist / 80)} hrs`,
      details: `Indian Railways Superfast/Express trains available. Book on IRCTC for best rates. Rajdhani/Shatabdi options available.`,
      isBestOption: bestMode === "Train",
      departureTime: "7:30 AM",
      arrivalTime: null,
    },
    {
      mode: "Flight",
      cost: flightTotal,
      duration: `${Math.max(1, Math.ceil(dist / 700))} hr${dist > 700 ? "s" : ""} 30 min`,
      details: `IndiGo, Air India, SpiceJet, Vistara flights available. Book 2-3 weeks in advance for best prices.`,
      isBestOption: bestMode === "Flight",
      departureTime: "8:00 AM",
      arrivalTime: null,
    },
    {
      mode: "Car",
      cost: carCost,
      duration: `${Math.ceil(dist / 70)} hrs`,
      details: `Self-drive or cab hire (Ola Outstation, Zoomcar). Comfortable option for ${people <= 4 ? "small groups" : "families"}. NH highway route recommended.`,
      isBestOption: false,
      departureTime: null,
      arrivalTime: null,
    },
  ];
}

function estimateDistance(source: string, dest: string): number {
  const distances: Record<string, Record<string, number>> = {
    delhi: { mumbai: 1415, jaipur: 270, agra: 230, goa: 1900, kolkata: 1500, chennai: 2200, bangalore: 2150, hyderabad: 1570 },
    mumbai: { delhi: 1415, goa: 590, pune: 150, bangalore: 980, chennai: 1340, hyderabad: 710, jaipur: 1150, agra: 1290 },
    bangalore: { mumbai: 980, chennai: 350, hyderabad: 570, goa: 600, mysore: 145, delhi: 2150, kolkata: 1870 },
    jaipur: { delhi: 270, agra: 240, mumbai: 1150, udaipur: 400, jodhpur: 330, bikaner: 330 },
    goa: { mumbai: 590, bangalore: 600, delhi: 1900, pune: 450 },
    agra: { delhi: 230, jaipur: 240, lucknow: 340, varanasi: 680 },
    kolkata: { delhi: 1500, bangalore: 1870, mumbai: 2000 },
    chennai: { bangalore: 350, mumbai: 1340, delhi: 2200, hyderabad: 630 },
    hyderabad: { bangalore: 570, mumbai: 710, delhi: 1570, chennai: 630 },
  };
  const s = source.toLowerCase().split(",")[0].trim().split(" ")[0];
  const d = dest.toLowerCase().split(",")[0].trim().split(" ")[0];
  for (const [srcKey, dests] of Object.entries(distances)) {
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
  const budgetPrice = Math.max(500, Math.round(perPersonPerNight * people * 0.4));
  const midPrice = Math.max(1500, Math.round(perPersonPerNight * people * 0.7));
  const luxPrice = Math.max(4000, Math.round(perPersonPerNight * people * 1.3));
  const dest = destination.split(",")[0].trim();

  return [
    {
      name: `Budget Inn ${dest}`,
      type: "Budget",
      pricePerNight: budgetPrice,
      image: `https://source.unsplash.com/400x300/?budget+hotel,india,room`,
      amenities: ["Free WiFi", "AC Room", "24/7 Reception", "Hot Water", "TV"],
      location: `Near ${dest} Bus Stand`,
      rating: 3.5,
    },
    {
      name: `${dest} Comfort Suites`,
      type: "Mid-range",
      pricePerNight: midPrice,
      image: `https://source.unsplash.com/400x300/?hotel+room,comfortable,india`,
      amenities: ["Free WiFi", "Swimming Pool", "Restaurant", "AC", "Room Service", "Gym", "Parking"],
      location: `City Center, ${dest}`,
      rating: 4.1,
    },
    {
      name: `The Grand ${dest}`,
      type: "Luxury",
      pricePerNight: luxPrice,
      image: `https://source.unsplash.com/400x300/?luxury+hotel,india,five+star`,
      amenities: ["Free WiFi", "Spa & Wellness", "Multiple Restaurants", "Rooftop Pool", "Concierge", "Airport Transfer", "Butler Service", "Bar & Lounge"],
      location: `Prime Location, ${dest}`,
      rating: 4.7,
    },
  ];
}

export function getFoodRecommendations(destination: string, people: number): FoodRecommendation[] {
  const dest = destination.toLowerCase().split(",")[0].trim().split(" ")[0];
  const cuisineMap: Record<string, FoodRecommendation[]> = {
    goa: [
      { name: "Fisherman's Wharf", type: "Seafood Restaurant", cuisine: "Goan", pricePerPerson: 500, image: "https://source.unsplash.com/400x300/?goan+seafood,fish+curry", mustTry: ["Fish Curry Rice", "Prawn Balchão", "Goan Sausage"], location: "Cavelossim, South Goa", rating: 4.4 },
      { name: "Infantaria Pastelaria", type: "Cafe & Bakery", cuisine: "Goan-Portuguese", pricePerPerson: 300, image: "https://source.unsplash.com/400x300/?goan+cafe,breakfast,india", mustTry: ["Bebinca", "Croissants", "Ros Omelette"], location: "Baga Beach, North Goa", rating: 4.3 },
      { name: "Souza Lobo", type: "Heritage Restaurant", cuisine: "Authentic Goan", pricePerPerson: 700, image: "https://source.unsplash.com/400x300/?goan+restaurant,seafood,india", mustTry: ["Xacuti", "Rechado Fish", "Sorpotel"], location: "Calangute, Goa", rating: 4.5 },
    ],
    jaipur: [
      { name: "Rawat Mishthan Bhandar", type: "Iconic Sweet Shop", cuisine: "Rajasthani", pricePerPerson: 150, image: "https://source.unsplash.com/400x300/?indian+sweets,rajasthani+food", mustTry: ["Pyaz Kachori", "Mirchi Bada", "Ghewar"], location: "Station Road, Jaipur", rating: 4.5 },
      { name: "Laxmi Mishthan Bhandar", type: "Traditional Restaurant", cuisine: "Rajasthani Thali", pricePerPerson: 350, image: "https://source.unsplash.com/400x300/?rajasthani+thali,dal+baati+churma", mustTry: ["Dal Baati Churma", "Lal Maas", "Gatte ki Sabzi"], location: "Johari Bazaar, Jaipur", rating: 4.4 },
      { name: "Nahargarh Fort Restaurant", type: "Heritage Dining", cuisine: "Rajasthani & Continental", pricePerPerson: 800, image: "https://source.unsplash.com/400x300/?heritage+restaurant,fort,india", mustTry: ["Ker Sangri", "Junglee Maas", "Mawa Kachori"], location: "Nahargarh Fort", rating: 4.6 },
    ],
    mumbai: [
      { name: "Britannia & Co.", type: "Parsi Restaurant", cuisine: "Parsi/Iranian", pricePerPerson: 400, image: "https://source.unsplash.com/400x300/?parsi+food,iran,mumbai", mustTry: ["Berry Pulao", "Dhansak", "Chicken Farcha"], location: "Ballard Estate, Fort, Mumbai", rating: 4.7 },
      { name: "Juhu Chowpatty Food Stalls", type: "Street Food Hub", cuisine: "Mumbai Street Food", pricePerPerson: 150, image: "https://source.unsplash.com/400x300/?mumbai+street+food,bhel+puri,india", mustTry: ["Vada Pav", "Bhel Puri", "Pav Bhaji"], location: "Juhu Beach, Mumbai", rating: 4.3 },
      { name: "Khyber Restaurant", type: "Fine Dining", cuisine: "North-West Frontier", pricePerPerson: 1200, image: "https://source.unsplash.com/400x300/?indian+restaurant,fine+dining,mumbai", mustTry: ["Raan-e-Khyber", "Burra Kabab", "Mutton Biryani"], location: "Fort, Mumbai", rating: 4.6 },
    ],
    delhi: [
      { name: "Karim's", type: "Iconic Mughlai", cuisine: "Mughlai", pricePerPerson: 400, image: "https://source.unsplash.com/400x300/?mughlai+food,kebab,delhi", mustTry: ["Mutton Korma", "Seekh Kebab", "Nihari"], location: "Old Delhi, near Jama Masjid", rating: 4.5 },
      { name: "Paranthe Wali Gali", type: "Street Food Stalls", cuisine: "Delhi Street Food", pricePerPerson: 100, image: "https://source.unsplash.com/400x300/?paratha,delhi+street+food,india", mustTry: ["Stuffed Paranthas", "Lassi", "Halwa"], location: "Chandni Chowk, Old Delhi", rating: 4.4 },
      { name: "Indian Accent", type: "Fine Dining", cuisine: "Modern Indian", pricePerPerson: 3000, image: "https://source.unsplash.com/400x300/?fine+dining,modern+indian+cuisine,restaurant", mustTry: ["Doda Barfi French Toast", "Raw Mango Shrimp", "Pulled Lamb Shank"], location: "The Manor, Friends Colony, Delhi", rating: 4.8 },
    ],
    agra: [
      { name: "Pind Balluchi", type: "Restaurant", cuisine: "North Indian/Mughlai", pricePerPerson: 500, image: "https://source.unsplash.com/400x300/?north+indian+food,mughlai,agra", mustTry: ["Dal Makhani", "Chicken Tikka Masala", "Shahi Paneer"], location: "Near Taj Mahal, Agra", rating: 4.3 },
      { name: "Dasaprakash", type: "South Indian Restaurant", cuisine: "South Indian", pricePerPerson: 300, image: "https://source.unsplash.com/400x300/?south+indian+food,dosa,idli", mustTry: ["Masala Dosa", "Idli Sambar", "Filter Coffee"], location: "Gwalior Road, Agra", rating: 4.2 },
      { name: "Mama Chicken Restaurant", type: "Local Favorite", cuisine: "Agra Cuisine", pricePerPerson: 250, image: "https://source.unsplash.com/400x300/?chicken+curry,indian+food,restaurant", mustTry: ["Petha", "Bedai Kachori", "Chicken Biryani"], location: "Sadar Bazaar, Agra", rating: 4.1 },
    ],
  };

  for (const [key, recommendations] of Object.entries(cuisineMap)) {
    if (dest.includes(key) || key.includes(dest)) {
      return recommendations.map((r) => ({ ...r, rating: r.rating ?? null }));
    }
  }

  return getGenericFoodRecommendations(destination, people);
}

function getGenericFoodRecommendations(destination: string, _people: number): FoodRecommendation[] {
  const dest = destination.split(",")[0].trim();
  return [
    { name: `${dest} Local Dhabas`, type: "Dhaba", cuisine: "Local Cuisine", pricePerPerson: 150, image: `https://source.unsplash.com/400x300/?dhaba,indian+food,roadside`, mustTry: ["Thali", "Dal Tadka", "Roti"], location: `Main Market, ${dest}`, rating: 4.2 },
    { name: `${dest} Street Food Hub`, type: "Street Food", cuisine: "Local Street Food", pricePerPerson: 80, image: `https://source.unsplash.com/400x300/?indian+street+food,chaat,india`, mustTry: ["Chaat", "Samosa", "Chai"], location: `Bus Stand Area, ${dest}`, rating: 4.0 },
    { name: `Hotel Saravana Bhavan`, type: "Vegetarian Restaurant", cuisine: "South Indian/North Indian", pricePerPerson: 250, image: `https://source.unsplash.com/400x300/?vegetarian+restaurant,india,thali`, mustTry: ["Masala Dosa", "Idli Vada", "Biryani"], location: `Central Area, ${dest}`, rating: 4.3 },
    { name: `${dest} Fine Dining`, type: "Restaurant", cuisine: "Multi-cuisine", pricePerPerson: 600, image: `https://source.unsplash.com/400x300/?indian+restaurant,fine+dining`, mustTry: ["Butter Chicken", "Biryani", "Paneer Dishes"], location: `City Center, ${dest}`, rating: 4.4 },
  ];
}

export function generateItinerary(destination: string, days: number, places: Place[]): DayItinerary[] {
  const dest = destination.split(",")[0].trim();
  const itinerary: DayItinerary[] = [];
  const themes = ["Arrival & Top Attractions", "Heritage & Culture Exploration", "Nature & Local Markets", "Adventure & Leisure", "Local Life & Shopping", "Hidden Gems & Day Trips", "Relaxation & Departure Prep"];

  for (let day = 1; day <= days; day++) {
    const theme = themes[(day - 1) % themes.length];
    const dayPlaces = places.slice((day - 1) * 3, day * 3);

    const activities = [
      {
        time: "7:00 AM",
        description: day === 1 ? `Arrive at ${dest}. Check in to your hotel and freshen up.` : `Start the day with a refreshing breakfast at your hotel.`,
        place: null,
        cost: day === 1 ? 0 : 200,
      },
      {
        time: "9:00 AM",
        description: dayPlaces[0] ? `Visit ${dayPlaces[0].name}. ${dayPlaces[0].description.substring(0, 80)}...` : `Morning walk in ${dest} city center.`,
        place: dayPlaces[0]?.name ?? null,
        cost: dayPlaces[0]?.entryFee ?? 0,
      },
      {
        time: "12:00 PM",
        description: `Enjoy a hearty lunch at a local restaurant and savor the authentic flavors of ${dest}.`,
        place: null,
        cost: 300,
      },
      {
        time: "2:00 PM",
        description: dayPlaces[1] ? `Explore ${dayPlaces[1].name}. ${dayPlaces[1].description.substring(0, 80)}...` : `Shopping at local markets.`,
        place: dayPlaces[1]?.name ?? null,
        cost: dayPlaces[1]?.entryFee ?? 0,
      },
      {
        time: "4:30 PM",
        description: dayPlaces[2] ? `Head to ${dayPlaces[2].name} for an afternoon visit.` : `Visit a local market or cultural spot.`,
        place: dayPlaces[2]?.name ?? null,
        cost: dayPlaces[2]?.entryFee ?? 0,
      },
      {
        time: "7:00 PM",
        description: day === days ? `Enjoy a farewell dinner at a fine restaurant. Pack up for departure.` : `Dinner at a recommended local restaurant. Explore the evening vibe of ${dest}.`,
        place: null,
        cost: 500,
      },
    ];

    itinerary.push({
      day,
      title: `Day ${day}: ${theme}`,
      activities,
    });
  }
  return itinerary;
}

export function calculateBudget(
  totalBudget: number,
  budgetType: string,
  people: number,
  days: number,
  transportCost: number,
): BudgetBreakdown {
  let total: number;
  let perPerson: number;

  if (budgetType === "per_person") {
    perPerson = totalBudget;
    total = totalBudget * people;
  } else {
    total = totalBudget;
    perPerson = totalBudget / people;
  }

  const travelCost = Math.min(transportCost, total * 0.3);
  const remaining = total - travelCost;
  const stayBase = Math.round(remaining * 0.4);
  const foodBase = Math.round(remaining * 0.3);
  const miscBase = remaining - stayBase - foodBase;

  const stayPerNight = stayBase / days;
  const adjustedStay = Math.min(stayBase, stayPerNight * days);

  return {
    totalBudget: Math.round(total),
    perPersonBudget: Math.round(perPerson),
    travel: Math.round(travelCost),
    stay: Math.round(adjustedStay),
    food: Math.round(foodBase),
    misc: Math.round(miscBase),
    travelPercent: Math.round((travelCost / total) * 100),
    stayPercent: Math.round((adjustedStay / total) * 100),
    foodPercent: Math.round((foodBase / total) * 100),
    miscPercent: Math.round((miscBase / total) * 100),
  };
}
