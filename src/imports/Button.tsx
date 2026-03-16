import svgPaths from "./svg-dxkqw2oa87";

function IcoRefresh() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="ico_refresh">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="ico_refresh">
          <g id="boundary" opacity="0.3" />
          <path d={svgPaths.p2c69e000} fill="var(--fill-0, #A7B1BB)" id="btn_refresh" />
        </g>
      </svg>
    </div>
  );
}

function IConRefresh() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0 size-[16px]" data-name="iCon/refresh">
      <IcoRefresh />
    </div>
  );
}

export default function Button() {
  return (
    <div className="bg-white relative rounded-[4px] size-full" data-name="button">
      <div className="content-stretch flex gap-[4px] items-center justify-center overflow-clip px-[8px] py-[4px] relative rounded-[inherit] size-full">
        <IConRefresh />
        <p className="css-ew64yg font-['Pretendard_Variable:SemiBold',sans-serif] font-semibold leading-[24px] relative shrink-0 text-[#212b36] text-[13px] text-center">초기화</p>
      </div>
      <div aria-hidden="true" className="absolute border border-[#c4cdd5] border-solid inset-0 pointer-events-none rounded-[4px]" />
    </div>
  );
}