import { CARD_WIDTH, CARD_HEIGHT, type FrontLayout } from "@/lib/id-card-layout";
import frontTemplate from "@/assets/id-front-template.asset.json";
import { AutoFitText } from "@/components/AutoFitText";
import { DEFAULT_ADJUSTMENTS, type CardAdjustments } from "@/lib/card-adjustments";
import type { FrontFieldKey, MemberOverrides, Selection } from "@/lib/per-member-adjustments";
import { selectionEquals } from "@/lib/per-member-adjustments";

type Member = {
  name: string;
  position: string;
  dob: string;
  member_no: string;
  mobile: string;
  photo_url: string;
};

export function IDCardFront({
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
  layout: FrontLayout;
  scale?: number;
  innerRef?: React.Ref<HTMLDivElement>;
  adjustments?: CardAdjustments;
  overrides?: MemberOverrides["front"];
  editable?: boolean;
  selection?: Selection;
  onSelect?: (s: Selection) => void;
}) {
  const fmtDob = member.dob ? new Date(member.dob).toLocaleDateString("en-GB") : "";
  const values: Record<FrontFieldKey, string> = {
    name: member.name,
    position: member.position,
    dob: fmtDob,
    member_no: member.member_no,
    mobile: member.mobile,
  };

  const frame = overrides?.photoFrame ?? { dx: 0, dy: 0, dSize: 0 };
  const photoImg = overrides?.photoImage ?? {
    objX: adjustments.photoObjX,
    objY: adjustments.photoObjY,
    zoom: adjustments.photoZoom,
  };

  const photoX = layout.photo.x + frame.dx;
  const photoY = layout.photo.y + frame.dy;
  const photoSize = layout.photo.size + frame.dSize;

  const selectHandler = (s: Selection) => (e: React.MouseEvent) => {
    if (!editable) return;
    e.stopPropagation();
    onSelect?.(s);
  };

  const outlineFor = (s: Selection) =>
    editable && selectionEquals(selection, s)
      ? "2px dashed hsl(var(--primary))"
      : "none";

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
        data-id-card-side="front"
        style={{
          position: "relative",
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          backgroundImage: `url(${frontTemplate.url})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          fontFamily: "'Noto Sans Tamil', 'Inter', sans-serif",
          overflow: "hidden",
        }}
      >
        {member.photo_url && (
          <div
            onClick={selectHandler({ side: "front", kind: "photoFrame" })}
            style={{
              position: "absolute",
              left: photoX,
              top: photoY,
              width: photoSize,
              height: photoSize,
              borderRadius: "50%",
              overflow: "hidden",
              backgroundColor: "#ffffff",
              cursor: editable ? "pointer" : "default",
              outline: outlineFor({ side: "front", kind: "photoFrame" }),
              outlineOffset: 2,
            }}
          >
            <img
              src={member.photo_url}
              alt={member.name}
              onClick={selectHandler({ side: "front", kind: "photoImage" })}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: `${photoImg.objX}% ${photoImg.objY}%`,
                transform: `scale(${photoImg.zoom})`,
                transformOrigin: `${photoImg.objX}% ${photoImg.objY}%`,
                display: "block",
                cursor: editable ? "pointer" : "default",
                outline:
                  editable && selectionEquals(selection, { side: "front", kind: "photoImage" })
                    ? "2px solid hsl(var(--primary))"
                    : "none",
                outlineOffset: -2,
              }}
            />
          </div>
        )}

        {(Object.keys(values) as FrontFieldKey[]).map((key) => {
          const f = layout.fields[key];
          const ov = overrides?.fields[key];
          const dx = ov?.dx ?? adjustments.frontTextDx;
          const dy = ov?.dy ?? adjustments.frontTextDy;
          const scl = ov?.scale ?? adjustments.fontScale;
          const sel: Selection = { side: "front", kind: "field", key };
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
                fontSize={f.fontSize * scl}
                color={f.color}
                fontWeight={f.fontWeight}
                align={f.align}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
