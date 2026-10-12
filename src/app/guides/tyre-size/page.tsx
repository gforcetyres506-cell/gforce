import Link from 'next/link';
import InformationPage from '@/components/content/InformationPage';
import { publicMetadata } from '@/lib/site';
export const metadata = publicMetadata('/guides/tyre-size', 'How to Read Your Tyre Size', 'Understand the width, profile and rim markings in a tyre size such as 225/45 R18, then check vehicle requirements before selecting tyres.');
export default function TyreSizeGuide() {
  return <InformationPage path="/guides/tyre-size" title="How to read your tyre size" intro="Look for a marking such as 225/45 R18 on the tyre sidewall. The three numbers describe width, profile and wheel diameter.">
    <p className="text-xs">Updated <time dateTime="2026-10-12">12 October 2026</time></p>
    <section><h2 className="text-lg font-bold text-ink-1 mb-3">What 225/45 R18 means</h2><div className="overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Example tyre-size markings</caption><thead><tr><th scope="col" className="p-2">Marking</th><th scope="col" className="p-2">Meaning</th></tr></thead><tbody>
      <tr><th scope="row" className="p-2">225</th><td className="p-2">Nominal tyre width in millimetres.</td></tr>
      <tr><th scope="row" className="p-2">45</th><td className="p-2">Sidewall height as a percentage of tyre width: the aspect ratio.</td></tr>
      <tr><th scope="row" className="p-2">R</th><td className="p-2">Radial construction.</td></tr>
      <tr><th scope="row" className="p-2">18</th><td className="p-2">Wheel rim diameter in inches.</td></tr>
    </tbody></table></div></section>
    <section><h2 className="text-lg font-bold text-ink-1 mb-2">Check more than the three numbers</h2><p>The following load index and speed symbol also matter. Check the vehicle manufacturer&apos;s requirements and the markings on the fitted tyres. Front and rear sizes may differ. Ask a qualified fitter if anything is unclear before choosing a replacement.</p></section>
    <section><h2 className="text-lg font-bold text-ink-1 mb-2">Enter the size in the finder</h2><p>Use width 225, profile 45 and rim 18 for this example. It is an explanation, not a recommendation for your vehicle. <Link href="/mobile-tyre-fitting" className="underline">Learn about mobile tyre fitting</Link>.</p></section>
    <p>Source: <a href="https://www.continental-tyres.co.uk/b2c/tyre-knowledge/tyre-markings/" className="underline">Continental&apos;s explanation of tyre markings</a>.</p>
  </InformationPage>;
}
