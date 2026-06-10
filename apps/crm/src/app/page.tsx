import { Hero } from "@/components/landing/hero";
import { LandingSections } from "@/components/landing/sections";

export default function Home() {
  return (
    <main className="bg-background">
      <Hero />
      <LandingSections />
    </main>
  );
}
