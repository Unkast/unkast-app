"use client";

import { useState, type ReactNode } from "react";
import { EnterItem, EnterList, cardSpring, motion } from "@/components/motion";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Field from "@/components/ui/Field";
import GlassCard from "@/components/ui/GlassCard";
import ProgressSteps from "@/components/ui/ProgressSteps";

const FILTERS = ["Tous", "Fiction", "Clip", "Documentaire", "Publicité"];
const STEPS = 5;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-mono text-xs uppercase tracking-widest text-text-secondary">{title}</h2>
      {children}
    </section>
  );
}

export default function UiShowcase() {
  const [filter, setFilter] = useState(FILTERS[0]);
  const [search, setSearch] = useState("");
  const [step, setStep] = useState(0);
  const [listKey, setListKey] = useState(0);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-12">
      <h1 className="text-sheen text-5xl font-bold">Briques UI</h1>

      <Section title="Button">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Accent</Button>
          <Button variant="light">Clair</Button>
          <Button variant="glass">Verre</Button>
          <Button variant="icon" aria-label="Ajouter">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </Button>
          <Button disabled>Désactivé</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Petit</Button>
          <Button size="lg">Grand</Button>
          <Button variant="dashed" size="sm">Pointillé</Button>
          <Button variant="glass" href="/dev/ui">Lien</Button>
        </div>
      </Section>

      <Section title="Chip">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Chip key={f} selected={filter === f} onClick={() => setFilter(f)}>
              {f}
            </Chip>
          ))}
          <Chip variant="static">Statique</Chip>
        </div>
      </Section>

      <Section title="Badge">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="verified" />
          <Badge variant="pro" />
          <Badge variant="available" />
          <Badge variant="neutral">Neutre</Badge>
          <Badge variant="pending" />
        </div>
      </Section>

      <Section title="GlassCard">
        <div className="grid gap-4 sm:grid-cols-2">
          <GlassCard className="p-5">Verre, rayon carte</GlassCard>
          <GlassCard strong className="p-5">Verre fort, rayon carte</GlassCard>
          <GlassCard radius="panel" className="p-5">Verre, rayon panneau</GlassCard>
          <GlassCard strong radius="panel" className="p-5">Verre fort, rayon panneau</GlassCard>
        </div>
      </Section>

      <Section title="Field">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom de scène" placeholder="Ex : J.M. Vision" />
          <Field label="Email" type="email" placeholder="contact@exemple.com" />
          <Field multiline rows={3} label="Message" placeholder="Quelques mots..." />
          <Field
            size="lg"
            aria-label="Rechercher"
            placeholder="Nom, métier, ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
      </Section>

      <Section title="ProgressSteps">
        <div className="flex flex-wrap items-center gap-4">
          <ProgressSteps total={STEPS} current={step} />
          <Button variant="glass" onClick={() => setStep((s) => (s + 1) % STEPS)}>
            Étape suivante
          </Button>
        </div>
      </Section>

      <Section title="Motion">
        <EnterList key={listKey} className="grid gap-3 sm:grid-cols-3">
          {["Entrée 1", "Entrée 2", "Entrée 3"].map((label) => (
            <EnterItem key={label}>
              <motion.div whileHover={{ y: -4 }} transition={cardSpring}>
                <GlassCard className="p-5">{label}</GlassCard>
              </motion.div>
            </EnterItem>
          ))}
        </EnterList>
        <div>
          <Button variant="glass" onClick={() => setListKey((k) => k + 1)}>
            Rejouer l&apos;entrée
          </Button>
        </div>
      </Section>
    </main>
  );
}
