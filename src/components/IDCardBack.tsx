import { CARD_WIDTH, CARD_HEIGHT, type BackLayout } from "@/lib/id-card-layout";
import backTemplate from "@/assets/id-back-template.asset.json";
import { AutoFitText } from "@/components/AutoFitText";
import { DEFAULT_ADJUSTMENTS, type CardAdjustments } from "@/lib/card-adjustments";

type Member = {
  blood_group: string;
  license_no: string;
  renewal_date: string;
  auto_stand: string;
  emergency_mobile: string;
  father_name: string;
  address: string;
};

export function IDCardBack({
  member,
  layout,
  scale = 1,
  innerRef,
  adjustments = DEFAULT_ADJUSTMENTS,
}: {
  member: Member;
  layout: BackLayout;
  scale?: number;
  innerRef?: React.Ref<HTMLDivElement>;
  adjustments?: CardAdjustments;
}) {
  const fmtRenewal = member.renewal_date
    ? new Date(member.renewal_date).toLocaleDateString("en-GB")
    : "";
  const values: Record<keyof BackLayout["fields"], string> = {
    blood_group: member.blood_group,
    license_no: member.license_no,
    renewal_date: fmtRenewal,
    auto_stand: member.auto_stand,
    emergency_mobile: member.emergency_mobile,
    father_name: member.father_name,
    address: member.address,
  };

  return (
    <div
      style={{
        width: CARD_WIDTH * scale,
        height: CARD_HEIGHT * scale,
        transformOrigin: "top left",
      }}
    >
      <div
        ref={innerRef}
        data-id-card-side="back"
        style={{
          position: "relative",
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          backgroundImage: `url(${backTemplate.url})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          fontFamily: "'Noto Sans Tamil', 'Inter', sans-serif",
          overflow: "hidden",
        }}
      >
        {(Object.keys(values) as (keyof typeof values)[]).map((key) => {
          const f = layout.fields[key];
          const isAddress = key === "address";
          const fontSize = f.fontSize * adjustments.fontScale;
          return (
            <AutoFitText
              key={key}
              text={values[key]}
              x={f.x + adjustments.backTextDx}
              y={f.y + adjustments.backTextDy}
              width={f.width}
              fontSize={fontSize}
              color={f.color}
              fontWeight={f.fontWeight}
              align={f.align}
              wrap={isAddress}
              maxHeight={isAddress ? Math.ceil(fontSize * 1.25 * 3) : undefined}
              minFontSize={isAddress ? 11 : 12}
            />
          );
        })}
      </div>
    </div>
  );
}
