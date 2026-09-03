import { Composition } from "remotion";
import { StaticCardTemplate } from "./StaticCardTemplate";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="StaticCardsV1"
        component={StaticCardTemplate as any}
        durationInFrames={300} // 10 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          hook: "¿Querés controlar tu casa?",
          productTitle: "Enchufe Inteligente Wi-Fi",
          benefits: ["Fácil", "Rápido", "Seguro"],
          cta: "Link en bio",
          disclaimer: "Enlace afiliado",
          imageUrl: "https://via.placeholder.com/600",
        }}
      />
    </>
  );
};
