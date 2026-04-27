// lib/training-utils.ts
// Dataset validation, JSONL conversion, cost estimation, logistics templates

export interface TrainingMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TrainingExample {
  messages: TrainingMessage[];
}

// ─── COST ESTIMATION ──────────────────────────────────────────────────────────
const MODEL_COSTS: Record<string, number> = {
  "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": 0.2,
  "Qwen/Qwen2.5-7B-Instruct-Turbo": 0.2,
  "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo": 0.9,
  "mistralai/Mistral-7B-Instruct-v0.3": 0.2,
  "Qwen/Qwen2.5-72B-Instruct-Turbo": 0.9,
};

const AVG_TOKENS_PER_EXAMPLE = 512; // Average tokens per training example

export function estimateTrainingCost(params: {
  baseModel: string;
  rowCount: number;
  epochs: number;
}): {
  totalTokens: number;
  totalCost: number;
  creditsRequired: number;
  breakdown: { tokensPerEpoch: number; epochs: number; costPerMToken: number };
} {
  const costPerMToken = MODEL_COSTS[params.baseModel] ?? 0.3;
  const tokensPerEpoch = params.rowCount * AVG_TOKENS_PER_EXAMPLE;
  const totalTokens = tokensPerEpoch * params.epochs;
  const totalCost = (totalTokens / 1_000_000) * costPerMToken;
  const creditsRequired = Math.max(10, Math.ceil(totalCost * 100)); // Min 10 credits

  return {
    totalTokens,
    totalCost,
    creditsRequired,
    breakdown: { tokensPerEpoch, epochs: params.epochs, costPerMToken },
  };
}

// ─── JSONL VALIDATION ──────────────────────────────────────────────────────────
export function validateJsonl(content: string): {
  isValid: boolean;
  errors: string[];
  rowCount: number;
  examples: TrainingExample[];
} {
  const lines = content.trim().split("\n").filter(Boolean);
  const errors: string[] = [];
  const examples: TrainingExample[] = [];

  if (lines.length < 10) {
    errors.push("Dataset must have at least 10 training examples.");
  }

  if (lines.length > 50000) {
    errors.push("Dataset too large. Maximum 50,000 examples.");
  }

  lines.forEach((line, i) => {
    try {
      const parsed = JSON.parse(line) as unknown;
      const obj = parsed as Record<string, unknown>;

      if (!obj.messages || !Array.isArray(obj.messages)) {
        errors.push(`Line ${i + 1}: Missing 'messages' array.`);
        return;
      }

      const messages = obj.messages as TrainingMessage[];
      const hasUser = messages.some((m) => m.role === "user");
      const hasAssistant = messages.some((m) => m.role === "assistant");

      if (!hasUser) errors.push(`Line ${i + 1}: Missing 'user' message.`);
      if (!hasAssistant) errors.push(`Line ${i + 1}: Missing 'assistant' message.`);

      examples.push({ messages });
    } catch {
      errors.push(`Line ${i + 1}: Invalid JSON.`);
    }

    // Only report first 10 errors
    if (errors.length > 10) return;
  });

  return {
    isValid: errors.length === 0,
    errors: errors.slice(0, 10),
    rowCount: lines.length,
    examples,
  };
}

// ─── CSV TO JSONL CONVERSION ──────────────────────────────────────────────────
export function csvToJsonl(
  csvContent: string,
  systemPrompt?: string
): { jsonl: string; rowCount: number; errors: string[] } {
  const lines = csvContent.trim().split("\n");
  const errors: string[] = [];

  if (lines.length < 2) {
    return { jsonl: "", rowCount: 0, errors: ["CSV must have header row + at least 1 data row."] };
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const userColIdx = headers.findIndex((h) =>
    ["user", "input", "question", "prompt", "query"].includes(h)
  );
  const assistantColIdx = headers.findIndex((h) =>
    ["assistant", "output", "answer", "response", "completion"].includes(h)
  );

  if (userColIdx === -1) {
    errors.push("CSV must have a column named: user, input, question, prompt, or query.");
  }
  if (assistantColIdx === -1) {
    errors.push("CSV must have a column named: assistant, output, answer, response, or completion.");
  }

  if (errors.length > 0) return { jsonl: "", rowCount: 0, errors };

  const jsonlLines: string[] = [];
  const defaultSystem =
    systemPrompt ??
    "You are NeuroFast AI, a specialized logistics assistant for Indian supply chain and dark-store operations.";

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < Math.max(userColIdx, assistantColIdx) + 1) continue;

    const userMsg = cols[userColIdx]?.trim();
    const assistantMsg = cols[assistantColIdx]?.trim();

    if (!userMsg || !assistantMsg) continue;

    const example: TrainingExample = {
      messages: [
        { role: "system", content: defaultSystem },
        { role: "user", content: userMsg },
        { role: "assistant", content: assistantMsg },
      ],
    };
    jsonlLines.push(JSON.stringify(example));
  }

  return { jsonl: jsonlLines.join("\n"), rowCount: jsonlLines.length, errors };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += line[i];
    }
  }
  result.push(current);
  return result;
}

// ─── PREPARE DATASET ─────────────────────────────────────────────────────────
export function prepareDataset(
  content: string,
  format: "jsonl" | "csv",
  systemPrompt?: string
): {
  jsonl: string;
  rowCount: number;
  errors: string[];
  isValid: boolean;
} {
  if (format === "csv") {
    const { jsonl, rowCount, errors } = csvToJsonl(content, systemPrompt);
    return { jsonl, rowCount, errors, isValid: errors.length === 0 };
  }

  // v8 fix: removed unused `examples` destructuring
  const { isValid, errors, rowCount } = validateJsonl(content);
  return { jsonl: content, rowCount, errors, isValid };
}

// ─── LOGISTICS TEMPLATES ─────────────────────────────────────────────────────
export const LOGISTICS_TEMPLATES = [
  {
    id: "dark-store-sku",
    name: "Dark Store SKU Intelligence",
    description:
      "Train your model to handle SKU-level queries: demand forecasting, reorder points, spoilage prediction for dark stores.",
    icon: "📦",
    color: "cyan",
    category: "inventory",
    estimatedRows: 150,
    systemPrompt:
      "You are NeuroFast SKU Intelligence, a dark-store inventory AI. You manage SKU-level decisions with precision: when to reorder, predicted demand, spoilage risk, and slot optimization. Always respond with actionable data.",
    generateExamples: () => generateSkuExamples(),
  },
  {
    id: "fleet-routing",
    name: "Fleet Routing Optimizer",
    description:
      "Optimize last-mile delivery routes, ETA predictions, driver assignment, and real-time rerouting logic.",
    icon: "🚛",
    color: "magenta",
    category: "fleet",
    estimatedRows: 120,
    systemPrompt:
      "You are NeuroFast Fleet Router, an AI specialized in Indian last-mile logistics. You optimize vehicle routing, predict ETAs accounting for traffic and time-of-day, and handle driver assignment. Be precise and operational.",
    generateExamples: () => generateFleetExamples(),
  },
  {
    id: "inventory-prediction",
    name: "Inventory Demand Forecaster",
    description:
      "ML-grade demand forecasting for FMCG, Kirana, and e-commerce inventory. Handles seasonality, festivals, regional patterns.",
    icon: "📈",
    color: "cyan",
    category: "inventory",
    estimatedRows: 100,
    systemPrompt:
      "You are NeuroFast Demand AI, specializing in Indian market demand forecasting. You account for festivals (Diwali, Eid, Holi), regional preferences, weather impact, and supply constraints to predict optimal inventory levels.",
    generateExamples: () => generateInventoryExamples(),
  },
  {
    id: "cyber-logistics",
    name: "Sovereign Cyber Logistics",
    description:
      "Intelligent operations center AI for real-time decision making across your entire dark-store network.",
    icon: "⚡",
    color: "magenta",
    category: "operations",
    estimatedRows: 130,
    systemPrompt:
      "You are NeuroFast Command AI, the sovereign intelligence layer for dark-store network operations. You handle cross-store coordination, crisis management, SLA breach prevention, and operational decision trees. Think strategically and act decisively.",
    generateExamples: () => generateCyberLogisticsExamples(),
  },
];

// ─── TEMPLATE DATA GENERATORS ─────────────────────────────────────────────────
function generateSkuExamples(): TrainingExample[] {
  const system =
    "You are NeuroFast SKU Intelligence, a dark-store inventory AI. You manage SKU-level decisions with precision: when to reorder, predicted demand, spoilage risk, and slot optimization. Always respond with actionable data.";

  const pairs = [
    {
      user: "SKU: MILK-500ML-AMUL. Current stock: 45 units. Average daily sales: 38 units. Lead time: 6 hours. What action should I take?",
      assistant:
        "ALERT: Critical reorder needed. Stock covers only 1.18 days at current velocity. With 6hr lead time, trigger PO immediately. Recommend ordering 200 units (5-day buffer + safety stock). Reorder point for this SKU: 38×(6/24) = 9.5 units — you're already below optimal threshold.",
    },
    {
      user: "My dark store has 200 SKUs. How do I identify which ones are causing the most revenue loss due to stockouts?",
      assistant:
        "Run this prioritization matrix: 1) Export last 30 days sales data. 2) Calculate stockout rate = (days with 0 stock / 30) × 100. 3) Multiply by avg daily revenue per SKU. 4) Sort descending — these are your revenue-leaking SKUs. Focus on Top 20 — typically 80% of stockout losses. Set dynamic safety stock = 1.5× daily demand × lead time days for these.",
    },
    {
      user: "Tomatoes SKU showing 45% spoilage rate this week. How do I fix this?",
      assistant:
        "Root cause analysis: 45% spoilage indicates receiving quality issue OR demand-supply mismatch. Actions: 1) Reduce order quantity by 40% immediately. 2) Switch from 2× weekly ordering to daily micro-orders. 3) Check receiving temperature log — storage >12°C accelerates spoilage. 4) Implement FEFO (First Expired, First Out) strictly. 5) Create 'Quick Sell' WhatsApp alert when stock is >70% of batch life.",
    },
    {
      user: "Should I stock energy drinks in my dark store in Koramangala, Bangalore?",
      assistant:
        "YES — High confidence. Koramangala demographics: high density of tech workers, startups, gyms. Energy drink velocity in similar dark stores: 25-40 units/day. Recommended initial SKUs: Red Bull 250ml, Monster Green, Sting (price-sensitive segment). Stock depth: 3-day buffer minimum. Peak demand: Monday-Thursday 6-9 PM (post-work). Avoid overstocking Rockstar — low brand recall in South India market.",
    },
    {
      user: "I want to add 50 new SKUs to my store. What data do I need before deciding?",
      assistant:
        "Pre-launch checklist for new SKU additions: 1) Catchment area analysis — pin code-level purchase data from existing orders. 2) Competitive gap analysis — what do customers buy from Blinkit/Zepto but not you? 3) Margin stack — landed cost, storage cost, wastage estimate, delivery cost vs. sell price. 4) Shelf life vs. order frequency compatibility. 5) Minimum Viable Stock (MVS) — can you sustain ≥10 units/week? Below this, SKU isn't worth the slot cost. Start with 10 highest-confidence additions, evaluate weekly.",
    },
  ];

  return pairs.map(({ user, assistant }) => ({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
      { role: "assistant", content: assistant },
    ],
  }));
}

function generateFleetExamples(): TrainingExample[] {
  const system =
    "You are NeuroFast Fleet Router, an AI specialized in Indian last-mile logistics. You optimize vehicle routing, predict ETAs accounting for traffic and time-of-day, and handle driver assignment. Be precise and operational.";

  const pairs = [
    {
      user: "I have 8 orders ready for delivery from our Indiranagar dark store. Addresses span 3km radius. I have 2 riders available. How should I cluster?",
      assistant:
        "Optimal clustering for 8 orders, 2 riders, 3km radius: RIDER 1 (North cluster): Group orders by lane/pin code — aim 4 consecutive drops, max 4.5km total route. Priority: orders with shortest promised delivery window. RIDER 2 (South cluster): Remaining 4 orders. Rule: Never split orders in same apartment complex across riders. Use Google Maps 'Waypoints' API for sequencing. Expected time: 35-45 minutes per rider at current Indiranagar traffic.",
    },
    {
      user: "Driver hasn't moved for 20 minutes. Order SLA breach in 15 minutes. What do I do?",
      assistant:
        "IMMEDIATE: 1) Call driver NOW — if unreachable within 60 seconds, escalate. 2) If traffic-stuck: check Google Maps for alternate routes — share via WhatsApp immediately. 3) If breakdown: trigger backup rider dispatch, call customer to inform 20-min delay, offer discount code. 4) Mark order as 'SLA Risk' in system, notify store manager. 5) Log incident for driver performance review. Prevention protocol: Set geofence alerts for >10min no-movement during active delivery.",
    },
    {
      user: "What's the optimal time to do replenishment runs from supplier to our Karol Bagh dark store on weekdays?",
      assistant:
        "Optimal replenishment windows for Karol Bagh: BEST: 5:30 AM - 7:30 AM (pre-traffic, supplier freshness max). GOOD: 11:00 AM - 1:00 PM (post-morning rush, before lunch). AVOID: 8-11 AM (extreme congestion, +40% travel time), 5-8 PM (evening peak). Vehicle recommendation: Use tempo/mini-truck ≤ 2.5 ton to navigate narrow Karol Bagh galis. Route: Use NH-48 entry → bypass Main Bazar during peak. Estimated supplier-to-store time in optimal window: 28-35 mins.",
    },
    {
      user: "My delivery success rate is 78%. Target is 90%. What are the main failure categories I should investigate?",
      assistant:
        "78% success rate — 12-point gap analysis: Category 1 - Address Issues (typically 35-40% of failures): Incomplete addresses, no landmark, wrong pin code. Fix: Mandatory geo-tag at order placement. Category 2 - Customer Unavailability (25-30%): Customer not home/reachable. Fix: 3-stage notification (placed, dispatched, 5-min ETA). Category 3 - Rider No-show (15-20%): Breakdown, absenteeism. Fix: Backup rider protocol, rider insurance. Category 4 - Dark store SLA miss (10-15%): Picking delay exceeds slot. Fix: Picking productivity tracking. Audit 50 recent failed orders and tag each category — this gives you exact priority.",
    },
  ];

  return pairs.map(({ user, assistant }) => ({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
      { role: "assistant", content: assistant },
    ],
  }));
}

function generateInventoryExamples(): TrainingExample[] {
  const system =
    "You are NeuroFast Demand AI, specializing in Indian market demand forecasting. You account for festivals, regional preferences, weather impact, and supply constraints.";

  const pairs = [
    {
      user: "Diwali is in 3 weeks. I operate 5 dark stores in Delhi NCR. How should I adjust my inventory?",
      assistant:
        "Diwali Inventory Protocol for Delhi NCR (5 stores): SURGE CATEGORIES (stock 3-4× normal): Dry fruits (almonds, cashews, pistachios), mithai/sweets, gift boxes, diyas, puja items, premium snacks, soft drinks/juices. MODERATE SURGE (1.5-2×): Chocolates, packaged namkeen, ghee, cooking oils. REDUCE: Fresh produce (demand shifts to festive items), alcohol (gift delivery spikes but regulatory limits). ORDER TIMELINE: Place orders 15 days prior for dry goods, 3 days prior for fresh mithai. Coordinate with suppliers NOW — they'll be overwhelmed in week 2. Expect 15-20% higher AOV during Diwali week.",
    },
    {
      user: "My store in Kozhikode shows 40% drop in sales every Friday afternoon. Is this normal?",
      assistant:
        "Yes — this is a Jumu'ah (Friday prayers) pattern common in Kozhikode and similar cities with significant Muslim population. Friday 12:30-2:30 PM sees reduced activity. OPTIMIZATION STRATEGY: 1) Pre-stage high-demand items for morning (10 AM-12 PM surge before prayers). 2) Schedule replenishment/maintenance during 12:30-2:30 PM lull. 3) Plan rider breaks during this window — reduces idle cost. 4) Evening (4 PM onwards) typically shows compensatory surge — be fully stocked. This is predictable weekly pattern; build it into your demand model as a Friday afternoon multiplier of 0.3.",
    },
    {
      user: "How do I forecast demand for a new dark store opening in a neighborhood with no historical data?",
      assistant:
        "Cold Start Demand Forecasting Framework: Phase 1 (Week 1-2): Use comparable store proxy — find your nearest store with similar demographics (population density, income bracket). Start with 60% of that store's initial SKU quantities. Phase 2 (Week 3-4): Actual velocity data starts accumulating. Apply Bayesian update — blend proxy data (40% weight) with actuals (60%). Phase 3 (Week 5+): Switch to pure actuals with seasonal adjustment. Data sources for neighborhood profiling: Zomato restaurant density (indicates disposable income), JioBP/Petrol pump count (car density), School count (family demographics). Target: 85% in-stock rate with <8% waste in first month.",
    },
  ];

  return pairs.map(({ user, assistant }) => ({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
      { role: "assistant", content: assistant },
    ],
  }));
}

function generateCyberLogisticsExamples(): TrainingExample[] {
  const system =
    "You are NeuroFast Command AI, the sovereign intelligence layer for dark-store network operations. Think strategically and act decisively.";

  const pairs = [
    {
      user: "3 of my 10 dark stores in Mumbai are showing simultaneous inventory alerts. Could this be a systematic issue?",
      assistant:
        "SYSTEM ALERT — NETWORK-LEVEL ANOMALY DETECTED. Simultaneous alerts across 3 stores indicates: Scenario A (70% probability): Common supplier failure — all 3 stores share same distributor. Immediate action: Contact distributor, check if other clients also affected. Scenario B (20%): Demand surge in specific geography — check if local event (concert, sports match, festival) driving unified spike. Scenario C (10%): Data pipeline issue — alerts are false positives. Check if system update happened in last 2 hours. COMMAND DECISION: Activate inter-store transfer protocol immediately — move stock from 3 healthy stores to cover 24-hour demand of affected stores while root cause is identified. Escalate to ops head if Scenario A confirmed.",
    },
    {
      user: "My overall SLA compliance dropped from 94% to 81% this week. I need a root cause analysis framework.",
      assistant:
        "NETWORK HEALTH EMERGENCY — 13-point SLA drop requires structured RCA: STEP 1 - Temporal isolation: Did drop start on specific day? (Monday suggests new process/staff change; Weekend suggests demand surge). STEP 2 - Store isolation: Is it all 10 stores or concentrated? Concentration = local issue; Universal = systemic. STEP 3 - Category analysis: Order types failing — is it large orders? Far delivery zones? Specific time slots? STEP 4 - Supply chain audit: Check if any supplier changed delivery schedule affecting store readiness. STEP 5 - Rider performance: New hires? Spike in rider attrition? Festival season absenteeism? STEP 6 - Tech audit: Any app/OMS changes deployed this week? OUTPUT NEEDED: Give me your store-by-store SLA breakdown and I'll pinpoint the exact vector.",
    },
  ];

  return pairs.map(({ user, assistant }) => ({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
      { role: "assistant", content: assistant },
    ],
  }));
}

// ─── GENERATE TEMPLATE DATASET ────────────────────────────────────────────────
export function generateTemplateDataset(templateId: string): {
  jsonl: string;
  rowCount: number;
  systemPrompt: string;
} {
  const template = LOGISTICS_TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw new Error(`Template not found: ${templateId}`);

  const examples = template.generateExamples();

  // Add more synthetic examples to bulk up the dataset
  const bulkExamples = generateBulkExamples(template.systemPrompt, templateId);
  const allExamples = [...examples, ...bulkExamples];

  const jsonl = allExamples.map((e) => JSON.stringify(e)).join("\n");
  return { jsonl, rowCount: allExamples.length, systemPrompt: template.systemPrompt };
}

function generateBulkExamples(system: string, templateId: string): TrainingExample[] {
  // Generic logistics Q&A that applies to all template types
  const genericPairs = [
    {
      user: "What KPIs should I track daily for my dark store?",
      assistant:
        "Daily Dark Store KPI Dashboard: OPERATIONS: Fill rate (target >95%), Order fulfillment time (target <8 min), SLA compliance (target >92%), Rider utilization (target 75-85%). INVENTORY: In-stock rate, daily waste %, fast-mover stockout count. FINANCIAL: Revenue per order, COGS%, hourly GMV. CUSTOMER: Order cancellation rate (<3% target), customer rating. Review these in morning standup — anything red gets an owner and action plan before noon.",
    },
    {
      user: "How many SKUs should a 1000 sqft dark store carry?",
      assistant:
        "For 1000 sqft dark store: Optimal SKU range is 800-1200 active SKUs. BREAKDOWN: Fresh & perishables: 150-200 SKUs (high velocity, small space), Packaged foods: 300-400 SKUs, Personal care/HPC: 150-200 SKUs, Household: 100-150 SKUs, Beverages: 100-150 SKUs, Baby/pet: 50-100 SKUs. KEY RULE: Every SKU needs minimum 10 units weekly velocity to justify shelf space. Run quarterly SKU pruning — remove bottom 10% performers. This keeps turns high and reduces complexity.",
    },
    {
      user: "A customer is complaining that their order arrived late. How should I handle this?",
      assistant:
        "Customer Recovery Protocol for Late Delivery: IMMEDIATE (within 5 minutes of complaint): 1) Acknowledge with genuine apology — no excuses. 2) Verify exact delay duration from system. COMPENSATION MATRIX: 5-15 min late → ₹20 store credit. 15-30 min late → ₹50 credit + sorry note. >30 min late → ₹100 credit + free item (high-margin low-cost). PROCESS FIX: Log root cause (rider, store, traffic, system). If same customer reports 3+ late orders — flag for premium slot with backup rider. Lifetime customer value far exceeds any compensation cost.",
    },
  ];

  return genericPairs.map(({ user, assistant }) => ({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
      { role: "assistant", content: assistant },
    ],
  }));
}
