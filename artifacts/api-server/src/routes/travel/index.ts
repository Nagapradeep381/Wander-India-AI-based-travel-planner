import { Router, type IRouter } from "express";
import {
  getPlaceCountByDays,
  getCoordinates,
  fetchPlacesFromOverpass,
  getFallbackPlaces,
  getTransportOptions,
  getHotelRecommendations,
  getFoodRecommendations,
  generateItinerary,
  calculateBudget,
} from "./helpers";
import { GenerateTravelPlanBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/travel/plan", async (req, res): Promise<void> => {
  const parsed = GenerateTravelPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { source, destination, days, people, budget, budgetType } = parsed.data;

  try {
    req.log.info({ destination, days, people }, "Generating travel plan");

    const maxPlaces = getPlaceCountByDays(days);

    const [destCoordsResult] = await Promise.allSettled([
      getCoordinates(destination),
    ]);

    const destCoords = destCoordsResult.status === "fulfilled" ? destCoordsResult.value : null;
    const destLat = destCoords?.lat ?? null;
    const destLon = destCoords?.lon ?? null;

    let places = [];
    if (destLat && destLon) {
      places = await fetchPlacesFromOverpass(destLat, destLon, destination, maxPlaces);
    }

    if (places.length < maxPlaces) {
      const fallback = getFallbackPlaces(destination, maxPlaces);
      const existing = new Set(places.map((p) => p.name.toLowerCase()));
      for (const fp of fallback) {
        if (!existing.has(fp.name.toLowerCase())) {
          places.push(fp);
        }
        if (places.length >= maxPlaces) break;
      }
    }

    if (places.length === 0) {
      places = getFallbackPlaces(destination, maxPlaces);
    }

    const totalBudget = budgetType === "per_person" ? budget * people : budget;

    const transport = getTransportOptions(source, destination, people, totalBudget);
    const bestTransportCost = transport.find((t) => t.isBestOption)?.cost ?? transport[1].cost;

    const hotels = getHotelRecommendations(destination, people, days, totalBudget);
    const food = getFoodRecommendations(destination);
    const itinerary = generateItinerary(destination, days, places);
    const budgetBreakdown = calculateBudget(budget, budgetType, people, days, bestTransportCost);

    const destName = destination.split(",")[0].trim();
    const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(destName + ", India")}&output=embed`;

    res.json({
      destination: destName,
      source: source.split(",")[0].trim(),
      days,
      people,
      places,
      hotels,
      food,
      transport,
      itinerary,
      budget: budgetBreakdown,
      mapUrl,
      destinationLat: destLat,
      destinationLon: destLon,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to generate travel plan");
    res.status(500).json({ error: "Failed to generate travel plan. Please try again." });
  }
});

router.get("/travel/places", async (req, res): Promise<void> => {
  const destination = req.query.destination as string;
  const limit = parseInt((req.query.limit as string) || "10");

  if (!destination) {
    res.status(400).json({ error: "destination query parameter is required" });
    return;
  }

  try {
    const coords = await getCoordinates(destination);
    let places = [];
    if (coords) {
      places = await fetchPlacesFromOverpass(coords.lat, coords.lon, destination, limit);
    }

    if (places.length < Math.min(5, limit)) {
      const fallback = getFallbackPlaces(destination, limit);
      const existing = new Set(places.map((p) => p.name.toLowerCase()));
      for (const fp of fallback) {
        if (!existing.has(fp.name.toLowerCase())) places.push(fp);
        if (places.length >= limit) break;
      }
    }

    res.json(places.slice(0, limit));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch places");
    res.json(getFallbackPlaces(destination, limit).slice(0, limit));
  }
});

export default router;
