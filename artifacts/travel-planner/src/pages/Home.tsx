import { TravelForm } from "@/components/TravelForm";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center opacity-10"
        style={{ backgroundImage: 'url("https://source.unsplash.com/1600x900/?india,palace,architecture")' }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-background/50 to-background" />

      <main className="flex-1 relative z-10 flex flex-col items-center justify-center p-6 md:p-12 max-w-5xl mx-auto w-full">
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <h1 className="text-5xl md:text-7xl font-serif font-bold text-foreground mb-6 leading-tight">
            Discover the <span className="text-primary italic">Soul</span> of India.
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
            Your intelligent travel companion for exploring the vibrant colors, deep history, and breathtaking landscapes of the subcontinent.
          </p>
        </div>

        <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200 fill-mode-both">
          <TravelForm />
        </div>
      </main>
    </div>
  );
}
