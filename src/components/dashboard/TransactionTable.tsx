"use client";

import { useState, useEffect } from "react";

interface Transaction {
  id: string;
  amount: number;
  credits_added: number;
  status: "pending" | "completed" | "failed";
  created_at: string;
  payment_method: string;
}

export function TransactionTable() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/transactions")
      .then(res => res.json())
      .then(data => {
        setTransactions(data.transactions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border overflow-hidden">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Transaction History</h2>
      </div>
      
      {transactions.length === 0 ? (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
          No transactions yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b">
                <th className="p-4 text-left text-sm font-medium text-slate-500">Date</th>
                <th className="p-4 text-left text-sm font-medium text-slate-500">Amount</th>
                <th className="p-4 text-left text-sm font-medium text-slate-500">Credits</th>
                <th className="p-4 text-left text-sm font-medium text-slate-500">Method</th>
                <th className="p-4 text-left text-sm font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr key={txn.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{new Date(txn.created_at).toLocaleDateString()}</td>
                  <td className="p-4 text-sm font-medium">\u20B9{txn.amount}</td>
                  <td className="p-4 text-sm text-amber-600 dark:text-amber-400 font-medium">+{txn.credits_added}</td>
                  <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{txn.payment_method}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      txn.status === "completed" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                      txn.status === "pending" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" :
                      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {txn.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
