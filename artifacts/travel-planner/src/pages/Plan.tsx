import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTravelPlan } from "../context/TravelPlanContext";
import { formatCurrency } from "@/lib/utils";
import {
  MapPin, Calendar, Users, IndianRupee, Train, Bus, Plane, Car,
  Hotel, Utensils, Star, CheckCircle2, Navigation2, Map as MapIcon, ChevronRight,
  UtensilsCrossed, Clock, Ticket
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const FALLBACK_IMG = "https://source.unsplash.com/400x300/?india,tourism,travel";

function SafeImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [imgSrc, setImgSrc] = useState(src);
  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setImgSrc(FALLBACK_IMG)}
    />
  );
}

export default function Plan() {
  const [, setLocation] = useLocation();
  const { planData } = useTravelPlan();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!planData && mounted) {
      setLocation("/");
    }
  }, [planData, setLocation, mounted]);

  if (!planData) return null;

  const { destination, source, days, people, budget, places, hotels, food, transport, itinerary } = planData;

  const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(destination + ", India")}&output=embed`;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hero Section */}
      <header className="relative h-[60vh] md:h-[70vh] flex flex-col justify-end pb-12 px-6 md:px-12 overflow-hidden">
        <SafeImage
          src={`https://source.unsplash.com/1600x900/?${encodeURIComponent(destination + " india city landmark")}`}
          alt={destination}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="flex items-center gap-2 text-primary font-medium tracking-widest uppercase mb-4 text-sm">
            <Navigation2 className="w-4 h-4" />
            Your Bespoke Journey
          </div>
          <h1 className="text-5xl md:text-8xl font-serif font-bold text-foreground mb-6">{destination}</h1>
          <div className="flex flex-wrap gap-6 text-muted-foreground text-lg">
            <div className="flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> From {source}</div>
            <div className="flex items-center gap-2"><Calendar className="w-5 h-5 text-primary" /> {days} {days === 1 ? "Day" : "Days"}</div>
            <div className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> {people} {people === 1 ? "Traveler" : "Travelers"}</div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-6 md:px-12 space-y-24 mt-12">

        {/* Budget Overview */}
        <section className="animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200 fill-mode-both">
          <Card className="bg-card border-none shadow-xl overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3">
              <div className="p-8 lg:p-12 bg-primary text-primary-foreground flex flex-col justify-center">
                <h3 className="font-serif text-2xl mb-8 opacity-90">Budget Summary</h3>
                <div className="space-y-8">
                  <div>
                    <p className="text-sm uppercase tracking-wider opacity-80 mb-1">Total Budget</p>
                    <p className="text-4xl font-bold font-serif">{formatCurrency(budget.totalBudget)}</p>
                  </div>
                  <div className="h-px bg-white/20 w-full" />
                  <div>
                    <p className="text-sm uppercase tracking-wider opacity-80 mb-1">Per Person</p>
                    <p className="text-3xl font-serif">{formatCurrency(budget.perPersonBudget)}</p>
                  </div>
                </div>
              </div>
              <div className="p-8 lg:p-12 lg:col-span-2 flex flex-col justify-center">
                <h4 className="text-xl font-serif font-semibold mb-8 text-foreground">Budget Allocation</h4>
                <div className="space-y-8">
                  <BudgetBar label="Stay" amount={budget.stay} percent={budget.stayPercent} icon={Hotel} />
                  <BudgetBar label="Travel" amount={budget.travel} percent={budget.travelPercent} icon={Train} />
                  <BudgetBar label="Food" amount={budget.food} percent={budget.foodPercent} icon={Utensils} />
                  <BudgetBar label="Misc" amount={budget.misc} percent={budget.miscPercent} icon={IndianRupee} />
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Places to Visit */}
        <section>
          <div className="mb-10">
            <h2 className="text-4xl font-serif font-bold text-foreground mb-4">Attractions in {destination}</h2>
            <p className="text-xl text-muted-foreground max-w-2xl">
              {places.length} must-visit places curated for your {days}-day trip.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {places.map((place, idx) => {
              const keyword = encodeURIComponent(`${place.name.replace(/ /g, "+")} ${destination}`);
              return (
                <Card key={idx} className="group overflow-hidden border-none shadow-lg hover-elevate transition-all duration-300 bg-card">
                  <div className="aspect-[4/3] overflow-hidden relative">
                    <SafeImage
                      src={place.image || `https://source.unsplash.com/400x300/?${keyword}`}
                      alt={place.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <Badge className="absolute top-4 right-4 bg-background/80 backdrop-blur text-foreground border-none">
                      {place.category}
                    </Badge>
                  </div>
                  <CardHeader>
                    <div className="flex justify-between items-start gap-4">
                      <CardTitle className="font-serif text-xl leading-tight">{place.name}</CardTitle>
                      {place.rating && (
                        <div className="flex items-center gap-1 text-amber-500 shrink-0 bg-amber-500/10 px-2 py-1 rounded-md text-sm font-medium">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          {place.rating}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground line-clamp-3 leading-relaxed text-sm">{place.description}</p>
                    <div className="pt-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-4 h-4" />
                        {place.entryFee ? `Entry: ${formatCurrency(place.entryFee)}` : "Free Entry"}
                      </div>
                      {place.timings && (
                        <div className="flex items-center gap-1 truncate pl-2">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span className="truncate text-xs">{place.timings}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Transport Options */}
        <section>
          <div className="mb-10">
            <h2 className="text-4xl font-serif font-bold text-foreground mb-4">Getting There</h2>
            <p className="text-xl text-muted-foreground max-w-2xl">Transport options from {source} to {destination}.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {transport.map((option, idx) => {
              const Icon = getTransportIcon(option.mode);
              return (
                <Card key={idx} className={`border-none shadow-md overflow-hidden relative ${option.isBestOption ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}>
                  {option.isBestOption && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1.5 text-sm font-semibold rounded-bl-lg flex items-center gap-1.5 z-10">
                      <CheckCircle2 className="w-4 h-4" /> Best Option
                    </div>
                  )}
                  <CardContent className="p-6 flex items-center gap-5">
                    <div className={`p-4 rounded-2xl shrink-0 ${option.isBestOption ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xl font-bold font-serif mb-0.5 text-foreground">{option.mode}</h4>
                      <p className="text-muted-foreground text-sm mb-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {option.duration}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{option.details}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold text-foreground font-serif">{formatCurrency(option.cost)}</div>
                      <div className="text-xs text-muted-foreground">total</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Accommodations */}
        <section>
          <div className="mb-10">
            <h2 className="text-4xl font-serif font-bold text-foreground mb-4">Where to Stay</h2>
            <p className="text-xl text-muted-foreground max-w-2xl">Accommodation options across all budgets in {destination}.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {hotels.map((hotel, idx) => (
              <Card key={idx} className="overflow-hidden border-none shadow-lg bg-card flex flex-col">
                <div className="h-48 overflow-hidden relative">
                  <SafeImage
                    src={hotel.image || `https://source.unsplash.com/400x300/?hotel,${encodeURIComponent(hotel.type)},india`}
                    alt={hotel.name}
                    className="w-full h-full object-cover"
                  />
                  <Badge className="absolute top-4 left-4 bg-background/90 text-foreground border-none backdrop-blur font-semibold">
                    {hotel.type}
                  </Badge>
                </div>
                <CardHeader>
                  <CardTitle className="font-serif text-xl leading-tight">{hotel.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> {hotel.location}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                  <div className="mb-5 flex flex-wrap gap-1.5">
                    {hotel.amenities.map((amenity, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-full">
                        {amenity}
                      </span>
                    ))}
                  </div>
                  <div className="flex justify-between items-end border-t border-border pt-4">
                    <div>
                      <span className="text-2xl font-bold font-serif text-foreground">{formatCurrency(hotel.pricePerNight)}</span>
                      <span className="text-muted-foreground text-sm"> / night</span>
                    </div>
                    {hotel.rating && (
                      <div className="flex items-center gap-1 text-amber-500 font-medium">
                        <Star className="w-4 h-4 fill-current" />
                        {hotel.rating}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Famous Local Dishes */}
        <section>
          <div className="mb-10">
            <h2 className="text-4xl font-serif font-bold text-foreground mb-4">Famous Local Dishes</h2>
            <p className="text-xl text-muted-foreground max-w-2xl">
              Must-try foods and iconic flavours of {destination} — don't leave without tasting these.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {food.map((dish, idx) => {
              const dishKeyword = encodeURIComponent(dish.name.replace(/ /g, "+") + "+food+india");
              return (
                <Card key={idx} className="overflow-hidden border-none shadow-md bg-card group hover-elevate transition-all duration-300">
                  <div className="h-44 overflow-hidden relative">
                    <SafeImage
                      src={dish.image || `https://source.unsplash.com/400x300/?${dishKeyword}`}
                      alt={dish.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                      <h4 className="font-serif font-bold text-white text-lg leading-tight">{dish.name}</h4>
                      <Badge variant="secondary" className="bg-white/20 text-white border-none backdrop-blur text-xs shrink-0 ml-2">
                        {dish.type}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-primary">{dish.cuisine}</span>
                      <span className="text-sm font-bold text-foreground flex items-center gap-1">
                        <IndianRupee className="w-3.5 h-3.5" />{dish.pricePerPerson}/person
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <UtensilsCrossed className="w-3 h-3" /> Variations to Try
                      </p>
                      <ul className="space-y-0.5">
                        {dish.mustTry.slice(0, 3).map((item, i) => (
                          <li key={i} className="text-sm text-foreground flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground flex items-start gap-1">
                      <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>{dish.location}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Day-wise Itinerary */}
        <section>
          <div className="mb-10">
            <h2 className="text-4xl font-serif font-bold text-foreground mb-4">Day by Day Itinerary</h2>
            <p className="text-xl text-muted-foreground max-w-2xl">Your complete {days}-day plan with {places.length} attractions distributed across each day.</p>
          </div>
          <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
            {itinerary.map((dayPlan, idx) => (
              <div key={idx} className="relative flex items-start justify-between md:justify-normal md:odd:flex-row-reverse group">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-primary text-primary-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 font-bold font-serif text-sm mt-2">
                  {dayPlan.day}
                </div>
                <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] border-none shadow-md bg-card">
                  <CardHeader className="pb-3 border-b border-border/50 bg-muted/30">
                    <CardTitle className="font-serif text-lg text-primary">{dayPlan.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border/40">
                      {dayPlan.activities.map((activity, aIdx) => (
                        <div key={aIdx} className="p-4 flex gap-4 hover:bg-muted/20 transition-colors">
                          <div className="text-xs font-semibold text-primary shrink-0 w-16 pt-0.5 tabular-nums">
                            {activity.time}
                          </div>
                          <div className="space-y-1 min-w-0">
                            <p className="text-foreground text-sm leading-snug">{activity.description}</p>
                            {activity.place && (
                              <p className="text-xs text-primary flex items-center gap-1 font-medium">
                                <MapPin className="w-3 h-3 shrink-0" /> {activity.place}
                              </p>
                            )}
                            {activity.cost ? (
                              <p className="text-xs text-muted-foreground">Est. Cost: {formatCurrency(activity.cost)}</p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </section>

        {/* Map */}
        <section className="pb-20">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-serif font-bold text-foreground mb-4 flex items-center gap-3">
                <MapIcon className="w-8 h-8 text-primary" /> Explore the Map
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl">Navigate {destination} with ease.</p>
            </div>
            <Button variant="outline" className="hidden md:flex items-center gap-2" onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(destination + ", India")}`, "_blank")}>
              Open in Maps <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Card className="border-none shadow-xl overflow-hidden rounded-2xl bg-card">
            <iframe
              src={mapEmbedUrl}
              width="100%"
              height="480"
              className="border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`Map of ${destination}`}
            />
          </Card>
        </section>

      </main>
    </div>
  );
}

function getTransportIcon(mode: string) {
  const m = mode.toLowerCase();
  if (m.includes("train")) return Train;
  if (m.includes("flight") || m.includes("air")) return Plane;
  if (m.includes("bus")) return Bus;
  return Car;
}

function BudgetBar({ label, amount, percent, icon: Icon }: { label: string; amount: number; percent: number; icon: React.ElementType }) {
  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <div className="flex items-center gap-2 text-foreground font-medium">
          <Icon className="w-4 h-4 text-muted-foreground" />
          {label}
        </div>
        <div className="text-right">
          <div className="font-bold text-foreground">{formatCurrency(amount)}</div>
          <div className="text-xs text-muted-foreground">{percent.toFixed(0)}%</div>
        </div>
      </div>
      <Progress value={percent} className="h-2 bg-muted" />
    </div>
  );
}
