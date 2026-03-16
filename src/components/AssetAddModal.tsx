import { useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

interface AssetAddModalProps {
  open: boolean;
  onClose: () => void;
}

export function AssetAddModal({ open, onClose }: AssetAddModalProps) {
  const [formData, setFormData] = useState({
    account: "",
    assetType: "",
    name: "",
    purchasePrice: "",
    quantity: "",
    currentPrice: "",
    purchaseDate: "",
    memo: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log("Form submitted:", formData);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>자산 추가</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Account Selection */}
          <div>
            <Label htmlFor="account">계좌 선택</Label>
            <Select 
              value={formData.account} 
              onValueChange={(value) => setFormData({...formData, account: value})}
            >
              <SelectTrigger id="account" className="mt-2">
                <SelectValue placeholder="계좌를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jiyun-stock">지윤 - 주식투자계좌</SelectItem>
                <SelectItem value="jiyun-etf">지윤 - ETF계좌</SelectItem>
                <SelectItem value="jiyun-savings">지윤 - 예적금</SelectItem>
                <SelectItem value="oppa-stock">오빠 - 주식투자계좌</SelectItem>
                <SelectItem value="oppa-etf">오빠 - ETF계좌</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Asset Type */}
          <div>
            <Label htmlFor="assetType">자산유형</Label>
            <Select 
              value={formData.assetType} 
              onValueChange={(value) => setFormData({...formData, assetType: value})}
            >
              <SelectTrigger id="assetType" className="mt-2">
                <SelectValue placeholder="자산유형을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stock">주식</SelectItem>
                <SelectItem value="etf">ETF</SelectItem>
                <SelectItem value="fund">펀드</SelectItem>
                <SelectItem value="bond">채권</SelectItem>
                <SelectItem value="savings">예적금</SelectItem>
                <SelectItem value="other">기타</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Asset Name */}
          <div>
            <Label htmlFor="name">상품명</Label>
            <Input
              id="name"
              placeholder="상품명을 입력하세요"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="mt-2"
            />
          </div>

          {/* Purchase Price and Quantity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="purchasePrice">매수가격</Label>
              <div className="relative mt-2">
                <Input
                  id="purchasePrice"
                  type="number"
                  placeholder="0"
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData({...formData, purchasePrice: e.target.value})}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[--color-gray-700]">
                  원
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="quantity">보유수량</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="0"
                value={formData.quantity}
                onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                className="mt-2"
              />
            </div>
          </div>

          {/* Current Price */}
          <div>
            <Label htmlFor="currentPrice">현재가격</Label>
            <div className="relative mt-2">
              <Input
                id="currentPrice"
                type="number"
                placeholder="0"
                value={formData.currentPrice}
                onChange={(e) => setFormData({...formData, currentPrice: e.target.value})}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[--color-gray-700]">
                원
              </span>
            </div>
          </div>

          {/* Purchase Date */}
          <div>
            <Label htmlFor="purchaseDate">매수일자</Label>
            <Input
              id="purchaseDate"
              type="date"
              value={formData.purchaseDate}
              onChange={(e) => setFormData({...formData, purchaseDate: e.target.value})}
              className="mt-2"
            />
          </div>

          {/* Memo */}
          <div>
            <Label htmlFor="memo">메모</Label>
            <Textarea
              id="memo"
              placeholder="메모를 입력하세요"
              value={formData.memo}
              onChange={(e) => setFormData({...formData, memo: e.target.value})}
              className="mt-2 min-h-[80px]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[--color-primary] hover:bg-[--color-primary-dark] text-white"
            >
              저장
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
