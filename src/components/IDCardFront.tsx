import { useCallback, useState, type SyntheticEvent } from "react";
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

type FaceDetectorConstructor = new (options?: {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}) => {
  detect: (image: HTMLImageElement) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
};

function FocusedIdPhoto({ src, alt, layout }: { src: string; alt: string; layout: FrontLayout["photo"] }) {
  const [position, setPosition] = useState("50% 30%");
  const [scale, setScale] = useState(1.24);

  const focusFace = useCallback(async (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    const FaceDetector = (window as Window & { FaceDetector?: FaceDetectorConstructor }).FaceDetector;
    if (!FaceDetector || !img.naturalWidth || !img.naturalHeight) return;

    try {
      const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      const [face] = await detector.detect(img);
      if (!face) return;

      const { x, y, width, height } = face.boundingBox;
      const faceCenterX = ((x + width / 2) / img.naturalWidth) * 100;
      const faceCenterY = ((y + height / 2) / img.naturalHeight) * 100;
      const faceShare = Math.max(width / img.naturalWidth, height / img.naturalHeight);

      setPosition(`${Math.min(70, Math.max(30, faceCenterX))}% ${Math.min(45, Math.max(18, faceCenterY - 8))}%`);
      setScale(faceShare < 0.32 ? 1.34 : faceShare < 0.45 ? 1.22 : 1.08);
    } catch {
      // Keep the upper-center fallback crop when browser face detection is unavailable.
    }
  }, []);

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
        onLoad={focusFace}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: position,
          transform: `scale(${scale})`,
          transformOrigin: position,
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
        {member.photo_url && <FocusedIdPhoto src={member.photo_url} alt={member.name} layout={layout.photo} />}
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
