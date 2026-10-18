import Image from 'next/image';
import { publicMetadata } from '@/lib/site';
import StructuredData from '@/components/StructuredData';
import { organizationSchema, websiteSchema } from '@/lib/business-entity';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Car,
  CheckCircle2,
  Home,
  MapPin,
  ScanSearch,
  ShieldCheck,
} from 'lucide-react';
import MStripe from '@/components/ui/MStripe';
import ScrollReveal from '@/components/animations/ScrollReveal';
import HeroTyreMotion from '@/components/animations/HeroTyreMotion';
import TyreFinder from '@/components/booking/TyreFinder';
import { ContactActions } from '@/components/layout/BusinessContact';

export const metadata = publicMetadata('/', 'Mobile Tyre Fitting', 'G Force Tyres Mobile provides mobile tyre fitting. Check your postcode and tyre size, review available tyres and follow the booking instructions.');

const STEPS = [
  {
    n: '01',
    title: 'Check the fitting postcode',
    body: 'Start with the location so the booking journey only continues when the address is inside an active service area.',
  },
  {
    n: '02',
    title: 'Read your tyre size',
    body: 'Enter the width, profile and rim size printed on the tyre sidewall. Check vehicle requirements before selecting a replacement.',
  },
  {
    n: '03',
    title: 'Review tyres and continue',
    body: 'Compare compatible options, confirm the fitment details and continue into the appointment flow.',
  },
];

const JOURNEY_PROOF = [
  { icon: MapPin, label: 'Location first', sub: 'Postcode-based service check' },
  { icon: Car, label: 'Search by size', sub: 'Use the tyre sidewall markings' },
  { icon: ScanSearch, label: 'Fitment confirmation', sub: 'Review before selection' },
  { icon: ShieldCheck, label: 'Clear next steps', sub: 'No hidden navigation' },
];

const FITTING_CONTEXTS = [
  {
    icon: Home,
    title: 'At home',
    body: 'Choose an accessible fitting address and keep the booking details tied to the vehicle.',
  },
  {
    icon: Building2,
    title: 'At work',
    body: 'Use the same location-first journey for an office or workplace parking area.',
  },
  {
    icon: MapPin,
    title: 'At your location',
    body: 'Start with the postcode so availability can be checked before you spend time choosing tyres.',
  },
];

export default function HomePage() {
  return (
    <>
      <StructuredData data={organizationSchema()} />
      <StructuredData data={websiteSchema()} />
      <section className="hero-shell" aria-labelledby="hero-title">
        <div className="hero-grid-lines" aria-hidden="true" />
        <div className="hero-glow" aria-hidden="true" />

        <div className="container-g hero-layout">
          <div className="hero-copy">
            <MStripe className="mb-5" />

            <h1 id="hero-title" className="hero-title">
              The right tyres.
              <span>Fitted where you need them.</span>
            </h1>

            <p className="hero-lede">
              G Force Tyres Mobile provides mobile tyre fitting. Check your
              postcode, enter your tyre size and review the available options.
            </p>
            <ContactActions className="mt-5" />

            <div id="tyre-finder" className="hero-finder-anchor">
              <TyreFinder />
            </div>

            <div className="hero-microproof" aria-label="Search options">
              <span><CheckCircle2 size={14} /> Postcode check</span>
              <span><CheckCircle2 size={14} /> Manual size entry</span>
              <span><CheckCircle2 size={14} /> No account required</span>
            </div>
          </div>

          <div className="hero-visual" aria-label="Performance tyre product visual">
            <div className="hero-orbit hero-orbit-one" aria-hidden="true" />
            <div className="hero-orbit hero-orbit-two" aria-hidden="true" />
            <HeroTyreMotion>
              <Image
                src="/images/hero-tyre-v3.webp"
                alt="Low-profile performance tyre with a five-spoke graphite alloy wheel"
                width={1254}
                height={1254}
                priority
                sizes="(max-width: 767px) 340px, (max-width: 1199px) 48vw, 650px"
                className="hero-tyre-image"
              />
            </HeroTyreMotion>
            <div className="hero-spec-card" aria-hidden="true">
              <span className="hero-spec-kicker">Fitment search</span>
              <strong>POSTCODE → SIZE → TYRE</strong>
              <span>One clear route to the right option</span>
            </div>
          </div>
        </div>

        <a href="#how" className="hero-scroll-cue" aria-label="See how it works">
          <span>How it works</span>
          <span className="hero-scroll-line" aria-hidden="true" />
        </a>
      </section>

      <section className="journey-strip" aria-label="Booking journey highlights">
        <div className="container-g">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {JOURNEY_PROOF.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="journey-proof-item">
                <Icon size={19} className="shrink-0 text-brand" strokeWidth={1.7} />
                <div>
                  <div className="text-sm font-semibold text-ink-1">{label}</div>
                  <div className="text-xs text-ink-3">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="section section-light content-auto">
        <div className="container-g">
          <ScrollReveal>
            <MStripe className="mb-6" />
            <p className="label mb-3">A shorter route to the right fit</p>
            <h2 className="display-1 mb-5 max-w-[14ch]">From postcode to tyre choice</h2>
            <p className="mb-14 max-w-readable text-ink-2">
              Check the fitting location first, then enter the tyre-size markings.
              Registration lookup is currently unavailable.
            </p>
          </ScrollReveal>

          <ScrollReveal stagger={0.08} className="grid gap-5 md:grid-cols-3">
            {STEPS.map((step) => (
              <article key={step.n} className="process-card">
                <div className="process-number">{step.n}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </ScrollReveal>
        </div>
      </section>

      <section id="coverage" className="section content-auto border-t border-line bg-surface-2">
        <div className="container-g">
          <ScrollReveal className="mb-12 grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <div>
              <MStripe className="mb-6" />
              <p className="label mb-3">Built around the fitting location</p>
              <h2 className="display-1 max-w-[12ch]">Start where the vehicle is</h2>
            </div>
            <div>
              <p className="max-w-readable text-ink-2">
                Enter the postcode where the vehicle will be fitted. Coverage,
                stock and appointment availability must be checked before booking.
              </p>
              <Link href="/#tyre-finder" className="btn btn-secondary mt-7">
                Check a postcode <ArrowRight size={16} />
              </Link>
            </div>
          </ScrollReveal>

          <ScrollReveal stagger={0.08} className="grid gap-5 md:grid-cols-3">
            {FITTING_CONTEXTS.map(({ icon: Icon, title, body }) => (
              <article key={title} className="context-card">
                <div className="context-icon"><Icon size={22} /></div>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </ScrollReveal>
        </div>
      </section>

      <section className="cta-shell content-auto">
        <div className="container-g">
          <ScrollReveal className="cta-panel">
            <div>
              <p className="label mb-3 text-brand">Ready when you are</p>
              <h2 className="display-1 max-w-[15ch]">Find the size. See the options.</h2>
            </div>
            <div className="max-w-[420px] lg:text-right">
              <p className="mb-7 text-ink-2">
                Start with a postcode, then use the numbers on the tyre sidewall.
              </p>
              <Link href="/#tyre-finder" className="btn btn-primary">
                Start tyre search <ArrowRight size={16} />
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
      <section className="section border-t border-line"><div className="container-g max-w-3xl">
        <h2 className="display-2 mb-5">Before you book</h2>
        <p className="text-ink-2 mb-4">Bank-transfer reservations require independent staff payment verification. A pending payment is not a confirmed fitting. Keep your private management link to check the recorded status.</p>
        <p className="text-ink-2 mb-6">Check your postcode for coverage. Published opening hours and a service-area list are not yet available.</p>
        <nav aria-label="Service information" className="flex flex-wrap gap-3">
          <Link className="btn btn-secondary" href="/mobile-tyre-fitting">Mobile tyre fitting</Link>
          <Link className="btn btn-secondary" href="/how-it-works">Booking and payment steps</Link>
          <Link className="btn btn-secondary" href="/guides/tyre-size">Read your tyre size</Link>
          <Link className="btn btn-secondary" href="/contact">Contact G Force Tyres Mobile</Link>
        </nav>
      </div></section>
    </>
  );
}
