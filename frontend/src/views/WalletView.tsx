import React, { useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { useTonConnectUI } from '@tonconnect/ui-react';

interface Transaction {
  id: string;
  amount: number;
  currency: 'TON' | 'STARS';
  type: string;
  createdAt: string;
}

const WalletView: React.FC = () => {
  const { user, token, updateBalance } = useAuth();
  const [tonConnectUI] = useTonConnectUI();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState(100);
  const [depositCurrency, setDepositCurrency] = useState<'STARS' | 'TON'>('STARS');
  const [showDeposit, setShowDeposit] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, [token]);

  const loadTransactions = async () => {
    try {
      const data = await apiFetch('/api/wallet/transactions', token);
      setTransactions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (isDepositing || depositAmount <= 0) return;
    setIsDepositing(true);
    try {
      const endpoint = depositCurrency === 'STARS'
        ? '/api/wallet/deposit/stars'
        : '/api/wallet/deposit/ton';

      await apiFetch(endpoint, token, {
        method: 'POST',
        body: JSON.stringify({ amount: depositAmount })
      });

      updateBalance(depositCurrency, depositAmount);
      setShowDeposit(false);
      loadTransactions();
    } catch (err: any) {
      alert(err.message || 'Deposit failed');
    } finally {
      setIsDepositing(false);
    }
  };

  const getTxIcon = (type: string) => {
    if (type === 'DEPOSIT' || type === 'WINNINGS') return <ArrowDownCircle size={16} className="text-game-success" />;
    return <ArrowUpCircle size={16} className="text-game-danger" />;
  };

  const getTxLabel = (type: string) => {
    switch (type) {
      case 'DEPOSIT': return 'Deposit';
      case 'WITHDRAWAL': return 'Withdrawal';
      case 'BET_PLACED': return 'Bet Placed';
      case 'WINNINGS': return 'Winnings';
      case 'COMMISSION': return 'Commission';
      default: return type;
    }
  };

  return (
    <div className="flex flex-col min-h-screen p-4 pb-24 max-w-lg mx-auto w-full">
      <h1 className="text-2xl font-bold text-white mb-6">Wallet</h1>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-game-card border border-yellow-500/30 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">Stars Balance</p>
          <div className="flex items-center space-x-2">
            <span className="text-yellow-400 text-lg">&#11088;</span>
            <span className="text-2xl font-bold text-white">{user?.starsBalance || 0}</span>
          </div>
        </div>
        <div className="bg-game-card border border-blue-500/30 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">TON Balance</p>
          <div className="flex items-center space-x-2">
            <span className="text-blue-400 text-lg">&#128142;</span>
            <span className="text-2xl font-bold text-white">{user?.tonBalance || 0}</span>
          </div>
        </div>
      </div>

      {/* Deposit Button */}
      <button
        onClick={() => setShowDeposit(true)}
        className="w-full bg-game-accent hover:bg-sky-500 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-game-accent/20 transition-all mb-6"
      >
        Deposit Funds
      </button>

      {/* TON Connect */}
      <button
        onClick={() => tonConnectUI.openModal()}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 rounded-xl shadow-lg mb-8 transition-all"
      >
        Connect TON Wallet
      </button>

      {/* Transaction History */}
      <h2 className="text-sm font-semibold text-slate-400 tracking-wider uppercase mb-4">Recent Transactions</h2>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-game-accent"></div>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-10 bg-game-card rounded-xl border border-slate-800">
          <Clock className="mx-auto h-12 w-12 text-slate-600 mb-3" />
          <p className="text-slate-400">No transactions yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map(tx => (
            <div key={tx.id} className="bg-game-card border border-slate-700 p-3 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getTxIcon(tx.type)}
                <div>
                  <p className="text-sm font-medium text-white">{getTxLabel(tx.type)}</p>
                  <p className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${tx.type === 'DEPOSIT' || tx.type === 'WINNINGS' ? 'text-game-success' : 'text-game-danger'}`}>
                  {tx.type === 'DEPOSIT' || tx.type === 'WINNINGS' ? '+' : '-'}{tx.amount}
                </p>
                <p className="text-xs text-slate-500">{tx.currency}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deposit Modal */}
      {showDeposit && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeposit(false)}></div>
          <div className="glass-panel w-full max-w-sm rounded-t-2xl sm:rounded-2xl relative z-10 p-6">
            <h3 className="text-xl font-bold mb-6">Deposit</h3>

            <div className="space-y-4 mb-8">
              <div>
                <label className="text-sm text-slate-400 block mb-2">Currency</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDepositCurrency('STARS')}
                    className={`py-3 rounded-lg border transition-colors flex justify-center items-center space-x-2 ${depositCurrency === 'STARS' ? 'bg-game-card border-yellow-400 text-yellow-400' : 'border-slate-700 text-slate-400'}`}
                  >
                    <span>&#11088; Stars</span>
                  </button>
                  <button
                    onClick={() => setDepositCurrency('TON')}
                    className={`py-3 rounded-lg border transition-colors flex justify-center items-center space-x-2 ${depositCurrency === 'TON' ? 'bg-game-card border-blue-400 text-blue-400' : 'border-slate-700 text-slate-400'}`}
                  >
                    <span>&#128142; TON</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-2">Amount</label>
                <input
                  type="number"
                  min={1}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-game-accent"
                />
              </div>
            </div>

            <button
              onClick={handleDeposit}
              disabled={isDepositing}
              className="w-full bg-game-accent text-white py-3.5 rounded-xl font-semibold text-lg shadow-lg shadow-game-accent/20 disabled:opacity-50"
            >
              {isDepositing ? 'Processing...' : 'Confirm Deposit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletView;
