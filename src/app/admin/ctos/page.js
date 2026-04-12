import { auth } from "@/lib/auth";
import { getCTOs } from "@/actions/ctos";
import CTOsClient from "@/components/admin/CTOsClient";

export const metadata = {
  title: "CTOs | FiberOps",
};

export default async function CTOsPage() {
  const session = await auth();
  let ctos = [];
  let erroCarregamento = null;

  try {
    ctos = await getCTOs(session?.user?.projeto_id);
  } catch (e) {
    erroCarregamento = e.message;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">CTOs</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Caixas de Terminação Óptica — {ctos.length} registros
          </p>
        </div>
      </div>

      {erroCarregamento && (
        <div
          style={{ backgroundColor: "#450a0a", border: "1px solid #7f1d1d" }}
          className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
        >
          Erro ao carregar CTOs: {erroCarregamento}
        </div>
      )}

      <CTOsClient
        ctosIniciais={ctos}
        projetoId={session?.user?.projeto_id}
        userRole={session?.user?.role}
      />
    </div>
  );
}
