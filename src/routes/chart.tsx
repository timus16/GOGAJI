import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Starfield from '~/components/Starfield';
import Generator from '~/components/Generator';
import { Reveal, Chapter } from '~/lib/ui';

function ChartPage() {
  const [showGenerator, setShowGenerator] = useState(true);

  return (
    <>
      <Starfield density={0.5} className="fixed inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto max-w-6xl px-4 md:px-8 py-8 md:py-16">
        <Reveal>
          <Chapter index="01" title="Create Your Chart" sub="Enter your birth details to generate a precise Vedic birth chart and deterministic wallpaper. The chart maths runs entirely on your device." accent="text-gold" />
        </Reveal>

        {showGenerator && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Generator
              initialName=""
              subject="self"
              autoGenerate={false}
            />
          </motion.div>
        )}
      </div>
    </>
  );
}

export const Route = createFileRoute('/chart')({
  component: ChartPage,
});
