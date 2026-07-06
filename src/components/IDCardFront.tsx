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

// Passport-style crop: face + upper body sit in the top portion of the
// circular frame. We deliberately do NOT auto-detect or zoom in on the face —
// fixed object-fit + object-position gives a consistent ID-card framing
// regardless of the source photo.
function IdPhoto({ src, alt, layout }: { src: string; alt: string; layout: FrontLayout["photo"] }) {
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
          objectPosition: "50% 20%",
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
        {member.photo_url && <IdPhoto src={member.photo_url} alt={member.name} layout={layout.photo} />}
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
