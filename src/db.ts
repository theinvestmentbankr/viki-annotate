import Database from "@tauri-apps/plugin-sql";
import type { Annotation, AnnotationRect } from "./types";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;
  db = await Database.load("sqlite:viki-annotate.db");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      filePath TEXT NOT NULL,
      page INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'highlight',
      color TEXT NOT NULL DEFAULT '#ffeb3b',
      note TEXT NOT NULL DEFAULT '',
      rects TEXT,
      selectedText TEXT,
      region TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_annotations_file ON annotations(filePath)`
  );
  return db;
}

export async function saveAnnotation(a: Annotation): Promise<void> {
  const database = await getDb();
  await database.execute(
    `INSERT OR REPLACE INTO annotations (id, filePath, page, type, color, note, rects, selectedText, region, createdAt, updatedAt)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      a.id,
      a.filePath,
      a.page,
      a.type,
      a.color,
      a.note,
      a.rects ? JSON.stringify(a.rects) : null,
      a.selectedText ?? null,
      a.region ? JSON.stringify(a.region) : null,
      a.createdAt,
      a.updatedAt,
    ]
  );
}

export async function getAnnotationsForFile(
  filePath: string
): Promise<Annotation[]> {
  const database = await getDb();
  const rows = await database.select<
    Array<{
      id: string;
      filePath: string;
      page: number;
      type: "highlight" | "region";
      color: string;
      note: string;
      rects: string | null;
      selectedText: string | null;
      region: string | null;
      createdAt: string;
      updatedAt: string;
    }>
  >("SELECT * FROM annotations WHERE filePath = $1 ORDER BY page, createdAt", [
    filePath,
  ]);
  return rows.map((r) => ({
    ...r,
    rects: r.rects ? (JSON.parse(r.rects) as AnnotationRect[]) : undefined,
    selectedText: r.selectedText ?? undefined,
    region: r.region ? JSON.parse(r.region) : undefined,
  }));
}

export async function deleteAnnotation(id: string): Promise<void> {
  const database = await getDb();
  await database.execute("DELETE FROM annotations WHERE id = $1", [id]);
}

export async function getAllAnnotations(): Promise<Annotation[]> {
  const database = await getDb();
  const rows = await database.select<
    Array<{
      id: string;
      filePath: string;
      page: number;
      type: "highlight" | "region";
      color: string;
      note: string;
      rects: string | null;
      selectedText: string | null;
      region: string | null;
      createdAt: string;
      updatedAt: string;
    }>
  >("SELECT * FROM annotations ORDER BY filePath, page, createdAt");
  return rows.map((r) => ({
    ...r,
    rects: r.rects ? (JSON.parse(r.rects) as AnnotationRect[]) : undefined,
    selectedText: r.selectedText ?? undefined,
    region: r.region ? JSON.parse(r.region) : undefined,
  }));
}
