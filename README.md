# NeuroFast AI Trainer

**Sovereign Logistics Intelligence Platform** — Fine-tune, edit, and deploy private AI models for Indian logistics operators.

![NeuroFast AI Trainer](https://neurofast.vercel.app/og-image.png)

---

## 🚀 Features

- **Fine-tune open-source LLMs** (Llama 3.1, Qwen 2.5, Mistral) via Together AI — no GPU management
- **Pre-built logistics templates** for dark-store SKU, fleet routing, inventory forecasting
- **Real-time training logs** with terminal-style UI
- **Chat playground** with streaming inference
- **Model editor** — system prompts, DPO preference pairs, safety filters
- **India-first billing** via Razorpay (UPI, cards, netbanking)
- **NeuroFast integration** — pull your store data, auto-generate training examples
- **Credit-based pricing** with free tier

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.2 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui |
| Auth | Clerk (email, Google, magic link) |
| Database | Drizzle ORM + Postgres |
| Storage | Supabase Storage |
| AI Backend | Together AI (fine-tuning + inference) |
| Payments | Razorpay |
| Validation | Zod + React Hook Form |
| Toasts | Sonner |
| Charts | Recharts |

---

## ⚡ Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/your-org/neurofast-ai-trainer
cd neurofast-ai-trainer
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local`:

```bash
# Clerk — https://clerk.com → Create app
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Database — Vercel Postgres or Supabase Postgres
DATABASE_URL=postgresql://...

# Supabase — https://supabase.com → New project → Settings → API
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Together AI — https://together.ai → API Keys
TOGETHER_API_KEY=...

# Razorpay — https://razorpay.com → Dashboard → API Keys
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Webhook secret (generate: openssl rand -hex 32)
WEBHOOK_SECRET=...
```

### 3. Set Up Supabase Storage

In your Supabase dashboard:
1. Go to **Storage** → **New Bucket**
2. Create bucket named: `neurofast-datasets`
3. Set to **Public** (or configure RLS policies)

### 4. Set Up Database

```bash
# Generate Drizzle migrations
npx drizzle-kit generate

# Push schema to database
npx drizzle-kit push
```

### 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🌐 Deploy to Vercel (2 clicks)

### Option A: Deploy Button

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-org/neurofast-ai-trainer)

### Option B: Manual Deploy

1. Push to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repo
4. Add all environment variables from `.env.example`
5. Click **Deploy**

> **Important:** After deployment, update `NEXT_PUBLIC_APP_URL` to your Vercel domain.

---

## 📦 Adding More Base Models

In `lib/training.ts`, add to the `SUPPORTED_MODELS` array:

```typescript
{
  id: "your-model-id-on-together",     // Together AI model ID
  name: "Model Display Name",
  description: "What it's good for",
  paramCount: "13B",
  costPerMToken: 0.3,                  // Together pricing in USD/M tokens
  maxContextLength: 4096,
  recommended: false,
}
```

Find available Together models at: https://api.together.xyz/models

---

## 💳 Credit Pricing

| Pack | Credits | Price (INR) | Best For |
|------|---------|-------------|---------|
| Free | 100 | ₹0 | 1 trial job |
| Starter | 500 | ₹299 | 2-3 small jobs |
| Builder | 1,000 | ₹499 | 5 jobs on 8B models |
| Pro | 3,000 | ₹1,299 | 15 jobs |
| Enterprise | 10,000 | ₹3,999 | Unlimited |

**Credit costs:**
- Training job (8B model, 100 examples, 3 epochs): ~15-20 credits
- Inference per message: 1 credit
- Free signup bonus: 100 credits

---

## 🔧 Webhooks Setup

### Razorpay Webhook
1. Go to Razorpay Dashboard → **Settings → Webhooks**
2. Add URL: `https://your-domain.vercel.app/api/webhooks/razorpay`
3. Select event: `payment.captured`, `payment.failed`
4. Set `WEBHOOK_SECRET` in your env to the webhook secret

### Clerk Webhook (optional)
1. Go to Clerk Dashboard → **Webhooks**
2. Add URL: `https://your-domain.vercel.app/api/webhooks/clerk`
3. Select: `user.created`, `user.updated`

---

## 🏗️ Project Structure

```
neurofast-ai-trainer/
├── app/
│   ├── (app)/                    # Protected app routes
│   │   ├── dashboard/            # Main dashboard
│   │   ├── train/                # Train new model
│   │   ├── models/               # My models + editor
│   │   ├── playground/           # Chat interface
│   │   ├── billing/              # Credits & payments
│   │   ├── integrate/            # NeuroFast integration
│   │   └── settings/             # Account settings
│   ├── api/
│   │   ├── train/                # Launch training job
│   │   ├── jobs/[id]/            # Poll job status
│   │   ├── chat/[modelId]/       # Streaming inference
│   │   ├── datasets/upload/      # Dataset upload
│   │   ├── models/[id]/          # Model CRUD
│   │   ├── billing/              # Razorpay orders
│   │   ├── integrate/neurofast/  # Store data integration
│   │   └── webhooks/             # Razorpay + Clerk webhooks
│   ├── sign-in/                  # Clerk auth pages
│   └── sign-up/
├── components/
│   ├── layout/                   # Sidebar, TopBar
│   ├── dashboard/                # Charts, templates carousel
│   ├── training/                 # Train stepper
│   ├── models/                   # Model cards, status poller
│   ├── playground/               # Chat UI
│   └── billing/                  # Buy credits button
├── lib/
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema
│   │   └── index.ts              # DB connection
│   ├── training.ts               # Together AI core engine
│   ├── training-utils.ts         # Dataset processing, templates
│   ├── auth.ts                   # Clerk <> DB bridge
│   ├── supabase.ts               # File storage
│   └── utils.ts                  # Helpers
└── middleware.ts                 # Clerk route protection
```

---

## 🐛 Troubleshooting

**"DATABASE_URL not set"** → Make sure `.env.local` exists with `DATABASE_URL`

**"Supabase upload failed"** → Check bucket name is exactly `neurofast-datasets` and is public

**"Together API error 401"** → Verify `TOGETHER_API_KEY` is correct at together.ai

**"Razorpay checkout not loading"** → Ensure `NEXT_PUBLIC_RAZORPAY_KEY_ID` starts with `rzp_test_` or `rzp_live_`

**Training job stuck at "queued"** → Together AI may have a queue. Jobs typically start within 5-15 minutes.

---

## 📞 Support

Built by the NeuroFast team. For issues or integrations, contact: support@neurofast.in

---

*NeuroFast AI Trainer — Sovereign Logistics Intelligence, Made in India 🇮🇳*
