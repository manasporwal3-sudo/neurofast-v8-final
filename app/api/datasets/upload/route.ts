// app/api/datasets/upload/route.ts
// POST: Upload and validate dataset files
//
// UPGRADE LOG (v2):
//   + withSentry()     — catches unhandled errors
//   + applyRateLimit() — upload limiter (10/min)
//   + auditInfo()      — logs every upload
//   Existing upload + validation logic: unchanged

import { NextRequest, NextResponse } from "next/server";
import { getUserForApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { datasets } from "@/lib/db/schema";
import { uploadDatasetFile } from "@/lib/supabase";
import { prepareDataset, generateTemplateDataset } from "@/lib/training-utils";
import { applyRateLimit } from "@/lib/services/ratelimit";
import { auditInfo } from "@/lib/services/audit";
import { withSentry } from "@/lib/services/sentry";

async function handler(req: NextRequest): Promise<NextResponse> {
  const user = await getUserForApi();
  if (!user) return NextResponse.json({ error: "Session expired — please sign in again." }, { status: 401 });

  const rateLimitResult = await applyRateLimit(req, user.id, "upload");
  if (rateLimitResult) return rateLimitResult;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const templateId = formData.get("templateId") as string | null;

  let jsonlContent = "";
  let fileName = "";
  let rowCount = 0;
  let templateType: string | null = null;

  if (templateId) {
    const generated = generateTemplateDataset(templateId);
    jsonlContent = generated.jsonl;
    rowCount = generated.rowCount;
    fileName = `${templateId}-dataset.jsonl`;
    templateType = templateId;
  } else if (file) {
    const content = await file.text();
    fileName = file.name;
    const format = file.name.endsWith(".csv") ? "csv" : "jsonl";

    const prepared = prepareDataset(content, format);
    if (!prepared.isValid) {
      return NextResponse.json(
        { error: `Validation failed: ${prepared.errors.join(", ")}` },
        { status: 400 }
      );
    }
    jsonlContent = prepared.jsonl;
    rowCount = prepared.rowCount;
  } else {
    return NextResponse.json({ error: "No file or template provided" }, { status: 400 });
  }

  if (rowCount < 10) {
    return NextResponse.json(
      { error: "Dataset must have at least 10 training examples" },
      { status: 400 }
    );
  }

  const { url } = await uploadDatasetFile(user.id, fileName, jsonlContent);

  const [dataset] = await db
    .insert(datasets)
    .values({
      userId: user.id,
      name: fileName.replace(/\.[^.]+$/, ""),
      fileName,
      fileUrl: url,
      fileSizeBytes: new Blob([jsonlContent]).size,
      format: "jsonl",
      rowCount,
      templateType,
      isValidated: true,
    })
    .returning();

  await auditInfo({
    userId: user.id,
    actorEmail: user.email,
    action: "train.create",
    resource: "dataset",
    resourceId: dataset.id,
    metadata: {
      fileName,
      rowCount,
      templateType: templateType ?? "custom",
      sizeBytes: new Blob([jsonlContent]).size,
    },
    req,
  });

  return NextResponse.json({ datasetId: dataset.id, rowCount, fileName });
}

export const POST = withSentry(handler);
