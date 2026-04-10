import { useState } from "react";
import { MIcon } from "./MIcon";
import { Card } from "./ui/card";
import { Button } from "./ui/button";

interface Asset {
  id: string;
  name: string;
  quantity: number;
  currentPrice: number;
  purchasePrice: number;
}

interface Account {
  id: string;
  name: string;
  institution: string;
  balance: number;
  return: number;
  assets: Asset[];
}

const mockAccounts: Account[] = [
  {
    id: "1",
    name: "주식투자계좌",
    institution: "삼성증권",
    balance: 25000000,
    return: 8.5,
    assets: [
      { id: "1", name: "삼성전자", quantity: 100, currentPrice: 75000, purchasePrice: 70000 },
      { id: "2", name: "카카오", quantity: 50, currentPrice: 52000, purchasePrice: 55000 },
      { id: "3", name: "NAVER", quantity: 30, currentPrice: 220000, purchasePrice: 200000 },
    ]
  },
  {
    id: "2",
    name: "ETF계좌",
    institution: "미래에셋증권",
    balance: 15000000,
    return: 5.2,
    assets: [
      { id: "4", name: "TIGER 미국S&P500", quantity: 200, currentPrice: 45000, purchasePrice: 43000 },
      { id: "5", name: "KODEX 레버리지", quantity: 150, currentPrice: 25000, purchasePrice: 24000 },
    ]
  },
  {
    id: "3",
    name: "예적금",
    institution: "국민은행",
    balance: 12000000,
    return: 3.5,
    assets: [
      { id: "6", name: "정기예금", quantity: 1, currentPrice: 12000000, purchasePrice: 12000000 },
    ]
  }
];

interface AccountManagementProps {
  accountType: "지윤계좌" | "오빠계좌";
  onAddAsset?: () => void;
}

export function AccountManagement({ accountType, onAddAsset }: AccountManagementProps) {
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);

  const calculateReturn = (currentPrice: number, purchasePrice: number) => {
    return ((currentPrice - purchasePrice) / purchasePrice * 100).toFixed(2);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1>{accountType}</h1>
        <Button
          className="gap-2 bg-[--color-primary] hover:bg-[--color-primary-dark] text-white border-0 shadow-sm"
          onClick={onAddAsset}
          style={{ fontSize: '14px', fontWeight: '600', lineHeight: '16.8px' }}
        >
          <MIcon name="add" size={16} />
          자산 추가
        </Button>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {mockAccounts.map((account) => (
          <Card key={account.id} className="p-6 cursor-pointer transition-all hover:shadow-md border border-[--color-gray-200]">
            <div onClick={() => setExpandedAccount(expandedAccount === account.id ? null : account.id)}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="mb-1">{account.name}</h3>
                  <p className="text-[--color-gray-600]" style={{ fontSize: '13px' }}>{account.institution}</p>
                </div>
                <button className="text-[--color-gray-600] hover:text-[--color-gray-900] transition-colors">
                  {expandedAccount === account.id ? (
                    <MIcon name="expand_less" size={20} />
                  ) : (
                    <MIcon name="expand_more" size={20} />
                  )}
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <small className="text-[--color-gray-600]">보유금액</small>
                  <div className="number">{account.balance.toLocaleString()}원</div>
                </div>
                <div className="flex items-center justify-between">
                  <small className="text-[--color-gray-600]">수익률</small>
                  <span className={`${
                    account.return > 0 ? 'text-[--color-success]' : 'text-[--color-danger]'
                  }`} style={{ fontSize: '15px', fontWeight: '600' }}>
                    {account.return > 0 ? '+' : ''}{account.return}%
                  </span>
                </div>
              </div>
            </div>

            {/* Expanded Asset List */}
            {expandedAccount === account.id && (
              <div className="mt-6 pt-6 border-t border-[--color-gray-200]">
                <p className="mb-4" style={{ fontSize: '14px', fontWeight: '600' }}>보유 자산</p>
                <div className="space-y-3">
                  {account.assets.map((asset) => {
                    const returnRate = calculateReturn(asset.currentPrice, asset.purchasePrice);
                    const isPositive = Number(returnRate) > 0;
                    
                    return (
                      <div key={asset.id} className="flex items-center justify-between p-3 bg-[--color-gray-50] rounded-xl">
                        <div className="flex-1">
                          <p className="mb-1" style={{ fontSize: '14px', fontWeight: '500' }}>{asset.name}</p>
                          <small className="text-[--color-gray-600]">
                            {asset.quantity}주 × {asset.currentPrice.toLocaleString()}원
                          </small>
                        </div>
                        <div className="text-right">
                          <p className="mb-1" style={{ fontSize: '15px', fontWeight: '600' }}>{(asset.quantity * asset.currentPrice).toLocaleString()}원</p>
                          <small className={isPositive ? 'text-[--color-success]' : 'text-[--color-danger]'} style={{ fontWeight: '500' }}>
                            {isPositive ? '+' : ''}{returnRate}%
                          </small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Summary */}
      <Card className="p-6 bg-[--color-gray-50] border border-[--color-gray-200]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[--color-gray-600] mb-2" style={{ fontSize: '13px' }}>총 자산 (전체 계좌)</p>
            <div className="number-large text-[--color-gray-900]">52,000,000원</div>
          </div>
          <div className="text-right">
            <p className="text-[--color-gray-600] mb-2" style={{ fontSize: '13px' }}>총 수익률</p>
            <div className="number text-[--color-success]">+6.8%</div>
          </div>
        </div>
      </Card>
    </div>
  );
}