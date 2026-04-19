import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, MapPin, Navigation, Calendar, Users, Wallet, CreditCard } from "lucide-react";
import { useGenerateTravelPlan } from "@workspace/api-client-react";
import { useTravelPlan } from "../context/TravelPlanContext";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  source: z.string().min(2, "Source city is required"),
  destination: z.string().min(2, "Destination city is required"),
  days: z.coerce.number().min(1, "Must be at least 1 day").max(30, "Maximum 30 days allowed"),
  people: z.coerce.number().min(1, "Must be at least 1 person").max(20, "Maximum 20 people allowed"),
  budget: z.coerce.number().min(1000, "Minimum budget is ₹1,000"),
  budgetType: z.enum(["total", "per_person"]),
});

export function TravelForm() {
  const [, setLocation] = useLocation();
  const { setPlanData } = useTravelPlan();
  const { toast } = useToast();
  
  const generatePlan = useGenerateTravelPlan();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      source: "",
      destination: "",
      days: 3,
      people: 2,
      budget: 50000,
      budgetType: "total",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    generatePlan.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          setPlanData(data);
          setLocation("/plan");
        },
        onError: (error) => {
          toast({
            title: "Failed to generate plan",
            description: error.error || "Please try again later.",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <Card className="border-none shadow-xl bg-card/80 backdrop-blur-xl">
      <CardContent className="p-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Source */}
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-foreground/80">
                      <MapPin className="w-4 h-4 text-primary" />
                      Starting From
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Mumbai" className="h-12 bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Destination */}
              <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-foreground/80">
                      <Navigation className="w-4 h-4 text-primary" />
                      Going To
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Jaipur" className="h-12 bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Days */}
              <FormField
                control={form.control}
                name="days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-foreground/80">
                      <Calendar className="w-4 h-4 text-primary" />
                      Number of Days
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={30} className="h-12 bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* People */}
              <FormField
                control={form.control}
                name="people"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-foreground/80">
                      <Users className="w-4 h-4 text-primary" />
                      Travelers
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={20} className="h-12 bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Budget */}
              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-foreground/80">
                      <Wallet className="w-4 h-4 text-primary" />
                      Budget (₹)
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min={1000} className="h-12 bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Budget Type */}
              <FormField
                control={form.control}
                name="budgetType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="flex items-center gap-2 text-foreground/80">
                      <CreditCard className="w-4 h-4 text-primary" />
                      Budget Type
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex space-x-4"
                      >
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="total" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            Total Budget
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="per_person" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            Per Person
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 text-lg font-medium tracking-wide mt-6 hover-elevate transition-all"
              disabled={generatePlan.isPending}
            >
              {generatePlan.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Crafting Your Perfect Trip...
                </>
              ) : (
                "Plan My Trip"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
