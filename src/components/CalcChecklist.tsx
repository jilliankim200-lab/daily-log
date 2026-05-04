import { useAppContext } from '../App';

export function CalcChecklist() {
  const { isMobile } = useAppContext();
  return (
    <div style={{ width: '100%', height: isMobile ? 'calc(100vh - 60px)' : '100vh', overflow: 'hidden' }}>
      <iframe
        src="/calc-checklist.html"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="계산식 체크리스트"
      />
    </div>
  );
}
