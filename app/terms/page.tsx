// app/terms/page.tsx — Terms & Conditions / Privacy Policy v6
import Link from "next/link";
import { Shield, FileText } from "lucide-react";

const LAST_UPDATED = "April 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="border-b border-white/5 backdrop-blur-md bg-black/20 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg border border-cyan-neon/50 flex items-center justify-center" style={{ background: "rgba(0,240,255,0.08)" }}>
            <span className="font-bold text-cyan-neon text-sm" style={{ fontFamily: "Orbitron,sans-serif" }}>NF</span>
          </div>
          <span className="font-bold text-white tracking-wide" style={{ fontFamily: "Orbitron,sans-serif", fontSize: "16px" }}>NEUROFAST AI</span>
        </Link>
        <Link href="/sign-up" className="btn-neon px-5 py-2 rounded-lg text-sm font-semibold">Get Started →</Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 rounded-xl border border-cyan-neon/30 bg-cyan-neon/8 flex items-center justify-center">
            <FileText className="w-6 h-6 text-cyan-neon" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold text-white">Terms & Conditions</h1>
            <p className="font-mono text-xs text-muted-foreground mt-1">Last updated: {LAST_UPDATED} · NeuroFast AI</p>
          </div>
        </div>

        {/* Quick nav */}
        <div className="cyber-card p-5 mb-10">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Quick Navigation</p>
          <div className="flex flex-wrap gap-2">
            {["Usage Policy","AI Usage","Payments","Refunds","Data Usage","Privacy","Contact"].map((s) => (
              <a key={s} href={`#${s.toLowerCase().replace(" ","-")}`}
                className="px-3 py-1 rounded border border-white/10 font-mono text-xs text-white/60 hover:text-white hover:border-white/20 transition-all">
                {s}
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-10 font-body text-white/80 leading-relaxed">

          {/* Section 1 */}
          <section id="usage-policy">
            <h2 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-cyan-neon font-mono text-sm">01.</span> Usage Policy
            </h2>
            <div className="space-y-3 text-sm">
              <p>By accessing NeuroFast AI (&quot;the Platform&quot;), you agree to use it solely for lawful purposes and in accordance with these Terms. You are responsible for all activity under your account.</p>
              <p><strong className="text-white">Permitted Use:</strong> Training custom AI models on your own data, running inference via the chat playground, integrating via API into your own applications.</p>
              <p><strong className="text-white">Prohibited Use:</strong> You may not use the Platform to train models on illegal content, malicious code, copyrighted material without rights, or to generate harmful, abusive, or deceptive outputs. Automated abuse, credential sharing, and circumventing rate limits are prohibited.</p>
              <p>We reserve the right to suspend accounts that violate these policies without prior notice.</p>
            </div>
          </section>

          <div className="border-t border-white/5" />

          {/* Section 2 */}
          <section id="ai-usage">
            <h2 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-cyan-neon font-mono text-sm">02.</span> AI Usage Disclaimer
            </h2>
            <div className="space-y-3 text-sm">
              <p>NeuroFast AI enables you to fine-tune large language models using your data. While we provide infrastructure and tooling, you are solely responsible for the outputs and behavior of models you train.</p>
              <div className="p-4 rounded-lg border border-yellow-400/20 bg-yellow-400/5">
                <p className="font-mono text-xs text-yellow-400 mb-1">⚠ Important Disclaimer</p>
                <p className="text-sm text-white/70">AI-generated outputs may be inaccurate, incomplete, or biased. Do not rely solely on AI outputs for critical business decisions without human review. NeuroFast AI is not liable for decisions made based on model outputs.</p>
              </div>
              <p>Your training data is processed by Together AI, our infrastructure partner. By uploading data, you confirm you have the rights to use it for model training. We do not use your training data to train our own models.</p>
              <p>Models you create are private to your account unless you explicitly make them public. Public models may be viewed and used by other users within the platform.</p>
            </div>
          </section>

          <div className="border-t border-white/5" />

          {/* Section 3 */}
          <section id="payments">
            <h2 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-cyan-neon font-mono text-sm">03.</span> Payment Terms
            </h2>
            <div className="space-y-3 text-sm">
              <p>NeuroFast AI operates on a credit-based system. Credits are purchased in packs and used for training jobs and inference calls. Prices are listed in Indian Rupees (INR) and are subject to change with notice.</p>
              <p><strong className="text-white">Free Tier:</strong> New accounts receive complimentary credits upon registration. Free credits expire 90 days after account creation.</p>
              <p><strong className="text-white">Purchased Credits:</strong> Credits purchased via Razorpay do not expire. Payment is processed securely; we do not store card details.</p>
              <p><strong className="text-white">Credit Consumption:</strong> Training jobs and inference calls consume credits at rates displayed at time of use. Credit consumption rates may change; you will be notified via email 14 days before any changes.</p>
              <p>All prices are exclusive of applicable taxes. GST may apply to Indian customers as per applicable law.</p>
            </div>
          </section>

          <div className="border-t border-white/5" />

          {/* Section 4 */}
          <section id="refunds">
            <h2 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-cyan-neon font-mono text-sm">04.</span> Refund Policy
            </h2>
            <div className="space-y-3 text-sm">
              <p>We offer refunds in the following circumstances:</p>
              <ul className="list-disc list-inside space-y-2 text-white/70 ml-2">
                <li>Training job failed due to a Platform error (not user data issues)</li>
                <li>Credits were incorrectly deducted due to a billing bug</li>
                <li>Account was charged after cancellation</li>
              </ul>
              <p>Refund requests must be submitted within 14 days of the transaction via our support channel. We do not refund credits consumed by completed training jobs or inference calls, or credits purchased more than 30 days ago.</p>
              <p>Refunds are processed to the original payment method within 7–10 business days.</p>
              <div className="p-4 rounded-lg border border-cyan-neon/10 bg-cyan-neon/3">
                <p className="text-sm text-white/70">To request a refund, contact us with your transaction ID at: <strong className="text-cyan-neon">support@neurofast.ai</strong></p>
              </div>
            </div>
          </section>

          <div className="border-t border-white/5" />

          {/* Section 5 */}
          <section id="data-usage">
            <h2 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-cyan-neon font-mono text-sm">05.</span> Data Usage
            </h2>
            <div className="space-y-3 text-sm">
              <p>We collect only data necessary to provide the Platform services: account information, usage logs, and training datasets you upload.</p>
              <p><strong className="text-white">Your Training Data:</strong> Data you upload for model training is stored encrypted, processed by Together AI for fine-tuning, and never used to train NeuroFast-owned models. You can delete your datasets at any time.</p>
              <p><strong className="text-white">Usage Analytics:</strong> We collect anonymized usage metrics (API calls, feature usage, error rates) to improve the Platform. This data cannot be linked back to individual users.</p>
              <p><strong className="text-white">Audit Logs:</strong> All admin actions and billing events are logged with IP address and timestamp for security and compliance purposes. These logs are retained for 2 years.</p>
              <p>We do not sell your personal data to third parties. We share data only with service providers (Clerk for auth, Razorpay for billing, Upstash for caching, Together AI for training) under data processing agreements.</p>
            </div>
          </section>

          <div className="border-t border-white/5" />

          {/* Section 6 */}
          <section id="privacy">
            <h2 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-cyan-neon font-mono text-sm">06.</span> Privacy & Security
            </h2>
            <div className="space-y-3 text-sm">
              <p>We take security seriously. All data is encrypted at rest and in transit (TLS 1.3). We implement rate limiting, input sanitization, and audit logging on all sensitive operations.</p>
              <p>You have the right to: access your personal data, request deletion of your account and all associated data, correct inaccurate information, and data portability.</p>
              <p>To exercise these rights, contact us at <strong className="text-cyan-neon">privacy@neurofast.ai</strong>.</p>
            </div>
          </section>

          <div className="border-t border-white/5" />

          {/* Section 7 */}
          <section id="contact">
            <h2 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-cyan-neon font-mono text-sm">07.</span> Contact & Governing Law
            </h2>
            <div className="space-y-3 text-sm">
              <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in India.</p>
              <p>For questions about these Terms, contact us at <strong className="text-cyan-neon">legal@neurofast.ai</strong>.</p>
              <p>We may update these Terms from time to time. Continued use of the Platform after changes constitutes acceptance of the updated Terms. Major changes will be communicated via email.</p>
            </div>
          </section>

        </div>

        {/* Footer CTA */}
        <div className="mt-16 cyber-card p-8 text-center">
          <Shield className="w-8 h-8 text-cyan-neon mx-auto mb-3" />
          <h3 className="font-display text-lg font-bold text-white mb-2">Ready to Get Started?</h3>
          <p className="font-body text-sm text-muted-foreground mb-6">By signing up, you agree to these Terms & Conditions.</p>
          <Link href="/sign-up" className="btn-neon px-8 py-3 rounded-xl font-display text-sm font-bold">Create Free Account →</Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <div className="flex items-center justify-center gap-6 font-mono text-xs text-muted-foreground">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <Link href="/demo" className="hover:text-white transition-colors">Demo</Link>
          <Link href="/terms" className="text-white">Terms</Link>
          <Link href="/sign-in" className="hover:text-white transition-colors">Sign In</Link>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground mt-4">
          © {new Date().getFullYear()} NeuroFast AI. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
