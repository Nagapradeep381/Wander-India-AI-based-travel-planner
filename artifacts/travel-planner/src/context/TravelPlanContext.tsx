import React, { createContext, useContext, useState, ReactNode } from "react";
import type { TravelPlanResponse } from "@workspace/api-client-react/src/generated/api.schemas";

interface TravelPlanContextType {
  planData: TravelPlanResponse | null;
  setPlanData: (data: TravelPlanResponse | null) => void;
}

const TravelPlanContext = createContext<TravelPlanContextType | undefined>(undefined);

export function TravelPlanProvider({ children }: { children: ReactNode }) {
  const [planData, setPlanData] = useState<TravelPlanResponse | null>(null);

  return (
    <TravelPlanContext.Provider value={{ planData, setPlanData }}>
      {children}
    </TravelPlanContext.Provider>
  );
}

export function useTravelPlan() {
  const context = useContext(TravelPlanContext);
  if (context === undefined) {
    throw new Error("useTravelPlan must be used within a TravelPlanProvider");
  }
  return context;
}
