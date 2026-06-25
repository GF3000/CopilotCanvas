import { Composition } from "remotion";
import { CanvasForCopilot, CanvasForCopilotFull } from "./CanvasForCopilot";

// Each <Composition> is an entry in the Remotion Studio sidebar.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* The main hackathon video: animation + real screen-recording slots. */}
      <Composition
        id="CanvasForCopilotFull"
        component={CanvasForCopilotFull}
        durationInFrames={3090}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* A shorter, animation-only cut (no demo clips). */}
      <Composition
        id="CanvasForCopilot"
        component={CanvasForCopilot}
        durationInFrames={1800}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
