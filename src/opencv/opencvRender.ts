import cv, { Mat } from "opencv-ts";
import { HmtTracker } from "../types";

export function opencvRender(
  dst: Mat,
  tracks: HmtTracker[],
  cameraIdx: string
) {
  const renderTracks = [];

  if (tracks.length > 0) {
    for (let track of tracks) {
      const trackData = {
        hmtFeatureId: track.hmtFeatureId,
        bbox: track.bbox,
      };
      renderTracks.push(trackData);
    }
  }

  renderTracks.map((t) => {
    const pt1 = new cv.Point((t.bbox[0] / 512) * 640, (t.bbox[1] / 512) * 480);
    const pt2 = new cv.Point((t.bbox[2] / 512) * 640, (t.bbox[3] / 512) * 480);
    const centerPoint = new cv.Point(
      (t.bbox[0] / 512) * 640 + 20,
      (t.bbox[1] / 512) * 480 + 20
    );
    const color = new cv.Scalar(0, 0, 255);
    const red = new cv.Scalar(255, 0, 0);
    const fontFace = cv.FONT_HERSHEY_SIMPLEX;
    cv.rectangle(dst, pt1, pt2, color, 2, cv.LINE_8, 0);
    cv.putText(
      dst,
      t.hmtFeatureId.slice(-6),
      centerPoint,
      fontFace,
      0.8,
      red,
      1
    );
  });

  cv.imshow(`canvas${cameraIdx}`, dst);
}
