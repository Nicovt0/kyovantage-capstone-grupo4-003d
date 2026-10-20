import { useEffect, useState } from "react";
import { getRecurringTemplates } from "@/features/settings/api/recurringRepository";
import { getTransactions } from "@/features/wallet/api/transactionRepository";

export default function DebugPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const templates = await getRecurringTemplates();
      const txs = await getTransactions();
      setData({ templates, txs });
    }
    load();
  }, []);

  if (!data) return <div className="p-10 text-center opacity-50">Cargando debug...</div>;

  return (
    <div className="p-10 max-w-4xl mx-auto flex flex-col gap-6 font-mono text-xs">
      <h1 className="text-xl font-bold">Debug Data</h1>

      <div>
        <h2 className="font-bold text-lg text-blue-500 mb-2">Recurring Templates ({data.templates.length})</h2>
        <pre className="bg-[#111] p-4 rounded-xl overflow-auto text-white">
          {JSON.stringify(data.templates, null, 2)}
        </pre>
      </div>

      <div>
        <h2 className="font-bold text-lg text-green-500 mb-2">Transactions - Pending ({data.txs.filter((t: any) => t.status === 'pending').length})</h2>
        <pre className="bg-[#111] p-4 rounded-xl overflow-auto text-white">
          {JSON.stringify(data.txs.filter((t: any) => t.status === 'pending'), null, 2)}
        </pre>
      </div>
    </div>
  );
}
