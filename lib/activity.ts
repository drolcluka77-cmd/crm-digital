import { prisma } from "@/lib/prisma";
import { CONTACT_ACTIVITY_TYPES } from "@/lib/constants";

/**
 * Adds an entry to a customer's timeline. Contact-type activities (call,
 * demo, email, materials/quote sent) also bump the customer's
 * lastContactAt so "gone quiet" leads can be spotted.
 */
export async function logActivity(
  customerId: string,
  userId: string | null,
  type: string,
  body?: string | null
) {
  await prisma.activity.create({
    data: { customerId, userId, type, body: body || null },
  });
  if (CONTACT_ACTIVITY_TYPES.includes(type)) {
    await prisma.customer.update({
      where: { id: customerId },
      data: { lastContactAt: new Date() },
    });
  }
}
