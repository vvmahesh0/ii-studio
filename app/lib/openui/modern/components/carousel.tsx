"use client";

import { Card, CardContent } from "@/components/modern/ui/card";
import {
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  Carousel as ShadcnCarousel,
} from "@/components/modern/ui/carousel";
import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod";

const CarouselSchema = z.object({
  slides: z.array(z.array(z.any())),
  variant: z.enum(["default", "card"]).optional(),
});

export const Carousel = defineComponent({
  name: "Carousel",
  props: CarouselSchema,
  description:
    'Horizontal sliding content. slides: array of slide arrays. variant: "default" | "card".',
  component: function CarouselView({ props, renderNode }) {
    const slides = (props.slides ?? []) as unknown[][];
    const isCard = props.variant === "card";

    return (
      <ShadcnCarousel className="w-full">
        <CarouselContent>
          {slides.map((slide, i) => (
            <CarouselItem key={i}>
              {isCard ? (
                <Card>
                  <CardContent className="p-4 flex flex-col gap-3">
                    {renderNode(slide)}
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col gap-3">{renderNode(slide)}</div>
              )}
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </ShadcnCarousel>
    );
  },
});
