import svgPaths from "./svg-p0frrf0qtb";

function Heading() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="Heading 1">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[24px] left-0 not-italic text-[16px] text-nowrap text-white top-[-2px] whitespace-pre">대시보드 디자인 시스템</p>
    </div>
  );
}

function HdfsCapacityCard() {
  return (
    <div className="absolute h-[24px] left-[24px] top-[24px] w-[466.656px]" data-name="HDFSCapacityCard">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[24px] left-0 not-italic text-[16px] text-nowrap text-white top-[-2px] whitespace-pre">HDFS Capacity Used</p>
    </div>
  );
}

function Icon() {
  return (
    <div className="relative size-[200px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 200 200">
        <g clipPath="url(#clip0_169_279)" id="Icon">
          <path d={svgPaths.p12861600} id="Vector" stroke="var(--stroke-0, #4F46E5)" strokeOpacity="0.2" strokeWidth="25" />
          <path d={svgPaths.p12861600} id="Vector_2" stroke="url(#paint0_linear_169_279)" strokeDasharray="549.78 549.78" strokeLinecap="round" strokeWidth="25" />
        </g>
        <defs>
          <linearGradient gradientUnits="userSpaceOnUse" id="paint0_linear_169_279" x1="12.5" x2="17512.5" y1="12.5" y2="17512.5">
            <stop stopColor="#818CF8" />
            <stop offset="1" stopColor="#4F46E5" />
          </linearGradient>
          <clipPath id="clip0_169_279">
            <rect fill="white" height="200" width="200" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Text() {
  return (
    <div className="absolute content-stretch flex h-[64px] items-start left-0 top-[-8px] w-[52.875px]" data-name="Text">
      <p className="font-['Arial:Regular',sans-serif] leading-[48px] not-italic relative shrink-0 text-[48px] text-center text-nowrap text-white whitespace-pre">41</p>
    </div>
  );
}

function Text1() {
  return (
    <div className="absolute content-stretch flex h-[32px] items-start left-[56.88px] top-[18px] w-[20.078px]" data-name="Text">
      <p className="font-['Arial:Regular',sans-serif] leading-[32px] not-italic relative shrink-0 text-[#99a1af] text-[24px] text-center text-nowrap whitespace-pre">%</p>
    </div>
  );
}

function Container() {
  return (
    <div className="absolute h-[50px] left-[61.52px] top-[75px] w-[76.953px]" data-name="Container">
      <Text />
      <Text1 />
    </div>
  );
}

function HdfsCapacityCard1() {
  return (
    <div className="absolute left-[157.33px] size-[200px] top-[72px]" data-name="HDFSCapacityCard">
      <div className="absolute flex items-center justify-center left-0 size-[200px] top-[-9px]" style={{ "--transform-inner-width": "0", "--transform-inner-height": "0" } as React.CSSProperties}>
        <div className="flex-none rotate-[270deg]">
          <Icon />
        </div>
      </div>
      <Container />
    </div>
  );
}

function Container1() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-[49.28px] not-italic text-[#99a1af] text-[14px] text-center text-nowrap top-[-1px] translate-x-[-50%] whitespace-pre">Used</p>
    </div>
  );
}

function Container2() {
  return (
    <div className="h-[32px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[32px] left-[49px] not-italic text-[24px] text-center text-white top-[-2px] translate-x-[-50%] w-[98px]">412.7 GB</p>
    </div>
  );
}

function Container3() {
  return (
    <div className="h-[56px] relative shrink-0 w-[97.406px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[4px] items-start relative size-full">
        <Container1 />
        <Container2 />
      </div>
    </div>
  );
}

function Container4() {
  return (
    <div className="bg-[#364153] h-[48px] relative shrink-0 w-px" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid size-full" />
    </div>
  );
}

function Container5() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-[55.48px] not-italic text-[#99a1af] text-[14px] text-center text-nowrap top-[-1px] translate-x-[-50%] whitespace-pre">Max</p>
    </div>
  );
}

function Container6() {
  return (
    <div className="h-[32px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[32px] left-[55.5px] not-italic text-[24px] text-center text-white top-[-2px] translate-x-[-50%] w-[111px]">1006.6 GB</p>
    </div>
  );
}

function Container7() {
  return (
    <div className="h-[56px] relative shrink-0 w-[110.625px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[4px] items-start relative size-full">
        <Container5 />
        <Container6 />
      </div>
    </div>
  );
}

function HdfsCapacityCard2() {
  return (
    <div className="absolute content-stretch flex gap-[32px] h-[56px] items-center justify-center left-[24px] top-[304px] w-[466.656px]" data-name="HDFSCapacityCard">
      <Container3 />
      <Container4 />
      <Container7 />
    </div>
  );
}

function DashboardCard() {
  return (
    <div className="absolute bg-[#2a2d3e] border border-[#1e2939] border-solid h-[811px] left-0 rounded-[14px] top-0 w-[516.656px]" data-name="DashboardCard">
      <HdfsCapacityCard />
      <HdfsCapacityCard1 />
      <HdfsCapacityCard2 />
    </div>
  );
}

function YarnApplicationsCard() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="YARNApplicationsCard">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[24px] left-0 not-italic text-[16px] text-nowrap text-white top-[-2px] whitespace-pre">YARN Applications</p>
    </div>
  );
}

function Container8() {
  return (
    <div className="absolute h-[20px] left-[16px] top-0 w-[975.344px]" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-0 not-italic text-[#99a1af] text-[14px] text-nowrap top-[-1px] whitespace-pre">Application Name</p>
    </div>
  );
}

function Container9() {
  return (
    <div className="absolute h-[20px] left-[16px] top-[36px] w-[975.344px]" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-0 not-italic text-[#99a1af] text-[14px] text-nowrap top-[-1px] whitespace-pre">Progress</p>
    </div>
  );
}

function Container10() {
  return <div className="absolute h-0 left-[16px] top-[72px] w-[975.344px]" data-name="Container" />;
}

function Container11() {
  return (
    <div className="absolute h-[20px] left-[16px] top-[88px] w-[975.344px]" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-0 not-italic text-[#99a1af] text-[14px] text-nowrap top-[-1px] whitespace-pre">Status</p>
    </div>
  );
}

function Container12() {
  return (
    <div className="h-[121px] relative shrink-0 w-full" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#364153] border-[0px_0px_1px] border-solid inset-0 pointer-events-none" />
      <Container8 />
      <Container9 />
      <Container10 />
      <Container11 />
    </div>
  );
}

function Container13() {
  return (
    <div className="absolute h-[24px] left-[16px] top-[12px] w-[975.344px]" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[24px] left-0 not-italic text-[#d1d5dc] text-[16px] text-nowrap top-[-2px] whitespace-pre">batch_test01</p>
    </div>
  );
}

function Container14() {
  return <div className="bg-[#2b7fff] h-[8px] rounded-[3.35544e+07px] shrink-0 w-full" data-name="Container" />;
}

function Container15() {
  return (
    <div className="absolute bg-[#364153] content-stretch flex flex-col h-[8px] items-start left-[16px] overflow-clip pl-0 pr-[292.609px] py-0 rounded-[3.35544e+07px] top-[52px] w-[975.344px]" data-name="Container">
      <Container14 />
    </div>
  );
}

function Container16() {
  return (
    <div className="absolute h-[20px] left-[16px] top-[76px] w-[975.344px]" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-[976.2px] not-italic text-[#99a1af] text-[14px] text-right top-[-1px] translate-x-[-100%] w-[28px]">70%</p>
    </div>
  );
}

function Icon1() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g clipPath="url(#clip0_169_275)" id="Icon">
          <path d={svgPaths.p14d24500} id="Vector" stroke="var(--stroke-0, #51A2FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.p3e012060} id="Vector_2" stroke="var(--stroke-0, #51A2FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
        <defs>
          <clipPath id="clip0_169_275">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Container17() {
  return (
    <div className="absolute content-stretch flex h-[20px] items-start justify-end left-[16px] top-[112px] w-[975.344px]" data-name="Container">
      <Icon1 />
    </div>
  );
}

function Container18() {
  return (
    <div className="h-[144px] relative rounded-[10px] shrink-0 w-full" data-name="Container">
      <Container13 />
      <Container15 />
      <Container16 />
      <Container17 />
    </div>
  );
}

function Container19() {
  return (
    <div className="absolute h-[24px] left-[16px] top-[12px] w-[975.344px]" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[24px] left-0 not-italic text-[#d1d5dc] text-[16px] text-nowrap top-[-2px] whitespace-pre">dn01.hdp.exem</p>
    </div>
  );
}

function Container20() {
  return <div className="bg-[#2b7fff] h-[8px] rounded-[3.35544e+07px] shrink-0 w-full" data-name="Container" />;
}

function Container21() {
  return (
    <div className="absolute bg-[#364153] content-stretch flex flex-col h-[8px] items-start left-[16px] overflow-clip pl-0 pr-[292.609px] py-0 rounded-[3.35544e+07px] top-[52px] w-[975.344px]" data-name="Container">
      <Container20 />
    </div>
  );
}

function Container22() {
  return (
    <div className="absolute h-[20px] left-[16px] top-[76px] w-[975.344px]" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-[976.2px] not-italic text-[#99a1af] text-[14px] text-right top-[-1px] translate-x-[-100%] w-[28px]">70%</p>
    </div>
  );
}

function Icon2() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g clipPath="url(#clip0_169_286)" id="Icon">
          <path d={svgPaths.p14d24500} id="Vector" stroke="var(--stroke-0, #F6339A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M10 6.66667V10" id="Vector_2" stroke="var(--stroke-0, #F6339A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M10 13.3333H10.0083" id="Vector_3" stroke="var(--stroke-0, #F6339A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
        <defs>
          <clipPath id="clip0_169_286">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Container23() {
  return (
    <div className="absolute content-stretch flex h-[20px] items-start justify-end left-[16px] top-[112px] w-[975.344px]" data-name="Container">
      <Icon2 />
    </div>
  );
}

function Container24() {
  return (
    <div className="h-[144px] relative rounded-[10px] shrink-0 w-full" data-name="Container">
      <Container19 />
      <Container21 />
      <Container22 />
      <Container23 />
    </div>
  );
}

function Container25() {
  return (
    <div className="absolute h-[24px] left-[16px] top-[12px] w-[975.344px]" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[24px] left-0 not-italic text-[#d1d5dc] text-[16px] text-nowrap top-[-2px] whitespace-pre">dn01.hdp.exem</p>
    </div>
  );
}

function Container26() {
  return <div className="bg-[#2b7fff] h-[8px] rounded-[3.35544e+07px] shrink-0 w-full" data-name="Container" />;
}

function Container27() {
  return (
    <div className="absolute bg-[#364153] content-stretch flex flex-col h-[8px] items-start left-[16px] overflow-clip pl-0 pr-[292.609px] py-0 rounded-[3.35544e+07px] top-[52px] w-[975.344px]" data-name="Container">
      <Container26 />
    </div>
  );
}

function Container28() {
  return (
    <div className="absolute h-[20px] left-[16px] top-[76px] w-[975.344px]" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-[976.2px] not-italic text-[#99a1af] text-[14px] text-right top-[-1px] translate-x-[-100%] w-[28px]">70%</p>
    </div>
  );
}

function Icon3() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g clipPath="url(#clip0_169_275)" id="Icon">
          <path d={svgPaths.p14d24500} id="Vector" stroke="var(--stroke-0, #51A2FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.p3e012060} id="Vector_2" stroke="var(--stroke-0, #51A2FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
        <defs>
          <clipPath id="clip0_169_275">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Container29() {
  return (
    <div className="absolute content-stretch flex h-[20px] items-start justify-end left-[16px] top-[112px] w-[975.344px]" data-name="Container">
      <Icon3 />
    </div>
  );
}

function Container30() {
  return (
    <div className="h-[144px] relative rounded-[10px] shrink-0 w-full" data-name="Container">
      <Container25 />
      <Container27 />
      <Container28 />
      <Container29 />
    </div>
  );
}

function Container31() {
  return (
    <div className="absolute h-[24px] left-[16px] top-[12px] w-[975.344px]" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[24px] left-0 not-italic text-[#d1d5dc] text-[16px] text-nowrap top-[-2px] whitespace-pre">dn01.hdp.exem</p>
    </div>
  );
}

function Container32() {
  return <div className="bg-[#2b7fff] h-[8px] rounded-[3.35544e+07px] shrink-0 w-full" data-name="Container" />;
}

function Container33() {
  return (
    <div className="absolute bg-[#364153] content-stretch flex flex-col h-[8px] items-start left-[16px] overflow-clip pl-0 pr-[292.609px] py-0 rounded-[3.35544e+07px] top-[52px] w-[975.344px]" data-name="Container">
      <Container32 />
    </div>
  );
}

function Container34() {
  return (
    <div className="absolute h-[20px] left-[16px] top-[76px] w-[975.344px]" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-[976.2px] not-italic text-[#99a1af] text-[14px] text-right top-[-1px] translate-x-[-100%] w-[28px]">70%</p>
    </div>
  );
}

function Icon4() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Icon">
          <path d={svgPaths.p32d5d880} id="Vector" stroke="var(--stroke-0, #FDC700)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M10 7.5V10.8333" id="Vector_2" stroke="var(--stroke-0, #FDC700)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M10 14.1667H10.0083" id="Vector_3" stroke="var(--stroke-0, #FDC700)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
      </svg>
    </div>
  );
}

function Container35() {
  return (
    <div className="absolute content-stretch flex h-[20px] items-start justify-end left-[16px] top-[112px] w-[975.344px]" data-name="Container">
      <Icon4 />
    </div>
  );
}

function Container36() {
  return (
    <div className="h-[144px] relative rounded-[10px] shrink-0 w-full" data-name="Container">
      <Container31 />
      <Container33 />
      <Container34 />
      <Container35 />
    </div>
  );
}

function YarnApplicationsCard1() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] h-[713px] items-start relative shrink-0 w-full" data-name="YARNApplicationsCard">
      <Container12 />
      <Container18 />
      <Container24 />
      <Container30 />
      <Container36 />
    </div>
  );
}

function DashboardCard1() {
  return (
    <div className="absolute bg-[#2a2d3e] content-stretch flex flex-col gap-[24px] h-[811px] items-start left-[540.66px] pb-px pt-[25px] px-[25px] rounded-[14px] top-0 w-[1057.344px]" data-name="DashboardCard">
      <div aria-hidden="true" className="absolute border border-[#1e2939] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <YarnApplicationsCard />
      <YarnApplicationsCard1 />
    </div>
  );
}

function ServerStatusCard() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="ServerStatusCard">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[24px] left-0 not-italic text-[16px] text-nowrap text-white top-[-2px] whitespace-pre">Server Status</p>
    </div>
  );
}

function Container37() {
  return (
    <div className="absolute h-[20px] left-[16px] top-0 w-[209.328px]" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-0 not-italic text-[#99a1af] text-[14px] text-nowrap top-[-1px] whitespace-pre">Application Name</p>
    </div>
  );
}

function Container38() {
  return (
    <div className="absolute h-[20px] left-[241.33px] top-0 w-[209.328px]" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-0 not-italic text-[#99a1af] text-[14px] text-nowrap top-[-1px] whitespace-pre">State</p>
    </div>
  );
}

function Container39() {
  return (
    <div className="h-[33px] relative shrink-0 w-full" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#364153] border-[0px_0px_1px] border-solid inset-0 pointer-events-none" />
      <Container37 />
      <Container38 />
    </div>
  );
}

function Container40() {
  return (
    <div className="absolute h-[24px] left-[16px] top-[12px] w-[209.328px]" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[24px] left-0 not-italic text-[#d1d5dc] text-[16px] text-nowrap top-[-2px] whitespace-pre">HBASE</p>
    </div>
  );
}

function Text2() {
  return (
    <div className="absolute content-stretch flex h-[28px] items-start left-[241.33px] px-[13px] py-[5px] rounded-[4px] top-[10px] w-[84.859px]" data-name="Text">
      <div aria-hidden="true" className="absolute border border-[#2b7fff] border-solid inset-0 pointer-events-none rounded-[4px]" />
      <p className="font-['Arial:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#51a2ff] text-[14px] text-nowrap whitespace-pre">NORMAL</p>
    </div>
  );
}

function Container41() {
  return (
    <div className="h-[48px] relative rounded-[10px] shrink-0 w-full" data-name="Container">
      <Container40 />
      <Text2 />
    </div>
  );
}

function Container42() {
  return (
    <div className="absolute h-[24px] left-[16px] top-[12px] w-[209.328px]" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[24px] left-0 not-italic text-[#d1d5dc] text-[16px] text-nowrap top-[-2px] whitespace-pre">HIVE</p>
    </div>
  );
}

function Text3() {
  return (
    <div className="absolute content-stretch flex h-[28px] items-start left-[241.33px] px-[13px] py-[5px] rounded-[4px] top-[10px] w-[84.859px]" data-name="Text">
      <div aria-hidden="true" className="absolute border border-[#2b7fff] border-solid inset-0 pointer-events-none rounded-[4px]" />
      <p className="font-['Arial:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#51a2ff] text-[14px] text-nowrap whitespace-pre">NORMAL</p>
    </div>
  );
}

function Container43() {
  return (
    <div className="h-[48px] relative rounded-[10px] shrink-0 w-full" data-name="Container">
      <Container42 />
      <Text3 />
    </div>
  );
}

function Container44() {
  return (
    <div className="absolute h-[24px] left-[16px] top-[12px] w-[209.328px]" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[24px] left-0 not-italic text-[#d1d5dc] text-[16px] text-nowrap top-[-2px] whitespace-pre">KAFKA</p>
    </div>
  );
}

function Text4() {
  return (
    <div className="absolute content-stretch flex h-[28px] items-start left-[241.33px] px-[13px] py-[5px] rounded-[4px] top-[10px] w-[84.859px]" data-name="Text">
      <div aria-hidden="true" className="absolute border border-[#2b7fff] border-solid inset-0 pointer-events-none rounded-[4px]" />
      <p className="font-['Arial:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#51a2ff] text-[14px] text-nowrap whitespace-pre">NORMAL</p>
    </div>
  );
}

function Container45() {
  return (
    <div className="h-[48px] relative rounded-[10px] shrink-0 w-full" data-name="Container">
      <Container44 />
      <Text4 />
    </div>
  );
}

function ServerStatusCard1() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] h-[241px] items-start relative shrink-0 w-full" data-name="ServerStatusCard">
      <Container39 />
      <Container41 />
      {[...Array(2).keys()].map((_, i) => (
        <Container43 key={i} />
      ))}
      <Container45 />
    </div>
  );
}

function DashboardCard2() {
  return (
    <div className="absolute bg-[#2a2d3e] content-stretch flex flex-col gap-[24px] h-[370px] items-start left-0 pb-px pt-[25px] px-[25px] rounded-[14px] top-[835px] w-[516.656px]" data-name="DashboardCard">
      <div aria-hidden="true" className="absolute border border-[#1e2939] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <ServerStatusCard />
      <ServerStatusCard1 />
    </div>
  );
}

function DatanodeStateCard() {
  return (
    <div className="h-[27px] relative shrink-0 w-full" data-name="DatanodeStateCard">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[27px] left-0 not-italic text-[18px] text-nowrap text-white top-[-2px] whitespace-pre">Datanode State</p>
    </div>
  );
}

function Container46() {
  return (
    <div className="absolute h-[20px] left-[100.47px] top-[24px] w-[24.391px]" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-0 not-italic text-[14px] text-nowrap text-white top-[-1px] whitespace-pre">Live</p>
    </div>
  );
}

function Container47() {
  return (
    <div className="absolute h-[48px] left-[99.44px] top-[52px] w-[26.438px]" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[48px] left-0 not-italic text-[48px] text-nowrap text-white top-[-5px] whitespace-pre">3</p>
    </div>
  );
}

function Icon5() {
  return (
    <div className="relative shrink-0 size-[96px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 96 96">
        <g id="Icon">
          <path d={svgPaths.p283c7e80} id="Vector" stroke="var(--stroke-0, #0A0A0A)" strokeDasharray="3.84 3.84" strokeWidth="1.92" />
        </g>
      </svg>
    </div>
  );
}

function Container48() {
  return (
    <div className="absolute content-stretch flex h-[124px] items-center justify-center left-0 opacity-20 pl-0 pr-[0.016px] py-0 top-0 w-[225.328px]" data-name="Container">
      <Icon5 />
    </div>
  );
}

function Container49() {
  return (
    <div className="absolute bg-emerald-500 h-[124px] left-0 overflow-clip rounded-[14px] top-0 w-[225.328px]" data-name="Container">
      <Container46 />
      <Container47 />
      <Container48 />
    </div>
  );
}

function Container50() {
  return (
    <div className="h-[20px] relative shrink-0 w-[92.688px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-0 not-italic text-[14px] text-gray-400 text-nowrap top-[-1px] whitespace-pre">Decommission</p>
      </div>
    </div>
  );
}

function Container51() {
  return (
    <div className="h-[48px] relative shrink-0 w-[26.438px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Arial:Regular',sans-serif] leading-[48px] left-0 not-italic text-[48px] text-gray-500 text-nowrap top-[-5px] whitespace-pre">0</p>
      </div>
    </div>
  );
}

function Container52() {
  return (
    <div className="absolute bg-[rgba(107,116,128,0.2)] content-stretch flex flex-col gap-[8px] h-[124px] items-center justify-center left-[241.33px] overflow-clip rounded-[14px] top-0 w-[225.344px]" data-name="Container">
      <Container50 />
      <Container51 />
    </div>
  );
}

function Container53() {
  return (
    <div className="h-[20px] relative shrink-0 w-[53.063px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-0 not-italic text-[14px] text-gray-400 text-nowrap top-[-1px] whitespace-pre">Warning</p>
      </div>
    </div>
  );
}

function Container54() {
  return (
    <div className="h-[48px] relative shrink-0 w-[26.438px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Arial:Regular',sans-serif] leading-[48px] left-0 not-italic text-[48px] text-gray-500 text-nowrap top-[-5px] whitespace-pre">0</p>
      </div>
    </div>
  );
}

function Container55() {
  return (
    <div className="absolute bg-[rgba(107,116,128,0.2)] content-stretch flex flex-col gap-[8px] h-[124px] items-center justify-center left-0 overflow-clip rounded-[14px] top-[140px] w-[225.328px]" data-name="Container">
      <Container53 />
      <Container54 />
    </div>
  );
}

function Container56() {
  return (
    <div className="h-[20px] relative shrink-0 w-[33.25px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-0 not-italic text-[14px] text-gray-400 text-nowrap top-[-1px] whitespace-pre">Dead</p>
      </div>
    </div>
  );
}

function Container57() {
  return (
    <div className="h-[48px] relative shrink-0 w-[26.438px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Arial:Regular',sans-serif] leading-[48px] left-0 not-italic text-[48px] text-gray-500 text-nowrap top-[-5px] whitespace-pre">0</p>
      </div>
    </div>
  );
}

function Container58() {
  return (
    <div className="absolute bg-[rgba(107,116,128,0.2)] content-stretch flex flex-col gap-[8px] h-[124px] items-center justify-center left-[241.33px] overflow-clip rounded-[14px] top-[140px] w-[225.344px]" data-name="Container">
      <Container56 />
      <Container57 />
    </div>
  );
}

function DatanodeStateCard1() {
  return (
    <div className="h-[264px] relative shrink-0 w-full" data-name="DatanodeStateCard">
      <Container49 />
      <Container52 />
      <Container55 />
      <Container58 />
    </div>
  );
}

function DashboardCard3() {
  return (
    <div className="absolute bg-[#2a2d3e] content-stretch flex flex-col gap-[24px] h-[370px] items-start left-[540.66px] pb-px pt-[25px] px-[25px] rounded-[14px] top-[835px] w-[516.672px]" data-name="DashboardCard">
      <div aria-hidden="true" className="absolute border border-[#1e2939] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <DatanodeStateCard />
      <DatanodeStateCard1 />
    </div>
  );
}

function WorkflowExecutionCard() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="WorkflowExecutionCard">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[24px] left-0 not-italic text-[16px] text-nowrap text-white top-[-2px] whitespace-pre">Workflow Execution History</p>
    </div>
  );
}

function Icon6() {
  return (
    <div className="h-[24px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[41.67%_70.83%_8.33%_29.17%]" data-name="Vector">
        <div className="absolute inset-[-8.33%_-1px]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2 14">
            <path d="M1 1V13" id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[8.33%_9.04%_8.33%_8.33%]" data-name="Vector">
        <div className="absolute inset-[-5%_-5.04%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22 22">
            <path d={svgPaths.pbf48880} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Container59() {
  return (
    <div className="bg-[#2b7fff] relative rounded-[10px] shrink-0 size-[48px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-0 pt-[12px] px-[12px] relative size-full">
        <Icon6 />
      </div>
    </div>
  );
}

function Text5() {
  return (
    <div className="basis-0 grow h-[24px] min-h-px min-w-px relative shrink-0" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Arial:Regular',sans-serif] leading-[24px] left-0 not-italic text-[#d1d5dc] text-[16px] text-nowrap top-[-2px] whitespace-pre">Success</p>
      </div>
    </div>
  );
}

function Container60() {
  return (
    <div className="h-[48px] relative shrink-0 w-[119.484px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[16px] items-center relative size-full">
        <Container59 />
        <Text5 />
      </div>
    </div>
  );
}

function Container61() {
  return (
    <div className="h-[32px] relative shrink-0 w-[39.656px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Arial:Regular',sans-serif] leading-[32px] not-italic relative shrink-0 text-[24px] text-nowrap text-white whitespace-pre">990</p>
      </div>
    </div>
  );
}

function Container62() {
  return (
    <div className="bg-[rgba(30,41,57,0.5)] h-[80px] relative rounded-[10px] shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between px-[16px] py-0 relative size-full">
          <Container60 />
          <Container61 />
        </div>
      </div>
    </div>
  );
}

function Icon7() {
  return (
    <div className="h-[24px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[8.33%]" data-name="Vector">
        <div className="absolute inset-[-5%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22 22">
            <path d={svgPaths.pb60700} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-1/2 left-1/2 right-1/2 top-[33.33%]" data-name="Vector">
        <div className="absolute inset-[-25%_-1px]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2 6">
            <path d="M1 1V5" id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-[33.33%] left-1/2 right-[49.96%] top-[66.67%]" data-name="Vector">
        <div className="absolute inset-[-1px_-9999.77%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 3 2">
            <path d="M1 1H1.01" id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Container63() {
  return (
    <div className="basis-0 bg-[#f6339a] grow h-[48px] min-h-px min-w-px relative rounded-[10px] shrink-0" data-name="Container">
      <div className="size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-0 pt-[12px] px-[12px] relative size-full">
          <Icon7 />
        </div>
      </div>
    </div>
  );
}

function Text6() {
  return (
    <div className="h-[24px] relative shrink-0 w-[23.531px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Arial:Regular',sans-serif] leading-[24px] left-0 not-italic text-[#d1d5dc] text-[16px] text-nowrap top-[-2px] whitespace-pre">Fail</p>
      </div>
    </div>
  );
}

function Container64() {
  return (
    <div className="h-[48px] relative shrink-0 w-[87.531px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[16px] items-center relative size-full">
        <Container63 />
        <Text6 />
      </div>
    </div>
  );
}

function Container65() {
  return (
    <div className="h-[32px] relative shrink-0 w-[26.438px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Arial:Regular',sans-serif] leading-[32px] not-italic relative shrink-0 text-[24px] text-nowrap text-white whitespace-pre">18</p>
      </div>
    </div>
  );
}

function Container66() {
  return (
    <div className="bg-[rgba(30,41,57,0.5)] h-[80px] relative rounded-[10px] shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between px-[16px] py-0 relative size-full">
          <Container64 />
          <Container65 />
        </div>
      </div>
    </div>
  );
}

function Icon8() {
  return (
    <div className="h-[24px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute bottom-1/2 left-[8.35%] right-[8.26%] top-[8.33%]" data-name="Vector">
        <div className="absolute inset-[-10%_-5%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 23 12">
            <path d={svgPaths.p87dce00} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-[29.17%] left-[8.33%] right-[8.33%] top-1/2" data-name="Vector">
        <div className="absolute inset-[-20.01%_-5%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22 7">
            <path d={svgPaths.p14755380} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[70.83%_8.33%_8.34%_8.33%]" data-name="Vector">
        <div className="absolute inset-[-20.01%_-5%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22 7">
            <path d={svgPaths.p14755380} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Container67() {
  return (
    <div className="basis-0 bg-[#ad46ff] grow h-[48px] min-h-px min-w-px relative rounded-[10px] shrink-0" data-name="Container">
      <div className="size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-0 pt-[12px] px-[12px] relative size-full">
          <Icon8 />
        </div>
      </div>
    </div>
  );
}

function Text7() {
  return (
    <div className="h-[24px] relative shrink-0 w-[34.125px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Arial:Regular',sans-serif] leading-[24px] left-0 not-italic text-[#d1d5dc] text-[16px] text-nowrap top-[-2px] whitespace-pre">Total</p>
      </div>
    </div>
  );
}

function Container68() {
  return (
    <div className="h-[48px] relative shrink-0 w-[98.125px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[16px] items-center relative size-full">
        <Container67 />
        <Text7 />
      </div>
    </div>
  );
}

function Container69() {
  return (
    <div className="h-[32px] relative shrink-0 w-[58.125px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Arial:Regular',sans-serif] leading-[32px] not-italic relative shrink-0 text-[24px] text-nowrap text-white whitespace-pre">1,008</p>
      </div>
    </div>
  );
}

function Container70() {
  return (
    <div className="bg-[rgba(30,41,57,0.5)] h-[80px] relative rounded-[10px] shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between px-[16px] py-0 relative size-full">
          <Container68 />
          <Container69 />
        </div>
      </div>
    </div>
  );
}

function WorkflowExecutionCard1() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] h-[272px] items-start relative shrink-0 w-full" data-name="WorkflowExecutionCard">
      <Container62 />
      <Container66 />
      <Container70 />
    </div>
  );
}

function DashboardCard4() {
  return (
    <div className="absolute bg-[#2a2d3e] content-stretch flex flex-col gap-[24px] h-[370px] items-start left-[1081.33px] pb-px pt-[25px] px-[25px] rounded-[14px] top-[835px] w-[516.672px]" data-name="DashboardCard">
      <div aria-hidden="true" className="absolute border border-[#1e2939] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <WorkflowExecutionCard />
      <WorkflowExecutionCard1 />
    </div>
  );
}

function Container71() {
  return (
    <div className="h-[1205px] relative shrink-0 w-full" data-name="Container">
      <DashboardCard />
      <DashboardCard1 />
      <DashboardCard2 />
      <DashboardCard3 />
      <DashboardCard4 />
    </div>
  );
}

function App() {
  return (
    <div className="bg-[#1a1d2e] h-[1325px] relative shrink-0 w-full" data-name="App">
      <div className="size-full">
        <div className="content-stretch flex flex-col gap-[32px] items-start pb-0 pt-[32px] px-[32px] relative size-full">
          <Heading />
          <Container71 />
        </div>
      </div>
    </div>
  );
}

export default function Component() {
  return (
    <div className="bg-white content-stretch flex flex-col items-start relative size-full" data-name="디자인 시스템 시각화">
      <App />
    </div>
  );
}