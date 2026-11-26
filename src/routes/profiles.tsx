import { Link, useSearch, createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Starfield from '~/components/Starfield';
import { Reveal, Chapter, Readout, Divider, Tag, cx } from '~/lib/ui';
import { computeChart, type Chart, type BirthInput } from '~/lib/astro';
import { GRAHAS, RASHIS, NAKSHATRAS, NAK_SPAN } from '~/content/vedic-mapping';
import { dms, rashiOf } from '~/lib/astro';

const STORAGE_KEY = 'gogaji.profiles';

function readProfiles(): BirthInput[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeProfiles(profiles: BirthInput[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    }
  } catch { }
}

function saveProfile(input: BirthInput) {
  const profiles = readProfiles();
  const exists = profiles.findIndex(p => p.name === input.name && p.date === input.date && p.time === input.time);
  if (exists >= 0) profiles[exists] = input;
  else profiles.unshift(input);
  if (profiles.length > 50) profiles.length = 50;
  writeProfiles(profiles);
}

function deleteProfile(input: BirthInput) {
  const profiles = readProfiles().filter(p => !(p.name === input.name && p.date === input.date && p.time === input.time));
  writeProfiles(profiles);
}

export default function ProfilesPage() {
  const search = useSearch({ from: '/profiles' });
  const [profiles, setProfiles] = useState<BirthInput[]>([]);
  const [chart, setChart] = useState<Chart | null>(null);
  const [editing, setEditing] = useState<BirthInput | null>(null);
  const [editData, setEditData] = useState<Partial<BirthInput>>({});

  useEffect(() => {
    setProfiles(readProfiles());
  }, []);

  useEffect(() => {
    if (search.chart) {
      try {
        const parsed = JSON.parse(search.chart as string);
        setChart(parsed);
      } catch { }
    }
  }, [search.chart]);

  const handleSave = (input: BirthInput) => {
    saveProfile(input);
    setProfiles(readProfiles());
    setEditing(null);
  };

  const handleDelete = (input: BirthInput) => {
    if (confirm(`Delete ${input.name}'s chart?`)) {
      deleteProfile(input);
      setProfiles(readProfiles());
    }
  };

  const startEdit = (input: BirthInput) => {
    setEditing(input);
    setEditData({ ...input });
  };

  const handleEditSave = () => {
    if (editing) {
      deleteProfile(editing);
      handleSave(editData as BirthInput);
    }
  };

  return (
    <>
      <Starfield density={0.5} className="fixed inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto max-w-5xl px-4 md:px-8 pb-16">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="display text-2xl md:text-3xl font-semibold text-bone">
              Saved Profiles
            </h1>
            <p className="text-mute mt-1">
              {profiles.length} chart{profiles.length !== 1 ? 's' : ''} saved locally
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/chart" className="rounded-xl bg-gradient-to-r from-gold to-gold-deep px-4 py-2 font-serif text-sm tracking-wide text-void hover:from-gold-light hover:to-gold">
              New Chart
            </Link>
            {chart && (
              <Link to="/canvas" className="rounded-xl border border-gold/30 bg-void/60 px-4 py-2 font-serif text-sm tracking-wide text-bone hover:border-gold hover:bg-gold/10">
                Back to Canvas
              </Link>
            )}
          </div>
        </div>

        {editing && (
          <Reveal>
            <div className="panel p-6 mb-8 max-w-xl">
              <h3 className="display text-lg font-semibold text-bone mb-4">Edit Profile</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-mute mb-1">Name</label>
                  <input value={editData.name || ''} onChange={e => setEditData({ ...editData, name: e.target.value })} className="w-full rounded-xl border border-gold/20 bg-void/60 px-4 py-2 text-bone outline-none focus:border-gold" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-mute mb-1">Date</label>
                    <input value={editData.date || ''} onChange={e => setEditData({ ...editData, date: e.target.value })} className="w-full rounded-xl border border-gold/20 bg-void/60 px-4 py-2 text-bone outline-none focus:border-gold" />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-mute mb-1">Time</label>
                    <input value={editData.time || ''} onChange={e => setEditData({ ...editData, time: e.target.value })} className="w-full rounded-xl border border-gold/20 bg-void/60 px-4 py-2 text-bone outline-none focus:border-gold" />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-mute mb-1">Timezone</label>
                    <input value={editData.timezone || ''} onChange={e => setEditData({ ...editData, timezone: e.target.value })} className="w-full rounded-xl border border-gold/20 bg-void/60 px-4 py-2 text-bone outline-none focus:border-gold" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-mute mb-1">Latitude</label>
                    <input value={editData.latitude || ''} onChange={e => setEditData({ ...editData, latitude: Number(e.target.value) })} type="number" step="any" className="w-full rounded-xl border border-gold/20 bg-void/60 px-4 py-2 text-bone outline-none focus:border-gold" />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-mute mb-1">Longitude</label>
                    <input value={editData.longitude || ''} onChange={e => setEditData({ ...editData, longitude: Number(e.target.value) })} type="number" step="any" className="w-full rounded-xl border border-gold/20 bg-void/60 px-4 py-2 text-bone outline-none focus:border-gold" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleEditSave} className="flex-1 rounded-xl bg-gradient-to-r from-gold to-gold-deep px-4 py-2 font-serif text-sm tracking-wide text-void hover:from-gold-light hover:to-gold">Save</button>
                  <button onClick={() => setEditing(null)} className="flex-1 rounded-xl border border-gold/30 bg-void/60 px-4 py-2 font-serif text-sm tracking-wide text-bone hover:border-gold hover:bg-gold/10">Cancel</button>
                </div>
              </div>
            </div>
          </Reveal>
        )}

        {profiles.length === 0 && (
          <Reveal>
            <div className="panel p-12 text-center">
              <div className="mb-4 text-gold/60">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="display text-xl font-semibold text-bone mb-2">No saved profiles</h3>
              <p className="text-mute mb-6">Create your first chart to see it here.</p>
              <Link to="/chart" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-deep px-6 py-3 font-serif text-base tracking-wide text-void hover:from-gold-light hover:to-gold">
                Create Chart
              </Link>
            </div>
          </Reveal>
        )}

        {profiles.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile, i) => {
              const c = computeChart(profile);
              const moon = c.GRAHAS.find(p => p.key === 'moon')!;
              return (
                <motion.article
                  key={`${profile.name}-${profile.date}-${profile.time}`}
                  className="panel p-4 relative"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="display text-lg font-semibold text-bone truncate">{profile.name}</h3>
                      <p className="text-sm text-mute mt-1">{profile.date} · {profile.time}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(profile)} className="p-1.5 text-mute hover:text-gold transition-colors" aria-label="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => handleDelete(profile)} className="p-1.5 text-mute hover:text-crimson transition-colors" aria-label="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <Readout label="Lagna" value={RASHIS[c.lagna.signIndex].name} tone="gold" />
                    <Readout label="Moon" value={`${RASHIS[c.moonSign].name} · {NAKSHATRAS[moon.nakshatraIndex].name} Pd {moon.pada}`} tone="steel" />
                    <Readout label="Sun" value={RASHIS[c.sunSign].name} tone="gold" />
                    <Readout label="Ruling" value={GRAHAS[c.rulingPlanet].name} tone="violet" />
                  </div>

                  <div className="flex gap-2">
                    <Link
                      to="/canvas"
                      search={{ chart: JSON.stringify(c) }}
                      className="flex-1 rounded-xl border border-gold/30 bg-void/60 px-3 py-2 text-center font-serif text-sm tracking-wide text-bone hover:border-gold hover:bg-gold/10"
                    >
                      View Canvas
                    </Link>
                    <Link
                      to="/match"
                      search={{ chart: JSON.stringify(c) }}
                      className="flex-1 rounded-xl border border-gold/30 bg-void/60 px-3 py-2 text-center font-serif text-sm tracking-wide text-bone hover:border-gold hover:bg-gold/10"
                    >
                      Match
                    </Link>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export const Route = createFileRoute("/profiles")({
  validateSearch: (search) => search as { chart?: string },
  component: ProfilesPage,
});
