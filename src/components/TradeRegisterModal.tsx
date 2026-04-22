import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface TradeRegisterModalProps {
  open: boolean;
  onClose: () => void;
  onSave?: (data: TradeData) => void;
}

interface TradeData {
  type: '매수' | '매도';
  stockName: string;
  ticker: string;
  quantity: string;
  price: string;
}

export function TradeRegisterModal({ open, onClose, onSave }: TradeRegisterModalProps) {
  const [tradeType, setTradeType] = useState<'매수' | '매도'>('매수');
  const [stockName, setStockName] = useState('');
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');

  const handleSave = () => {
    const data: TradeData = {
      type: tradeType,
      stockName,
      ticker,
      quantity,
      price
    };
    
    if (onSave) {
      onSave(data);
    }
    
    handleClose();
  };

  const handleClose = () => {
    // Reset form
    setTradeType('매수');
    setStockName('');
    setTicker('');
    setQuantity('');
    setPrice('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontSize: 'var(--text-lg)', fontWeight: '600' }}>매매등록</DialogTitle>
          <DialogDescription style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)' }}>매매 정보를 입력하세요.</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-5 mt-4">
          {/* Trade Type Selection */}
          <div className="space-y-2">
            <Label style={{ fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-gray-700)' }}>선택</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tradeType"
                  value="매수"
                  checked={tradeType === '매수'}
                  onChange={(e) => setTradeType(e.target.value as '매수' | '매도')}
                  className="w-4 h-4 text-[--color-primary] accent-[--color-primary]"
                />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-900)' }}>매수</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tradeType"
                  value="매도"
                  checked={tradeType === '매도'}
                  onChange={(e) => setTradeType(e.target.value as '매수' | '매도')}
                  className="w-4 h-4 text-[--color-primary] accent-[--color-primary]"
                />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-900)' }}>매도</span>
              </label>
            </div>
          </div>

          {/* Stock Name */}
          <div className="space-y-2">
            <Label htmlFor="stockName" style={{ fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-gray-700)' }}>
              종목명
            </Label>
            <Input
              id="stockName"
              value={stockName}
              onChange={(e) => setStockName(e.target.value)}
              placeholder="종목명을 입력하세요"
              className="border-[--color-gray-300]"
              style={{ fontSize: 'var(--text-sm)' }}
            />
          </div>

          {/* Ticker */}
          <div className="space-y-2">
            <Label htmlFor="ticker" style={{ fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-gray-700)' }}>
              티커
            </Label>
            <Input
              id="ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="티커를 입력하세요"
              className="border-[--color-gray-300]"
              style={{ fontSize: 'var(--text-sm)' }}
            />
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity" style={{ fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-gray-700)' }}>
              수량
            </Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="수량을 입력하세요"
              className="border-[--color-gray-300]"
              style={{ fontSize: 'var(--text-sm)' }}
            />
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price" style={{ fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--color-gray-700)' }}>
              매매가
            </Label>
            <Input
              id="price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="매매가를 입력하세요"
              className="border-[--color-gray-300]"
              style={{ fontSize: 'var(--text-sm)' }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <Button
            onClick={handleClose}
            variant="outline"
            className="flex-1 border-[--color-gray-300] text-black hover:bg-[--color-gray-100]"
            style={{ fontSize: 'var(--text-sm)', fontWeight: '500' }}
          >
            취소
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 bg-[--color-primary] hover:bg-[--color-primary-dark] text-black"
            style={{ fontSize: 'var(--text-sm)', fontWeight: '500' }}
          >
            저장
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}