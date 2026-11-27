// What the website's forms send: each one adds a document to its own
// Firestore collection, which the rules let anyone create and no one read
// (firestore.rules). Akshat reads them in the Firebase console.
import { firestore } from "./firebase";

async function add(collectionName: string, data: Record<string, unknown>, id?: string): Promise<void> {
  const db = await firestore();
  const m = await import("firebase/firestore");
  const fields = { ...data, createdAt: m.serverTimestamp() };
  if (id) await m.setDoc(m.doc(db, collectionName, id), fields);
  else await m.addDoc(m.collection(db, collectionName), fields);
}

export type ContactTopic = "support" | "bank" | "feedback" | "privacy" | "press" | "other";

export function sendContactMessage(message: { name: string; email: string; topic: ContactTopic; message: string }): Promise<void> {
  return add("site_messages", { ...message, email: message.email.toLowerCase() });
}

/**
 * The Monthly Check-in. One document per address, so subscribing twice is
 * refused by the rules; that still means "you're on the list".
 */
export async function subscribeNewsletter(email: string, source: string): Promise<void> {
  const address = email.trim().toLowerCase();
  try {
    await add("newsletter", { email: address, source: source.slice(0, 40) }, address);
  } catch (error) {
    if ((error as { code?: string })?.code === "permission-denied") return;
    throw error;
  }
}

export type ProgrammeRequest = {
  kind: "gift" | "institution";
  contactName: string;
  email: string;
  organisation?: string | undefined;
  quantity?: number | undefined;
  plan?: "essential" | "plus" | undefined;
  message?: string | undefined;
};

export function sendProgrammeRequest(request: ProgrammeRequest): Promise<void> {
  const data: Record<string, unknown> = { kind: request.kind, contactName: request.contactName, email: request.email.toLowerCase() };
  if (request.organisation) data["organisation"] = request.organisation;
  if (request.quantity !== undefined) data["quantity"] = request.quantity;
  if (request.kind === "gift" && request.plan) data["plan"] = request.plan;
  if (request.message) data["message"] = request.message;
  return add("programme_requests", data);
}
