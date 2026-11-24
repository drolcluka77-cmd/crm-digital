import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { mirrorBudget, mirrorEngines } from "@/lib/ai-mirror";
import MirrorForm from "@/components/MirrorForm";

export default async function MirrorHome({
  user,
  basePath,
  customerId,
  everyone = false,
}: {
  user: { id: string; role: string };
  basePath: string;
  customerId?: string;
  everyone?: boolean; // staff see all runs
}) {
  const customer = customerId
    ? await prisma.customer.findFirst({ where: everyone ? { id: customerId } : { id: customerId, ownerId: user.id } })
    : null;
  const [budget, runs] = await Promise.all([
    mirrorBudget(user.id),
    prisma.aiMirrorRun.findMany({
      where: everyone ? { geoClientId: null } : { userId: user.id, geoClientId: null },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, kind: true, status: true, company: true, city: true, score: true, createdAt: true, userName: true },
    }),
  ]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Mirror</h1>
        <p className="text-black/60 mt-1 text-sm max-w-2xl">
          Kaj ChatGPT in Gemini povesta strankam o podjetju. <b>Hiter pregled</b> zaženite med klicem in stranki povejte, kdo je omenjen
          namesto nje. <b>Celovito analizo</b> naredite pred sestankom — dobite konkurente, napačne podatke in točke za pogovor.
        </p>
      </div>
      <MirrorForm
        basePath={basePath}
        budget={{ ...budget, engines: mirrorEngines().map((e) => (e === "chatgpt" ? "ChatGPT" : "Gemini")) }}
        prefill={
          customer
            ? { company: customer.company || customer.name, city: customer.city, website: customer.website, phone: customer.phone, customerId: customer.id }
            : {}
        }
      />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-black/40 border-b border-black/5">
              <th className="px-4 py-2">Podjetje</th>
              <th className="px-3 py-2">Vrsta</th>
              <th className="px-3 py-2">AI vidnost</th>
              <th className="px-3 py-2">Datum</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-2.5">
                  <Link href={`${basePath}/${r.id}`} className="font-medium hover:underline">
                    {r.company}
                  </Link>
                  <span className="text-black/40"> · {r.city}{everyone && r.userName ? ` · ${r.userName}` : ""}</span>
                </td>
                <td className="px-3 py-2.5">{r.kind === "FULL" ? "Celovita" : "Hiter"}</td>
                <td className="px-3 py-2.5">{r.status === "DONE" ? `${r.score ?? 0} %` : r.status === "FAILED" ? "napaka" : "teče …"}</td>
                <td className="px-3 py-2.5 text-black/50">{r.createdAt.toLocaleString("sl-SI", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-black/40">
                  Še ni analiz.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
