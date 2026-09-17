// insertCallOnce against a real Postgres: concurrent writers of one external call id write it once.
import { afterAll, beforeAll, describe as vitestDescribe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { insertCallOnce } from "./call-dedupe";

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "");
  } catch {
    return "";
  }
})();
const describe = vitestDescribe.skipIf(!dbName.endsWith("_test"));
const U = Date.now();
const ids = { user: "", contact: "" };

beforeAll(async () => {
  if (!dbName.endsWith("_test")) return;
  ids.user = (await prisma.user.create({ data: { email: `dedupe-${U}@test.local`, name: "Dedupe", role: "STAFF", isActive: true } })).id;
  ids.contact = (await prisma.contact.create({ data: { firstName: "Dedupe", lastName: String(U) } })).id;
});

afterAll(async () => {
  if (!dbName.endsWith("_test")) return;
  await prisma.communication.deleteMany({ where: { contactId: ids.contact } });
  await prisma.contact.delete({ where: { id: ids.contact } });
  await prisma.user.delete({ where: { id: ids.user } });
  await prisma.$disconnect();
});

describe("insertCallOnce", () => {
  it("writes a call once however many writers race for it (push and import alike)", async () => {
    const externalCallId = `callvibe:race_${U}`;
    const write = () =>
      insertCallOnce(externalCallId, (tx) =>
        tx.communication.create({
          data: {
            type: "CALL",
            content: "race",
            contactId: ids.contact,
            createdById: ids.user,
            callLog: { create: { disposition: "COMPLETED", externalCallId, contactId: ids.contact, agentId: ids.user } },
          },
          select: { id: true },
        })
      );
    const results = await Promise.all(Array.from({ length: 8 }, write));
    expect(results.filter((r) => r.inserted)).toHaveLength(1);
    expect(await prisma.callLog.count({ where: { externalCallId } })).toBe(1);
    const winner = results.find((r) => r.inserted)!;
    for (const r of results.filter((x) => !x.inserted)) {
      if (!r.inserted && winner.inserted) expect(r.existing.communicationId).toBe(winner.value.id);
    }
  });
});
