import { CARD_WIDTH, CARD_HEIGHT, type FrontLayout } from "@/lib/id-card-layout";
import frontTemplate from "@/assets/id-front-template.asset.json";
import { AutoFitText } from "@/components/AutoFitText";
import { DEFAULT_ADJUSTMENTS, type CardAdjustments } from "@/lib/card-adjustments";

type Member = {
  name: string;
  position: string;
  dob: string;
  member_no: string;
  mobile: string;
  photo_url: string;
};

function IdPhoto({
  src,
  alt,
  layout,
  adjustments,
}: {
  src: string;
  alt: string;
  layout: FrontLayout["photo"];
  adjustments: CardAdjustments;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: layout.x,
        top: layout.y,
        width: layout.size,
        height: layout.size,
        borderRadius: "50%",
        overflow: "hidden",
        backgroundColor: "#ffffff",
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: `${adjustments.photoObjX}% ${adjustments.photoObjY}%`,
          transform: `scale(${adjustments.photoZoom})`,
          transformOrigin: `${adjustments.photoObjX}% ${adjustments.photoObjY}%`,
          display: "block",
        }}
      />
    </div>
  );
}

export function IDCardFront({
  member,
  layout,
  scale = 1,
  innerRef,
  adjustments = DEFAULT_ADJUSTMENTS,
}: {
  member: Member;
  layout: FrontLayout;
  scale?: number;
  innerRef?: React.Ref<HTMLDivElement>;
  adjustments?: CardAdjustments;
}) {
  const fmtDob = member.dob ? new Date(member.dob).toLocaleDateString("en-GB") : "";
  const values: Record<keyof FrontLayout["fields"], string> = {
    name: member.name,
    position: member.position,
    dob: fmtDob,
    member_no: member.member_no,
    mobile: member.mobile,
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
          <IdPhoto src={member.photo_url} alt={member.name} layout={layout.photo} adjustments={adjustments} />
        )}
        {(Object.keys(values) as (keyof typeof values)[]).map((key) => {
          const f = layout.fields[key];
          return (
            <AutoFitText
              key={key}
              text={values[key]}
              x={f.x + adjustments.frontTextDx}
              y={f.y + adjustments.frontTextDy}
              width={f.width}
              fontSize={f.fontSize * adjustments.fontScale}
              color={f.color}
              fontWeight={f.fontWeight}
              align={f.align}
            />
          );
        })}
      </div>
    </div>
  );
}
