import { CARD_WIDTH, CARD_HEIGHT, type FrontLayout } from "@/lib/id-card-layout";
import frontTemplate from "@/assets/id-front-template.asset.json";

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
}: {
  member: Member;
  layout: FrontLayout;
  scale?: number;
  innerRef?: React.Ref<HTMLDivElement>;
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
          <img
            src={member.photo_url}
            alt={member.name}
            crossOrigin="anonymous"
            style={{
              position: "absolute",
              left: layout.photo.x,
              top: layout.photo.y,
              width: layout.photo.size,
              height: layout.photo.size,
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
        )}
        {(Object.keys(values) as (keyof typeof values)[]).map((key) => {
          const f = layout.fields[key];
          return (
            <div
              key={key}
              style={{
                position: "absolute",
                left: f.x,
                top: f.y,
                width: f.width,
                fontSize: f.fontSize,
                color: f.color,
                fontWeight: f.fontWeight,
                textAlign: f.align,
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {values[key]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
