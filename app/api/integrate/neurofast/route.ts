// app/api/integrate/neurofast/route.ts
// Pull operational data from NeuroFast dark store platform
// and convert it to a training-ready dataset

import { NextRequest, NextResponse } from "next/server";
import { getUserForApi } from "@/lib/auth";

// ─── REPLACE THIS with real NeuroFast API endpoint when available ─────────────
// const NEUROFAST_API_BASE = "https://neurofast.vercel.app/api";
// Add your real API key from your NeuroFast dashboard:
// const NEUROFAST_API_KEY = process.env.NEUROFAST_API_KEY;
// ─────────────────────────────────────────────────────────────────────────────

interface SampleStoreData {
  store_id: string;
  sku_data: Array<{ sku: string; daily_sales: number; current_stock: number; reorder_point: number }>;
  fleet_data: Array<{ vehicle_id: string; route: string; on_time_rate: number; avg_delay_mins: number }>;
  incidents: Array<{ type: string; description: string; resolution: string }>;
}

function generateSampleData(): SampleStoreData {
  // Realistic sample data representing what a NeuroFast integration would return
  return {
    store_id: "NF-BLR-001",
    sku_data: [
      { sku: "MILK-500ML-AMUL", daily_sales: 42, current_stock: 180, reorder_point: 90 },
      { sku: "BREAD-WB-BRITANNIA", daily_sales: 28, current_stock: 45, reorder_point: 56 },
      { sku: "EGGS-12PK-LOCAL", daily_sales: 35, current_stock: 120, reorder_point: 70 },
      { sku: "TOMATO-1KG-FRESH", daily_sales: 60, current_stock: 30, reorder_point: 60 },
      { sku: "ONION-1KG-FRESH", daily_sales: 55, current_stock: 200, reorder_point: 110 },
    ],
    fleet_data: [
      { vehicle_id: "BLR-001", route: "Koramangala-Indiranagar", on_time_rate: 0.87, avg_delay_mins: 8 },
      { vehicle_id: "BLR-002", route: "HSR-BTM", on_time_rate: 0.93, avg_delay_mins: 4 },
      { vehicle_id: "BLR-003", route: "Whitefield-Mahadevapura", on_time_rate: 0.76, avg_delay_mins: 18 },
    ],
    incidents: [
      { type: "stockout", description: "Tomato SKU hit zero during peak hours", resolution: "Emergency inter-store transfer from NF-BLR-003" },
      { type: "sla_breach", description: "BLR-003 missed 12 SLAs on Friday evening", resolution: "Added backup rider, optimized route sequence" },
      { type: "overstock", description: "Soft drinks overstock during monsoon week", resolution: "Ran WhatsApp promotion, reduced next order by 60%" },
    ],
  };
}

function generateTrainingExamplesFromData(data: SampleStoreData): Array<{ messages: Array<{ role: string; content: string }> }> {
  const system = "You are NeuroFast Intelligence, the AI brain of a dark-store operations platform. You have full visibility into store inventory, fleet performance, and operational incidents. Provide precise, actionable recommendations.";

  const examples = [];

  // SKU-based examples
  for (const sku of data.sku_data) {
    const daysOfStock = sku.current_stock / sku.daily_sales;
    const needsReorder = sku.current_stock <= sku.reorder_point;

    examples.push({
      messages: [
        { role: "system", content: system },
        { role: "user", content: `What is the current inventory status for SKU ${sku.sku}?` },
        {
          role: "assistant",
          content: `SKU: ${sku.sku} — Status: ${needsReorder ? "⚠️ REORDER REQUIRED" : "✅ OK"}
Current stock: ${sku.current_stock} units
Daily velocity: ${sku.daily_sales} units/day
Days of coverage: ${daysOfStock.toFixed(1)} days
Reorder point: ${sku.reorder_point} units

${needsReorder ? `ACTION REQUIRED: Stock is at or below reorder point (${sku.current_stock} ≤ ${sku.reorder_point}). Place purchase order immediately. Recommended order quantity: ${sku.daily_sales * 5} units (5-day buffer + safety stock).` : `Next reorder trigger in approximately ${(daysOfStock - sku.reorder_point / sku.daily_sales).toFixed(1)} days.`}`,
        },
      ],
    });
  }

  // Fleet examples
  for (const vehicle of data.fleet_data) {
    examples.push({
      messages: [
        { role: "system", content: system },
        { role: "user", content: `How is vehicle ${vehicle.vehicle_id} performing on the ${vehicle.route} route?` },
        {
          role: "assistant",
          content: `Vehicle ${vehicle.vehicle_id} — Route: ${vehicle.route}
On-time rate: ${(vehicle.on_time_rate * 100).toFixed(0)}% ${vehicle.on_time_rate >= 0.9 ? "✅ Excellent" : vehicle.on_time_rate >= 0.8 ? "⚠️ Needs attention" : "❌ Critical — immediate intervention"}
Average delay: ${vehicle.avg_delay_mins} minutes

${vehicle.on_time_rate < 0.9 ? `RECOMMENDATION: Review route sequence for ${vehicle.route}. Common fixes: (1) Resequence stops to minimize backtracking. (2) Check if traffic hotspots at ${vehicle.avg_delay_mins > 10 ? "peak hours need alt routes" : "specific intersections can be bypassed"}. (3) Consider adding 1 buffer stop per hour of route length.` : "Performance is strong. Maintain current routing and driver schedule."}`,
        },
      ],
    });
  }

  // Incident-based examples
  for (const incident of data.incidents) {
    examples.push({
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Tell me about the ${incident.type} incident and what we did.` },
        {
          role: "assistant",
          content: `Incident Report — Type: ${incident.type.toUpperCase()}

Description: ${incident.description}

Resolution: ${incident.resolution}

Prevention protocol for future: For ${incident.type} events, standard protocol is: (1) Detect via automated alert threshold breach, (2) Trigger escalation to store manager within 5 minutes, (3) Implement immediate mitigation (transfer/reroute/promote), (4) Log root cause for demand model update. This incident has been added to your model's training data.`,
        },
      ],
    });
  }

  return examples;
}

export async function GET(_req: NextRequest) {
  try {
    const user = await getUserForApi();
    if (!user) return NextResponse.json({ error: "Session expired — please sign in again." }, { status: 401 });

    // ─── REAL INTEGRATION POINT ─────────────────────────────────────────────
    // When you have the real NeuroFast API endpoint, replace this with:
    //
    // const res = await fetch(`${NEUROFAST_API_BASE}/stores/${storeId}/export`, {
    //   headers: { Authorization: `Bearer ${NEUROFAST_API_KEY}` }
    // });
    // const storeData = await res.json();
    //
    // For now, returning sample data:
    // ────────────────────────────────────────────────────────────────────────
    const storeData = generateSampleData();
    const trainingExamples = generateTrainingExamplesFromData(storeData);
    const jsonl = trainingExamples.map((e) => JSON.stringify(e)).join("\n");

    return NextResponse.json({
      storeId: storeData.store_id,
      skuCount: storeData.sku_data.length,
      fleetVehicles: storeData.fleet_data.length,
      incidents: storeData.incidents.length,
      generatedExamples: trainingExamples.length,
      jsonlPreview: jsonl.slice(0, 500) + "...",
      jsonl, // Full JSONL dataset ready for upload
      templateSystemPrompt: "You are NeuroFast Intelligence, the AI brain of a dark-store operations platform.",
      message: "✅ Sample data generated. In production, this will pull real data from your NeuroFast store.",
    });
  } catch (err) {
    console.error("[GET /api/integrate/neurofast]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
