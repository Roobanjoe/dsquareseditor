import { CARD_WIDTH, CARD_HEIGHT, type BackLayout } from "@/lib/id-card-layout";
import backTemplate from "@/assets/id-back-template.asset.json";
import { AutoFitText } from "@/components/AutoFitText";
import { DEFAULT_ADJUSTMENTS, type CardAdjustments } from "@/lib/card-adjustments";
import type { BackFieldKey, MemberOverrides, Selection } from "@/lib/per-member-adjustments";
import { selectionEquals } from "@/lib/per-member-adjustments";

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
  overrides,
  editable = false,
  selection = null,
  onSelect,
}: {
  member: Member;
  layout: BackLayout;
  scale?: number;
  innerRef?: React.Ref<HTMLDivElement>;
  adjustments?: CardAdjustments;
  overrides?: MemberOverrides["back"];
  editable?: boolean;
  selection?: Selection;
  onSelect?: (s: Selection) => void;
}) {
  const fmtRenewal = member.renewal_date
    ? new Date(member.renewal_date).toLocaleDateString("en-GB")
    : "";
  const values: Record<BackFieldKey, string> = {
    blood_group: member.blood_group,
    license_no: member.license_no,
    renewal_date: fmtRenewal,
    auto_stand: member.auto_stand,
    emergency_mobile: member.emergency_mobile,
    father_name: member.father_name,
    address: member.address,
  };

  const selectHandler = (s: Selection) => (e: React.MouseEvent) => {
    if (!editable) return;
    e.stopPropagation();
    onSelect?.(s);
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
        {(Object.keys(values) as BackFieldKey[]).map((key) => {
          const f = layout.fields[key];
          const isAddress = key === "address";
          const ov = overrides?.fields[key];
          const dx = ov?.dx ?? adjustments.backTextDx;
          const dy = ov?.dy ?? adjustments.backTextDy;
          const scl = ov?.scale ?? adjustments.fontScale;
          const fontSize = f.fontSize * scl;
          const sel: Selection = { side: "back", kind: "field", key };
          const isSelected = editable && selectionEquals(selection, sel);
          return (
            <div
              key={key}
              onClick={selectHandler(sel)}
              style={{
                position: "absolute",
                left: f.x + dx,
                top: f.y + dy,
                width: f.width,
                cursor: editable ? "pointer" : "default",
                outline: isSelected
                  ? "2px dashed hsl(var(--primary))"
                  : "none",
                outlineOffset: 2,
              }}
            >
              <AutoFitText
                text={values[key]}
                x={0}
                y={0}
                width={f.width}
                fontSize={fontSize}
                color={f.color}
                fontWeight={f.fontWeight}
                align={f.align}
                wrap={isAddress}
                maxHeight={isAddress ? Math.ceil(fontSize * 1.25 * 3) : undefined}
                minFontSize={isAddress ? 11 : 12}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
