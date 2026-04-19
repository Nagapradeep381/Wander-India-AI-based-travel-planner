import { Router, type IRouter } from "express";
import {
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

    const [destCoords, srcCoords] = await Promise.allSettled([
      getCoordinates(destination),
      getCoordinates(source),
    ]);

    const destLat = destCoords.status === "fulfilled" && destCoords.value ? destCoords.value.lat : null;
    const destLon = destCoords.status === "fulfilled" && destCoords.value ? destCoords.value.lon : null;

    let places = [];
    if (destLat && destLon) {
      places = await fetchPlacesFromOverpass(destLat, destLon, destination);
    }

    if (places.length < 5) {
      const fallback = getFallbackPlaces(destination);
      const existing = new Set(places.map((p) => p.name.toLowerCase()));
      for (const fp of fallback) {
        if (!existing.has(fp.name.toLowerCase())) {
          places.push(fp);
          if (places.length >= 10) break;
        }
      }
    }

    if (places.length === 0) {
      places = getFallbackPlaces(destination);
    }

    const totalBudget = budgetType === "per_person" ? budget * people : budget;

    const transport = getTransportOptions(source, destination, people, totalBudget);
    const bestTransportCost = transport.find((t) => t.isBestOption)?.cost ?? transport[1].cost;

    const hotels = getHotelRecommendations(destination, people, days, totalBudget);
    const food = getFoodRecommendations(destination, people);
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
      places = await fetchPlacesFromOverpass(coords.lat, coords.lon, destination);
    }

    if (places.length < 5) {
      const fallback = getFallbackPlaces(destination);
      const existing = new Set(places.map((p) => p.name.toLowerCase()));
      for (const fp of fallback) {
        if (!existing.has(fp.name.toLowerCase())) {
          places.push(fp);
        }
      }
    }

    res.json(places.slice(0, limit));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch places");
    res.json(getFallbackPlaces(destination).slice(0, limit));
  }
});

export default router;
