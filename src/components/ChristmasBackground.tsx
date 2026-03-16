import { SnowfallBackground } from './ui/snow-flakes';

export function ChristmasBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Snowfall Effect */}
      <SnowfallBackground
        count={100}
        speed={0.1}
        minSize={8}
        maxSize={20}
        minOpacity={0.4}
        maxOpacity={0.9}
        color="#ffffff"
        wind={true}
        zIndex={1}
      />
    </div>
  );
}