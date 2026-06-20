import { ScrollProgress } from "@/components/pitch/shared";
import Hero from "@/components/pitch/sections/Hero";
import Problem from "@/components/pitch/sections/Problem";
import DataModel from "@/components/pitch/sections/DataModel";
import OneQuery from "@/components/pitch/sections/OneQuery";
import LiveDemo from "@/components/pitch/sections/LiveDemo";
import Superpowers from "@/components/pitch/sections/Superpowers";
import Architecture from "@/components/pitch/sections/Architecture";
import WhyAurora from "@/components/pitch/sections/WhyAurora";
import Close from "@/components/pitch/sections/Close";

export default function PitchPage() {
  return (
    <>
      <ScrollProgress />
      <Hero />
      <Problem />
      <DataModel />
      <OneQuery />
      <LiveDemo />
      <Superpowers />
      <Architecture />
      <WhyAurora />
      <Close />
    </>
  );
}
