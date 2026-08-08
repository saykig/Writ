import { CorpusNetwork } from "@/components/home/corpus-network";
import { HomepageField } from "@/components/home/homepage-field";
import { HomepageHero } from "@/components/home/home-intro";

export default function Home() {
  return (
    <div className="homepage-motion-world">
      <HomepageField />
      <main className="homepage-motion-content">
        <HomepageHero />
        <CorpusNetwork />
      </main>
    </div>
  );
}
